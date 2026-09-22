create or replace function patopay.create_payment_request(
  p_payer_profile_id uuid,
  p_amount_minor bigint,
  p_asset_id uuid,
  p_memo text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = patopay, public
as $$
declare
  v_requester uuid := auth.uid();
  v_source_wallet uuid;
  v_destination_wallet uuid;
  v_policy patopay.payment_policy_versions;
  v_request patopay.payment_requests;
  v_outcome text;
  v_reason text;
  v_status text;
  v_next_action text;
  v_daily_minor bigint;
  v_request_hash text;
  v_previous patopay.idempotency_keys;
  v_response jsonb;
begin
  if v_requester is null then
    raise exception 'authenticated actor required' using errcode = '28000';
  end if;
  if p_payer_profile_id = v_requester then
    raise exception 'requester and payer must differ' using errcode = '22023';
  end if;
  if p_amount_minor < 1 or p_amount_minor > 9000000000000000 then
    raise exception 'amount is outside supported range' using errcode = '22023';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 128 then
    raise exception 'idempotency key is required' using errcode = '22023';
  end if;

  v_request_hash := encode(
    digest(
      concat_ws('|', p_payer_profile_id::text, p_amount_minor::text, p_asset_id::text, coalesce(p_memo, '')),
      'sha256'
    ),
    'hex'
  );
  select * into v_previous
    from patopay.idempotency_keys
   where actor_id = v_requester
     and method = 'POST'
     and path = '/payment-requests'
     and key = p_idempotency_key;
  if found then
    if v_previous.request_hash <> v_request_hash then
      raise exception 'idempotency key payload conflict' using errcode = '23505';
    end if;
    return v_previous.response_body;
  end if;

  select w.id into v_source_wallet
    from patopay.wallets w
   where w.user_id = p_payer_profile_id and w.status = 'active'
   order by w.is_default desc, w.created_at asc
   limit 1;
  select w.id into v_destination_wallet
    from patopay.wallets w
   where w.user_id = v_requester and w.status = 'active'
   order by w.is_default desc, w.created_at asc
   limit 1;
  if v_source_wallet is null or v_destination_wallet is null then
    raise exception 'active wallets are required' using errcode = '22023';
  end if;

  select * into v_policy
    from patopay.payment_policy_versions
   where user_id = p_payer_profile_id
   order by version desc
   limit 1;
  if not found then
    raise exception 'payment policy not found' using errcode = '22023';
  end if;
  if not exists (
    select 1 from patopay.policy_allowed_assets aa
    where aa.policy_version_id = v_policy.id and aa.asset_id = p_asset_id
  ) then
    v_outcome := 'blocked';
    v_reason := 'asset_not_allowed';
  elsif v_policy.recipient_mode = 'allowlist' and not exists (
    select 1 from patopay.policy_allowed_recipients ar
    where ar.policy_version_id = v_policy.id and ar.recipient_profile_id = v_requester
  ) then
    v_outcome := 'blocked';
    v_reason := 'recipient_not_allowed';
  else
    select coalesce(sum(pa.amount_minor), 0) into v_daily_minor
      from patopay.payment_attempts pa
      join patopay.payment_requests pr on pr.id = pa.payment_request_id
     where pr.payer_id = p_payer_profile_id
       and pa.status = 'confirmed'
       and pa.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
    if v_daily_minor + p_amount_minor > v_policy.daily_limit_minor then
      v_outcome := 'blocked';
      v_reason := 'daily_limit_exceeded';
    elsif p_amount_minor <= v_policy.auto_pay_limit_minor then
      v_outcome := 'eligible_for_auto_approval';
      v_reason := 'within_auto_pay_limit';
    elsif p_amount_minor <= v_policy.approval_limit_minor then
      v_outcome := 'approval_required';
      v_reason := 'manual_approval_required';
    else
      v_outcome := 'blocked';
      v_reason := 'approval_limit_exceeded';
    end if;
  end if;

  if v_outcome = 'eligible_for_auto_approval' then
    v_status := 'approved';
    v_next_action := 'prepare_sign_and_execute';
  elsif v_outcome = 'approval_required' then
    v_status := 'pending_approval';
    v_next_action := 'approve_or_reject';
  else
    v_status := 'blocked';
    v_next_action := null;
  end if;

  insert into patopay.payment_requests (
    requester_id, payer_id, source_wallet_id, destination_wallet_id, asset_id,
    amount_minor, memo, policy_version_id, policy_snapshot, status
  )
  values (
    v_requester, p_payer_profile_id, v_source_wallet, v_destination_wallet, p_asset_id,
    p_amount_minor, p_memo, v_policy.id,
    jsonb_build_object(
      'version', v_policy.version,
      'auto_pay_limit_minor', v_policy.auto_pay_limit_minor,
      'approval_limit_minor', v_policy.approval_limit_minor,
      'daily_limit_minor', v_policy.daily_limit_minor,
      'recipient_mode', v_policy.recipient_mode,
      'outcome', v_outcome,
      'reason_code', v_reason
    ),
    v_status
  )
  returning * into v_request;

  insert into patopay.policy_decisions (
    payment_request_id, actor_id, source, action, outcome, reason_code, policy_snapshot
  )
  values (
    v_request.id, null, 'engine',
    case when v_outcome = 'eligible_for_auto_approval' then 'approve' else 'block' end,
    v_outcome, v_reason, v_request.policy_snapshot
  );

  v_response := jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'policy_outcome', v_outcome,
    'reason_code', v_reason,
    'next_action', v_next_action,
    'amount_minor', p_amount_minor::text,
    'asset_id', p_asset_id
  );
  insert into patopay.idempotency_keys (
    actor_id, method, path, key, request_hash, response_status, response_body
  ) values (
    v_requester, 'POST', '/payment-requests', p_idempotency_key,
    v_request_hash, 201, v_response
  );
  return v_response;
end;
$$;

grant execute on function patopay.create_payment_request(uuid, bigint, uuid, text, text) to authenticated;
