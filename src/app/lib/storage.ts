// src/app/lib/storage.ts

'use client';

import BrowserDatabase from "./BrowserDatabase";
import { PastelID } from "@/app/types";
import browserLogger from "@/app/lib/logger";

class BrowserStorage {
  private static instance: BrowserStorage;
  private browserDB: BrowserDatabase;
  private storageInitialized: boolean;

  private constructor() {
    this.browserDB = BrowserDatabase.getInstance();
    this.storageInitialized = false;
  }

  public static getInstance(): BrowserStorage {
    if (!BrowserStorage.instance) {
      BrowserStorage.instance = new BrowserStorage();
    }
    return BrowserStorage.instance;
  }

  public async initializeStorage(): Promise<void> {
    if (!this.storageInitialized) {
      try {
        await this.browserDB.initializeDatabase();
        browserLogger.info("Storage initialized successfully");
        this.storageInitialized = true;
      } catch (error) {
        browserLogger.error(
          `Error initializing storage: ${
            (error as Error).message.slice(0, 100)
          }`
        );
        throw error;
      }
    }
  }

  public async getCurrentPastelIdAndPassphrase(): Promise<PastelID> {
    try {
      await this.initializeStorage();
      const pastelID = localStorage.getItem("MY_LOCAL_PASTELID");
      const passphrase = localStorage.getItem("MY_PASTELID_PASSPHRASE");

      if (!pastelID || !passphrase) {
        browserLogger.warn("PastelID or passphrase not found in storage");
        return { pastelID: null, passphrase: null };
      }

      browserLogger.info(`Retrieved PastelID from storage: ${pastelID}`);
      return { pastelID, passphrase };
    } catch (error) {
      browserLogger.error(
        `Error retrieving PastelID and passphrase: ${(
          error as Error
        ).message.slice(0, 100)}`
      );
      return { pastelID: null, passphrase: null };
    }
  }

  public async setPastelIdAndPassphrase(
    pastelID: string,
    passphrase: string
  ): Promise<void> {
    if (!pastelID || !passphrase) {
      browserLogger.error("Attempted to set empty PastelID or passphrase");
      throw new Error("PastelID and passphrase must not be empty");
    }

    try {
      await this.initializeStorage();
      localStorage.setItem("MY_LOCAL_PASTELID", pastelID);
      localStorage.setItem("MY_PASTELID_PASSPHRASE", passphrase);
      browserLogger.info(`Set PastelID: ${pastelID}`);
    } catch (error) {
      browserLogger.error(
        `Error setting PastelID and passphrase: ${(
          error as Error
        ).message.slice(0, 100)}`
      );
      throw error;
    }
  }

  public async storeData<T>(storeName: string, data: T): Promise<IDBValidKey> {
    await this.initializeStorage();
    return this.browserDB.addData(storeName, data);
  }

  public async retrieveData<T>(
    storeName: string,
    id: IDBValidKey
  ): Promise<T | undefined> {
    await this.initializeStorage();
    return this.browserDB.getData<T>(storeName, id);
  }

  public async updateData<T>(
    storeName: string,
    id: IDBValidKey,
    data: T
  ): Promise<IDBValidKey> {
    await this.initializeStorage();
    return this.browserDB.updateData(storeName, id, data);
  }

  public async deleteData(storeName: string, id: IDBValidKey): Promise<void> {
    await this.initializeStorage();
    return this.browserDB.deleteData(storeName, id);
  }

  public async getNetworkFromLocalStorage(): Promise<string> {
    return localStorage.getItem("PASTEL_NETWORK") || "Mainnet";
  }

  public async setNetworkInLocalStorage(network: string): Promise<void> {
    localStorage.setItem("PASTEL_NETWORK", network);
  }

  public async storeSecureContainer(
    pastelID: string,
    secureContainer: string,
    network: string
  ): Promise<void> {
    localStorage.setItem(
      `secureContainer_${pastelID}_${network}`,
      secureContainer
    );
  }
}

const browserStorage = BrowserStorage.getInstance();
export default browserStorage;

export async function getCurrentPastelIdAndPassphrase(): Promise<PastelID> {
  return browserStorage.getCurrentPastelIdAndPassphrase();
}

export async function setPastelIdAndPassphrase(
  pastelID: string,
  passphrase: string
): Promise<void> {
  return browserStorage.setPastelIdAndPassphrase(pastelID, passphrase);
}

export async function getNetworkFromLocalStorage(): Promise<string> {
  return browserStorage.getNetworkFromLocalStorage();
}

export async function setNetworkInLocalStorage(network: string): Promise<void> {
  return browserStorage.setNetworkInLocalStorage(network);
}

export async function storeSecureContainer(
  pastelID: string,
  secureContainer: string,
  network: string
): Promise<void> {
  return browserStorage.storeSecureContainer(
    pastelID,
    secureContainer,
    network
  );
}

export async function storeData<T>(
  storeName: string,
  data: T
): Promise<IDBValidKey> {
  return browserStorage.storeData(storeName, data);
}

export async function retrieveData<T>(
  storeName: string,
  id: IDBValidKey
): Promise<T | undefined> {
  return browserStorage.retrieveData(storeName, id);
}

export async function updateData<T>(
  storeName: string,
  id: IDBValidKey,
  data: T
): Promise<IDBValidKey> {
  return browserStorage.updateData(storeName, id, data);
}

export async function deleteData(
  storeName: string,
  id: IDBValidKey
): Promise<void> {
  return browserStorage.deleteData(storeName, id);
}