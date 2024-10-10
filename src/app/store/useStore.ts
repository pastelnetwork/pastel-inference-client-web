// src/app/store/useStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "../lib/api";
import * as initializeApp from "../lib/initializeApp";
import { CreditPack, ModelMenu } from "@/app/types";
import browserLogger from "@/app/lib/logger";
import { initWasm } from "../lib/wasmLoader";

interface WalletState {
  isLocked: boolean;
  networkMode: "Mainnet" | "Testnet" | "Devnet";
  pastelId: string;
  balance: number;
  addresses: string[];
  creditPacks: CreditPack[];
  modelMenu: ModelMenu | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
  promoGeneratorMessage: string | null;
  isGeneratingPromotionalPacks: boolean;
}

interface WalletActions {
  setLocked: (isLocked: boolean) => void;
  setNetworkMode: (mode: "Mainnet" | "Testnet" | "Devnet") => void;
  setPastelId: (id: string) => void;
  setBalance: (balance: number) => void;
  setAddresses: (addresses: string[]) => void;
  setCreditPacks: (packs: CreditPack[]) => void;
  setModelMenu: (menu: ModelMenu | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  initializeWallet: () => Promise<void>;
  lockWallet: () => Promise<void>;
  unlockWallet: (password: string) => Promise<void>;
  createNewAddress: () => Promise<void>;
  refreshWalletData: () => Promise<void>;
  fetchModelMenu: () => Promise<void>;
  setPromoGeneratorMessage: (message: string | null) => void;
  setGeneratingPromotionalPacks: (status: boolean) => void;
}

const useStore = create<WalletState & WalletActions>()(
  persist(
    (set, get) => ({
      isLocked: true,
      networkMode: "Mainnet",
      pastelId: "",
      balance: 0,
      addresses: [],
      creditPacks: [],
      modelMenu: null,
      isLoading: false,
      error: null,
      isInitialized: false,
      promoGeneratorMessage: '',
      isGeneratingPromotionalPacks: false,

      setLocked: (isLocked) => set({ isLocked }),
      setNetworkMode: (mode) => set({ networkMode: mode }),
      setPastelId: (id) => set({ pastelId: id }),
      setBalance: (balance) => set({ balance }),
      setAddresses: (addresses) => set({ addresses }),
      setCreditPacks: (packs) => set({ creditPacks: packs }),
      setModelMenu: (menu) => set({ modelMenu: menu }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setPromoGeneratorMessage: (promoGeneratorMessage) => set({ promoGeneratorMessage }),
      setGeneratingPromotionalPacks: (isGeneratingPromotionalPacks) => set({ isGeneratingPromotionalPacks }),

      initializeWallet: async () => {
        if (get().isLoading) {
          return
        }
        set({ isLoading: true, error: null });
        try {
          const wasmModule = await initWasm();
          if (!wasmModule) {
            throw new Error("Failed to initialize WASM module");
          }
          await initializeApp.initializeApp();
          const networkInfo = await api.getNetworkInfo();
          set({
            networkMode: networkInfo.network as "Mainnet" | "Testnet" | "Devnet",
            isInitialized: true,
          });
          await get().refreshWalletData();
        } catch (error) {
          console.error("Failed to initialize wallet:", error);
          set({ error: `Failed to initialize wallet: ${(error as Error).message}` });
        } finally {
          set({ isLoading: false });
        }
      },

      lockWallet: async () => {
        set({ isLoading: true, error: null });
        try {
          // Since there's no lockWallet function in the API, we'll just set the isLocked state
          set({ isLocked: true });
          browserLogger.info("Wallet locked");
        } catch (error) {
          browserLogger.error("Failed to lock wallet:", error);
          set({ error: `Failed to lock wallet: ${(error as Error).message}` });
        } finally {
          set({ isLoading: false });
        }
      },

      unlockWallet: async (password: string) => {
        set({ isLoading: true, error: null });
        try {
          // Since there's no unlockWallet function in the API, we'll use loadWallet
          await api.loadWallet("", password);
          set({ isLocked: false });
          await get().refreshWalletData();
        } catch (error) {
          browserLogger.error("Failed to unlock wallet:", error);
          set({
            error: `Failed to unlock wallet: ${(error as Error).message}`,
          });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      createNewAddress: async () => {
        set({ isLoading: true, error: null });
        try {
          if (get().isLocked) {
            throw new Error("Wallet is locked");
          }
          const newAddressResult = await api.createAndFundNewAddress(0);
          if (newAddressResult.newCreditTrackingAddress) {
            set((state) => ({
              addresses: [
                ...state.addresses,
                newAddressResult.newCreditTrackingAddress!,
              ],
            }));
          } else {
            throw new Error(
              "Failed to create new address: Address is undefined"
            );
          }
        } catch (error) {
          browserLogger.error("Failed to create new address:", error);
          set({
            error: `Failed to create new address: ${(error as Error).message}`,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      refreshWalletData: async () => {
        set({ isLoading: true, error: null });
        if (get().isLocked) {
          set({ isLoading: false });
          return;
        }
        try {
          const balance = await api.getBalance();
          const addressAmounts = await api.listAddressAmounts();
          const addresses = Object.keys(addressAmounts);
          const pastelIDs = await api.listPastelIDs();
          const creditPacks = await api.getMyValidCreditPacks();

          set({
            balance,
            addresses,
            pastelId: pastelIDs[0] || "",
            creditPacks,
          });
        } catch (error) {
          browserLogger.error("Failed to refresh wallet data:", error);
          set({
            error: `Failed to refresh wallet data: ${(error as Error).message}`,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      fetchModelMenu: async () => {
        set({ isLoading: true, error: null });
        try {
          const menu = await api.getInferenceModelMenu();
          set({ modelMenu: menu });
        } catch (error) {
          browserLogger.error("Failed to fetch model menu:", error);
          set({
            error: `Failed to fetch model menu: ${(error as Error).message}`,
          });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: "pastel-wallet-storage",
      partialize: (state) => ({
        networkMode: state.networkMode,
        pastelId: state.pastelId,
        addresses: state.addresses,
      }),
    }
  )
);

export default useStore;
