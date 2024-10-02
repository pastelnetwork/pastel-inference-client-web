// src/app/lib/storage.ts

import { BrowserRPCReplacement } from './BrowserRPCReplacement';
import { BrowserDatabase } from './BrowserDatabase';
import { PastelID, NetworkInfo } from '@/app/types';
import browserLogger from '@/app/lib/logger';
import pastelGlobals from '@/app/lib/globals';

class BrowserStorage {
  private browserDB: BrowserDatabase;
  private rpcReplacement: BrowserRPCReplacement;
  private storageInitialized: boolean;

  constructor() {
    this.browserDB = new BrowserDatabase();
    this.rpcReplacement = new BrowserRPCReplacement();
    this.storageInitialized = false;
  }

  async initializeStorage(): Promise<void> {
    if (!this.storageInitialized) {
      try {
        await this.browserDB.initializeDatabase();
        browserLogger.info("Storage initialized successfully");
        this.storageInitialized = true;
      } catch (error) {
        browserLogger.error(
          `Error initializing storage: ${(error as Error).message.slice(0, 100)}`
        );
        throw error;
      }
    }
  }

  async getCurrentPastelIdAndPassphrase(): Promise<PastelID> {
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
        `Error retrieving PastelID and passphrase: ${(error as Error).message.slice(0, 100)}`
      );
      return { pastelID: null, passphrase: null };
    }
  }

  async setPastelIdAndPassphrase(pastelID: string, passphrase: string): Promise<void> {
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
        `Error setting PastelID and passphrase: ${(error as Error).message.slice(0, 100)}`
      );
      throw error;
    }
  }

  async storeData<T>(storeName: string, data: T): Promise<IDBValidKey> {
    await this.initializeStorage();
    return this.browserDB.addData(storeName, data);
  }

  async retrieveData<T>(storeName: string, id: IDBValidKey): Promise<T | undefined> {
    await this.initializeStorage();
    return this.browserDB.getData<T>(storeName, id);
  }

  async updateData<T>(storeName: string, id: IDBValidKey, data: T): Promise<IDBValidKey> {
    await this.initializeStorage();
    return this.browserDB.updateData(storeName, id, data);
  }

  async deleteData(storeName: string, id: IDBValidKey): Promise<void> {
    await this.initializeStorage();
    return this.browserDB.deleteData(storeName, id);
  }

  async performRPCOperation<T>(method: keyof BrowserRPCReplacement, ...args: any[]): Promise<T> {
    return (this.rpcReplacement[method] as (...args: any[]) => Promise<T>)(...args);
  }

  async getNetworkFromLocalStorage(): Promise<string> {
    return localStorage.getItem('PASTEL_NETWORK') || 'Mainnet';
  }

  async setNetworkInLocalStorage(network: string): Promise<void> {
    localStorage.setItem('PASTEL_NETWORK', network);
  }
}

// Create and export a singleton instance
const browserStorage = new BrowserStorage();

export default browserStorage;

// Utility functions
export async function getCurrentPastelIdAndPassphrase(): Promise<PastelID> {
  return browserStorage.getCurrentPastelIdAndPassphrase();
}

export async function setPastelIdAndPassphrase(pastelID: string, passphrase: string): Promise<void> {
  return browserStorage.setPastelIdAndPassphrase(pastelID, passphrase);
}

export async function getNetworkFromLocalStorage(): Promise<string> {
  return browserStorage.getNetworkFromLocalStorage();
}

export async function setNetworkInLocalStorage(network: string): Promise<void> {
  return browserStorage.setNetworkInLocalStorage(network);
}
