// src/app/store/useStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "../lib/api";
import * as initializeApp from "../lib/initializeApp";
import {
  CreditPack,
  ModelMenu,
  InferenceRequestParams,
  InferenceResult,
  CreditPackCreationResult,
  CreditPackTicketInfo,
  UserMessage,
  PastelIDType,
  SupernodeInfo,
  EmscriptenModule,
} from "@/app/types";
import browserLogger from "@/app/lib/logger";
import { generateSecurePassword } from "../lib/passwordUtils";
import { initWasm } from "../lib/wasmLoader";
declare const Module: EmscriptenModule;

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
  walletPassword: string | null;
}

interface WalletActions {
  setLocked: (isLocked: boolean) => void;
  unlockWallet: () => Promise<boolean>;
  setNetworkMode: (mode: "Mainnet" | "Testnet" | "Devnet") => void;
  setPastelId: (id: string) => void;
  setBalance: (balance: number) => void;
  setAddresses: (addresses: string[]) => void;
  setCreditPacks: (packs: CreditPack[]) => void;
  setModelMenu: (menu: ModelMenu | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setPromoGeneratorMessage: (message: string | null) => void;
  setGeneratingPromotionalPacks: (status: boolean) => void;
  initializeWallet: () => Promise<void>;
  lockWallet: () => Promise<void>;
  createNewAddress: () => Promise<void>;
  refreshWalletData: () => Promise<void>;
  fetchModelMenu: () => Promise<void>;
  changeNetwork: (
    newNetwork: string
  ) => Promise<{ success: boolean; message: string }>;
  getNetworkInfo: () => Promise<{ network: string }>;
  getBestSupernodeUrl: (userPastelID: string) => Promise<string>;
  getInferenceModelMenu: () => Promise<ModelMenu>;
  estimateCreditPackCost: (
    desiredNumberOfCredits: number,
    creditPriceCushionPercentage: number
  ) => Promise<number>;
  sendMessage: (
    toPastelID: string,
    messageBody: string
  ) => Promise<{
    sent_messages: UserMessage[];
    received_messages: UserMessage[];
  }>;
  getReceivedMessages: () => Promise<UserMessage[]>;
  createCreditPackTicket: (
    numCredits: number,
    creditUsageTrackingPSLAddress: string,
    maxTotalPrice: number,
    maxPerCreditPrice: number
  ) => Promise<CreditPackCreationResult>;
  getCreditPackInfo: (txid: string) => Promise<CreditPackTicketInfo>;
  getMyValidCreditPacks: () => Promise<CreditPack[]>;
  getMyPslAddressWithLargestBalance: () => Promise<string>;
  createInferenceRequest: (
    params: InferenceRequestParams
  ) => Promise<InferenceResult | null>;
  checkSupernodeList: () => Promise<{
    validMasternodeListFullDF: SupernodeInfo[];
  }>;
  registerPastelID: (
    pastelid: string,
    address: string,
    fee?: number
  ) => Promise<string>;
  listPastelIDs: () => Promise<string[]>;
  checkForPastelID: () => Promise<string | null>;
  isCreditPackConfirmed: (txid: string) => Promise<boolean>;
  createAndRegisterPastelID: () => Promise<{ pastelID: string; txid: string }>;
  isPastelIDRegistered: (pastelID: string) => Promise<boolean>;
  setPastelIdAndPassphrase: (
    pastelID: string,
    passphrase: string
  ) => Promise<void>;
  ensureMinimalPSLBalance: (addresses: string[] | null) => Promise<void>;
  checkPastelIDValidity: (pastelID: string) => Promise<boolean>;
  verifyPastelID: (pastelID: string) => Promise<boolean>;
  verifyTrackingAddress: (address: string) => Promise<boolean>;
  checkTrackingAddressBalance: (
    creditPackTicketId: string
  ) => Promise<{ address: string; balance: number }>;
  importPastelID: (
    fileContent: string,
    network: string,
    passphrase: string
  ) => Promise<{ success: boolean; message: string }>;
  createWalletFromMnemonic: (
    password: string,
    mnemonic: string
  ) => Promise<string>;
  loadWalletFromDatFile: (walletData: ArrayBuffer) => Promise<boolean>;
  downloadWalletToDatFile: (filename?: string) => Promise<boolean>;
  selectAndReadWalletFile: () => Promise<string>;
  waitForPastelIDRegistration: (pastelID: string) => Promise<boolean>;
  waitForCreditPackConfirmation: (txid: string) => Promise<boolean>;
  getBurnAddress: () => Promise<string>;
  signMessageWithPastelID: (
    pastelid: string,
    messageToSign: string,
    type?: PastelIDType
  ) => Promise<string>;
  verifyMessageWithPastelID: (
    pastelid: string,
    messageToVerify: string,
    pastelIDSignatureOnMessage: string
  ) => Promise<boolean>;
  getCurrentPastelBlockHeight: () => Promise<number>;
  getBestBlockHashAndMerkleRoot: () => Promise<[string, string, number]>;
  sendToAddress: (address: string, amount: number) => Promise<string>;
  sendMany: (amounts: { address: string; amount: number }[]) => Promise<string>;
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
      promoGeneratorMessage: "",
      isGeneratingPromotionalPacks: false,
      walletPassword: null,

      setLocked: (isLocked) => set({ isLocked }),
      setNetworkMode: (mode) => set({ networkMode: mode }),
      setPastelId: (id) => set({ pastelId: id }),
      setBalance: (balance) => set({ balance }),
      setAddresses: (addresses) => set({ addresses }),
      setCreditPacks: (packs) => set({ creditPacks: packs }),
      setModelMenu: (menu) => set({ modelMenu: menu }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setPromoGeneratorMessage: (promoGeneratorMessage) =>
        set({ promoGeneratorMessage }),
      setGeneratingPromotionalPacks: (isGeneratingPromotionalPacks) =>
        set({ isGeneratingPromotionalPacks }),

      initializeWallet: async () => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });
        try {
          console.log("Starting wallet initialization");
          const wasmModule = await initWasm();
          if (!wasmModule) {
            throw new Error("Failed to initialize WASM module");
          }
          console.log("WASM module initialized");

          await new Promise<void>((resolve) => {
            if (Module.calledRun) {
              resolve();
            } else {
              Module.onRuntimeInitialized = resolve;
            }
          });
          console.log("Module runtime initialized");

          await initializeApp.initializeApp();
          console.log("App initialized");

          const networkInfo = await api.getNetworkInfo();
          console.log("Network info retrieved:", networkInfo);

          let password = localStorage.getItem("walletPassword");
          if (!password) {
            password = generateSecurePassword();
            localStorage.setItem("walletPassword", password);
            console.log("New wallet password generated");
          } else {
            console.log("Existing wallet password retrieved");
          }

          // Try to create a new wallet or unlock existing one
          let unlocked = false;
          try {
            console.log("Attempting to create new wallet");
            await api.createNewWallet(password);
            console.log("New wallet created successfully");
            unlocked = true;
          } catch (createError) {
            console.log(
              "Wallet creation failed, attempting to unlock existing wallet:",
              createError
            );
            try {
              unlocked = await api.unlockWallet(password);
              if (unlocked) {
                console.log("Existing wallet unlocked successfully");
              } else {
                throw new Error("Failed to unlock existing wallet");
              }
            } catch (unlockError) {
              console.error("Error unlocking wallet:", unlockError);
              throw unlockError;
            }
          }

          if (!unlocked) {
            throw new Error("Failed to create or unlock wallet");
          }

          set({
            networkMode: networkInfo.network as
              | "Mainnet"
              | "Testnet"
              | "Devnet",
            isInitialized: true,
            isLocked: false,
            walletPassword: password,
          });

          console.log("Wallet state set, waiting before refreshing data");
          await new Promise((resolve) => setTimeout(resolve, 2000));

          try {
            console.log("Refreshing wallet data");
            await get().refreshWalletData();
            console.log("Wallet data refreshed successfully");
          } catch (refreshError) {
            console.warn(
              "Failed to refresh wallet data, but wallet is initialized:",
              refreshError
            );
          }

          // Check for existing PastelID, but don't create one automatically
          const existingPastelId = await api.checkForPastelID();
          if (existingPastelId) {
            console.log("Existing PastelID found:", existingPastelId);
            await api.setPastelIdAndPassphrase(existingPastelId, password);
            set({ pastelId: existingPastelId });
          } else {
            console.log(
              "No PastelID found. User may need to create a new one or import a promo pack."
            );
          }
        } catch (error) {
          console.error("Failed to initialize wallet:", error);
          set({
            error: `Failed to initialize wallet: ${(error as Error).message}`,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      unlockWallet: async () => {
        const password = get().walletPassword;
        if (!password) {
          console.error("No wallet password found");
          return false;
        }
        try {
          const unlocked = await api.unlockWallet(password);
          set({ isLocked: !unlocked });
          return unlocked;
        } catch (error) {
          console.error("Failed to unlock wallet:", error);
          return false;
        }
      },

      lockWallet: async () => {
        set({ isLoading: true, error: null });
        try {
          set({ isLocked: true });
          browserLogger.info("Wallet locked");
        } catch (error) {
          browserLogger.error("Failed to lock wallet:", error);
          set({ error: `Failed to lock wallet: ${(error as Error).message}` });
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
          const newAddress = await api.makeNewAddress();
          if (!newAddress) {
            throw new Error("Failed to create new address");
          }
          set((state) => ({
            addresses: [...state.addresses, newAddress],
          }));
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
          let addresses: string[] = [];
          let addressAmounts: { [address: string]: number } = {};
          try {
            addressAmounts = await api.listAddressAmounts();
            addresses = Object.keys(addressAmounts);
          } catch (error) {
            console.error("Error getting address amounts:", error);
          }
          let pastelIDs: string[] = [];
          try {
            pastelIDs = await api.listPastelIDs();
          } catch (error) {
            console.error("Error listing PastelIDs:", error);
          }
          let creditPacks: CreditPack[] = [];
          try {
            creditPacks = await api.getMyValidCreditPacks();
          } catch (error) {
            console.error("Error getting valid credit packs:", error);
          }

          set({
            balance,
            addresses,
            pastelId: pastelIDs[0] || "",
            creditPacks,
          });
        } catch (error) {
          console.error("Failed to refresh wallet data:", error);
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
          console.error("Failed to fetch model menu:", error);
          // Set an empty model menu instead of an error
          set({ modelMenu: { models: [] } });
        } finally {
          set({ isLoading: false });
        }
      },

      changeNetwork: api.changeNetwork,
      getNetworkInfo: api.getNetworkInfo,
      getBestSupernodeUrl: api.getBestSupernodeUrl,
      getInferenceModelMenu: api.getInferenceModelMenu,
      estimateCreditPackCost: api.estimateCreditPackCost,
      sendMessage: api.sendMessage,
      getReceivedMessages: api.getReceivedMessages,
      createCreditPackTicket: api.createCreditPackTicket,
      getCreditPackInfo: api.getCreditPackInfo,
      getMyValidCreditPacks: api.getMyValidCreditPacks,
      getMyPslAddressWithLargestBalance: api.getMyPslAddressWithLargestBalance,
      createInferenceRequest: api.createInferenceRequest,
      checkSupernodeList: api.checkSupernodeList,

      // Corrected registerPastelID signature and mapping
      registerPastelID: async (
        pastelid: string,
        address: string,
        fee?: number
      ) => {
        return await api.registerPastelID(pastelid, address, fee);
      },

      listPastelIDs: api.listPastelIDs,
      checkForPastelID: api.checkForPastelID,
      isCreditPackConfirmed: api.isCreditPackConfirmed,
      createAndRegisterPastelID: api.createAndRegisterPastelID,
      isPastelIDRegistered: api.isPastelIDRegistered,
      setPastelIdAndPassphrase: api.setPastelIdAndPassphrase,
      ensureMinimalPSLBalance: api.ensureMinimalPSLBalance,
      checkPastelIDValidity: api.checkPastelIDValidity,
      verifyPastelID: api.verifyPastelID,
      verifyTrackingAddress: api.verifyTrackingAddress,
      checkTrackingAddressBalance: api.checkTrackingAddressBalance,
      importPastelID: api.importPastelID,
      createWalletFromMnemonic: api.createWalletFromMnemonic,
      loadWalletFromDatFile: api.loadWalletFromDatFile,
      downloadWalletToDatFile: api.downloadWalletToDatFile,
      selectAndReadWalletFile: api.selectAndReadWalletFile,
      waitForPastelIDRegistration: api.waitForPastelIDRegistration,
      waitForCreditPackConfirmation: api.waitForCreditPackConfirmation,
      getBurnAddress: api.getBurnAddress,

      // Corrected signMessageWithPastelID signature and mapping
      signMessageWithPastelID: (
        pastelid: string,
        messageToSign: string,
        type?: PastelIDType
      ) => api.signMessageWithPastelID(pastelid, messageToSign, type),

      // Corrected verifyMessageWithPastelID signature and mapping
      verifyMessageWithPastelID: (
        pastelid: string,
        messageToVerify: string,
        pastelIDSignatureOnMessage: string
      ) =>
        api.verifyMessageWithPastelID(
          pastelid,
          messageToVerify,
          pastelIDSignatureOnMessage
        ),

      getCurrentPastelBlockHeight: api.getCurrentPastelBlockHeight,
      getBestBlockHashAndMerkleRoot: api.getBestBlockHashAndMerkleRoot,
      sendToAddress: api.sendToAddress,
      sendMany: api.sendMany,
    }),
    {
      name: "pastel-wallet-storage",
      partialize: (state) => ({
        networkMode: state.networkMode,
        pastelId: state.pastelId,
        addresses: state.addresses,
        walletPassword: state.walletPassword,
      }),
    }
  )
);

export default useStore;
