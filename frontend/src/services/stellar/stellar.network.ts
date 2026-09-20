import {Asset,Networks} from '@stellar/stellar-sdk';

export type StellarNetwork='testnet';

const TESTNET_HORIZON_URL='https://horizon-testnet.stellar.org';
const TESTNET_RPC_URL='https://soroban-testnet.stellar.org';
const TESTNET_FRIENDBOT_URL='https://friendbot.stellar.org';
const TESTNET_EXPLORER_URL='https://stellar.expert/explorer/testnet';

// Canonical passkey-kit v0.19.1 smart-wallet deployment for Protocol 27.
// It remains overrideable so upgrades never require a source-code change.
const DEFAULT_WALLET_WASM_HASH='97ce047884106b1c6c3bb40b8973cc48db1c4dad95c9e20462bf2c701daa764e';

function valueOrDefault(value:string|undefined,fallback:string){
  const normalized=value?.trim();
  return normalized||fallback;
}

function commaSeparated(value:string|undefined){
  return value?.split(',').map(item=>item.trim()).filter(Boolean)??[];
}

const configuredNetwork=process.env.EXPO_PUBLIC_STELLAR_NETWORK?.trim().toLowerCase();

if(configuredNetwork&&configuredNetwork!=='testnet'){
  throw new Error('Pato Pay sólo habilita Stellar Testnet en esta etapa.');
}

export const stellarNetwork={
  network:'testnet' as StellarNetwork,
  networkPassphrase:Networks.TESTNET,
  rpcUrl:valueOrDefault(process.env.EXPO_PUBLIC_STELLAR_RPC_URL,TESTNET_RPC_URL),
  horizonUrl:valueOrDefault(process.env.EXPO_PUBLIC_STELLAR_HORIZON_URL,TESTNET_HORIZON_URL),
  friendbotUrl:valueOrDefault(process.env.EXPO_PUBLIC_STELLAR_FRIENDBOT_URL,TESTNET_FRIENDBOT_URL),
  explorerUrl:valueOrDefault(process.env.EXPO_PUBLIC_STELLAR_EXPLORER_URL,TESTNET_EXPLORER_URL),
  walletWasmHash:valueOrDefault(process.env.EXPO_PUBLIC_STELLAR_WALLET_WASM_HASH,DEFAULT_WALLET_WASM_HASH),
  relayerUrl:process.env.EXPO_PUBLIC_STELLAR_RELAYER_URL?.trim()??'',
  rpId:process.env.EXPO_PUBLIC_PASSKEY_RP_ID?.trim()??'',
  allowedOrigins:commaSeparated(process.env.EXPO_PUBLIC_PASSKEY_ALLOWED_ORIGINS),
  assetCode:valueOrDefault(process.env.EXPO_PUBLIC_STELLAR_ASSET_CODE,'XLM'),
  assetContractId:process.env.EXPO_PUBLIC_STELLAR_ASSET_CONTRACT_ID?.trim()
    ||Asset.native().contractId(Networks.TESTNET),
  assetDecimals:Number(process.env.EXPO_PUBLIC_STELLAR_ASSET_DECIMALS??'7'),
};

export function assertStellarConfiguration(options:{passkey?:boolean;relayer?:boolean}={}){
  if(!/^https:\/\//.test(stellarNetwork.rpcUrl)||!/^https:\/\//.test(stellarNetwork.horizonUrl)){
    throw new Error('Las URLs de Stellar deben usar HTTPS.');
  }
  if(!/^[0-9a-f]{64}$/i.test(stellarNetwork.walletWasmHash)){
    throw new Error('EXPO_PUBLIC_STELLAR_WALLET_WASM_HASH no es válido.');
  }
  if(!Number.isInteger(stellarNetwork.assetDecimals)||stellarNetwork.assetDecimals<0||stellarNetwork.assetDecimals>18){
    throw new Error('EXPO_PUBLIC_STELLAR_ASSET_DECIMALS no es válido.');
  }
  if(options.passkey&&(!stellarNetwork.rpId||stellarNetwork.allowedOrigins.length===0)){
    throw new Error('Configurá EXPO_PUBLIC_PASSKEY_RP_ID y EXPO_PUBLIC_PASSKEY_ALLOWED_ORIGINS para crear una passkey real.');
  }
  if(options.relayer&&!stellarNetwork.relayerUrl){
    throw new Error('Configurá EXPO_PUBLIC_STELLAR_RELAYER_URL para desplegar y enviar la smart wallet.');
  }
}

export function transactionExplorerUrl(txHash:string){
  return `${stellarNetwork.explorerUrl}/tx/${encodeURIComponent(txHash)}`;
}
