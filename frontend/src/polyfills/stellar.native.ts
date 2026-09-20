let installPromise:Promise<void>|null=null;

/**
 * Installs the primitives required by the Stellar SDK and passkey-kit in
 * React Native. It is deliberately lazy so mock mode can still run in Expo Go.
 */
export function ensureStellarRuntime(){
  if(!installPromise){
    installPromise=(async()=>{
      await import('react-native-get-random-values');
      const {install}=await import('react-native-quick-crypto');
      install();
    })();
  }

  return installPromise;
}
