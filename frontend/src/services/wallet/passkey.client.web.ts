import type {PasskeyKitConfig} from 'passkey-kit';

type WebAuthnClient=NonNullable<PasskeyKitConfig['WebAuthn']>;

export async function isNativePasskeySupported(){
  return Boolean(globalThis.PublicKeyCredential&&globalThis.isSecureContext);
}

/** Browser passkeys are handled by passkey-kit's official WebAuthn client. */
export async function getPasskeyClient():Promise<WebAuthnClient|undefined>{
  return undefined;
}
