#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token::TokenClient,
    Address, BytesN, Env, String, Vec,
};

pub const STROOPS_PER_XLM: i128 = 10_000_000;
pub const MAX_PAGE_SIZE: u32 = 10;
const DAY: u32 = 17_280;
const TTL_THRESHOLD: u32 = 7 * DAY;
const TTL_EXTEND: u32 = 30 * DAY;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Recipe {
    pub name: String,
    pub category: String,
    pub ingredients: Vec<String>,
    pub vibe: String,
    pub description: String,
    /// Integer stroops, never floating point. 1 XLM = 10_000_000 stroops.
    pub price: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MenuItem {
    pub id: u64,
    pub creator: Address,
    pub name: String,
    pub category: String,
    pub ingredients: Vec<String>,
    pub vibe: String,
    pub description: String,
    pub price: i128,
    pub orders_count: u64,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum OrderStatus {
    Pending,
    Served,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Order {
    pub id: u64,
    pub item_id: u64,
    pub buyer: Address,
    pub creator: Address,
    pub amount: i128,
    pub status: OrderStatus,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub barista: Address,
    /// Immutable token selected at deployment. The deploy script enforces native Testnet XLM.
    pub payment_token: Address,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,
    ItemCount,
    OrderCount,
    Item(u64),
    Order(u64),
    OrderRequest(Address, BytesN<32>),
    TipRequest(Address, BytesN<32>),
    Tips(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    InvalidText = 1,
    InvalidCategory = 2,
    InvalidIngredients = 3,
    InvalidPrice = 4,
    ItemNotFound = 5,
    OrderNotFound = 6,
    InvalidPage = 7,
    Unauthorized = 8,
    AlreadyServed = 9,
    DuplicateRequest = 10,
    PriceChanged = 11,
    SelfPayment = 12,
    InvalidTip = 13,
    Overflow = 14,
    NotInitialized = 15,
}

#[contractevent]
pub struct ItemRegistered {
    #[topic]
    pub creator: Address,
    pub item_id: u64,
}

#[contractevent]
pub struct ItemOrdered {
    #[topic]
    pub item_id: u64,
    #[topic]
    pub buyer: Address,
    pub order_id: u64,
    pub creator: Address,
    pub amount: i128,
}

#[contractevent]
pub struct OrderServed {
    #[topic]
    pub order_id: u64,
    pub item_id: u64,
    pub served_by: Address,
}

#[contractevent]
pub struct BaristaTipped {
    #[topic]
    pub barista: Address,
    #[topic]
    pub buyer: Address,
    pub amount: i128,
}

#[contract]
pub struct CafeMenu;

#[contractimpl]
impl CafeMenu {
    /// Constructor runs atomically once at deployment, preventing initialization takeover.
    /// No upgrades, token changes or barista changes in this workshop contract.
    pub fn __constructor(env: Env, barista: Address, payment_token: Address) {
        env.storage().instance().set(
            &DataKey::Config,
            &Config {
                barista,
                payment_token,
            },
        );
        env.storage().instance().set(&DataKey::ItemCount, &0u64);
        env.storage().instance().set(&DataKey::OrderCount, &0u64);
        touch_instance(&env);
    }

    pub fn get_config(env: Env) -> Result<Config, Error> {
        config(&env)
    }

    pub fn register_item(env: Env, creator: Address, recipe: Recipe) -> Result<MenuItem, Error> {
        creator.require_auth();
        validate_recipe(&env, &recipe)?;
        touch_instance(&env);
        let id = next_id(&env, &DataKey::ItemCount)?;
        let item = MenuItem {
            id,
            creator: creator.clone(),
            name: recipe.name,
            category: recipe.category,
            ingredients: recipe.ingredients,
            vibe: recipe.vibe,
            description: recipe.description,
            price: recipe.price,
            orders_count: 0,
            created_at: env.ledger().timestamp(),
        };
        save_item(&env, &item);
        ItemRegistered {
            creator,
            item_id: id,
        }
        .publish(&env);
        Ok(item)
    }

    pub fn get_item(env: Env, id: u64) -> Result<MenuItem, Error> {
        load_item(&env, id)
    }

    /// Ascending IDs, starting at 1. Never scans or serializes an unbounded collection.
    pub fn get_items(env: Env, start: u64, limit: u32) -> Result<Vec<MenuItem>, Error> {
        validate_page(start, limit)?;
        let end: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ItemCount)
            .unwrap_or(0);
        let mut result = Vec::new(&env);
        let mut id = start;
        while id <= end && result.len() < limit {
            result.push_back(load_item(&env, id)?);
            if id == end {
                break;
            }
            id += 1;
        }
        Ok(result)
    }

    /// The buyer signs both this invocation and its nested SAC transfer.
    /// A failed transfer rolls back the ENTIRE invocation: no unpaid orders or counters.
    /// Reuse the same request_id after a timeout; a new ID means a deliberate new order.
    pub fn order_item(
        env: Env,
        buyer: Address,
        item_id: u64,
        expected_price: i128,
        request_id: BytesN<32>,
    ) -> Result<Order, Error> {
        buyer.require_auth();
        let request_key = DataKey::OrderRequest(buyer.clone(), request_id);
        if env.storage().persistent().has(&request_key) {
            return Err(Error::DuplicateRequest);
        }
        let mut item = load_item(&env, item_id)?;
        if item.creator == buyer {
            return Err(Error::SelfPayment);
        }
        if item.price != expected_price {
            return Err(Error::PriceChanged);
        }
        let cfg = config(&env)?;
        touch_instance(&env);
        let id = next_id(&env, &DataKey::OrderCount)?;
        let count = item.orders_count.checked_add(1).ok_or(Error::Overflow)?;

        // Workshop extension point: apply a checked integer discount here, then test
        // the exact charged amount, event and order. Never trust a client-supplied amount.
        let amount = item.price;
        TokenClient::new(&env, &cfg.payment_token).transfer(&buyer, &item.creator, &amount);

        let order = Order {
            id,
            item_id,
            buyer: buyer.clone(),
            creator: item.creator.clone(),
            amount,
            status: OrderStatus::Pending,
            created_at: env.ledger().timestamp(),
        };
        item.orders_count = count;
        save_item(&env, &item);
        let order_key = DataKey::Order(id);
        env.storage().persistent().set(&order_key, &order);
        env.storage().persistent().set(&request_key, &id);
        touch(&env, &order_key);
        touch(&env, &request_key);
        ItemOrdered {
            item_id,
            order_id: id,
            buyer,
            creator: item.creator,
            amount,
        }
        .publish(&env);
        Ok(order)
    }

    pub fn get_order(env: Env, id: u64) -> Result<Order, Error> {
        load_order(&env, id)
    }

    pub fn get_orders(env: Env, start: u64, limit: u32) -> Result<Vec<Order>, Error> {
        validate_page(start, limit)?;
        let end: u64 = env
            .storage()
            .instance()
            .get(&DataKey::OrderCount)
            .unwrap_or(0);
        let mut result = Vec::new(&env);
        let mut id = start;
        while id <= end && result.len() < limit {
            result.push_back(load_order(&env, id)?);
            if id == end {
                break;
            }
            id += 1;
        }
        Ok(result)
    }

    /// Only the item creator or the immutable event barista may serve an order.
    pub fn mark_served(env: Env, order_id: u64, served_by: Address) -> Result<Order, Error> {
        let mut order = load_order(&env, order_id)?;
        let cfg = config(&env)?;
        if served_by != order.creator && served_by != cfg.barista {
            return Err(Error::Unauthorized);
        }
        served_by.require_auth();
        if order.status != OrderStatus::Pending {
            return Err(Error::AlreadyServed);
        }
        order.status = OrderStatus::Served;
        let key = DataKey::Order(order_id);
        env.storage().persistent().set(&key, &order);
        touch(&env, &key);
        touch_instance(&env);
        OrderServed {
            order_id,
            item_id: order.item_id,
            served_by,
        }
        .publish(&env);
        Ok(order)
    }

    /// Tips go to the configured event barista, not an arbitrary destination from the UI.
    pub fn tip_barista(
        env: Env,
        buyer: Address,
        amount: i128,
        request_id: BytesN<32>,
    ) -> Result<i128, Error> {
        buyer.require_auth();
        if amount <= 0 || amount > 100 * STROOPS_PER_XLM {
            return Err(Error::InvalidTip);
        }
        let cfg = config(&env)?;
        if buyer == cfg.barista {
            return Err(Error::SelfPayment);
        }
        let request_key = DataKey::TipRequest(buyer.clone(), request_id);
        if env.storage().persistent().has(&request_key) {
            return Err(Error::DuplicateRequest);
        }
        let key = DataKey::Tips(cfg.barista.clone());
        let previous: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let total = previous.checked_add(amount).ok_or(Error::Overflow)?;
        TokenClient::new(&env, &cfg.payment_token).transfer(&buyer, &cfg.barista, &amount);
        env.storage().persistent().set(&key, &total);
        env.storage().persistent().set(&request_key, &true);
        touch(&env, &key);
        touch(&env, &request_key);
        touch_instance(&env);
        BaristaTipped {
            barista: cfg.barista,
            buyer,
            amount,
        }
        .publish(&env);
        Ok(total)
    }

    pub fn get_tip_total(env: Env) -> Result<i128, Error> {
        let cfg = config(&env)?;
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::Tips(cfg.barista))
            .unwrap_or(0))
    }
}

fn config(env: &Env) -> Result<Config, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Config)
        .ok_or(Error::NotInitialized)
}

fn next_id(env: &Env, key: &DataKey) -> Result<u64, Error> {
    let current: u64 = env.storage().instance().get(key).unwrap_or(0);
    let next = current.checked_add(1).ok_or(Error::Overflow)?;
    env.storage().instance().set(key, &next);
    Ok(next)
}

fn load_item(env: &Env, id: u64) -> Result<MenuItem, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Item(id))
        .ok_or(Error::ItemNotFound)
}
fn load_order(env: &Env, id: u64) -> Result<Order, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Order(id))
        .ok_or(Error::OrderNotFound)
}
fn save_item(env: &Env, item: &MenuItem) {
    let key = DataKey::Item(item.id);
    env.storage().persistent().set(&key, item);
    touch(env, &key);
}
fn touch(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND);
}
fn touch_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
}
fn validate_page(start: u64, limit: u32) -> Result<(), Error> {
    if start == 0 || limit == 0 || limit > MAX_PAGE_SIZE {
        return Err(Error::InvalidPage);
    }
    Ok(())
}

// Soroban String lengths are UTF-8 BYTES, unlike JS string lengths. Fixed buffers
// bound CPU/memory even when a malicious caller bypasses the entire frontend.
fn validate_text(text: &String, max: u32) -> Result<(), Error> {
    if text.is_empty() || text.len() > max {
        return Err(Error::InvalidText);
    }
    let mut bytes = [0u8; 240];
    let slice = &mut bytes[..text.len() as usize];
    text.copy_into_slice(slice);
    if slice.iter().all(|b| b.is_ascii_whitespace()) || slice.iter().any(|b| b.is_ascii_control()) {
        return Err(Error::InvalidText);
    }
    Ok(())
}
fn validate_recipe(env: &Env, recipe: &Recipe) -> Result<(), Error> {
    validate_text(&recipe.name, 60)?;
    validate_text(&recipe.vibe, 80)?;
    validate_text(&recipe.description, 240)?;
    if recipe.price < STROOPS_PER_XLM || recipe.price > 5 * STROOPS_PER_XLM {
        return Err(Error::InvalidPrice);
    }
    if !["coffee", "dessert", "cold", "experimental"]
        .iter()
        .any(|c| recipe.category == String::from_str(env, c))
    {
        return Err(Error::InvalidCategory);
    }
    if recipe.ingredients.is_empty() || recipe.ingredients.len() > 8 {
        return Err(Error::InvalidIngredients);
    }
    for ingredient in recipe.ingredients.iter() {
        validate_text(&ingredient, 60)?;
    }
    Ok(())
}

#[cfg(test)]
mod test;
