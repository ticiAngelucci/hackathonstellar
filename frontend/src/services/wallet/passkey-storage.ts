import AsyncStorage from '@react-native-async-storage/async-storage';
import type {StorageAdapter,StoredPasskey} from 'passkey-kit';

const PASSKEY_RECORDS_KEY='patopay:wallet:passkey-public-records:v1';

type SerializedPasskey=Omit<StoredPasskey,'publicKey'>&{publicKey:number[]};

function serialize(record:StoredPasskey):SerializedPasskey{
  return {...record,publicKey:Array.from(record.publicKey)};
}

function deserialize(record:SerializedPasskey):StoredPasskey{
  return {...record,publicKey:new Uint8Array(record.publicKey)};
}

async function readAll(){
  const raw=await AsyncStorage.getItem(PASSKEY_RECORDS_KEY);
  if(!raw)return [];
  try{
    return (JSON.parse(raw) as SerializedPasskey[]).map(deserialize);
  }catch{
    return [];
  }
}

async function writeAll(records:StoredPasskey[]){
  await AsyncStorage.setItem(PASSKEY_RECORDS_KEY,JSON.stringify(records.map(serialize)));
}

/** Stores only public WebAuthn/wallet association data. No private key exists here. */
export class AsyncStoragePasskeyAdapter implements StorageAdapter{
  async save(passkey:StoredPasskey){
    const records=await readAll();
    const next=records.filter(record=>record.keyId!==passkey.keyId);
    next.push(passkey);
    await writeAll(next);
  }

  async get(keyId:string){
    return (await readAll()).find(record=>record.keyId===keyId)??null;
  }

  async getByContract(contractId:string){
    return (await readAll()).filter(record=>record.contractId===contractId);
  }

  getAll(){
    return readAll();
  }

  async delete(keyId:string){
    await writeAll((await readAll()).filter(record=>record.keyId!==keyId));
  }

  async update(keyId:string,updates:Partial<Omit<StoredPasskey,'keyId'|'publicKey'>>){
    const records=(await readAll()).map(record=>record.keyId===keyId?{...record,...updates}:record);
    await writeAll(records);
  }

  async clear(){
    await AsyncStorage.removeItem(PASSKEY_RECORDS_KEY);
  }
}
