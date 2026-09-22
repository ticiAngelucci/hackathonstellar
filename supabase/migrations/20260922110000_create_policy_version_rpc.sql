create or replace function patopay.replace_payment_policy(
  p_auto_pay_limit_minor bigint,
  p_approval_limit_minor bigint,
  p_daily_limit_minor bigint,
  p_recipient_mode text,
  p_allowed_recipient_ids uuid[],
  p_allowed_asset_ids uuid[],
  p_expected_version integer
)
returns jsonb
language plpgsql
security invoker
set search_path = patopay, public
as $$
declare
  v_actor uuid := auth.uid();
  v_current_version integer;
  v_policy patopay.payment_policy_versions;
begin
  if v_actor is null then
    raise exception 'authenticated actor required' using errcode = '28000';
  end if;
  if p_auto_pay_limit_minor < 0
     or p_approval_limit_minor < p_auto_pay_limit_minor
     or p_daily_limit_minor < 1
     or p_allowed_asset_ids is null
     or cardinality(p_allowed_asset_ids) < 1 then
    raise exception 'policy thresholds or assets are invalid' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(coalesce(p_allowed_recipient_ids, '{}')) id where id = v_actor) then
    raise exception 'self recipient is not allowed' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(p_allowed_asset_ids) requested(id)
    left join patopay.assets a on a.id = requested.id and a.enabled
    where a.id is null
  ) then
    raise exception 'policy contains disabled asset' using errcode = '22023';
  end if;

  select coalesce(max(version), 0)
    into v_current_version
    from patopay.payment_policy_versions
   where user_id = v_actor;
  if v_current_version <> p_expected_version then
    raise exception 'policy version is stale' using errcode = '40001';
  end if;

  insert into patopay.payment_policy_versions (
    user_id, version, auto_pay_limit_minor, approval_limit_minor,
    daily_limit_minor, recipient_mode
  )
  values (
    v_actor, v_current_version + 1, p_auto_pay_limit_minor,
    p_approval_limit_minor, p_daily_limit_minor, p_recipient_mode
  )
  returning * into v_policy;

  insert into patopay.policy_allowed_recipients (policy_version_id, recipient_profile_id)
  select v_policy.id, id from unnest(coalesce(p_allowed_recipient_ids, '{}')) id;
  insert into patopay.policy_allowed_assets (policy_version_id, asset_id)
  select v_policy.id, id from unnest(p_allowed_asset_ids) id;

  return jsonb_build_object(
    'id', v_policy.id,
    'version', v_policy.version,
    'auto_pay_limit_minor', v_policy.auto_pay_limit_minor,
    'approval_limit_minor', v_policy.approval_limit_minor,
    'daily_limit_minor', v_policy.daily_limit_minor,
    'recipient_mode', v_policy.recipient_mode,
    'allowed_recipient_ids', coalesce(p_allowed_recipient_ids, '{}'),
    'allowed_asset_ids', p_allowed_asset_ids
  );
end;
$$;

grant execute on function patopay.replace_payment_policy(bigint, bigint, bigint, text, uuid[], uuid[], integer) to authenticated;
