#![no_std]
use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, Address, BytesN, Env, String, Vec,
};

// Bounded event directory: updating the list is one atomic, authorized operation.
// Hosts review participant code before pinning its hash; clients independently verify it.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Cafe {
    pub name: String,
    pub contract_id: Address,
    pub wasm_hash: BytesN<32>,
    pub barista: Address,
    pub owner: Option<Address>,
    pub interface_version: u32,
}
#[contracttype]
#[derive(Clone)]
enum Key {
    Admin,
    Cafes,
    Revision,
}
#[contractevent]
pub struct CafesUpdated {
    pub revision: u64,
    pub count: u32,
}
#[contract]
pub struct CafeRegistry;

fn renew(env: &Env) {
    env.storage().instance().extend_ttl(100_000, 200_000);
}
fn valid_account(address: &Address) -> bool {
    address.to_string().to_bytes().get(0) == Some(b'G')
}
#[contractimpl]
impl CafeRegistry {
    pub fn __constructor(env: Env, admin: Address) {
        admin.require_auth();
        assert!(valid_account(&admin), "admin must be an account");
        env.storage().instance().set(&Key::Admin, &admin);
        env.storage()
            .instance()
            .set(&Key::Cafes, &Vec::<Cafe>::new(&env));
        env.storage().instance().set(&Key::Revision, &0u64);
        renew(&env);
    }
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&Key::Admin).unwrap()
    }
    pub fn get_cafes(env: Env) -> Vec<Cafe> {
        env.storage().instance().get(&Key::Cafes).unwrap()
    }
    pub fn get_revision(env: Env) -> u64 {
        env.storage().instance().get(&Key::Revision).unwrap()
    }
    pub fn set_cafes(env: Env, cafes: Vec<Cafe>, expected_revision: u64) {
        let admin: Address = Self::get_admin(env.clone());
        admin.require_auth();
        let revision = Self::get_revision(env.clone());
        assert!(
            revision == expected_revision,
            "directory changed; read again"
        );
        assert!(cafes.len() <= 20, "maximum 20 cafes");
        for (index, cafe) in cafes.iter().enumerate() {
            let name = cafe.name.to_bytes();
            assert!(!name.is_empty() && name.len() <= 60, "invalid name");
            for byte in name.iter() {
                assert!(byte >= 32 && byte != 127, "name has controls");
            }
            assert!(name.iter().any(|byte| byte != b' '), "name is blank");
            assert!(
                cafe.contract_id.to_string().to_bytes().get(0) == Some(b'C'),
                "invalid contract"
            );
            assert!(valid_account(&cafe.barista), "invalid barista");
            if let Some(owner) = cafe.owner {
                assert!(valid_account(&owner), "invalid owner");
            }
            assert!(cafe.interface_version == 1, "unsupported interface");
            for previous in 0..index {
                assert!(
                    cafes.get(previous as u32).unwrap().contract_id != cafe.contract_id,
                    "duplicate cafe"
                );
            }
        }
        env.storage().instance().set(&Key::Cafes, &cafes);
        env.storage()
            .instance()
            .set(&Key::Revision, &revision.checked_add(1).unwrap());
        renew(&env);
        CafesUpdated {
            revision: revision + 1,
            count: cafes.len(),
        }
        .publish(&env);
    }
    // Anyone may pay the fee to keep the directory alive; no authority changes.
    pub fn keep_alive(env: Env) {
        renew(&env);
    }
}

#[cfg(test)]
mod test {
    extern crate std;
    use super::*;
    use soroban_sdk::vec;
    fn account(env: &Env) -> Address {
        Address::from_string(&String::from_str(
            env,
            "GAHH4R4JBNPITSHP2O4JXGGFEIJKTBA4VBNFOFKZVQRA2OHPKAF5IXTZ",
        ))
    }
    fn setup() -> (Env, Address, Address) {
        let env = Env::default();
        let admin = account(&env);
        env.mock_all_auths();
        let id = env.register(CafeRegistry, (admin.clone(),));
        (env, id, admin)
    }
    fn cafe(env: &Env) -> Cafe {
        Cafe {
            name: String::from_str(env, "My cafe"),
            contract_id: Address::from_string(&String::from_str(
                env,
                "CCWWU2UY5WAO7WXBRXHZQA7AHSDE6FMNZOFPKG3AECKEP5MY7QAAADYP",
            )),
            wasm_hash: BytesN::from_array(env, &[1; 32]),
            barista: account(env),
            owner: None,
            interface_version: 1,
        }
    }
    #[test]
    fn stores_and_removes_cafes() {
        let (env, id, admin) = setup();
        let client = CafeRegistryClient::new(&env, &id);
        assert_eq!(client.get_admin(), admin);
        assert!(client.get_cafes().is_empty());
        let entry = cafe(&env);
        client.set_cafes(&vec![&env, entry.clone()], &0);
        assert_eq!(client.get_cafes().get(0).unwrap(), entry);
        client.set_cafes(&Vec::new(&env), &1);
        assert!(client.get_cafes().is_empty());
        assert_eq!(client.get_revision(), 2);
        assert!(client.try_set_cafes(&Vec::new(&env), &1).is_err());
        assert_eq!(client.get_revision(), 2);
        client.keep_alive();
    }
    #[test]
    fn rejects_unauthorized_change() {
        let (env, id, _) = setup();
        env.mock_auths(&[]);
        assert!(CafeRegistryClient::new(&env, &id)
            .try_set_cafes(&Vec::new(&env), &0)
            .is_err());
    }
    #[test]
    fn validates_every_entry_and_duplicates() {
        let (env, id, _) = setup();
        let client = CafeRegistryClient::new(&env, &id);
        let base = cafe(&env);
        assert!(client
            .try_set_cafes(&vec![&env, base.clone(), base.clone()], &0)
            .is_err());
        for name in [
            "",
            "   ",
            "bad\nname",
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ] {
            let mut bad = base.clone();
            bad.name = String::from_str(&env, name);
            assert!(client.try_set_cafes(&vec![&env, bad], &0).is_err());
        }
        let mut bad = base.clone();
        bad.interface_version = 2;
        assert!(client.try_set_cafes(&vec![&env, bad], &0).is_err());
        let mut bad = base.clone();
        bad.contract_id = account(&env);
        assert!(client.try_set_cafes(&vec![&env, bad], &0).is_err());
        let mut entries = Vec::new(&env);
        for _ in 0..21 {
            entries.push_back(base.clone());
        }
        assert!(client.try_set_cafes(&entries, &0).is_err());
        assert!(client.get_cafes().is_empty());
    }
}
