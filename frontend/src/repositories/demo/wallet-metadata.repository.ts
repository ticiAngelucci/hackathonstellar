import {AppError} from '@/lib/errors';
import type {WalletMetadataRepository} from '@/repositories/contracts';

export const demoWalletMetadataRepository:WalletMetadataRepository={
  async list(){return [];},
  async get(){throw new AppError('La metadata remota de wallet no se usa en demo.','unsupported');},
  async create(){throw new AppError('La metadata remota de wallet no se usa en demo.','unsupported');},
  async disable(){throw new AppError('La metadata remota de wallet no se usa en demo.','unsupported');},
  async balance(){throw new AppError('El saldo remoto de wallet no se usa en demo.','unsupported');},
};
