// Generated from CafeMenu WASM. Run pnpm contract:bindings; do not edit.
import {MenuItem, Order, Config, Recipe, ContractEvent} from './types';
import {Result, Spec, AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, ExternalExecutableRef} from '@stellar/stellar-sdk/contract';
import {Address, xdr} from '@stellar/stellar-sdk';

export interface Client {
  get_item(args: { id: bigint }, options?: MethodOptions): Promise<AssembledTransaction<Result<MenuItem, Error>>>;
  /**
   * Ascending IDs, starting at 1. Never scans or serializes an unbounded collection.
   */
  get_items(args: { start: bigint; limit: number }, options?: MethodOptions): Promise<AssembledTransaction<Result<Array<MenuItem>, Error>>>;
  get_order(args: { id: bigint }, options?: MethodOptions): Promise<AssembledTransaction<Result<Order, Error>>>;
  get_config(options?: MethodOptions): Promise<AssembledTransaction<Result<Config, Error>>>;
  get_orders(args: { start: bigint; limit: number }, options?: MethodOptions): Promise<AssembledTransaction<Result<Array<Order>, Error>>>;
  /**
   * The buyer signs both this invocation and its nested SAC transfer.
   * A failed transfer rolls back the ENTIRE invocation: no unpaid orders or counters.
   * Reuse the same request_id after a timeout; a new ID means a deliberate new order.
   */
  order_item(args: { buyer: string | Address; item_id: bigint; expected_price: bigint; request_id: Uint8Array }, options?: MethodOptions): Promise<AssembledTransaction<Result<Order, Error>>>;
  /**
   * Only the item creator or the immutable event barista may serve an order.
   */
  mark_served(args: { order_id: bigint; served_by: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<Order, Error>>>;
  /**
   * Tips go to the configured event barista, not an arbitrary destination from the UI.
   */
  tip_barista(args: { buyer: string | Address; amount: bigint; request_id: Uint8Array }, options?: MethodOptions): Promise<AssembledTransaction<Result<bigint, Error>>>;
  get_tip_total(options?: MethodOptions): Promise<AssembledTransaction<Result<bigint, Error>>>;
  register_item(args: { creator: string | Address; recipe: Recipe }, options?: MethodOptions): Promise<AssembledTransaction<Result<MenuItem, Error>>>;
}

export class Client extends ContractClient {
  constructor(public readonly options: ContractClientOptions) {
    super(
      new Spec(["AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAADwAAAAAAAAALSW52YWxpZFRleHQAAAAAAQAAAAAAAAAPSW52YWxpZENhdGVnb3J5AAAAAAIAAAAAAAAAEkludmFsaWRJbmdyZWRpZW50cwAAAAAAAwAAAAAAAAAMSW52YWxpZFByaWNlAAAABAAAAAAAAAAMSXRlbU5vdEZvdW5kAAAABQAAAAAAAAANT3JkZXJOb3RGb3VuZAAAAAAAAAYAAAAAAAAAC0ludmFsaWRQYWdlAAAAAAcAAAAAAAAADFVuYXV0aG9yaXplZAAAAAgAAAAAAAAADUFscmVhZHlTZXJ2ZWQAAAAAAAAJAAAAAAAAABBEdXBsaWNhdGVSZXF1ZXN0AAAACgAAAAAAAAAMUHJpY2VDaGFuZ2VkAAAACwAAAAAAAAALU2VsZlBheW1lbnQAAAAADAAAAAAAAAAKSW52YWxpZFRpcAAAAAAADQAAAAAAAAAIT3ZlcmZsb3cAAAAOAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAADw==", "AAAAAQAAAAAAAAAAAAAABU9yZGVyAAAAAAAABwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAVidXllcgAAAAAAABMAAAAAAAAACmNyZWF0ZWRfYXQAAAAAAAYAAAAAAAAAB2NyZWF0b3IAAAAAEwAAAAAAAAACaWQAAAAAAAYAAAAAAAAAB2l0ZW1faWQAAAAABgAAAAAAAAAGc3RhdHVzAAAAAAfQAAAAC09yZGVyU3RhdHVzAA==", "AAAAAQAAAAAAAAAAAAAABkNvbmZpZwAAAAAAAgAAAAAAAAAHYmFyaXN0YQAAAAATAAAAVkltbXV0YWJsZSB0b2tlbiBzZWxlY3RlZCBhdCBkZXBsb3ltZW50LiBUaGUgZGVwbG95IHNjcmlwdCBlbmZvcmNlcyBuYXRpdmUgVGVzdG5ldCBYTE0uAAAAAAANcGF5bWVudF90b2tlbgAAAAAAABM=", "AAAAAQAAAAAAAAAAAAAABlJlY2lwZQAAAAAABgAAAAAAAAAIY2F0ZWdvcnkAAAAQAAAAAAAAAAtkZXNjcmlwdGlvbgAAAAAQAAAAAAAAAAtpbmdyZWRpZW50cwAAAAPqAAAAEAAAAAAAAAAEbmFtZQAAABAAAABCSW50ZWdlciBzdHJvb3BzLCBuZXZlciBmbG9hdGluZyBwb2ludC4gMSBYTE0gPSAxMF8wMDBfMDAwIHN0cm9vcHMuAAAAAAAFcHJpY2UAAAAAAAALAAAAAAAAAAR2aWJlAAAAEA==", "AAAAAQAAAAAAAAAAAAAACE1lbnVJdGVtAAAACgAAAAAAAAAIY2F0ZWdvcnkAAAAQAAAAAAAAAApjcmVhdGVkX2F0AAAAAAAGAAAAAAAAAAdjcmVhdG9yAAAAABMAAAAAAAAAC2Rlc2NyaXB0aW9uAAAAABAAAAAAAAAAAmlkAAAAAAAGAAAAAAAAAAtpbmdyZWRpZW50cwAAAAPqAAAAEAAAAAAAAAAEbmFtZQAAABAAAAAAAAAADG9yZGVyc19jb3VudAAAAAYAAAAAAAAABXByaWNlAAAAAAAACwAAAAAAAAAEdmliZQAAABA=", "AAAAAAAAAAAAAAAIZ2V0X2l0ZW0AAAABAAAAAAAAAAJpZAAAAAAABgAAAAEAAAPpAAAH0AAAAAhNZW51SXRlbQAAAAM=", "AAAAAAAAAFBBc2NlbmRpbmcgSURzLCBzdGFydGluZyBhdCAxLiBOZXZlciBzY2FucyBvciBzZXJpYWxpemVzIGFuIHVuYm91bmRlZCBjb2xsZWN0aW9uLgAAAAlnZXRfaXRlbXMAAAAAAAACAAAAAAAAAAVzdGFydAAAAAAAAAYAAAAAAAAABWxpbWl0AAAAAAAABAAAAAEAAAPpAAAD6gAAB9AAAAAITWVudUl0ZW0AAAAD", "AAAAAAAAAAAAAAAJZ2V0X29yZGVyAAAAAAAAAQAAAAAAAAACaWQAAAAAAAYAAAABAAAD6QAAB9AAAAAFT3JkZXIAAAAAAAAD", "AAAAAgAAAAAAAAAAAAAAC09yZGVyU3RhdHVzAAAAAAIAAAAAAAAAAAAAAAdQZW5kaW5nAAAAAAAAAAAAAAAABlNlcnZlZAAA", "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAPpAAAH0AAAAAZDb25maWcAAAAAAAM=", "AAAAAAAAAAAAAAAKZ2V0X29yZGVycwAAAAAAAgAAAAAAAAAFc3RhcnQAAAAAAAAGAAAAAAAAAAVsaW1pdAAAAAAAAAQAAAABAAAD6QAAA+oAAAfQAAAABU9yZGVyAAAAAAAAAw==", "AAAAAAAAAOVUaGUgYnV5ZXIgc2lnbnMgYm90aCB0aGlzIGludm9jYXRpb24gYW5kIGl0cyBuZXN0ZWQgU0FDIHRyYW5zZmVyLgpBIGZhaWxlZCB0cmFuc2ZlciByb2xscyBiYWNrIHRoZSBFTlRJUkUgaW52b2NhdGlvbjogbm8gdW5wYWlkIG9yZGVycyBvciBjb3VudGVycy4KUmV1c2UgdGhlIHNhbWUgcmVxdWVzdF9pZCBhZnRlciBhIHRpbWVvdXQ7IGEgbmV3IElEIG1lYW5zIGEgZGVsaWJlcmF0ZSBuZXcgb3JkZXIuAAAAAAAACm9yZGVyX2l0ZW0AAAAAAAQAAAAAAAAABWJ1eWVyAAAAAAAAEwAAAAAAAAAHaXRlbV9pZAAAAAAGAAAAAAAAAA5leHBlY3RlZF9wcmljZQAAAAAACwAAAAAAAAAKcmVxdWVzdF9pZAAAAAAD7gAAACAAAAABAAAD6QAAB9AAAAAFT3JkZXIAAAAAAAAD", "AAAABQAAAAAAAAAAAAAAC0l0ZW1PcmRlcmVkAAAAAAEAAAAMaXRlbV9vcmRlcmVkAAAABQAAAAAAAAAHaXRlbV9pZAAAAAAGAAAAAQAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAQAAAAAAAAAIb3JkZXJfaWQAAAAGAAAAAAAAAAAAAAAHY3JlYXRvcgAAAAATAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=", "AAAABQAAAAAAAAAAAAAAC09yZGVyU2VydmVkAAAAAAEAAAAMb3JkZXJfc2VydmVkAAAAAwAAAAAAAAAIb3JkZXJfaWQAAAAGAAAAAQAAAAAAAAAHaXRlbV9pZAAAAAAGAAAAAAAAAAAAAAAJc2VydmVkX2J5AAAAAAAAEwAAAAAAAAAC", "AAAAAAAAAEhPbmx5IHRoZSBpdGVtIGNyZWF0b3Igb3IgdGhlIGltbXV0YWJsZSBldmVudCBiYXJpc3RhIG1heSBzZXJ2ZSBhbiBvcmRlci4AAAALbWFya19zZXJ2ZWQAAAAAAgAAAAAAAAAIb3JkZXJfaWQAAAAGAAAAAAAAAAlzZXJ2ZWRfYnkAAAAAAAATAAAAAQAAA+kAAAfQAAAABU9yZGVyAAAAAAAAAw==", "AAAAAAAAAFJUaXBzIGdvIHRvIHRoZSBjb25maWd1cmVkIGV2ZW50IGJhcmlzdGEsIG5vdCBhbiBhcmJpdHJhcnkgZGVzdGluYXRpb24gZnJvbSB0aGUgVUkuAAAAAAALdGlwX2JhcmlzdGEAAAAAAwAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACnJlcXVlc3RfaWQAAAAAA+4AAAAgAAAAAQAAA+kAAAALAAAAAw==", "AAAABQAAAAAAAAAAAAAADUJhcmlzdGFUaXBwZWQAAAAAAAABAAAADmJhcmlzdGFfdGlwcGVkAAAAAAADAAAAAAAAAAdiYXJpc3RhAAAAABMAAAABAAAAAAAAAAVidXllcgAAAAAAABMAAAABAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAg==", "AAAAAAAAAJxDb25zdHJ1Y3RvciBydW5zIGF0b21pY2FsbHkgb25jZSBhdCBkZXBsb3ltZW50LCBwcmV2ZW50aW5nIGluaXRpYWxpemF0aW9uIHRha2VvdmVyLgpObyB1cGdyYWRlcywgdG9rZW4gY2hhbmdlcyBvciBiYXJpc3RhIGNoYW5nZXMgaW4gdGhpcyB3b3Jrc2hvcCBjb250cmFjdC4AAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAAB2JhcmlzdGEAAAAAEwAAAAAAAAANcGF5bWVudF90b2tlbgAAAAAAABMAAAAA", "AAAAAAAAAAAAAAANZ2V0X3RpcF90b3RhbAAAAAAAAAAAAAABAAAD6QAAAAsAAAAD", "AAAAAAAAAAAAAAANcmVnaXN0ZXJfaXRlbQAAAAAAAAIAAAAAAAAAB2NyZWF0b3IAAAAAEwAAAAAAAAAGcmVjaXBlAAAAAAfQAAAABlJlY2lwZQAAAAAAAQAAA+kAAAfQAAAACE1lbnVJdGVtAAAAAw==", "AAAABQAAAAAAAAAAAAAADkl0ZW1SZWdpc3RlcmVkAAAAAAABAAAAD2l0ZW1fcmVnaXN0ZXJlZAAAAAACAAAAAAAAAAdjcmVhdG9yAAAAABMAAAABAAAAAAAAAAdpdGVtX2lkAAAAAAYAAAAAAAAAAg=="]),
      options
    );
  }

   static deploy<T = Client>(args: { barista: string | Address; payment_token: string | Address }, options: MethodOptions & Omit<ContractClientOptions, 'contractId'> & { salt?: Uint8Array; address?: string; } & ({ wasmHash: Uint8Array | string; format?: "hex" | "base64"; externalRef?: never; } | { externalRef: ExternalExecutableRef; wasmHash?: never; format?: never; })): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(args, options);
  }
  public readonly fromJson = {
    get_item : this.txFromJson<Result<MenuItem, Error>>,  get_items : this.txFromJson<Result<Array<MenuItem>, Error>>,  get_order : this.txFromJson<Result<Order, Error>>,  get_config : this.txFromJson<Result<Config, Error>>,  get_orders : this.txFromJson<Result<Array<Order>, Error>>,  order_item : this.txFromJson<Result<Order, Error>>,  mark_served : this.txFromJson<Result<Order, Error>>,  tip_barista : this.txFromJson<Result<bigint, Error>>,  get_tip_total : this.txFromJson<Result<bigint, Error>>,  register_item : this.txFromJson<Result<MenuItem, Error>>
  };

  /** @deprecated Use fromJson instead. */
  public readonly fromJSON = this.fromJson;

  /**
   * Parse a raw contract event (topics + data) into a typed {@link ContractEvent}.
   */
  parseEvent(topics: xdr.ScVal[] | string[], data: xdr.ScVal | string): ContractEvent | undefined {
    return this.spec.parseEvent(topics, data) as ContractEvent | undefined;
  }
  /**
   * Build a topics filter row for the "ItemOrdered" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  itemOrderedEventFilter(topicValues?: { item_id?: bigint; buyer?: string | Address }): string[] {
    return this.spec.eventTopicFilter("ItemOrdered", topicValues);
  }
  /**
   * Build a topics filter row for the "OrderServed" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  orderServedEventFilter(topicValues?: { order_id?: bigint }): string[] {
    return this.spec.eventTopicFilter("OrderServed", topicValues);
  }
  /**
   * Build a topics filter row for the "BaristaTipped" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  baristaTippedEventFilter(topicValues?: { barista?: string | Address; buyer?: string | Address }): string[] {
    return this.spec.eventTopicFilter("BaristaTipped", topicValues);
  }
  /**
   * Build a topics filter row for the "ItemRegistered" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  itemRegisteredEventFilter(topicValues?: { creator?: string | Address }): string[] {
    return this.spec.eventTopicFilter("ItemRegistered", topicValues);
  }
}
