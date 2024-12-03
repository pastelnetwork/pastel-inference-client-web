// src/app/lib/api.ts

import browserLogger from "@/app/lib/logger";
import BrowserRPCReplacement from './BrowserRPCReplacement';
import {
  getNetworkFromLocalStorage,
  setNetworkInLocalStorage,
  setPastelIdAndPassphrase as storageSetPastelIdAndPassphrase,
} from "./storage";
import * as endToEndFunctions from "./endToEndFunctions";
import * as utils from "./utils";
import pastelGlobals from "./globals";
import PastelInferenceClient from "./PastelInferenceClient";
import {
  SupernodeInfo,
  ModelMenu,
  CreditPack,
  InferenceRequestParams,
  InferenceResult,
  CreditPackCreationResult,
  CreditPackTicketInfo,
  UserMessage,
  WalletInfo,
  SendToAddressResult,
  PastelIDType,
  NetworkMode
} from "@/app/types";

let network: string = "Mainnet"; // Default value
let burnAddress: string = "PtpasteLBurnAddressXXXXXXXXXXbJ5ndd"; // Default Mainnet burn address

export async function changeNetwork(newNetwork: string): Promise<{ success: boolean; message: string }> {
  const rpc = BrowserRPCReplacement.getInstance();
  if (["Mainnet", "Testnet", "Devnet"].includes(newNetwork)) {
    await setNetworkInLocalStorage(newNetwork);
    const { network: configuredNetwork, burnAddress: configuredBurnAddress } = await configureRPCAndSetBurnAddress();
    network = configuredNetwork;
    burnAddress = configuredBurnAddress;
    await rpc.initialize();
    return { success: true, message: `Network changed to ${newNetwork}` };
  } else {
    return { success: false, message: "Invalid network specified" };
  }
}

async function configureRPCAndSetBurnAddress(): Promise<{
  network: string;
  burnAddress: string;
}> {
  let network = await getNetworkFromLocalStorage();
  if (!network) {
    network = "Mainnet";
    await setNetworkInLocalStorage(network);
  }

  let burnAddress: string;
  switch (network) {
    case "Mainnet":
      burnAddress = "PtpasteLBurnAddressXXXXXXXXXXbJ5ndd";
      break;
    case "Testnet":
      burnAddress = "tPpasteLBurnAddressXXXXXXXXXXX3wy7u";
      break;
    case "Devnet":
      burnAddress = "44oUgmZSL997veFEQDq569wv5tsT6KXf9QY7";
      break;
    default:
      throw new Error(`Unsupported network: ${network}`);
  }

  return { network, burnAddress };
}

export async function getNetworkInfo(): Promise<{ network: string }> {
  return { network };
}

export async function getBestSupernodeUrl(userPastelID: string): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  const supernodeListDF = await rpc.checkSupernodeList();
  const { url: supernodeURL } = await utils.getClosestSupernodeToPastelIDURL(
    userPastelID,
    supernodeListDF.validMasternodeListFullDF
  );
  if (!supernodeURL) {
    throw new Error("No valid supernode URL found.");
  }
  return supernodeURL;
}

export async function getInferenceModelMenu(): Promise<ModelMenu> {
  const pastelID = pastelGlobals.getPastelId();
  const passphrase = pastelGlobals.getPassphrase();
  
  if (!pastelID || !passphrase) {
    console.warn("PastelID or passphrase not set. Returning empty model menu.");
    return { models: [] }; // Return an empty menu
  }
  
  const pastelInferenceClient = new PastelInferenceClient({
    pastelID,
    passphrase,
  });
  return await pastelInferenceClient.getModelMenu();
}

export async function estimateCreditPackCost(
  desiredNumberOfCredits: number,
  creditPriceCushionPercentage: number
): Promise<number> {
  return await endToEndFunctions.estimateCreditPackCostEndToEnd(
    desiredNumberOfCredits,
    creditPriceCushionPercentage
  );
}

export async function sendMessage(
  toPastelID: string,
  messageBody: string
): Promise<{
  sent_messages: UserMessage[];
  received_messages: UserMessage[];
}> {
  const pastelID = pastelGlobals.getPastelId();
  const passphrase = pastelGlobals.getPassphrase();
  
  if (!pastelID || !passphrase) {
    console.warn("PastelID or passphrase not set. Cannot send message.");
    return { sent_messages: [], received_messages: [] };
  }
  
  return await endToEndFunctions.sendMessageAndCheckForNewIncomingMessages(
    toPastelID,
    messageBody
  );
}

export async function getReceivedMessages(): Promise<UserMessage[]> {
  const pastelID = pastelGlobals.getPastelId();
  const passphrase = pastelGlobals.getPassphrase();
  
  if (!pastelID || !passphrase) {
    console.warn("PastelID or passphrase not set. Cannot retrieve messages.");
    return [];
  }
  
  return await endToEndFunctions.checkForNewIncomingMessages();
}


export async function createCreditPackTicket(
  numCredits: number,
  creditUsageTrackingPSLAddress: string,
  maxTotalPrice: number,
  maxPerCreditPrice: number,
  callback: (value: string) => void
): Promise<CreditPackCreationResult> {
  return await endToEndFunctions.handleCreditPackTicketEndToEnd(
    numCredits,
    creditUsageTrackingPSLAddress,
    burnAddress,
    maxTotalPrice,
    maxPerCreditPrice,
    callback
  );
}

export async function getCreditPackInfo(txid: string): Promise<CreditPackTicketInfo> {
  return await endToEndFunctions.getCreditPackTicketInfoEndToEnd(txid);
}

export async function getMyValidCreditPacks(): Promise<CreditPack[]> {
  return await endToEndFunctions.getMyValidCreditPackTicketsEndToEnd();
}

export async function getMyPslAddressWithLargestBalance(): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.getMyPslAddressWithLargestBalance();
}

export async function createInferenceRequest(params: InferenceRequestParams, callback: (value: string) => void): Promise<InferenceResult | null> {
  return await endToEndFunctions.handleInferenceRequestEndToEnd(params, callback);
}

export async function checkSupernodeList(): Promise<{ validMasternodeListFullDF: SupernodeInfo[] }> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.checkSupernodeList();
}

export async function registerPastelID(pastelid: string, address: string): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.createRegisterPastelIdTransaction(pastelid, address);
}

export async function getPastelTicket(txid: string): Promise<unknown> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.getPastelTicket(txid);
}

export async function listContractTickets(ticketTypeIdentifier: string, startingBlockHeight: number = 0): Promise<unknown[]> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.listContractTickets(ticketTypeIdentifier, startingBlockHeight);
}

export async function findContractTicket(key: string): Promise<unknown> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.findContractTicket(key);
}

export async function getContractTicket(txid: string, decodeProperties: boolean = true): Promise<unknown> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.getContractTicket(txid, decodeProperties);
}

export async function importPrivKey(zcashPrivKey: string): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.importPrivKey(zcashPrivKey);
}

export async function listAddressAmounts(includeEmpty: boolean = false): Promise<{ [address: string]: number }> {
  try {
    const rpc = BrowserRPCReplacement.getInstance();
    return await rpc.listAddressAmounts(includeEmpty);
  } catch (error) {
    console.error("Error in listAddressAmounts:", error);
    throw error;
  }
}

export async function getBalance(): Promise<number> {
  try {
    const rpc = BrowserRPCReplacement.getInstance();
    const addresses = await rpc.getAllAddresses();
    let totalBalance = 0;
    for (const address of addresses) {
      try {
        const balance = await rpc.checkPSLAddressBalance(address);
        totalBalance += balance;
      } catch (error) {
        console.error(`Error getting balance for address ${address}:`, error);
      }
    }
    return totalBalance;
  } catch (error) {
    console.error("Error in getBalance:", error);
    return 0;
  }
}

export async function getWalletInfo(): Promise<WalletInfo> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.getWalletInfo();
}

export async function createAndFundNewAddress(amount: number): Promise<SendToAddressResult> {
  const rpc = BrowserRPCReplacement.getInstance();
  const result = await rpc.createAndFundNewPSLCreditTrackingAddress(amount);
  return {
    success: true,
    newCreditTrackingAddress: result.newCreditTrackingAddress || "",
    txid: result.txid || "",
  };
}

export async function listPastelIDs(): Promise<string[]> {
  try {
    const rpc = BrowserRPCReplacement.getInstance();
    const pastelIDs = await rpc.getPastelIDs();
    console.log("Retrieved PastelIDs:", pastelIDs);
    return pastelIDs;
  } catch (error) {
    console.error("Error listing PastelIDs:", error);
    return [];
  }
}

export async function makeNewAddress(mode: NetworkMode = NetworkMode.Mainnet): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.makeNewAddress(mode);
}

export async function checkForPastelID(): Promise<string | null> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.checkForRegisteredPastelID();
}

export async function isCreditPackConfirmed(txid: string): Promise<boolean> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.isCreditPackConfirmed(txid);
}

export async function createAndRegisterPastelID(): Promise<{ pastelID: string; txid: string }> {
  try {
    const rpc = BrowserRPCReplacement.getInstance();
    const pastelID = await rpc.makeNewPastelID(false);
    console.log("New PastelID created:", pastelID);
    const address = await rpc.getMyPslAddressWithLargestBalance();
    const txid = await rpc.createRegisterPastelIdTransaction(pastelID, address);
    console.log("PastelID registered with txid:", txid);
    return { pastelID, txid };
  } catch (error) {
    console.error("Error creating and registering PastelID:", error);
    throw error;
  }
}

export async function isPastelIDRegistered(pastelID: string): Promise<boolean> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.isPastelIDRegistered(pastelID);
}

export async function setPastelIdAndPassphrase(pastelID: string, passphrase: string): Promise<void> {
  await storageSetPastelIdAndPassphrase(pastelID, passphrase);
  pastelGlobals.setPastelIdAndPassphrase(pastelID, passphrase);
}

export async function ensureMinimalPSLBalance(addresses: string[] | null = null): Promise<void> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.ensureTrackingAddressesHaveMinimalPSLBalance(addresses);
}

export async function checkPastelIDValidity(pastelID: string): Promise<boolean> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.isPastelIDRegistered(pastelID);
}

export async function dumpPrivKey(tAddr: string): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.dumpPrivKey(tAddr);
}

export function safeString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

export async function verifyPastelID(pastelID: string): Promise<boolean> {
  const testMessage = "Verification test message";
  const rpc = BrowserRPCReplacement.getInstance();
  const signature = await rpc.signMessageWithPastelID(
    safeString(pastelID),
    testMessage,
    PastelIDType.PastelID
  );
  return await rpc.verifyMessageWithPastelID(
    safeString(pastelID),
    testMessage,
    signature
  );
}

export async function verifyTrackingAddress(address: string): Promise<boolean> {
  const rpc = BrowserRPCReplacement.getInstance();
  const balance = await rpc.checkPSLAddressBalance(address);
  return balance !== undefined;
}

export async function checkTrackingAddressBalance(creditPackTicketId: string): Promise<{ address: string; balance: number }> {
  const creditPackInfo = await getCreditPackInfo(creditPackTicketId);
  if (!creditPackInfo || !creditPackInfo.requestConfirmation) {
    throw new Error("Credit pack ticket not found or invalid");
  }
  const trackingAddress = safeString(creditPackInfo.requestConfirmation.credit_usage_tracking_psl_address);
  if (!trackingAddress) {
    throw new Error("Tracking address not found in credit pack ticket");
  }
  const rpc = BrowserRPCReplacement.getInstance();
  const balance = await rpc.checkPSLAddressBalance(trackingAddress);
  if (balance === undefined) {
    throw new Error("Failed to retrieve balance for the tracking address");
  }
  return { address: trackingAddress, balance: balance };
}

export async function unlockWallet(password: string): Promise<boolean> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.unlockWallet(password);
}

export async function createNewWallet(password: string): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.createNewWallet(password);
}

export async function importPastelID(fileContent: string | ArrayBuffer | null, network: string, passphrase: string, pastelID: string): Promise<{ success: boolean; message: string; importedPastelID: string }> {
  try {
    const rpc = BrowserRPCReplacement.getInstance();
    await rpc.initialize()
    return await rpc.importPastelIDFromFile(fileContent, network, passphrase, pastelID);
  } catch (error) {
    console.error("Error importing PastelID:", error);
    return { success: false, message: `Failed to import PastelID: ${(error as Error).message}`, importedPastelID: '' };
  }
}

export async function checkPSLAddressBalanceAlternative(addressToCheck: string): Promise<number> {
  const rpc = BrowserRPCReplacement.getInstance();
  const addressAmounts = await rpc.listAddressAmounts();
  return addressAmounts[addressToCheck] || 0;
}

export async function createWalletFromMnemonic(password: string, mnemonic: string): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.createWalletFromMnemonic(password, mnemonic);
}

export async function loadWalletFromDatFile(walletData: ArrayBuffer): Promise<boolean> {
  try {
    const rpc = BrowserRPCReplacement.getInstance();
    return await rpc.loadWalletFromDatFile(walletData);
  } catch (error) {
    console.error("Error loading wallet from .dat file:", error);
    return false;
  }
}

export async function downloadWalletToDatFile(filename: string = "pastel_wallet.dat"): Promise<boolean> {
  try {
    const rpc = BrowserRPCReplacement.getInstance();
    return await rpc.downloadWalletToDatFile(filename);
  } catch (error) {
    console.error("Error downloading wallet:", error);
    return false;
  }
}

export async function selectAndReadWalletFile(): Promise<string> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.readAsText(file, "UTF-8");
        reader.onload = (readerEvent) => {
          const content = readerEvent.target?.result as string;
          resolve(content);
        };
      } else {
        resolve("");
      }
    };
    input.click();
  });
}

export async function waitForPastelIDRegistration(pastelID: string): Promise<boolean> {
  const rpc = BrowserRPCReplacement.getInstance();
  return utils.waitForConfirmation(
    rpc.isPastelIDRegistered.bind(rpc),
    pastelID,
    {
      maxRetries: 20,
      retryDelay: 15000,
      actionName: "PastelID registration",
    }
  ) as Promise<boolean>;
}

export async function waitForCreditPackConfirmation(txid: string): Promise<boolean> {
  const rpc = BrowserRPCReplacement.getInstance();
  return utils.waitForConfirmation(
    rpc.isCreditPackConfirmed.bind(rpc),
    txid,
    {
      maxRetries: 40,
      retryDelay: 20000,
      actionName: "Credit pack confirmation",
    }
  ) as Promise<boolean>;
}

export async function getBurnAddress(): Promise<string> {
  const { network } = await getNetworkInfo();
  switch (network) {
    case "Mainnet":
      return "PtpasteLBurnAddressXXXXXXXXXXbJ5ndd";
    case "Testnet":
      return "tPpasteLBurnAddressXXXXXXXXXXX3wy7u";
    case "Devnet":
      return "44oUgmZSL997veFEQDq569wv5tsT6KXf9QY7";
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
}

export async function signMessageWithPastelID(
  pastelid: string,
  messageToSign: string,
  type: PastelIDType = PastelIDType.PastelID,
): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.signMessageWithPastelID(pastelid, messageToSign, type);
}

export async function verifyMessageWithPastelID(
  pastelid: string,
  messageToVerify: string,
  pastelIDSignatureOnMessage: string
): Promise<boolean> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.verifyMessageWithPastelID(pastelid, messageToVerify, pastelIDSignatureOnMessage);
}

export async function getCurrentPastelBlockHeight(): Promise<number> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.getCurrentPastelBlockHeight();
}

export async function getBestBlockHashAndMerkleRoot(): Promise<[string, string, number]> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.getBestBlockHashAndMerkleRoot();
}

export async function sendToAddress(address: string, amount: number): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  const amountFormatted = amount.toFixed(5);
  return await rpc.sendToAddress(address, amountFormatted);
}

export async function sendMany(amounts: { address: string; amount: number;}[]): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.sendMany(amounts);
}

export async function getAndDecodeRawTransaction(txid: string): Promise<unknown> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.getAndDecodeRawTransaction(txid);
}

export async function getTransactionDetails(txid: string, includeWatchonly: boolean = false): Promise<unknown> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.getTransactionDetails(txid, includeWatchonly);
}

export async function sendTrackingAmountFromControlAddressToBurnAddressToConfirmInferenceRequest(
  inferenceRequestId: string,
  creditUsageTrackingPSLAddress: string,
  creditUsageTrackingAmountInPSL: number,
  burnAddress: string,
  callback: (value: string) => void,
  onSaveLocalStorage: (value: string) => void,
): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.sendTrackingAmountFromControlAddressToBurnAddressToConfirmInferenceRequest(
    inferenceRequestId,
    creditUsageTrackingPSLAddress,
    creditUsageTrackingAmountInPSL,
    burnAddress,
    callback,
    onSaveLocalStorage
  );
}

export async function importAddress(address: string): Promise<void> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.importAddress(address);
}

export async function getBlockHash(blockHeight: number): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.getBlockHash(blockHeight);
}

export async function getBlock(blockHash: string): Promise<unknown> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.getBlock(blockHash);
}

export async function getAddressesCount(): Promise<number> {
  const rpc = BrowserRPCReplacement.getInstance();
  return rpc.getAddressesCount();
}

export async function makeNewPastelID(flag: boolean): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  return rpc.makeNewPastelID(flag);
}

export async function exportWallet(): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  return rpc.exportWallet();
}

export async function importWalletFromDatFile(walletData: ArrayBuffer | string, password: string): Promise<boolean> {
  try {
    browserLogger.info("Initializing WASM...");
    const rpc = BrowserRPCReplacement.getInstance();
    await rpc.initialize(true);
    browserLogger.info("WASM initialized successfully");
    await rpc.importWallet(walletData);
    await rpc.unlockWallet(password);
    localStorage.setItem('walletPassword', password)
    return true;
  } catch (error) {
    console.error("Error loading wallet from .dat file:", error);
    return false;
  }
}

export async function getAllAddresses(): Promise<string[]> {
  const rpc = BrowserRPCReplacement.getInstance();
  return rpc.getAllAddresses();
}

const api = {
  changeNetwork,
  unlockWallet,
  createNewWallet, 
  getNetworkInfo,
  getBestSupernodeUrl,
  getInferenceModelMenu,
  estimateCreditPackCost,
  sendMessage,
  getReceivedMessages,
  createCreditPackTicket,
  getCreditPackInfo,
  getMyValidCreditPacks,
  getMyPslAddressWithLargestBalance,
  createInferenceRequest,
  checkSupernodeList,
  registerPastelID,
  getPastelTicket,
  listPastelIDs,
  listContractTickets,
  findContractTicket,
  getContractTicket,
  importPrivKey,
  listAddressAmounts,
  getBalance,
  getWalletInfo,
  createAndFundNewAddress,
  checkForPastelID,
  isCreditPackConfirmed,
  createAndRegisterPastelID,
  isPastelIDRegistered,
  setPastelIdAndPassphrase,
  ensureMinimalPSLBalance,
  checkPastelIDValidity,
  dumpPrivKey,
  verifyPastelID,
  verifyTrackingAddress,
  checkTrackingAddressBalance,
  importPastelID,
  checkPSLAddressBalanceAlternative,
  createWalletFromMnemonic,
  loadWalletFromDatFile,
  downloadWalletToDatFile,
  selectAndReadWalletFile,
  waitForPastelIDRegistration,
  waitForCreditPackConfirmation,
  getBurnAddress,
  signMessageWithPastelID,
  verifyMessageWithPastelID,
  getCurrentPastelBlockHeight,
  getBestBlockHashAndMerkleRoot,
  sendToAddress,
  sendMany,
  getAndDecodeRawTransaction,
  getTransactionDetails,
  sendTrackingAmountFromControlAddressToBurnAddressToConfirmInferenceRequest,
  importAddress,
  getBlockHash,
  getBlock,
  makeNewAddress,
  makeNewPastelID,
  getAddressesCount,
  exportWallet,
  importWalletFromDatFile,
  getAllAddresses,
};

export default api;
