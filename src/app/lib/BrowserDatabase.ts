// src/app/lib/BrowserDatabase.ts

'use client';

import {
  SupernodeList,
  Message,
  UserMessage,
  CreditPackPurchaseRequest,
  CreditPackPurchaseRequestRejection,
  CreditPackPurchaseRequestPreliminaryPriceQuote,
  CreditPackPurchaseRequestPreliminaryPriceQuoteResponse,
  CreditPackPurchaseRequestResponseTermination,
  CreditPackPurchaseRequestResponse,
  CreditPackPurchaseRequestConfirmation,
  CreditPackPurchaseRequestConfirmationResponse,
  CreditPackRequestStatusCheck,
  CreditPackPurchaseRequestStatus,
  CreditPackStorageRetryRequest,
  CreditPackStorageRetryRequestResponse,
  InferenceAPIUsageRequest,
  InferenceAPIUsageResponse,
  InferenceAPIOutputResult,
  InferenceConfirmation,
} from "@/app/types";

/**
 * Singleton BrowserDatabase class for managing IndexedDB interactions.
 */

export class BrowserDatabase {
  private static instance: BrowserDatabase;
  private db: IDBDatabase | null = null;
  private readonly dbName = "PastelInferenceClientDB";
  private readonly dbVersion = 1;

  private constructor() {}

  public static getInstance(): BrowserDatabase {
    if (!BrowserDatabase.instance) {
      BrowserDatabase.instance = new BrowserDatabase();
    }
    return BrowserDatabase.instance;
  }

  public async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event: Event) => {
        console.error("Error opening database:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };

      request.onsuccess = (event: Event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        console.log("Database opened successfully");
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores(this.db);
      };
    });
  }

  /**
   * Creates the necessary object stores and indexes in the database.
   * @param {IDBDatabase} db - The IDBDatabase instance.
   */
  private createObjectStores(db: IDBDatabase): void {
    const storeDefinitions = [
      {
        storeName: "SupernodeList",
        keyPath: "id",
        autoIncrement: true,
        indexes: [
          {
            name: "txid_vout",
            keyPath: "txid_vout",
            options: { unique: false },
          },
          {
            name: "supernode_psl_address",
            keyPath: "supernode_psl_address",
            options: { unique: false },
          },
        ],
      },
      {
        storeName: "Message",
        keyPath: "id",
        autoIncrement: true,
        indexes: [],
      },
      {
        storeName: "UserMessage",
        keyPath: "id",
        autoIncrement: true,
        indexes: [],
      },
      {
        storeName: "CreditPackPurchaseRequest",
        keyPath: "id",
        autoIncrement: true,
        indexes: [
          {
            name: "sha3_256_hash_of_credit_pack_purchase_request_fields",
            keyPath: "sha3_256_hash_of_credit_pack_purchase_request_fields",
            options: { unique: true },
          },
        ],
      },
      {
        storeName: "CreditPackPurchaseRequestRejection",
        keyPath: "id",
        autoIncrement: true,
        indexes: [],
      },
      {
        storeName: "CreditPackPurchaseRequestPreliminaryPriceQuote",
        keyPath: "id",
        autoIncrement: true,
        indexes: [],
      },
      {
        storeName: "CreditPackPurchaseRequestPreliminaryPriceQuoteResponse",
        keyPath: "id",
        autoIncrement: true,
        indexes: [],
      },
      {
        storeName: "CreditPackPurchaseRequestResponseTermination",
        keyPath: "id",
        autoIncrement: true,
        indexes: [],
      },
      {
        storeName: "CreditPackPurchaseRequestResponse",
        keyPath: "id",
        autoIncrement: true,
        indexes: [
          {
            name: "sha3_256_hash_of_credit_pack_purchase_request_response_fields",
            keyPath:
              "sha3_256_hash_of_credit_pack_purchase_request_response_fields",
            options: { unique: true },
          },
        ],
      },
      {
        storeName: "CreditPackPurchaseRequestConfirmation",
        keyPath: "id",
        autoIncrement: true,
        indexes: [
          {
            name: "sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields",
            keyPath:
              "sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields",
            options: { unique: true },
          },
        ],
      },
      {
        storeName: "CreditPackPurchaseRequestConfirmationResponse",
        keyPath: "id",
        autoIncrement: true,
        indexes: [
          {
            name: "sha3_256_hash_of_credit_pack_purchase_request_confirmation_response_fields",
            keyPath:
              "sha3_256_hash_of_credit_pack_purchase_request_confirmation_response_fields",
            options: { unique: true },
          },
        ],
      },
      {
        storeName: "CreditPackRequestStatusCheck",
        keyPath: "id",
        autoIncrement: true,
        indexes: [],
      },
      {
        storeName: "CreditPackPurchaseRequestStatus",
        keyPath: "id",
        autoIncrement: true,
        indexes: [
          {
            name: "sha3_256_hash_of_credit_pack_purchase_request_status_fields",
            keyPath:
              "sha3_256_hash_of_credit_pack_purchase_request_status_fields",
            options: { unique: true },
          },
        ],
      },
      {
        storeName: "CreditPackStorageRetryRequest",
        keyPath: "id",
        autoIncrement: true,
        indexes: [],
      },
      {
        storeName: "CreditPackStorageRetryRequestResponse",
        keyPath: "id",
        autoIncrement: true,
        indexes: [],
      },
      {
        storeName: "InferenceAPIUsageRequest",
        keyPath: "id",
        autoIncrement: true,
        indexes: [
          {
            name: "inference_request_id",
            keyPath: "inference_request_id",
            options: { unique: true },
          },
        ],
      },
      {
        storeName: "InferenceAPIUsageResponse",
        keyPath: "id",
        autoIncrement: true,
        indexes: [
          {
            name: "inference_response_id",
            keyPath: "inference_response_id",
            options: { unique: true },
          },
        ],
      },
      {
        storeName: "InferenceAPIOutputResult",
        keyPath: "id",
        autoIncrement: true,
        indexes: [
          {
            name: "inference_result_id",
            keyPath: "inference_result_id",
            options: { unique: true },
          },
        ],
      },
      {
        storeName: "InferenceConfirmation",
        keyPath: "id",
        autoIncrement: true,
        indexes: [],
      },
    ];

    storeDefinitions.forEach((storeDef) => {
      if (!db.objectStoreNames.contains(storeDef.storeName)) {
        const store = db.createObjectStore(storeDef.storeName, {
          keyPath: storeDef.keyPath,
          autoIncrement: storeDef.autoIncrement,
        });
        storeDef.indexes.forEach((index) => {
          store.createIndex(index.name, index.keyPath, index.options);
        });
      }
    });
  }

  /**
   * Adds data to a specified object store.
   * @param {string} storeName - The name of the object store.
   * @param {T} data - The data to add.
   * @returns {Promise<IDBValidKey>} A promise that resolves with the key of the added data.
   */
  public async addData<T>(storeName: string, data: T): Promise<IDBValidKey> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result);
      };
    });
  }

   /**
   * Adds data to a specified object store.
   * @param {string} storeName - The name of the object store.
   * @param {T} data - The data to add.
   * @returns {Promise<IDBValidKey>} A promise that resolves with the key of the added data.
   */
   public async saveData<T>(storeName: string, data: T): Promise<IDBValidKey> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result);
      };
    });
  }

  /**
   * Retrieves data by primary key from a specified object store.
   * @param {string} storeName - The name of the object store.
   * @param {IDBValidKey} id - The primary key of the data.
   * @returns {Promise<T | undefined>} A promise that resolves with the retrieved data or undefined if not found.
   */
  public async getData<T>(storeName: string, id: IDBValidKey): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result as T);
      };
    });
  }

  /**
   * Updates data in a specified object store.
   * @param {string} storeName - The name of the object store.
   * @param {IDBValidKey} id - The primary key of the data to update.
   * @param {T} data - The updated data.
   * @returns {Promise<IDBValidKey>} A promise that resolves with the key of the updated data.
   */
  public async updateData<T>(
    storeName: string,
    id: IDBValidKey,
    data: T
  ): Promise<IDBValidKey> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.put({ ...data, id });

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result);
      };
    });
  }

  /**
   * Deletes data from a specified object store.
   * @param {string} storeName - The name of the object store.
   * @param {IDBValidKey} id - The primary key of the data to delete.
   * @returns {Promise<void>} A promise that resolves when the data is deleted.
   */
  public async deleteData(storeName: string, id: IDBValidKey): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Retrieves all data from a specified object store.
   * @param {string} storeName - The name of the object store.
   * @returns {Promise<T[]>} A promise that resolves with an array of all data.
   */
  public async getAllData<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result as T[]);
      };
    });
  }

  /**
   * Finds data in a specified object store using an index.
   * @param {string} storeName - The name of the object store.
   * @param {string} indexName - The name of the index to use.
   * @param {IDBValidKey} value - The value to search for.
   * @returns {Promise<T | undefined>} A promise that resolves with the found data or undefined.
   */
  public async findByIndex<T>(
    storeName: string,
    indexName: string,
    value: IDBValidKey
  ): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.get(value);

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result as T);
      };
    });
  }
}

/**
 * Factory function to create model methods for a given store.
 * @template T - The type of the model.
 * @param {string} storeName - The name of the object store.
 * @returns {ModelMethods<T>} An object containing CRUD methods for the model.
 */
type ModelMethods<T> = {
  create: (data: T) => Promise<IDBValidKey>;
  findByPk: (id: IDBValidKey) => Promise<T | undefined>;
  update: (id: IDBValidKey, data: T) => Promise<IDBValidKey>;
  destroy: (id: IDBValidKey) => Promise<void>;
  findAll: () => Promise<T[]>;
  findOne: (options: {
    where: { [key: string]: IDBValidKey };
  }) => Promise<T | undefined>;
};

function createModelMethods<T>(storeName: string): ModelMethods<T> {
  const db = BrowserDatabase.getInstance();

  return {
    create: async (data) => await db.addData<T>(storeName, data),
    findByPk: async (id) => await db.getData<T>(storeName, id),
    update: async (id, data) =>
      await db.updateData<T>(storeName, id, data),
    destroy: async (id) => await db.deleteData(storeName, id),
    findAll: async () => await db.getAllData<T>(storeName),
    findOne: async (options) => {
      if (options.where) {
        const [key, value] = Object.entries(options.where)[0];
        return await db.findByIndex<T>(storeName, key, value);
      }
      return undefined;
    },
  };
}

/**
 * Exported models with CRUD methods.
 */
export const models = {
  SupernodeList: createModelMethods<SupernodeList>("SupernodeList"),
  Message: createModelMethods<Message>("Message"),
  UserMessage: createModelMethods<UserMessage>("UserMessage"),
  CreditPackPurchaseRequest: createModelMethods<CreditPackPurchaseRequest>(
    "CreditPackPurchaseRequest"
  ),
  CreditPackPurchaseRequestRejection:
    createModelMethods<CreditPackPurchaseRequestRejection>(
      "CreditPackPurchaseRequestRejection"
    ),
  CreditPackPurchaseRequestPreliminaryPriceQuote:
    createModelMethods<CreditPackPurchaseRequestPreliminaryPriceQuote>(
      "CreditPackPurchaseRequestPreliminaryPriceQuote"
    ),
  CreditPackPurchaseRequestPreliminaryPriceQuoteResponse:
    createModelMethods<CreditPackPurchaseRequestPreliminaryPriceQuoteResponse>(
      "CreditPackPurchaseRequestPreliminaryPriceQuoteResponse"
    ),
  CreditPackPurchaseRequestResponseTermination:
    createModelMethods<CreditPackPurchaseRequestResponseTermination>(
      "CreditPackPurchaseRequestResponseTermination"
    ),
  CreditPackPurchaseRequestResponse:
    createModelMethods<CreditPackPurchaseRequestResponse>(
      "CreditPackPurchaseRequestResponse"
    ),
  CreditPackPurchaseRequestConfirmation:
    createModelMethods<CreditPackPurchaseRequestConfirmation>(
      "CreditPackPurchaseRequestConfirmation"
    ),
  CreditPackPurchaseRequestConfirmationResponse:
    createModelMethods<CreditPackPurchaseRequestConfirmationResponse>(
      "CreditPackPurchaseRequestConfirmationResponse"
    ),
  CreditPackRequestStatusCheck:
    createModelMethods<CreditPackRequestStatusCheck>(
      "CreditPackRequestStatusCheck"
    ),
  CreditPackPurchaseRequestStatus:
    createModelMethods<CreditPackPurchaseRequestStatus>(
      "CreditPackPurchaseRequestStatus"
    ),
  CreditPackStorageRetryRequest:
    createModelMethods<CreditPackStorageRetryRequest>(
      "CreditPackStorageRetryRequest"
    ),
  CreditPackStorageRetryRequestResponse:
    createModelMethods<CreditPackStorageRetryRequestResponse>(
      "CreditPackStorageRetryRequestResponse"
    ),
  InferenceAPIUsageRequest: createModelMethods<InferenceAPIUsageRequest>(
    "InferenceAPIUsageRequest"
  ),
  InferenceAPIUsageResponse: createModelMethods<InferenceAPIUsageResponse>(
    "InferenceAPIUsageResponse"
  ),
  InferenceAPIOutputResult: createModelMethods<InferenceAPIOutputResult>(
    "InferenceAPIOutputResult"
  ),
  InferenceConfirmation: createModelMethods<InferenceConfirmation>(
    "InferenceConfirmation"
  ),
};

/**
 * Initializes the database by calling the singleton's initializeDatabase method.
 * @returns {Promise<void>} A promise that resolves when the database is initialized.
 */
export async function initializeDatabase(): Promise<void> {
  try {
    const db = BrowserDatabase.getInstance();
    await db.initializeDatabase();
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }
}

export default BrowserDatabase;

