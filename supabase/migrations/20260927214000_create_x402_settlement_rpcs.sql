alter table patopay.payment_requests
  drop constraint if exists payment_requests_status_check;

alter table patopay.payment_requests
  add constraint payment_requests_status_check
  check (status in ('pending_approval', 'approved', 'processing', 'paid', 'failed', 'rejected', 'expired', 'cancelled', 'blocked'));

alter table patopay.payment_attempts
  add column if not exists payment_requirements jsonb,
  add column if not exists payment_payload_hash text,
  add column if not exists last_checked_at timestamptz;

alter table patopay.payment_attempts
  drop constraint if exists payment_attempts_requirements_check,
  drop constraint if exists payment_attempts_payload_hash_check;

alter table patopay.payment_attempts
  add constraint payment_attempts_requirements_check
  check ((mode = 'stellar' and payment_requirements is not null) or (mode = 'mock' and payment_requirements is null)),
  add constraint payment_attempts_payload_hash_check
  check (payment_payload_hash is null or payment_payload_hash ~ '^[0-9a-f]{64}$');

create or replace function patopay.prepare_payment_attempt(
  p_request_id uuid,
  p_expected_version integer,
  p_attempt_id uuid,
  p_payment_requirements jsonb,
  p_preparation_expires_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = patopay, public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_request patopay.payment_requests%rowtype;
  v_source patopay.wallets%rowtype;
  v_destination patopay.wallets%rowtype;
  v_asset patopay.assets%rowtype;
  v_accept jsonb;
  v_attempt_number integer;
  v_requirements_hash text;
  v_response jsonb;
  v_previous patopay.idempotency_keys%rowtype;
  v_inserted integer;
begin
  if v_actor is null then raise exception 'authenticated actor required' using errcode = '28000'; end if;
  if p_request_id is null or p_attempt_id is null then raise exception 'request and attempt ids are required' using errcode = '22023'; end if;
  if p_expected_version is null or p_expected_version < 1 then raise exception 'expected version is invalid' using errcode = '22023'; end if;
  if p_payment_requirements is null or jsonb_typeof(p_payment_requirements) <> 'object' then raise exception 'payment requirements must be an object' using errcode = '22023'; end if;
  if p_preparation_expires_at is null or p_preparation_expires_at < now() + interval '15 seconds' or p_preparation_expires_at > now() + interval '5 minutes' then
    raise exception 'payment preparation expiry is outside the supported window' using errcode = '22023';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 128 then raise exception 'idempotency key is required' using errcode = '22023'; end if;

  v_requirements_hash := encode(extensions.digest(convert_to(p_payment_requirements::text, 'utf8'), 'sha256'), 'hex');
  insert into patopay.idempotency_keys(actor_id, method, path, key, request_hash)
  values (v_actor, 'POST', '/payment-requests/prepare', p_idempotency_key,
          encode(extensions.digest(convert_to(concat_ws('|', p_request_id::text, p_expected_version::text, p_attempt_id::text, v_requirements_hash), 'utf8'), 'sha256'), 'hex'))
  on conflict (actor_id, method, path, key) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    select * into strict v_previous from patopay.idempotency_keys
     where actor_id = v_actor and method = 'POST' and path = '/payment-requests/prepare' and key = p_idempotency_key;
    if v_previous.request_hash <> encode(extensions.digest(convert_to(concat_ws('|', p_request_id::text, p_expected_version::text, p_attempt_id::text, v_requirements_hash), 'utf8'), 'sha256'), 'hex') then
      raise exception 'idempotency key payload conflict' using errcode = '23505';
    end if;
    if v_previous.response_body is null then raise exception 'payment preparation is still in progress' using errcode = 'PT409'; end if;
    return v_previous.response_body;
  end if;

  select * into v_request from patopay.payment_requests where id = p_request_id for update;
  if not found then raise exception 'payment request not found' using errcode = 'P0002'; end if;
  if v_request.payer_id <> v_actor then raise exception 'only the payer can prepare payment' using errcode = '42501'; end if;
  if v_request.status <> 'approved' then raise exception 'payment request is not approved' using errcode = 'PT409'; end if;
  if v_request.version <> p_expected_version then raise exception 'payment request version is stale' using errcode = 'PT409'; end if;

  select * into v_source from patopay.wallets where id = v_request.source_wallet_id;
  select * into v_destination from patopay.wallets where id = v_request.destination_wallet_id;
  if v_source.status <> 'active' or v_source.provider <> 'stellar' or v_source.network <> 'testnet' then raise exception 'source Stellar wallet is not active' using errcode = '22023'; end if;
  if v_destination.status <> 'active' or v_destination.provider <> 'stellar' or v_destination.network <> 'testnet' then raise exception 'destination Stellar wallet is not active' using errcode = '22023'; end if;
  select * into v_asset from patopay.assets where id = v_request.asset_id and enabled and network = 'testnet';
  if not found then raise exception 'payment asset is not enabled on Testnet' using errcode = '22023'; end if;

  v_accept := p_payment_requirements->'accepts'->0;
  if p_payment_requirements->>'x402Version' <> '2' or jsonb_typeof(p_payment_requirements->'accepts') <> 'array' or v_accept is null then raise exception 'x402 v2 requirements are invalid' using errcode = '22023'; end if;
  if v_accept->>'scheme' <> 'exact' or v_accept->>'network' <> 'stellar:testnet' or v_accept->>'amount' <> v_request.amount_minor::text or v_accept->>'asset' <> v_asset.contract_address or v_accept->>'payTo' <> v_destination.contract_address then
    raise exception 'x402 requirements do not match the approved payment' using errcode = '22023';
  end if;
  if exists (select 1 from patopay.payment_attempts where payment_request_id = p_request_id and status in ('prepared','submitting','submitted','unknown')) then
    raise exception 'payment request already has an active attempt' using errcode = 'PT409';
  end if;

  select coalesce(max(attempt_number), 0) + 1 into v_attempt_number from patopay.payment_attempts where payment_request_id = p_request_id;
  insert into patopay.payment_attempts(
    id, payment_request_id, attempt_number, executor, mode, status,
    preparation_hash, preparation_expires_at, payment_requirements
  ) values (
    p_attempt_id, p_request_id, v_attempt_number, 'stellar', 'stellar', 'prepared',
    v_requirements_hash, p_preparation_expires_at, p_payment_requirements
  );
  update patopay.payment_requests set status = 'processing', version = version + 1, updated_at = now() where id = p_request_id returning * into v_request;
  v_response := jsonb_build_object(
    'attempt_id', p_attempt_id, 'payment_request_id', p_request_id, 'attempt_number', v_attempt_number,
    'status', 'prepared', 'payment_requirements', p_payment_requirements,
    'preparation_hash', v_requirements_hash, 'preparation_expires_at', p_preparation_expires_at,
    'source_wallet', v_source.contract_address, 'destination_wallet', v_destination.contract_address,
    'asset', v_asset.contract_address, 'amount_minor', v_request.amount_minor::text, 'request_version', v_request.version
  );
  update patopay.idempotency_keys set response_status = 201, response_body = v_response
   where actor_id = v_actor and method = 'POST' and path = '/payment-requests/prepare' and key = p_idempotency_key;
  return v_response;
end;
$$;

create or replace function patopay.consume_payment_attempt(p_attempt_id uuid, p_payment_payload_hash text)
returns jsonb language plpgsql security definer set search_path = patopay, public, extensions as $$
declare v_attempt patopay.payment_attempts%rowtype; v_response jsonb;
begin
  if auth.uid() is null then raise exception 'authenticated actor required' using errcode = '28000'; end if;
  if p_payment_payload_hash is null or p_payment_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'payment payload hash is invalid' using errcode = '22023'; end if;
  select a.* into v_attempt from patopay.payment_attempts a join patopay.payment_requests r on r.id = a.payment_request_id where a.id = p_attempt_id and r.payer_id = auth.uid() for update;
  if not found then raise exception 'payment attempt not found' using errcode = 'P0002'; end if;
  if v_attempt.status = 'prepared' then
    update patopay.payment_attempts set status = 'submitting', payment_payload_hash = p_payment_payload_hash, consumed_at = now(), updated_at = now() where id = p_attempt_id returning * into v_attempt;
  elsif v_attempt.payment_payload_hash is distinct from p_payment_payload_hash then
    raise exception 'payment payload does not match consumed attempt' using errcode = 'PT409';
  elsif v_attempt.status not in ('submitting','submitted','confirmed') then
    raise exception 'payment attempt cannot be consumed from its current state' using errcode = 'PT409';
  end if;
  v_response := jsonb_build_object('attempt_id', v_attempt.id, 'status', v_attempt.status, 'payment_request_id', v_attempt.payment_request_id);
  return v_response;
end;
$$;

create or replace function patopay.record_payment_submission(p_attempt_id uuid, p_tx_hash text, p_provider_reference text)
returns jsonb language plpgsql security definer set search_path = patopay, public, extensions as $$
declare v_attempt patopay.payment_attempts%rowtype;
begin
  if auth.uid() is null then raise exception 'authenticated actor required' using errcode = '28000'; end if;
  if p_tx_hash is null or p_tx_hash !~ '^[0-9a-fA-F]{64}$' then raise exception 'transaction hash is invalid' using errcode = '22023'; end if;
  select a.* into v_attempt from patopay.payment_attempts a join patopay.payment_requests r on r.id = a.payment_request_id where a.id = p_attempt_id and r.payer_id = auth.uid() for update;
  if not found then raise exception 'payment attempt not found' using errcode = 'P0002'; end if;
  if v_attempt.status = 'confirmed' then return jsonb_build_object('attempt_id', v_attempt.id, 'status', 'confirmed', 'tx_hash', v_attempt.tx_hash); end if;
  if v_attempt.status not in ('submitting','submitted','unknown') then raise exception 'payment attempt cannot be submitted from its current state' using errcode = 'PT409'; end if;
  update patopay.payment_attempts set status = 'submitted', tx_hash = lower(p_tx_hash), provider_reference = p_provider_reference, updated_at = now() where id = p_attempt_id returning * into v_attempt;
  return jsonb_build_object('attempt_id', v_attempt.id, 'status', v_attempt.status, 'tx_hash', v_attempt.tx_hash);
end;
$$;

create or replace function patopay.record_payment_confirmation(p_attempt_id uuid, p_tx_hash text, p_ledger bigint, p_receipt jsonb)
returns jsonb language plpgsql security definer set search_path = patopay, public, extensions as $$
declare v_attempt patopay.payment_attempts%rowtype;
begin
  if auth.uid() is null then raise exception 'authenticated actor required' using errcode = '28000'; end if;
  if p_tx_hash is null or p_tx_hash !~ '^[0-9a-fA-F]{64}$' or p_ledger is null or p_ledger < 1 then raise exception 'confirmation evidence is invalid' using errcode = '22023'; end if;
  select a.* into v_attempt from patopay.payment_attempts a join patopay.payment_requests r on r.id = a.payment_request_id where a.id = p_attempt_id and r.payer_id = auth.uid() for update;
  if not found then raise exception 'payment attempt not found' using errcode = 'P0002'; end if;
  if v_attempt.status = 'confirmed' then return jsonb_build_object('attempt_id', v_attempt.id, 'status', 'confirmed', 'tx_hash', v_attempt.tx_hash, 'ledger', v_attempt.ledger); end if;
  if v_attempt.status not in ('submitted','unknown') then raise exception 'payment attempt cannot be confirmed from its current state' using errcode = 'PT409'; end if;
  update patopay.payment_attempts set status = 'confirmed', tx_hash = lower(p_tx_hash), ledger = p_ledger, receipt = coalesce(p_receipt, '{}'::jsonb), last_checked_at = now(), updated_at = now() where id = p_attempt_id returning * into v_attempt;
  update patopay.payment_requests set status = 'paid', updated_at = now() where id = v_attempt.payment_request_id;
  return jsonb_build_object('attempt_id', v_attempt.id, 'status', 'confirmed', 'tx_hash', v_attempt.tx_hash, 'ledger', v_attempt.ledger);
end;
$$;

create or replace function patopay.record_payment_failure(p_attempt_id uuid, p_error_code text)
returns jsonb language plpgsql security definer set search_path = patopay, public, extensions as $$
declare v_attempt patopay.payment_attempts%rowtype; v_request patopay.payment_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'authenticated actor required' using errcode = '28000'; end if;
  select a.* into v_attempt from patopay.payment_attempts a join patopay.payment_requests r on r.id = a.payment_request_id where a.id = p_attempt_id and r.payer_id = auth.uid() for update;
  if not found then raise exception 'payment attempt not found' using errcode = 'P0002'; end if;
  if v_attempt.status in ('confirmed','failed') then return jsonb_build_object('attempt_id', v_attempt.id, 'status', v_attempt.status, 'error_code', v_attempt.error_code); end if;
  update patopay.payment_attempts set status = 'failed', error_code = left(coalesce(p_error_code, 'payment_failed'), 120), last_checked_at = now(), updated_at = now() where id = p_attempt_id returning * into v_attempt;
  select * into v_request from patopay.payment_requests where id = v_attempt.payment_request_id;
  if not exists (select 1 from patopay.payment_attempts where payment_request_id = v_attempt.payment_request_id and status in ('prepared','submitting','submitted','unknown')) then
    update patopay.payment_requests set status = 'failed', updated_at = now() where id = v_attempt.payment_request_id;
  end if;
  return jsonb_build_object('attempt_id', v_attempt.id, 'status', v_attempt.status, 'error_code', v_attempt.error_code);
end;
$$;

create or replace function patopay.record_payment_unknown(p_attempt_id uuid, p_error_code text)
returns jsonb language plpgsql security definer set search_path = patopay, public, extensions as $$
declare v_attempt patopay.payment_attempts%rowtype;
begin
  if auth.uid() is null then raise exception 'authenticated actor required' using errcode = '28000'; end if;
  select a.* into v_attempt from patopay.payment_attempts a join patopay.payment_requests r on r.id = a.payment_request_id where a.id = p_attempt_id and r.payer_id = auth.uid() for update;
  if not found then raise exception 'payment attempt not found' using errcode = 'P0002'; end if;
  if v_attempt.status in ('confirmed','failed') then return jsonb_build_object('attempt_id', v_attempt.id, 'status', v_attempt.status, 'error_code', v_attempt.error_code); end if;
  if v_attempt.status not in ('submitting','submitted','unknown') then raise exception 'payment attempt cannot become unknown from its current state' using errcode = 'PT409'; end if;
  update patopay.payment_attempts set status = 'unknown', error_code = left(coalesce(p_error_code, 'provider_timeout'), 120), last_checked_at = now(), updated_at = now() where id = p_attempt_id returning * into v_attempt;
  return jsonb_build_object('attempt_id', v_attempt.id, 'status', v_attempt.status, 'error_code', v_attempt.error_code);
end;
$$;

revoke all on function patopay.prepare_payment_attempt(uuid, integer, uuid, jsonb, timestamptz, text) from public, anon;
revoke all on function patopay.consume_payment_attempt(uuid, text) from public, anon;
revoke all on function patopay.record_payment_submission(uuid, text, text) from public, anon;
revoke all on function patopay.record_payment_confirmation(uuid, text, bigint, jsonb) from public, anon;
revoke all on function patopay.record_payment_failure(uuid, text) from public, anon;
revoke all on function patopay.record_payment_unknown(uuid, text) from public, anon;
grant execute on function patopay.prepare_payment_attempt(uuid, integer, uuid, jsonb, timestamptz, text) to authenticated;
grant execute on function patopay.consume_payment_attempt(uuid, text) to authenticated;
grant execute on function patopay.record_payment_submission(uuid, text, text) to authenticated;
grant execute on function patopay.record_payment_confirmation(uuid, text, bigint, jsonb) to authenticated;
grant execute on function patopay.record_payment_failure(uuid, text) to authenticated;
grant execute on function patopay.record_payment_unknown(uuid, text) to authenticated;
