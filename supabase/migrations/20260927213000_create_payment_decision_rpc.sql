create or replace function patopay.decide_payment_request(
  p_request_id uuid,
  p_action text,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = patopay, public
as $$
declare
  v_actor uuid := auth.uid();
  v_request patopay.payment_requests%rowtype;
  v_previous patopay.idempotency_keys%rowtype;
  v_request_hash text;
  v_response jsonb;
  v_inserted integer;
begin
  if v_actor is null then
    raise exception 'authenticated actor required' using errcode = '28000';
  end if;
  if p_request_id is null then
    raise exception 'payment request id is required' using errcode = '22023';
  end if;
  if p_action is null or p_action not in ('approve', 'reject') then
    raise exception 'payment decision action is invalid' using errcode = '22023';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception 'expected version is invalid' using errcode = '22023';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 128 then
    raise exception 'idempotency key is required' using errcode = '22023';
  end if;

  v_request_hash := encode(
    digest(
      concat_ws('|', p_request_id::text, p_action, p_expected_version::text),
      'sha256'
    ),
    'hex'
  );

  insert into patopay.idempotency_keys (
    actor_id, method, path, key, request_hash
  )
  values (
    v_actor, 'POST', '/payment-requests/decision', p_idempotency_key, v_request_hash
  )
  on conflict (actor_id, method, path, key) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select *
      into strict v_previous
      from patopay.idempotency_keys
     where actor_id = v_actor
       and method = 'POST'
       and path = '/payment-requests/decision'
       and key = p_idempotency_key;
    if v_previous.request_hash <> v_request_hash then
      raise exception 'idempotency key payload conflict' using errcode = '23505';
    end if;
    if v_previous.response_body is null then
      raise exception 'payment decision is still in progress' using errcode = 'PT409';
    end if;
    return v_previous.response_body;
  end if;

  select *
    into v_request
    from patopay.payment_requests
   where id = p_request_id
   for update;
  if not found then
    raise exception 'payment request not found' using errcode = 'P0002';
  end if;
  if v_request.payer_id <> v_actor then
    raise exception 'only the payer can decide a payment request' using errcode = '42501';
  end if;
  if v_request.version <> p_expected_version then
    raise exception 'payment request version is stale' using errcode = 'PT409';
  end if;
  if v_request.status <> 'pending_approval' then
    raise exception 'payment request is not pending approval' using errcode = 'PT409';
  end if;

  insert into patopay.policy_decisions (
    payment_request_id, actor_id, source, action, outcome, reason_code, policy_snapshot
  )
  values (
    v_request.id,
    v_actor,
    'manual',
    p_action,
    case p_action when 'approve' then 'approved' else 'rejected' end,
    case p_action when 'approve' then 'manual_approved' else 'manual_rejected' end,
    v_request.policy_snapshot
  );

  update patopay.payment_requests
     set status = case p_action when 'approve' then 'approved' else 'rejected' end,
         version = version + 1,
         updated_at = now()
   where id = v_request.id
  returning * into v_request;

  v_response := jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'version', v_request.version,
    'next_action', case
      when v_request.status = 'approved' then 'prepare_sign_and_execute'
      else null
    end
  );

  update patopay.idempotency_keys
     set response_status = 200,
         response_body = v_response
   where actor_id = v_actor
     and method = 'POST'
     and path = '/payment-requests/decision'
     and key = p_idempotency_key;

  return v_response;
end;
$$;

revoke all on function patopay.decide_payment_request(uuid, text, integer, text)
  from public, anon;
grant execute on function patopay.decide_payment_request(uuid, text, integer, text)
  to authenticated;
