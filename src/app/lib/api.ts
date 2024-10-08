import BrowserRPCReplacement from "./BrowserRPCReplacement";
import { BrowserDatabase } from "./BrowserDatabase";
import PastelInferenceClient from "./PastelInferenceClient";
import {
  getNetworkFromLocalStorage,
  setNetworkInLocalStorage,
  getCurrentPastelIdAndPassphrase,
  setPastelIdAndPassphrase as storageSetPastelIdAndPassphrase,
} from "./storage";
import * as endToEndFunctions from "./endToEndFunctions";
import * as utils from "./utils";
import pastelGlobals from "./globals";
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

const rpc = new BrowserRPCReplacement();
const db = new BrowserDatabase();

let network: string;
let burnAddress: string;

export async function initializeApp(): Promise<void> {
  await db.initializeDatabase();
  await rpc.initialize();
  const { network: configuredNetwork, burnAddress: configuredBurnAddress } =
    await configureRPCAndSetBurnAddress();
  network = configuredNetwork;
  burnAddress = configuredBurnAddress;

  const { pastelID, passphrase } = await getCurrentPastelIdAndPassphrase();
  if (pastelID && passphrase) {
    pastelGlobals.setPastelIdAndPassphrase(pastelID, passphrase);
    console.log(`Successfully set global PastelID`);
  } else {
    console.warn(`Failed to set global PastelID and passphrase from storage`);
  }

  const { validMasternodeListFullDF } = await rpc.checkSupernodeList();
  if (!validMasternodeListFullDF) {
    throw new Error(
      "The Pastel Daemon is not fully synced, and thus the Supernode information commands are not returning complete information. Finish fully syncing and try again."
    );
  }
}

export async function changeNetwork(
  newNetwork: string
): Promise<{ success: boolean; message: string }> {
  if (["Mainnet", "Testnet", "Devnet"].includes(newNetwork)) {
    await setNetworkInLocalStorage(newNetwork);
    const { network: configuredNetwork, burnAddress: configuredBurnAddress } =
      await configureRPCAndSetBurnAddress();
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

export async function getBestSupernodeUrl(
  userPastelID: string
): Promise<string> {
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

export async function getCreditPackInfo(
  txid: string
): Promise<CreditPackTicketInfo> {
  return await endToEndFunctions.getCreditPackTicketInfoEndToEnd(txid);
}

export async function getMyValidCreditPacks(): Promise<CreditPack[]> {
  return await endToEndFunctions.getMyValidCreditPackTicketsEndToEnd();
}

export async function getMyPslAddressWithLargestBalance(): Promise<string> {
  return await rpc.getMyPslAddressWithLargestBalance();
}

export async function createInferenceRequest(
  params: InferenceRequestParams
): Promise<InferenceResult | null> {
  return await endToEndFunctions.handleInferenceRequestEndToEnd(params);
}

export async function checkSupernodeList(): Promise<{
  validMasternodeListFullDF: SupernodeInfo[];
}> {
  return await rpc.checkSupernodeList();
}

export async function registerPastelID(
  pastelid: string,
  passphrase: string,
  address: string
): Promise<string> {
  return await rpc.registerPastelID(pastelid, passphrase, address);
}

export async function listPastelIDTickets(
  filter: string = "mine",
  minheight: number | null = null
): Promise<PastelIDTicket[]> {
  return await rpc.listPastelIDTickets(filter, minheight);
}

export async function findPastelIDTicket(key: string): Promise<PastelIDTicket> {
  return await rpc.findPastelIDTicket(key);
}

export async function getPastelTicket(
  txid: string,
  decodeProperties: boolean = true
): Promise<unknown> {
  return await rpc.getPastelTicket(txid, decodeProperties);
}

export async function listContractTickets(
  ticketTypeIdentifier: string,
  startingBlockHeight: number = 0
): Promise<unknown[]> {
  return await rpc.listContractTickets(
    ticketTypeIdentifier,
    startingBlockHeight
  );
}

export async function findContractTicket(key: string): Promise<unknown> {
  return await rpc.findContractTicket(key);
}

export async function getContractTicket(
  txid: string,
  decodeProperties: boolean = true
): Promise<unknown> {
  return await rpc.getContractTicket(txid, decodeProperties);
}

export async function importPrivKey(
  zcashPrivKey: string,
  label: string = "",
  rescan: boolean = true
): Promise<string> {
  return await rpc.importPrivKey(zcashPrivKey, label, rescan);
}

export async function importWallet(serializedWallet: string): Promise<string> {
  return await rpc.importWallet(serializedWallet);
}

export async function listAddressAmounts(
  includeEmpty: boolean = false
): Promise<{ [address: string]: number }> {
  return await rpc.listAddressAmounts(includeEmpty);
}

export async function getBalance(): Promise<number> {
  return await rpc.getBalance();
}

export async function getWalletInfo(): Promise<WalletInfo> {
  return await rpc.getWalletInfo();
}

export async function createAndFundNewAddress(
  amount: number
): Promise<SendToAddressResult> {
  const result = await rpc.createAndFundNewPSLCreditTrackingAddress(amount);
  return {
    success: true,
    newCreditTrackingAddress: result.newCreditTrackingAddress || "",
    txid: result.txid || "",
  };
}

export async function checkForPastelID(): Promise<string | null> {
  return await rpc.checkForRegisteredPastelID();
}

export async function isCreditPackConfirmed(txid: string): Promise<boolean> {
  return await rpc.isCreditPackConfirmed(txid);
}

export async function createAndRegisterPastelID(): Promise<{
  pastelID: string;
  txid: string;
}> {
  return await rpc.createAndRegisterPastelID();
}

export async function isPastelIDRegistered(pastelID: string): Promise<boolean> {
  return await rpc.isPastelIDRegistered(pastelID);
}

export async function setPastelIdAndPassphrase(
  pastelID: string,
  passphrase: string
): Promise<void> {
  await storageSetPastelIdAndPassphrase(pastelID, passphrase);
  pastelGlobals.setPastelIdAndPassphrase(pastelID, passphrase);
}

export async function ensureMinimalPSLBalance(
  addresses: string[] | null = null
): Promise<void> {
  return await rpc.ensureTrackingAddressesHaveMinimalPSLBalance(addresses);
}

export async function checkPastelIDValidity(
  pastelID: string
): Promise<boolean> {
  return await rpc.isPastelIDRegistered(pastelID);
}

export async function dumpPrivKey(tAddr: string): Promise<string> {
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

export async function verifyPastelID(
  pastelID: string,
  passphrase: string
): Promise<boolean> {
  const testMessage = "Verification test message";
  const signature = await rpc.signMessageWithPastelID(
    safeString(pastelID),
    testMessage,
    safeString(passphrase)
  );
  return (
    (await rpc.verifyMessageWithPastelID(
      safeString(pastelID),
      testMessage,
      signature
    )) === "OK"
  );
}

export async function verifyTrackingAddress(address: string): Promise<boolean> {
  const balance = await rpc.checkPSLAddressBalance(address);
  return balance !== undefined;
}

export async function checkTrackingAddressBalance(
  creditPackTicketId: string
): Promise<{ address: string; balance: number }> {
  const creditPackInfo = await getCreditPackInfo(creditPackTicketId);
  if (!creditPackInfo || !creditPackInfo.requestConfirmation) {
    throw new Error("Credit pack ticket not found or invalid");
  }
  const trackingAddress = safeString(
    creditPackInfo.requestConfirmation.credit_usage_tracking_psl_address
  );
  if (!trackingAddress) {
    throw new Error("Tracking address not found in credit pack ticket");
  }
  const balance = await rpc.checkPSLAddressBalance(trackingAddress);
  if (balance === undefined) {
    throw new Error("Failed to retrieve balance for the tracking address");
  }
  return { address: trackingAddress, balance: balance };
}

export async function importPastelID(fileContent: string, network: string): Promise<{ success: boolean; message: string }> {
  try {
    await rpc.importPastelID(fileContent, network);
    return { success: true, message: "PastelID imported successfully!" };
  } catch (error) {
    console.error("Error importing PastelID:", error);
    return { success: false, message: `Failed to import PastelID: ${(error as Error).message}` };
  }
}