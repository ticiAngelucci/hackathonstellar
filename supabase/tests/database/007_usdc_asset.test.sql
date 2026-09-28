begin;
set local role postgres;
set local search_path = public, extensions, patopay;
select plan(4);

select is(
  (
    select count(*)
    from patopay.assets
    where network = 'testnet' and code = 'USDC' and enabled
  ),
  1::bigint,
  'exactly one Testnet USDC asset is enabled'
);
select is(
  (
    select max(code)
    from patopay.assets
    where network = 'testnet'
      and contract_address = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'
      and enabled
  ),
  'USDC'::text,
  'canonical Testnet asset uses the USDC code'
);
select is(
  (
    select max(decimals)
    from patopay.assets
    where network = 'testnet'
      and contract_address = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'
      and enabled
  ),
  7::smallint,
  'canonical Testnet USDC uses seven decimals'
);
select is(
  (
    select max(contract_address)
    from patopay.assets
    where network = 'testnet' and code = 'USDC' and enabled
  ),
  'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'::text,
  'enabled Testnet USDC uses the canonical contract ID'
);

select * from finish();
rollback;
