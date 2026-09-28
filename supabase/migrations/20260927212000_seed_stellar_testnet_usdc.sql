insert into patopay.assets (network, contract_address, code, decimals, enabled)
values (
  'testnet',
  'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  'USDC',
  7,
  true
)
on conflict (network, contract_address)
do update set
  code = excluded.code,
  decimals = excluded.decimals,
  enabled = true;
