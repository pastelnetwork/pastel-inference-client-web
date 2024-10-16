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
  showPasswordQR: boolean;
  initialPassword: string | null;
  walletPassword: string | null;
  showQRScanner: boolean;
}

interface WalletActions {
  setLocked: (isLocked: boolean) => void;
  unlockWallet: (password: string) => Promise<boolean>;
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
  setShowPasswordQR: (show: boolean) => void;
  setInitialPassword: (password: string | null) => void;
  setShowQRScanner: (show: boolean) => void;
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
      showPasswordQR: false,
      initialPassword: null,
      showQRScanner: false,

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
      setShowPasswordQR: (show) => set({ showPasswordQR: show }),
      setInitialPassword: (password) => set({ initialPassword: password }),
      setShowQRScanner: (show) => set({ showQRScanner: show }),
      initializeWallet: async () => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });

        const initializationTimeout = setTimeout(() => {
          console.error("Wallet initialization timed out");
          set({ isLoading: false, error: "Wallet initialization timed out" });
        }, 30000);

        try {
          console.log("Starting wallet initialization");

          const wasmModule = await initWasm();
          if (!wasmModule) {
            throw new Error("Failed to initialize WASM module");
          }

          await new Promise<void>((resolve) => {
            if (Module.calledRun) {
              resolve();
            } else {
              Module.onRuntimeInitialized = resolve;
            }
          });

          await initializeApp.initializeApp();
          const networkInfo = await api.getNetworkInfo();

          let password = localStorage.getItem("walletPassword");
          if (!password) {
            password = generateSecurePassword();
            console.log("New wallet password generated");
            set({ initialPassword: password, showPasswordQR: true });
            await new Promise<void>((resolve) => {
              const checkAcknowledgement = () => {
                if (!get().showPasswordQR) {
                  resolve();
                } else {
                  setTimeout(checkAcknowledgement, 1000);
                }
              };
              checkAcknowledgement();
            });
            localStorage.setItem("walletPassword", password);
          } else {
            console.log("Existing wallet password retrieved");
          }

          try {
            console.log("Attempting to unlock or create wallet");
            await api.createNewWallet(password);
            await get().unlockWallet(password);
            console.log("Wallet unlocked successfully");
          } catch (error) {
            console.error("Error during wallet unlock/creation:", error);
            if (
              error instanceof Error &&
              (error.message.includes("Master key doesn't exist") ||
                error.message.includes("Failed to set master key"))
            ) {
              console.log("Resetting wallet due to persistent error");
              localStorage.removeItem("walletPassword");
              password = generateSecurePassword();
              set({ initialPassword: password, showPasswordQR: true });
              await new Promise<void>((resolve) => {
                const checkAcknowledgement = () => {
                  if (!get().showPasswordQR) {
                    resolve();
                  } else {
                    setTimeout(checkAcknowledgement, 1000);
                  }
                };
                checkAcknowledgement();
              });
              localStorage.setItem("walletPassword", password);
              await api.createNewWallet(password);
              await get().unlockWallet(password);
            } else {
              throw error;
            }
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

          await get().refreshWalletData();
        } catch (error) {
          console.error("Failed to initialize wallet:", error);
          set({
            error: `Failed to initialize wallet: ${(error as Error).message}`,
          });
        } finally {
          clearTimeout(initializationTimeout);
          set({ isLoading: false });
        }
      },

      unlockWallet: async (password: string) => {
        set({ isLoading: true, error: null });
        try {
          const unlocked = await api.unlockWallet(password);
          if (!unlocked) {
            throw new Error("Failed to unlock wallet");
          }
          set({ isLocked: false, walletPassword: password });
          await get().refreshWalletData();
        } catch (error) {
          console.error("Failed to unlock wallet:", error);
          set({
            error: `Failed to unlock wallet: ${(error as Error).message}`,
          });
        } finally {
          set({ isLoading: false });
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
