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
  WalletData,
  InferenceRequest,
} from "@/app/types";
import browserLogger from "@/app/lib/logger";
import { generateSecurePassword } from "../lib/passwordUtils";
import { initWasm } from "../lib/wasmLoader";
import * as utils from "@/app/lib/utils";
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
  pastelIDs: string[];
  selectedPastelID: string;
  walletBalance: string;
  myPslAddress: string;
  qrCodeContent: string;
  localPastelID: string;
  showConnectWallet: boolean;
  requests: InferenceRequest[];
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
    passphrase: string,
    pastelID: string
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
  setMyPslAddress: (address: string) => void;
  setSelectedPastelID: (address: string) => void;
  setPastelIDs: (pastelIDs: string[]) => void;
  setWalletBalance: (walletBalance: string) => void;
  fetchWalletInfo: () => Promise<void>;
  fetchPastelIDs: () => Promise<void>;
  fetchMyPslAddress: () => Promise<void>;
  setQRCodeContent: (qrCode: string) => void;
  saveWalletToLocalStorage: () => void;
  loadWalletFromLocalStorage: () => Promise<boolean>;
  setShowConnectWallet: (status: boolean) => void;
  closeQRCodeScan: () => void;
  createNewWallet: () => void;
  importedWalletByQRCode: () => void;
  getRequests: () => void;
}

const walletLocalStorageName = 'walletInfo';

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
      pastelIDs: [],
      selectedPastelID: "",
      walletBalance: "Loading...",
      myPslAddress: "",
      qrCodeContent: "",
      localPastelID: "",
      showConnectWallet: false,
      requests: [],

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
      setMyPslAddress: (address) => set({ myPslAddress: address }),
      setSelectedPastelID: (address) => set({ selectedPastelID: address }),
      setPastelIDs: (pastelIDs) => set({ pastelIDs }),
      setWalletBalance: (walletBalance: string) => set({ walletBalance }),
      setQRCodeContent: (qrCode: string) => set({ qrCodeContent: qrCode }),
      setShowConnectWallet: (status: boolean) => set({ showConnectWallet: status }),

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
          // Initialize the app
          await initializeApp.initializeApp();

          // Retrieve network info
          let networkInfo;
          try {
            networkInfo = await api.getNetworkInfo();
          } catch (error) {
            console.error("Failed to get network info:", error);
            throw new Error("Failed to retrieve network information");
          }

          const result = await get().loadWalletFromLocalStorage();
          if (result) {
            return
          }

          if (get().showQRScanner) {
            await new Promise<void>((resolve) => {
              const checkAcknowledgement = () => {
                if (!get().showQRScanner) {
                  resolve();
                } else {
                  setTimeout(checkAcknowledgement, 1000);
                }
              };
              checkAcknowledgement();
            });
          }

          set({ showConnectWallet: true });
          await new Promise<void>((resolve) => {
            const checkAcknowledgement = () => {
              if (!get().showConnectWallet) {
                resolve();
              } else {
                setTimeout(checkAcknowledgement, 1000);
              }
            };
            checkAcknowledgement();
          });

          if (get().showConnectWallet || get().showQRScanner) {
            return;
          }

          // Handle wallet password
          let password = localStorage.getItem("walletPassword");
          let isNewWalletPassword = false;
          if (!password) {
            password = generateSecurePassword();
            console.log("New wallet password generated");
            isNewWalletPassword = true;
            localStorage.setItem("walletPassword", password);
          } else {
            console.log("Existing wallet password retrieved");
          }

          // Attempt to create or unlock wallet
          try {
            console.log("Attempting to create or unlock wallet");
            await api.createNewWallet(password);
            const unlocked = await get().unlockWallet(password);
            if (!unlocked) {
              throw new Error("Failed to unlock wallet");
            }
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
              const unlocked = await get().unlockWallet(password);
              if (!unlocked) {
                throw new Error("Failed to unlock newly created wallet");
              }
            } else {
              throw error;
            }
          }

          set({
            networkMode: networkInfo.network as
              | "Mainnet"
              | "Testnet"
              | "Devnet",
            isLocked: false,
            walletPassword: password,
          });

          console.log("Checking for existing PastelID");
          let existingPastelID;
          try {
            existingPastelID = await api.checkForPastelID();
            if (!existingPastelID) {
              const newPastelID = await api.makeNewPastelID(false);
              set({ localPastelID: newPastelID });
            }
            const addressCount = await api.getAddressesCount();
            if (!addressCount) {
              await api.makeNewAddress();
            }
          } catch (error) {
            console.error("Error checking for PastelID:", error);
            existingPastelID = null;
          }

          if (existingPastelID) {
            console.log("Existing PastelID found:", existingPastelID);
            set({ pastelId: existingPastelID });
          } else {
            console.log("No existing PastelID found");
          }

          console.log("Wallet state set, waiting before refreshing data");
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await get().saveWalletToLocalStorage();
          try {
            await get().refreshWalletData();
          } catch (error) {
            console.error("Failed to refresh wallet data:", error);
            // Continue initialization even if refresh fails
          }

          // Set isInitialized to true if we have both a PastelID and the wallet is unlocked
          if (get().pastelId && !get().isLocked) {
            set({ isInitialized: true });
            if (isNewWalletPassword) {
              const walletContent = await api.exportWallet();
              set({ initialPassword: password, showPasswordQR: true, qrCodeContent: btoa(JSON.stringify({
                walletContent,
                initialPassword: password,
              })) });
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
            }
            console.log("Wallet initialization complete");
          } else {
            console.log(
              "Wallet initialization incomplete: missing PastelID or wallet is locked"
            );
            set({
              error:
                "Wallet initialization incomplete. Please ensure you have a PastelID and the wallet is unlocked.",
            });
          }
        } catch (error) {
          console.error("Failed to initialize wallet:", error);
          set({
            error: `Failed to initialize wallet: ${(error as Error).message}`,
            isInitialized: false,
          });
        } finally {
          clearTimeout(initializationTimeout);
          set({ isLoading: false });
        }
      },

      closeQRCodeScan() {
        set({ showConnectWallet: true, showQRScanner: false });
      },

      createNewWallet() {
        set({ showConnectWallet: false, showQRScanner: false });
      },

      importedWalletByQRCode() {
        set({ showConnectWallet: false, showQRScanner: false, isInitialized: true, isLoading: false });
      },

      unlockWallet: async (password: string): Promise<boolean> => {
        set({ isLoading: true, error: null });
        try {
          const unlocked = await api.unlockWallet(password);
          if (!unlocked) {
            throw new Error("Failed to unlock wallet");
          }
          set({ isLocked: false, walletPassword: password });
          await get().refreshWalletData();
          return true; // Return true if the wallet was successfully unlocked
        } catch (error) {
          console.error("Failed to unlock wallet:", error);
          set({
            error: `Failed to unlock wallet: ${(error as Error).message}`,
          });
          return false; // Return false if there was an error unlocking the wallet
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
          get().saveWalletToLocalStorage();
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
      ) => {
        return await api.registerPastelID(pastelid, address);
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
      fetchWalletInfo: async () => {
        try {
          const balance = await api.getBalance();
          get().setWalletBalance(
            utils.parseAndFormatNumber(balance.toString())
          );
        } catch (error) {
          browserLogger.error("Error retrieving wallet info:", error);
          get().setWalletBalance("Failed to load balance");
        }
      },
      fetchPastelIDs: async () => {
        try {
          const listPastelIDs = await api.listPastelIDs();
          const localPastelID = get().localPastelID
          const ids = listPastelIDs.filter((value) => value !== localPastelID)
          get().setPastelIDs(ids);
          if (ids.length > 0) {
            get().setSelectedPastelID(ids[0]);
            get().setPastelId(ids[0]);
          }
        } catch (error) {
          browserLogger.error("Error fetching PastelIDs:", error);
        }
      },
      fetchMyPslAddress: async () => {
        try {
          const address = await api.getMyPslAddressWithLargestBalance();
          get().setMyPslAddress(address);
        } catch (error) {
          browserLogger.error("Error fetching PSL address:", error);
        }
      },
      saveWalletToLocalStorage: async () => {
        const walletInfo = await api.exportWallet();
        const balance = await api.getBalance();
        const listPastelIDs = await api.listPastelIDs();
        const localPastelID = get().localPastelID
        const ids = listPastelIDs.filter((value) => value !== localPastelID);
        const addresses = await api.getAllAddresses();
        localStorage.removeItem(walletLocalStorageName);
        localStorage.setItem(walletLocalStorageName, btoa(JSON.stringify({
          wallet: walletInfo,
          balance,
          listPastelIDs: ids,
          addresses,
          localPastelID,
          walletPassword: localStorage.getItem('walletPassword')
        })))
      },
      loadWalletFromLocalStorage: async () => {
        const walletData = localStorage.getItem(walletLocalStorageName);
        if (walletData) {
          const parseWalletData = JSON.parse(atob(walletData)) as WalletData;
          if (parseWalletData.walletPassword) {
            const success = await api.importWalletFromDatFile(parseWalletData.wallet, parseWalletData.walletPassword);
            if (success) {
              set({ isLoading: false, isInitialized: true });
              get().unlockWallet(parseWalletData.walletPassword);
              await get().refreshWalletData();
              const listPastelIDs = await api.listPastelIDs();
              const ids = listPastelIDs.filter((value) => value !== parseWalletData.localPastelID);
              set({ pastelId: ids[0] || "", localPastelID: parseWalletData.localPastelID });
              await api.setPastelIdAndPassphrase(localStorage.getItem('MY_LOCAL_PASTELID') || '', localStorage.getItem('MY_PASTELID_PASSPHRASE') || '');
              return true;
            }
          }
        }
        return false;
      },
      getRequests: () => {
        const storedRequests = localStorage.getItem('inferenceRequests');
        if (storedRequests) {
          set({ requests: JSON.parse(storedRequests) });
        }
      },
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
