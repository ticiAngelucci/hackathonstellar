export async function ensureStellarRuntime(){
  if(!globalThis.crypto?.getRandomValues||!globalThis.crypto?.subtle){
    throw new Error('Stellar necesita ejecutarse en un origen HTTPS con Web Crypto disponible.');
  }
}
