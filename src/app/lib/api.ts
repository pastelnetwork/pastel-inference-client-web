// src/app/lib/api.ts

import BrowserRPCReplacement from './BrowserRPCReplacement';
import browserStorage from "./storage";
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
  PastelIDTicket,
  WalletInfo,
  SendToAddressResult,
} from "@/app/types";

let network: string = "Mainnet"; // Default value
let burnAddress: string = "PtpasteLBurnAddressXXXXXXXXXXbJ5ndd"; // Default Mainnet burn address

export async function changeNetwork(newNetwork: string): Promise<{ success: boolean; message: string }> {
  const rpc = BrowserRPCReplacement.getInstance();
  if (["Mainnet", "Testnet", "Devnet"].includes(newNetwork)) {
    await browserStorage.setNetworkInLocalStorage(newNetwork);
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
    throw new Error("Pastel ID and passphrase not set.");
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
  return await endToEndFunctions.sendMessageAndCheckForNewIncomingMessages(
    toPastelID,
    messageBody
  );
}

export async function getReceivedMessages(): Promise<UserMessage[]> {
  return await endToEndFunctions.checkForNewIncomingMessages();
}

export async function createCreditPackTicket(
  numCredits: number,
  creditUsageTrackingPSLAddress: string,
  maxTotalPrice: number,
  maxPerCreditPrice: number
): Promise<CreditPackCreationResult> {
  return await endToEndFunctions.handleCreditPackTicketEndToEnd(
    numCredits,
    creditUsageTrackingPSLAddress,
    burnAddress,
    maxTotalPrice,
    maxPerCreditPrice
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

export async function createInferenceRequest(params: InferenceRequestParams): Promise<InferenceResult | null> {
  return await endToEndFunctions.handleInferenceRequestEndToEnd(params);
}

export async function checkSupernodeList(): Promise<{ validMasternodeListFullDF: SupernodeInfo[] }> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.checkSupernodeList();
}

export async function registerPastelID(pastelid: string, passphrase: string, address: string): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.registerPastelID(pastelid, passphrase, address);
}

export async function listPastelIDTickets(filter: string = "mine", minheight: number | null = null): Promise<PastelIDTicket[]> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.listPastelIDTickets(filter, minheight);
}

export async function findPastelIDTicket(key: string): Promise<PastelIDTicket> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.findPastelIDTicket(key);
}

export async function getPastelTicket(txid: string, decodeProperties: boolean = true): Promise<unknown> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.getPastelTicket(txid, decodeProperties);
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

export async function importPrivKey(zcashPrivKey: string, label: string = "", rescan: boolean = true): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.importPrivKey(zcashPrivKey, label, rescan);
}

export async function importWallet(serializedWallet: string): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.importWallet(serializedWallet);
}

export async function listAddressAmounts(includeEmpty: boolean = false): Promise<{ [address: string]: number }> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.listAddressAmounts(includeEmpty);
}

export async function getBalance(): Promise<number> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.getBalance();
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

export async function checkForPastelID(): Promise<string | null> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.checkForRegisteredPastelID();
}

export async function isCreditPackConfirmed(txid: string): Promise<boolean> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.isCreditPackConfirmed(txid);
}

export async function createAndRegisterPastelID(): Promise<{ pastelID: string; txid: string }> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.createAndRegisterPastelID();
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

export async function verifyPastelID(pastelID: string, passphrase: string): Promise<boolean> {
  const testMessage = "Verification test message";
  const rpc = BrowserRPCReplacement.getInstance();
  const signature = await rpc.signMessageWithPastelID(safeString(pastelID), testMessage, safeString(passphrase));
  return (await rpc.verifyMessageWithPastelID(safeString(pastelID), testMessage, signature)) === "OK";
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

export async function importPastelID(fileContent: string, network: string): Promise<{ success: boolean; message: string }> {
  try {
    const rpc = BrowserRPCReplacement.getInstance();
    await rpc.importPastelID(fileContent, network);
    return { success: true, message: "PastelID imported successfully!" };
  } catch (error) {
    console.error("Error importing PastelID:", error);
    return { success: false, message: `Failed to import PastelID: ${(error as Error).message}` };
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

export async function loadWallet(serializedWallet: string, password: string): Promise<boolean> {
  const rpc = BrowserRPCReplacement.getInstance();
  await rpc.importWallet(serializedWallet);
  if (password) {
    await rpc.unlockWallet(password);
  }
  return true;
}

export async function downloadWallet(filename: string = "pastel_wallet.dat"): Promise<boolean> {
  const rpc = BrowserRPCReplacement.getInstance();
  const content = await rpc.exportWallet();
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  return true;
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

export async function signMessageWithPastelID(pastelid: string, messageToSign: string, passphrase: string): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.signMessageWithPastelID(pastelid, messageToSign, passphrase);
}

export async function verifyMessageWithPastelID(pastelid: string, messageToVerify: string, pastelIDSignatureOnMessage: string): Promise<string> {
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
  return await rpc.sendToAddress(address, amount);
}

export async function sendMany(amounts: { address: string; amount: number }[]): Promise<string> {
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
  burnAddress: string
): Promise<string> {
  const rpc = BrowserRPCReplacement.getInstance();
  return await rpc.sendTrackingAmountFromControlAddressToBurnAddressToConfirmInferenceRequest(
    inferenceRequestId,
    creditUsageTrackingPSLAddress,
    creditUsageTrackingAmountInPSL,
    burnAddress
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

const api = {
  changeNetwork,
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
  listPastelIDTickets,
  findPastelIDTicket,
  getPastelTicket,
  listContractTickets,
  findContractTicket,
  getContractTicket,
  importPrivKey,
  importWallet,
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
  loadWallet,
  downloadWallet,
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
};

export default api;