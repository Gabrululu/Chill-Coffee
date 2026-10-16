extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    vec, Event, IntoVal,
};

struct Fixture {
    env: Env,
    id: Address,
    token: Address,
    barista: Address,
    creator: Address,
    buyer: Address,
}
impl Fixture {
    fn new() -> Self {
        let env = Env::default();
        env.ledger().with_mut(|li| {
            li.timestamp = 1_000;
            li.sequence_number = 100;
        });
        let barista = Address::generate(&env);
        let creator = Address::generate(&env);
        let buyer = Address::generate(&env);
        // Real host SAC implementation, issued asset stand-in so tests can mint.
        // Public deployment always selects native XLM; no mock token contract is used.
        let admin = Address::generate(&env);
        let token = env.register_stellar_asset_contract_v2(admin).address();
        let id = env.register(CafeMenu, (barista.clone(), token.clone()));
        Self {
            env,
            id,
            token,
            barista,
            creator,
            buyer,
        }
    }
    fn client(&self) -> CafeMenuClient<'_> {
        CafeMenuClient::new(&self.env, &self.id)
    }
    fn recipe(&self) -> Recipe {
        Recipe {
            name: String::from_str(&self.env, "Lucuma Nebula"),
            category: String::from_str(&self.env, "dessert"),
            ingredients: vec![
                &self.env,
                String::from_str(&self.env, "Lucuma"),
                String::from_str(&self.env, "Espresso"),
            ],
            vibe: String::from_str(&self.env, "Cosmic Peruvian Chill"),
            description: String::from_str(&self.env, "A little joy in orbit."),
            price: 3 * STROOPS_PER_XLM,
        }
    }
    fn fund(&self) {
        self.env.mock_all_auths();
        StellarAssetClient::new(&self.env, &self.token).mint(&self.buyer, &(100 * STROOPS_PER_XLM));
    }
    fn item(&self) -> MenuItem {
        self.env.mock_all_auths();
        self.client().register_item(&self.creator, &self.recipe())
    }
    fn order(&self) -> Order {
        let item = self.item();
        self.fund();
        self.client().order_item(
            &self.buyer,
            &item.id,
            &item.price,
            &BytesN::from_array(&self.env, &[1; 32]),
        )
    }
}

#[test]
fn register_retrieve_auth_and_event() {
    let f = Fixture::new();
    let recipe = f.recipe();
    f.env.mock_auths(&[MockAuth {
        address: &f.creator,
        invoke: &MockAuthInvoke {
            contract: &f.id,
            fn_name: "register_item",
            args: (&f.creator, &recipe).into_val(&f.env),
            sub_invokes: &[],
        },
    }]);
    let item = f.client().register_item(&f.creator, &recipe);
    assert_eq!(f.env.auths().len(), 1);
    assert_eq!(f.env.auths()[0].0, f.creator);
    assert_eq!(
        f.env.events().all(),
        std::vec![ItemRegistered {
            creator: f.creator.clone(),
            item_id: 1
        }
        .to_xdr(&f.env, &f.id)]
    );
    assert_eq!(item.id, 1);
    assert_eq!(item.created_at, 1_000);
    assert_eq!(item.orders_count, 0);
    assert_eq!(item.description, recipe.description);
    assert_eq!(f.client().get_item(&1), item);
}

#[test]
fn rejects_impersonated_creator_without_signature() {
    let f = Fixture::new();
    assert!(f
        .client()
        .try_register_item(&f.creator, &f.recipe())
        .is_err());
    assert!(f.client().get_items(&1, &10).is_empty());
}

#[test]
fn validates_price_and_metadata_on_chain() {
    let f = Fixture::new();
    f.env.mock_all_auths();
    for price in [
        -1,
        0,
        STROOPS_PER_XLM - 1,
        5 * STROOPS_PER_XLM + 1,
        i128::MAX,
    ] {
        let mut recipe = f.recipe();
        recipe.price = price;
        assert_eq!(
            f.client().try_register_item(&f.creator, &recipe),
            Err(Ok(Error::InvalidPrice))
        );
    }
    for text in ["", "   ", "\n", &"a".repeat(61)] {
        let mut recipe = f.recipe();
        recipe.name = String::from_str(&f.env, text);
        assert_eq!(
            f.client().try_register_item(&f.creator, &recipe),
            Err(Ok(Error::InvalidText))
        );
    }
    let mut recipe = f.recipe();
    recipe.category = String::from_str(&f.env, "invalid");
    assert_eq!(
        f.client().try_register_item(&f.creator, &recipe),
        Err(Ok(Error::InvalidCategory))
    );
    let mut recipe = f.recipe();
    recipe.ingredients = Vec::new(&f.env);
    assert_eq!(
        f.client().try_register_item(&f.creator, &recipe),
        Err(Ok(Error::InvalidIngredients))
    );
    let mut recipe = f.recipe();
    recipe.ingredients = vec![&f.env, String::from_str(&f.env, &"a".repeat(61))];
    assert_eq!(
        f.client().try_register_item(&f.creator, &recipe),
        Err(Ok(Error::InvalidText))
    );
    assert!(f.client().get_items(&1, &10).is_empty());
}

#[test]
fn pagination_bounds_and_empty_results() {
    let f = Fixture::new();
    assert!(f.client().get_items(&1, &10).is_empty());
    for _ in 0..3 {
        f.item();
    }
    let page = f.client().get_items(&2, &2);
    assert_eq!(page.len(), 2);
    assert_eq!(page.get(0).unwrap().id, 2);
    assert_eq!(page.get(1).unwrap().id, 3);
    assert!(f.client().get_items(&u64::MAX, &10).is_empty());
    for (start, limit) in [(0, 1), (1, 0), (1, 11)] {
        assert_eq!(
            f.client().try_get_items(&start, &limit),
            Err(Ok(Error::InvalidPage))
        );
        assert_eq!(
            f.client().try_get_orders(&start, &limit),
            Err(Ok(Error::InvalidPage))
        );
    }
    assert_eq!(f.client().try_get_item(&99), Err(Ok(Error::ItemNotFound)));
    assert_eq!(f.client().try_get_order(&99), Err(Ok(Error::OrderNotFound)));
}

#[test]
fn order_transfers_payment_increments_count_and_emits_event() {
    let f = Fixture::new();
    let order = f.order();
    let auths = f.env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, f.buyer);
    assert_eq!(
        auths[0].1.function,
        soroban_sdk::testutils::AuthorizedFunction::Contract((
            f.id.clone(),
            soroban_sdk::Symbol::new(&f.env, "order_item"),
            (
                &f.buyer,
                1u64,
                3 * STROOPS_PER_XLM,
                BytesN::from_array(&f.env, &[1; 32])
            )
                .into_val(&f.env),
        )),
    );
    assert_eq!(auths[0].1.sub_invocations.len(), 1); // Nested SAC transfer is signed.
    assert_eq!(
        f.env.events().all().filter_by_contract(&f.id),
        std::vec![ItemOrdered {
            item_id: 1,
            order_id: 1,
            buyer: f.buyer.clone(),
            creator: f.creator.clone(),
            amount: 3 * STROOPS_PER_XLM,
        }
        .to_xdr(&f.env, &f.id)]
    );
    let token = TokenClient::new(&f.env, &f.token);
    assert_eq!(token.balance(&f.buyer), 97 * STROOPS_PER_XLM);
    assert_eq!(token.balance(&f.creator), 3 * STROOPS_PER_XLM);
    assert_eq!(f.client().get_item(&1).orders_count, 1);
    assert_eq!(f.client().get_order(&1), order);
    assert_eq!(f.client().get_orders(&1, &10), vec![&f.env, order]);
}

#[test]
fn duplicate_order_request_cannot_charge_twice() {
    let f = Fixture::new();
    f.order();
    assert_eq!(
        f.client().try_order_item(
            &f.buyer,
            &1,
            &(3 * STROOPS_PER_XLM),
            &BytesN::from_array(&f.env, &[1; 32])
        ),
        Err(Ok(Error::DuplicateRequest))
    );
    assert_eq!(
        TokenClient::new(&f.env, &f.token).balance(&f.buyer),
        97 * STROOPS_PER_XLM
    );
    assert_eq!(f.client().get_item(&1).orders_count, 1);
    assert_eq!(f.client().get_orders(&1, &10).len(), 1);
}

#[test]
fn failed_payment_rolls_back_order_counter_and_request() {
    let f = Fixture::new();
    let item = f.item();
    let request = BytesN::from_array(&f.env, &[2; 32]);
    assert!(f
        .client()
        .try_order_item(&f.buyer, &item.id, &item.price, &request)
        .is_err());
    assert_eq!(f.client().get_item(&1).orders_count, 0);
    assert!(f.client().get_orders(&1, &10).is_empty());
    f.fund();
    // Retry exactly the same request: failed transaction did not consume it or the ID.
    assert_eq!(
        f.client()
            .order_item(&f.buyer, &item.id, &item.price, &request)
            .id,
        1
    );
}

#[test]
fn order_rejects_wrong_price_missing_item_and_self_payment() {
    let f = Fixture::new();
    let item = f.item();
    let request = BytesN::from_array(&f.env, &[3; 32]);
    assert_eq!(
        f.client().try_order_item(&f.buyer, &1, &1, &request),
        Err(Ok(Error::PriceChanged))
    );
    assert_eq!(
        f.client()
            .try_order_item(&f.buyer, &99, &item.price, &request),
        Err(Ok(Error::ItemNotFound))
    );
    assert_eq!(
        f.client()
            .try_order_item(&f.creator, &1, &item.price, &request),
        Err(Ok(Error::SelfPayment))
    );
}

#[test]
fn buyer_signature_is_required() {
    let f = Fixture::new();
    let item = f.item();
    f.fund();
    f.env.mock_auths(&[]);
    assert!(f
        .client()
        .try_order_item(
            &f.buyer,
            &item.id,
            &item.price,
            &BytesN::from_array(&f.env, &[4; 32])
        )
        .is_err());
    assert_eq!(f.client().get_item(&1).orders_count, 0);
}

#[test]
fn creator_can_serve_once_with_auth_and_event() {
    let f = Fixture::new();
    let order = f.order();
    let served = f.client().mark_served(&order.id, &f.creator);
    assert_eq!(f.env.auths()[0].0, f.creator);
    assert_eq!(
        f.env.events().all(),
        std::vec![OrderServed {
            order_id: 1,
            item_id: 1,
            served_by: f.creator.clone()
        }
        .to_xdr(&f.env, &f.id)]
    );
    assert_eq!(served.status, OrderStatus::Served);
    assert_eq!(
        f.client().try_mark_served(&order.id, &f.creator),
        Err(Ok(Error::AlreadyServed))
    );
}

#[test]
fn event_barista_can_serve_but_outsiders_cannot() {
    let f = Fixture::new();
    let order = f.order();
    assert_eq!(
        f.client().try_mark_served(&order.id, &f.buyer),
        Err(Ok(Error::Unauthorized))
    );
    assert_eq!(f.client().get_order(&order.id).status, OrderStatus::Pending);
    assert_eq!(
        f.client().mark_served(&order.id, &f.barista).status,
        OrderStatus::Served
    );
}

#[test]
fn cannot_impersonate_barista() {
    let f = Fixture::new();
    let order = f.order();
    f.env.mock_auths(&[]);
    assert!(f.client().try_mark_served(&order.id, &f.barista).is_err());
    assert_eq!(f.client().get_order(&order.id).status, OrderStatus::Pending);
}

#[test]
fn tips_transfer_to_configured_barista_track_total_and_prevent_retry() {
    let f = Fixture::new();
    f.fund();
    let request = BytesN::from_array(&f.env, &[5; 32]);
    assert_eq!(f.client().get_tip_total(), 0);
    assert_eq!(
        f.client().tip_barista(&f.buyer, &STROOPS_PER_XLM, &request),
        STROOPS_PER_XLM
    );
    assert_eq!(f.env.auths()[0].0, f.buyer);
    assert_eq!(
        f.env.events().all().filter_by_contract(&f.id),
        std::vec![BaristaTipped {
            barista: f.barista.clone(),
            buyer: f.buyer.clone(),
            amount: STROOPS_PER_XLM
        }
        .to_xdr(&f.env, &f.id)]
    );
    assert_eq!(
        TokenClient::new(&f.env, &f.token).balance(&f.barista),
        STROOPS_PER_XLM
    );
    assert_eq!(f.client().get_tip_total(), STROOPS_PER_XLM);
    assert_eq!(
        f.client()
            .try_tip_barista(&f.buyer, &STROOPS_PER_XLM, &request),
        Err(Ok(Error::DuplicateRequest))
    );
    for amount in [-1, 0, 101 * STROOPS_PER_XLM] {
        assert_eq!(
            f.client().try_tip_barista(&f.buyer, &amount, &request),
            Err(Ok(Error::InvalidTip))
        );
    }
    assert_eq!(
        f.client()
            .try_tip_barista(&f.barista, &STROOPS_PER_XLM, &request),
        Err(Ok(Error::SelfPayment))
    );
}

#[test]
fn failed_tip_leaves_no_total_or_consumed_request() {
    let f = Fixture::new();
    f.env.mock_all_auths();
    let request = BytesN::from_array(&f.env, &[6; 32]);
    assert!(f
        .client()
        .try_tip_barista(&f.buyer, &STROOPS_PER_XLM, &request)
        .is_err());
    assert_eq!(f.client().get_tip_total(), 0);
    f.fund();
    assert_eq!(
        f.client().tip_barista(&f.buyer, &STROOPS_PER_XLM, &request),
        STROOPS_PER_XLM
    );
}

#[test]
fn tips_require_buyer_authorization() {
    let f = Fixture::new();
    f.fund();
    f.env.mock_auths(&[]);
    assert!(f
        .client()
        .try_tip_barista(
            &f.buyer,
            &STROOPS_PER_XLM,
            &BytesN::from_array(&f.env, &[7; 32])
        )
        .is_err());
}

#[test]
fn persistent_entries_and_instance_extend_ttl() {
    use soroban_sdk::testutils::storage::{Instance as _, Persistent as _};
    let f = Fixture::new();
    f.order();
    f.env.as_contract(&f.id, || {
        assert!(f.env.storage().instance().get_ttl() >= TTL_EXTEND);
        for key in [
            DataKey::Item(1),
            DataKey::Order(1),
            DataKey::OrderRequest(f.buyer.clone(), BytesN::from_array(&f.env, &[1; 32])),
        ] {
            assert!(f.env.storage().persistent().get_ttl(&key) >= TTL_EXTEND);
        }
    });
}

#[test]
fn maximum_metadata_page_stays_below_return_size_limit() {
    use soroban_sdk::xdr::ToXdr;
    let f = Fixture::new();
    f.env.mock_all_auths();
    let mut recipe = f.recipe();
    recipe.name = String::from_str(&f.env, &"n".repeat(60));
    recipe.vibe = String::from_str(&f.env, &"v".repeat(80));
    recipe.description = String::from_str(&f.env, &"d".repeat(240));
    recipe.category = String::from_str(&f.env, "experimental");
    recipe.ingredients = Vec::new(&f.env);
    for _ in 0..8 {
        recipe
            .ingredients
            .push_back(String::from_str(&f.env, &"i".repeat(60)));
    }
    for _ in 0..MAX_PAGE_SIZE {
        f.client().register_item(&f.creator, &recipe);
    }
    let page = f.client().get_items(&1, &MAX_PAGE_SIZE);
    assert_eq!(page.len(), MAX_PAGE_SIZE);
    assert!(page.to_xdr(&f.env).len() < 16_384);
    recipe
        .ingredients
        .push_back(String::from_str(&f.env, "One too many"));
    assert_eq!(
        f.client().try_register_item(&f.creator, &recipe),
        Err(Ok(Error::InvalidIngredients))
    );
}
