extern crate std;

use super::{PatopayPolicy, PatopayPolicyClient, PolicyConfig};
use smart_wallet_interface::types::{SignerExpiration, SignerKey, SignerLimits, SignerVal};
use soroban_sdk::{
    auth::{Context, ContractContext},
    contract, contractimpl,
    testutils::{Address as _, Ledger},
    vec, Address, Env, IntoVal, Symbol,
};

#[contract]
struct AttachedWallet;

#[contractimpl]
impl AttachedWallet {
    pub fn get_signer(_env: Env, _signer_key: SignerKey) -> Option<SignerVal> {
        Some(SignerVal::Policy(
            SignerExpiration(None),
            SignerLimits(None),
        ))
    }
}

#[test]
fn test_install_requires_wallet_auth() {
    let env = Env::default();
    let contract_id = env.register(PatopayPolicy, ());
    let client = PatopayPolicyClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);

    assert!(client.try_install(&wallet).is_err());

    client.mock_all_auths().install(&wallet);
}

#[test]
fn test_rejects_non_usdc_contract() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PatopayPolicy, ());
    let client = PatopayPolicyClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);
    let asset = Address::generate(&env);
    let recipient = Address::generate(&env);
    client.install(&wallet);
    client.configure(
        &wallet,
        &PolicyConfig {
            asset: asset.clone(),
            auto_pay_limit: 100,
            daily_limit: 500,
            allowed_recipients: vec![&env, recipient.clone()],
            revision: 1,
        },
    );

    let wrong_asset = Address::generate(&env);
    let contexts = vec![
        &env,
        Context::Contract(ContractContext {
            contract: wrong_asset,
            fn_name: Symbol::new(&env, "transfer"),
            args: (wallet.clone(), recipient, 50_i128).into_val(&env),
        }),
    ];

    assert!(client
        .try_policy__(&wallet, &SignerKey::Policy(contract_id.clone()), &contexts,)
        .is_err());
}

#[test]
fn test_rejects_wrong_from() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PatopayPolicy, ());
    let client = PatopayPolicyClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);
    let asset = Address::generate(&env);
    let recipient = Address::generate(&env);
    client.install(&wallet);
    client.configure(
        &wallet,
        &PolicyConfig {
            asset: asset.clone(),
            auto_pay_limit: 100,
            daily_limit: 500,
            allowed_recipients: vec![&env, recipient.clone()],
            revision: 1,
        },
    );
    let contexts = vec![
        &env,
        Context::Contract(ContractContext {
            contract: asset,
            fn_name: Symbol::new(&env, "transfer"),
            args: (Address::generate(&env), recipient, 50_i128).into_val(&env),
        }),
    ];

    assert!(client
        .try_policy__(&wallet, &SignerKey::Policy(contract_id.clone()), &contexts,)
        .is_err());
}

#[test]
fn test_rejects_unlisted_recipient() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PatopayPolicy, ());
    let client = PatopayPolicyClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);
    let asset = Address::generate(&env);
    client.install(&wallet);
    client.configure(
        &wallet,
        &PolicyConfig {
            asset: asset.clone(),
            auto_pay_limit: 100,
            daily_limit: 500,
            allowed_recipients: vec![&env, Address::generate(&env)],
            revision: 1,
        },
    );
    let contexts = vec![
        &env,
        Context::Contract(ContractContext {
            contract: asset,
            fn_name: Symbol::new(&env, "transfer"),
            args: (wallet.clone(), Address::generate(&env), 50_i128).into_val(&env),
        }),
    ];

    assert!(client
        .try_policy__(&wallet, &SignerKey::Policy(contract_id.clone()), &contexts,)
        .is_err());
}

#[test]
fn test_rejects_amount_above_auto_limit() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PatopayPolicy, ());
    let client = PatopayPolicyClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);
    let asset = Address::generate(&env);
    let recipient = Address::generate(&env);
    client.install(&wallet);
    client.configure(
        &wallet,
        &PolicyConfig {
            asset: asset.clone(),
            auto_pay_limit: 100,
            daily_limit: 500,
            allowed_recipients: vec![&env, recipient.clone()],
            revision: 1,
        },
    );
    let contexts = vec![
        &env,
        Context::Contract(ContractContext {
            contract: asset,
            fn_name: Symbol::new(&env, "transfer"),
            args: (wallet.clone(), recipient, 101_i128).into_val(&env),
        }),
    ];

    assert!(client
        .try_policy__(&wallet, &SignerKey::Policy(contract_id.clone()), &contexts,)
        .is_err());
}

#[test]
fn test_rejects_non_transfer_function() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PatopayPolicy, ());
    let client = PatopayPolicyClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);
    let asset = Address::generate(&env);
    let recipient = Address::generate(&env);
    client.install(&wallet);
    client.configure(
        &wallet,
        &PolicyConfig {
            asset: asset.clone(),
            auto_pay_limit: 100,
            daily_limit: 500,
            allowed_recipients: vec![&env, recipient.clone()],
            revision: 1,
        },
    );
    let contexts = vec![
        &env,
        Context::Contract(ContractContext {
            contract: asset,
            fn_name: Symbol::new(&env, "approve"),
            args: (wallet.clone(), recipient, 50_i128).into_val(&env),
        }),
    ];

    assert!(client
        .try_policy__(&wallet, &SignerKey::Policy(contract_id.clone()), &contexts,)
        .is_err());
}

#[test]
fn test_rejects_cumulative_daily_limit() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PatopayPolicy, ());
    let client = PatopayPolicyClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);
    let asset = Address::generate(&env);
    let recipient = Address::generate(&env);
    client.install(&wallet);
    client.configure(
        &wallet,
        &PolicyConfig {
            asset: asset.clone(),
            auto_pay_limit: 100,
            daily_limit: 100,
            allowed_recipients: vec![&env, recipient.clone()],
            revision: 1,
        },
    );
    let signer = SignerKey::Policy(contract_id.clone());
    let first = vec![
        &env,
        Context::Contract(ContractContext {
            contract: asset.clone(),
            fn_name: Symbol::new(&env, "transfer"),
            args: (wallet.clone(), recipient.clone(), 90_i128).into_val(&env),
        }),
    ];
    client.policy__(&wallet, &signer, &first);

    let second = vec![
        &env,
        Context::Contract(ContractContext {
            contract: asset,
            fn_name: Symbol::new(&env, "transfer"),
            args: (wallet.clone(), recipient, 20_i128).into_val(&env),
        }),
    ];
    assert!(client.try_policy__(&wallet, &signer, &second).is_err());
}

#[test]
fn test_resets_window_after_24_hours() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|ledger| ledger.timestamp = 1_000);
    let contract_id = env.register(PatopayPolicy, ());
    let client = PatopayPolicyClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);
    let asset = Address::generate(&env);
    let recipient = Address::generate(&env);
    client.install(&wallet);
    client.configure(
        &wallet,
        &PolicyConfig {
            asset: asset.clone(),
            auto_pay_limit: 100,
            daily_limit: 100,
            allowed_recipients: vec![&env, recipient.clone()],
            revision: 1,
        },
    );
    let signer = SignerKey::Policy(contract_id.clone());
    let transfer = vec![
        &env,
        Context::Contract(ContractContext {
            contract: asset,
            fn_name: Symbol::new(&env, "transfer"),
            args: (wallet.clone(), recipient, 90_i128).into_val(&env),
        }),
    ];
    client.policy__(&wallet, &signer, &transfer);

    env.ledger()
        .with_mut(|ledger| ledger.timestamp = 1_000 + 24 * 60 * 60);

    client.policy__(&wallet, &signer, &transfer);
}

#[test]
fn test_rejects_stale_revision() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PatopayPolicy, ());
    let client = PatopayPolicyClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);
    let asset = Address::generate(&env);
    let recipient = Address::generate(&env);
    let config = PolicyConfig {
        asset,
        auto_pay_limit: 100,
        daily_limit: 500,
        allowed_recipients: vec![&env, recipient],
        revision: 1,
    };
    client.install(&wallet);
    client.configure(&wallet, &config);

    assert!(client.try_configure(&wallet, &config).is_err());
}

#[test]
fn test_rejects_invalid_limits() {
    for (auto_pay_limit, daily_limit) in [(0, 100), (100, 0), (101, 100)] {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(PatopayPolicy, ());
        let client = PatopayPolicyClient::new(&env, &contract_id);
        let wallet = Address::generate(&env);
        client.install(&wallet);
        let config = PolicyConfig {
            asset: Address::generate(&env),
            auto_pay_limit,
            daily_limit,
            allowed_recipients: vec![&env, Address::generate(&env)],
            revision: 1,
        };

        assert!(client.try_configure(&wallet, &config).is_err());
    }
}

#[test]
fn test_rejects_oversized_recipient_allowlist() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PatopayPolicy, ());
    let client = PatopayPolicyClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);
    client.install(&wallet);
    let mut recipients = soroban_sdk::Vec::new(&env);
    for _ in 0..51 {
        recipients.push_back(Address::generate(&env));
    }
    let config = PolicyConfig {
        asset: Address::generate(&env),
        auto_pay_limit: 100,
        daily_limit: 500,
        allowed_recipients: recipients,
        revision: 1,
    };

    assert!(client.try_configure(&wallet, &config).is_err());
}

#[test]
fn test_policy_requires_wallet_auth_before_spending() {
    let env = Env::default();
    let contract_id = env.register(PatopayPolicy, ());
    let client = PatopayPolicyClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);
    let asset = Address::generate(&env);
    let recipient = Address::generate(&env);
    client.mock_all_auths().install(&wallet);
    client.mock_all_auths().configure(
        &wallet,
        &PolicyConfig {
            asset: asset.clone(),
            auto_pay_limit: 100,
            daily_limit: 500,
            allowed_recipients: vec![&env, recipient.clone()],
            revision: 1,
        },
    );
    let contexts = vec![
        &env,
        Context::Contract(ContractContext {
            contract: asset,
            fn_name: Symbol::new(&env, "transfer"),
            args: (wallet.clone(), recipient, 50_i128).into_val(&env),
        }),
    ];

    assert!(client
        .try_policy__(&wallet, &SignerKey::Policy(contract_id.clone()), &contexts,)
        .is_err());
}

#[test]
fn test_uninstall_requires_wallet_auth_and_removes_installation() {
    let env = Env::default();
    let contract_id = env.register(PatopayPolicy, ());
    let client = PatopayPolicyClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);

    assert!(client.try_uninstall(&wallet).is_err());
    client.mock_all_auths().install(&wallet);
    client.mock_all_auths().uninstall(&wallet);
    assert!(client
        .try_policy__(
            &wallet,
            &SignerKey::Policy(contract_id),
            &soroban_sdk::vec![&env],
        )
        .is_err());
}

#[test]
fn test_configure_requires_wallet_auth() {
    let env = Env::default();
    let contract_id = env.register(PatopayPolicy, ());
    let client = PatopayPolicyClient::new(&env, &contract_id);
    let wallet = Address::generate(&env);
    client.mock_all_auths().install(&wallet);
    let config = PolicyConfig {
        asset: Address::generate(&env),
        auto_pay_limit: 100,
        daily_limit: 500,
        allowed_recipients: vec![&env, Address::generate(&env)],
        revision: 1,
    };

    assert!(client.try_configure(&wallet, &config).is_err());
}
