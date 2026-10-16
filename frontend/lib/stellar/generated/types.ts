// Generated from CafeMenu WASM. Run pnpm contract:bindings; do not edit.
import {Address} from '@stellar/stellar-sdk';

    /**
 * Error Enum: Error
 */
export const Error = {
  1 : { message: "InvalidText" },
  2 : { message: "InvalidCategory" },
  3 : { message: "InvalidIngredients" },
  4 : { message: "InvalidPrice" },
  5 : { message: "ItemNotFound" },
  6 : { message: "OrderNotFound" },
  7 : { message: "InvalidPage" },
  8 : { message: "Unauthorized" },
  9 : { message: "AlreadyServed" },
  10 : { message: "DuplicateRequest" },
  11 : { message: "PriceChanged" },
  12 : { message: "SelfPayment" },
  13 : { message: "InvalidTip" },
  14 : { message: "Overflow" },
  15 : { message: "NotInitialized" }
}

/**
 * Struct: Order
 */
export interface Order {
  amount: bigint;
  buyer: string;
  created_at: bigint;
  creator: string;
  id: bigint;
  item_id: bigint;
  status: OrderStatus;
}

/**
 * Struct: Config
 */
export interface Config {
  barista: string;
  /**
   * Immutable token selected at deployment. The deploy script enforces native Testnet XLM.
   */
  payment_token: string;
}

/**
 * Struct: Recipe
 */
export interface Recipe {
  category: string;
  description: string;
  ingredients: Array<string>;
  name: string;
  /**
   * Integer stroops, never floating point. 1 XLM = 10_000_000 stroops.
   */
  price: bigint;
  vibe: string;
}

/**
 * Struct: MenuItem
 */
export interface MenuItem {
  category: string;
  created_at: bigint;
  creator: string;
  description: string;
  id: bigint;
  ingredients: Array<string>;
  name: string;
  orders_count: bigint;
  price: bigint;
  vibe: string;
}

/**
 * Union: OrderStatus
 */
 export type OrderStatus =
  { tag: "Pending"; values: void } |
  { tag: "Served"; values: void };

/**
 * Event: ItemOrdered
 */
export interface ItemOrderedEvent {
  name: "ItemOrdered";
  data: {
    item_id: bigint;
    buyer: string;
    order_id?: bigint;
    creator?: string;
    amount?: bigint;
  };
}

/**
 * Event: OrderServed
 */
export interface OrderServedEvent {
  name: "OrderServed";
  data: {
    order_id: bigint;
    item_id?: bigint;
    served_by?: string;
  };
}

/**
 * Event: BaristaTipped
 */
export interface BaristaTippedEvent {
  name: "BaristaTipped";
  data: {
    barista: string;
    buyer: string;
    amount?: bigint;
  };
}

/**
 * Event: ItemRegistered
 */
export interface ItemRegisteredEvent {
  name: "ItemRegistered";
  data: {
    creator: string;
    item_id?: bigint;
  };
}
    export type ContractEvent = ItemOrderedEvent | OrderServedEvent | BaristaTippedEvent | ItemRegisteredEvent;
    
