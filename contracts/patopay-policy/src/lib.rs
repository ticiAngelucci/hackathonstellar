#![no_std]

use smart_wallet_interface::types::SignerKey;
use soroban_sdk::{
    auth::{Context, ContractContext},
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env, TryFromVal, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum PolicyError {
    NotAllowed = 1,
    NotInstalled = 2,
    NotConfigured = 3,
    InvalidConfig = 4,
    StaleRevision = 5,
    StillInstalled = 6,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PolicyConfig {
    pub asset: Address,
    pub auto_pay_limit: i128,
    pub daily_limit: i128,
    pub allowed_recipients: Vec<Address>,
    pub revision: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Allowance {
    pub window_start: u64,
    pub spent: i128,
}

const WINDOW_SECONDS: u64 = 24 * 60 * 60;
const MAX_ALLOWED_RECIPIENTS: u32 = 50;

#[contracttype]
#[derive(Clone)]
enum StorageKey {
    Installed(Address),
    Config(Address),
    Spend(Address),
}

#[contract]
pub struct PatopayPolicy;

#[contractimpl]
impl PatopayPolicy {
    pub fn install(env: Env, wallet: Address) {
        wallet.require_auth();
        env.storage()
            .persistent()
            .set(&StorageKey::Installed(wallet), &true);
    }

    pub fn uninstall(env: Env, wallet: Address) {
        wallet.require_auth();
        let installed_key = StorageKey::Installed(wallet.clone());
        if !env.storage().persistent().has(&installed_key) {
            panic_with_error!(&env, PolicyError::NotInstalled);
        }
        env.storage().persistent().remove(&installed_key);
        env.storage()
            .persistent()
            .remove(&StorageKey::Config(wallet.clone()));
        env.storage()
            .persistent()
            .remove(&StorageKey::Spend(wallet));
    }

    pub fn configure(env: Env, wallet: Address, config: PolicyConfig) {
        wallet.require_auth();
        if !env
            .storage()
            .persistent()
            .has(&StorageKey::Installed(wallet.clone()))
        {
            panic_with_error!(&env, PolicyError::NotInstalled);
        }
        if config.auto_pay_limit <= 0
            || config.daily_limit <= 0
            || config.auto_pay_limit > config.daily_limit
            || config.allowed_recipients.len() > MAX_ALLOWED_RECIPIENTS
        {
            panic_with_error!(&env, PolicyError::InvalidConfig);
        }
        let config_key = StorageKey::Config(wallet);
        if let Some(previous) = env
            .storage()
            .persistent()
            .get::<_, PolicyConfig>(&config_key)
        {
            if config.revision <= previous.revision {
                panic_with_error!(&env, PolicyError::StaleRevision);
            }
        } else if config.revision == 0 {
            panic_with_error!(&env, PolicyError::StaleRevision);
        }
        env.storage().persistent().set(&config_key, &config);
    }

    pub fn policy__(env: Env, source: Address, _signer: SignerKey, contexts: Vec<Context>) {
        source.require_auth();
        if !env
            .storage()
            .persistent()
            .has(&StorageKey::Installed(source.clone()))
        {
            panic_with_error!(&env, PolicyError::NotInstalled);
        }
        let config = env
            .storage()
            .persistent()
            .get::<_, PolicyConfig>(&StorageKey::Config(source.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, PolicyError::NotConfigured));

        let mut total = 0_i128;
        for context in contexts.iter() {
            match context {
                Context::Contract(ContractContext {
                    contract,
                    fn_name,
                    args,
                }) if contract == config.asset && fn_name == symbol_short!("transfer") => {
                    let from = args
                        .get(0)
                        .and_then(|value| Address::try_from_val(&env, &value).ok())
                        .unwrap_or_else(|| panic_with_error!(&env, PolicyError::NotAllowed));
                    let to = args
                        .get(1)
                        .and_then(|value| Address::try_from_val(&env, &value).ok())
                        .unwrap_or_else(|| panic_with_error!(&env, PolicyError::NotAllowed));
                    let amount = args
                        .get(2)
                        .and_then(|value| i128::try_from_val(&env, &value).ok())
                        .unwrap_or_else(|| panic_with_error!(&env, PolicyError::NotAllowed));
                    if from != source
                        || !config.allowed_recipients.contains(&to)
                        || amount <= 0
                        || amount > config.auto_pay_limit
                    {
                        panic_with_error!(&env, PolicyError::NotAllowed);
                    }
                    total = total
                        .checked_add(amount)
                        .unwrap_or_else(|| panic_with_error!(&env, PolicyError::NotAllowed));
                }
                _ => panic_with_error!(&env, PolicyError::NotAllowed),
            }
        }

        let now = env.ledger().timestamp();
        let spend_key = StorageKey::Spend(source);
        let mut allowance = env
            .storage()
            .persistent()
            .get::<_, Allowance>(&spend_key)
            .unwrap_or(Allowance {
                window_start: now,
                spent: 0,
            });
        if now.saturating_sub(allowance.window_start) >= WINDOW_SECONDS {
            allowance.window_start = now;
            allowance.spent = 0;
        }
        let new_spent = allowance
            .spent
            .checked_add(total)
            .unwrap_or_else(|| panic_with_error!(&env, PolicyError::NotAllowed));
        if new_spent > config.daily_limit {
            panic_with_error!(&env, PolicyError::NotAllowed);
        }
        allowance.spent = new_spent;
        env.storage().persistent().set(&spend_key, &allowance);
    }
}

#[cfg(test)]
mod test;
