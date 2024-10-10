// src/app/lib/BrowserRPCReplacement.ts

import { initWasm } from "./wasmLoader";
import {
  PastelInstance,
  NetworkMode,
  SupernodeInfo,
  WalletInfo,
  TransactionDetail,
  BlockInfo,
  MempoolInfo,
  BlockchainInfo,
  TxOutSetInfo,
  ChainTip,
  BlockHeader,
  TxOutInfo,
  MemoryInfo,
  BlockSubsidy,
  BlockTemplate,
  MiningInfo,
  NetworkSolPs,
  NodeInfo,
  PeerInfo,
  DecodedRawTransaction,
  DecodedScript,
  ValidatedAddress,
  PastelIDInfo,
  PastelIDType,
} from "@/app/types";
import {
  getNetworkFromLocalStorage,
  setNetworkInLocalStorage,
} from "@/app/lib/storage";

declare const Module: {
  onRuntimeInitialized?: () => void;
  calledRun?: boolean;
  FS?: {
    mkdir: (path: string) => void;
    writeFile: (path: string, data: Uint8Array) => void;
  };
};

class BrowserRPCReplacement {
  private static instance: BrowserRPCReplacement | null = null;

  private apiBaseUrl: string;
  private pastelInstance: PastelInstance | null = null;
  private isInitialized: boolean = false;

  private constructor(
    apiBaseUrl: string = "https://opennode-fastapi.pastel.network"
  ) {
    this.apiBaseUrl = apiBaseUrl;
    this.pastelInstance = null;
    this.isInitialized = false;
  }

  public static getInstance(apiBaseUrl?: string): BrowserRPCReplacement {
    if (!BrowserRPCReplacement.instance) {
      BrowserRPCReplacement.instance = new BrowserRPCReplacement(apiBaseUrl);
    }
    return BrowserRPCReplacement.instance;
  }

  public async initialize(): Promise<void> {
    if (!this.isInitialized) {
      const wasmModule = await initWasm();
      if (!wasmModule) {
        throw new Error("WASM module not loaded");
      }
      this.pastelInstance = new wasmModule.Pastel();
      this.isInitialized = true;
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error("RPC not initialized. Call initialize first.");
    }
  }

  async getBurnAddress(): Promise<string> {
    const { network } = await this.getNetworkInfo();
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

  private executeWasmMethod<T>(method: () => Promise<T>): Promise<T> {
    if (!this.pastelInstance) {
      throw new Error("Pastel instance not initialized");
    }
    try {
      return method();
    } catch (error) {
      console.error("WASM method execution failed:", error);
      throw error;
    }
  }

  private async fetchJson<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(this.apiBaseUrl + endpoint);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching from ${endpoint}:`, error);
      throw error;
    }
  }

  public async createWalletFromMnemonic(
    password: string,
    mnemonic: string
  ): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.CreateWalletFromMnemonic(password, mnemonic)
    );
  }

  async checkMasternodeTop(): Promise<SupernodeInfo[]> {
    return this.fetchJson<SupernodeInfo[]>("/masternode/top");
  }

  async getCurrentPastelBlockHeight(): Promise<number> {
    return this.fetchJson<number>("/getblockcount");
  }

  async getBestBlockHashAndMerkleRoot(): Promise<[string, string, number]> {
    const blockHeight = await this.getCurrentPastelBlockHeight();
    const blockHash = await this.getBlockHash(blockHeight);
    const block = await this.getBlock(blockHash);
    return [blockHash, block.merkleroot, blockHeight];
  }

  async verifyMessageWithPastelID(
    pastelid: string,
    messageToVerify: string,
    pastelIDSignatureOnMessage: string
  ): Promise<boolean> {
    this.ensureInitialized();
    const networkMode = await this.getNetworkMode();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.VerifyWithPastelID(
        pastelid,
        messageToVerify,
        pastelIDSignatureOnMessage,
        this.getNetworkModeEnum(networkMode) // Convert string to NetworkMode enum
      )
    );
  }

  async importPastelID(
    fileContent: string,
    network: string
  ): Promise<{ success: boolean; message: string }> {
    this.ensureInitialized();
    let tempFilePath: string | null = null;
    try {
      if (!this.pastelInstance) {
        throw new Error("Pastel instance not initialized");
      }
  
      // Wait for the WASM module to be fully initialized
      await new Promise<void>((resolve) => {
        if (Module.calledRun) {
          resolve();
        } else {
          Module.onRuntimeInitialized = resolve;
        }
      });
  
      // Access FS through the WASM module
      const FS = Module.FS;
      if (!FS) {
        throw new Error("Emscripten file system is not available");
      }
  
      // Decode the base64 encoded secure container
      const binaryString = atob(fileContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
  
      // Ensure the directory exists in the Emscripten FS
      const dirPath = "/wallet_data";
      try {
        FS.mkdir(dirPath);
      } catch (e) {
        if ((e as { code?: string }).code !== "EEXIST") {
          console.error("Error creating directory:", e);
          throw e;
        }
      }
  
      // Generate a unique filename for the PastelID
      const pastelID = `pastelid_${Date.now()}.key`;
      tempFilePath = `${dirPath}/${pastelID}`;
  
      // Write the decoded binary data to the Emscripten FS
      FS.writeFile(tempFilePath, bytes);
  
      // Import the PastelID keys
      const passPhrase = ""; // Empty passphrase as per the original secure container
      let result;
      try {
        result = await this.pastelInstance.ImportPastelIDKeys(pastelID, passPhrase, dirPath);
      } catch (error) {
        console.error("Error in ImportPastelIDKeys:", error);
        throw new Error(`ImportPastelIDKeys failed: ${(error as Error).message || 'Unknown error'}`);
      }
  
      if (result) {
        // Verify the import by retrieving the PastelID
        let importedPastelID;
        try {
          importedPastelID = await this.pastelInstance.GetPastelID(pastelID, PastelIDType.PastelID);
        } catch (error) {
          console.error("Error in GetPastelID:", error);
          throw new Error(`GetPastelID failed: ${(error as Error).message || 'Unknown error'}`);
        }
  
        if (importedPastelID) {
          console.log(`PastelID ${importedPastelID} imported successfully on network ${network}`);
          return { success: true, message: "PastelID imported successfully!" };
        } else {
          throw new Error("PastelID import could not be verified");
        }
      } else {
        throw new Error("Failed to import PastelID");
      }
    } catch (error) {
      console.error("Error importing PastelID:", error);
      return {
        success: false,
        message: `Failed to import PastelID: ${(error as Error).message}`,
      };
    } finally {
      // Clean up: overwrite the temporary file with zeros if it exists
      if (tempFilePath) {
        try {
          const FS = Module.FS;
          if (FS) {
            // Assuming a reasonable maximum file size (e.g., 100kb)
            const maxSize = 1024 * 100;
            const zeroBuffer = new Uint8Array(maxSize);
            FS.writeFile(tempFilePath, zeroBuffer);
          }
        } catch (error) {
          console.error("Error cleaning up temporary file:", error);
        }
      }
    }
  }

  async sendToAddress(address: string, amount: number): Promise<string> {
    this.ensureInitialized();
    const sendTo = [{ address, amount }];
    const fromAddress = await this.getMyPslAddressWithLargestBalance();
    return this.createSendToTransaction(sendTo, fromAddress);
  }

  async sendMany(
    amounts: { address: string; amount: number }[]
  ): Promise<string> {
    this.ensureInitialized();
    const fromAddress = await this.getMyPslAddressWithLargestBalance();
    return this.createSendToTransaction(amounts, fromAddress);
  }

  async checkPSLAddressBalance(addressToCheck: string): Promise<number> {
    return this.fetchJson<number>(
      `/get_address_balance?addresses=${addressToCheck}`
    );
  }

  async checkIfAddressIsAlreadyImportedInLocalWallet(
    addressToCheck: string
  ): Promise<boolean> {
    this.ensureInitialized();
    const addresses = await this.getAllAddresses();
    return addresses.includes(addressToCheck);
  }

  async getAndDecodeRawTransaction(
    txid: string
  ): Promise<DecodedRawTransaction> {
    const rawTx = await this.fetchJson<string>(`/getrawtransaction/${txid}`);
    return this.fetchJson<DecodedRawTransaction>(
      `/decoderawtransaction/${rawTx}`
    );
  }

  async getTransactionDetails(
    txid: string,
    includeWatchonly: boolean = false
  ): Promise<TransactionDetail> {
    return this.fetchJson<TransactionDetail>(
      `/gettransaction/${txid}?includeWatchonly=${includeWatchonly}`
    );
  }

  async sendTrackingAmountFromControlAddressToBurnAddressToConfirmInferenceRequest(
    inferenceRequestId: string,
    creditUsageTrackingPSLAddress: string,
    creditUsageTrackingAmountInPSL: number,
    burnAddress: string
  ): Promise<string> {
    const sendTo = [
      { address: burnAddress, amount: creditUsageTrackingAmountInPSL },
    ];
    return this.createSendToTransaction(sendTo, creditUsageTrackingPSLAddress);
  }

  async importAddress(address: string): Promise<void> {
    this.ensureInitialized();
    const importedAddresses = JSON.parse(
      localStorage.getItem("importedAddresses") || "[]"
    ) as string[];
    if (!importedAddresses.includes(address)) {
      importedAddresses.push(address);
      localStorage.setItem(
        "importedAddresses",
        JSON.stringify(importedAddresses)
      );
    }
    console.log(`Address ${address} has been tracked for monitoring.`);
  }

  async getBlockHash(blockHeight: number): Promise<string> {
    return this.fetchJson<string>(`/getblockhash/${blockHeight}`);
  }

  async getBlock(blockHash: string): Promise<BlockInfo> {
    return this.fetchJson<BlockInfo>(`/getblock/${blockHash}`);
  }

  async signMessageWithPastelID(
    pastelid: string,
    messageToSign: string,
    network: string,
    type: PastelIDType = PastelIDType.PastelID
  ): Promise<string> {
    this.ensureInitialized();
    const networkMode = this.getNetworkModeEnum(network);
    return this.executeWasmMethod(() =>
      this.pastelInstance!.SignWithPastelID(
        pastelid,
        messageToSign,
        type,
        networkMode
      )
    );
  }

  async createAndFundNewPSLCreditTrackingAddress(
    amountOfPSLToFundAddressWith: number
  ): Promise<{ newCreditTrackingAddress: string; txid: string }> {
    this.ensureInitialized();
    const newAddress = await this.makeNewAddress();
    const txid = await this.sendToAddress(
      newAddress,
      amountOfPSLToFundAddressWith
    );
    return { newCreditTrackingAddress: newAddress, txid };
  }

  async checkSupernodeList(): Promise<{
    validMasternodeListFullDF: SupernodeInfo[];
  }> {
    return this.fetchJson<{ validMasternodeListFullDF: SupernodeInfo[] }>(
      "/supernode_data"
    );
  }

  async createAndRegisterNewPastelID(
    passphrase: string,
    fee: number
  ): Promise<{
    success: boolean;
    PastelID: string;
    PastelIDRegistrationTXID: string;
  }> {
    this.ensureInitialized();
    const networkMode = await this.getNetworkMode();
    
    // Create a new PastelID
    const pastelID = await this.makeNewPastelID("", passphrase, networkMode, true);
    
    // Get the funding address
    const fundingAddress = await this.getMyPslAddressWithLargestBalance();
    
    // Register the PastelID
    const txid = await this.createRegisterPastelIdTransaction(
      pastelID,
      fundingAddress,
      passphrase,
      fee
    );
    
    return {
      success: true,
      PastelID: pastelID,
      PastelIDRegistrationTXID: txid,
    };
  }

  async getBalance(): Promise<number> {
    this.ensureInitialized();
    const addresses = await this.getAllAddresses();
    let totalBalance = 0;
    for (const address of addresses) {
      const balance = await this.checkPSLAddressBalance(address);
      totalBalance += balance;
    }
    return totalBalance;
  }

  async getWalletInfo(): Promise<WalletInfo> {
    this.ensureInitialized();
    const balance = await this.getBalance();
    return {
      walletversion: 1,
      balance,
      unconfirmed_balance: 0,
      immature_balance: 0,
      txcount: await this.getWalletTransactionCount(),
      keypoololdest: 0,
      keypoolsize: 0,
      paytxfee: 0.001,
      seedfp: "Not available",
    };
  }

  async getNewAddress(): Promise<string> {
    this.ensureInitialized();
    return this.makeNewAddress();
  }

  async getMyPslAddressWithLargestBalance(): Promise<string> {
    this.ensureInitialized();
    const addresses = await this.getAllAddresses();
    let maxBalance = -1;
    let addressWithMaxBalance = "";
    for (const address of addresses) {
      const balance = await this.checkPSLAddressBalance(address);
      if (balance > maxBalance) {
        maxBalance = balance;
        addressWithMaxBalance = address;
      }
    }
    return addressWithMaxBalance;
  }

  async getAllAddresses(): Promise<string[]> {
    this.ensureInitialized();
    const addressCount = await this.getAddressesCount();
    const addresses: string[] = [];
    for (let i = 0; i < addressCount; i++) {
      const networkMode = await this.getNetworkMode();
      addresses.push(
        await this.getAddress(i, this.getNetworkModeEnum(networkMode))
      );
    }
    return addresses;
  }

  async getWalletTransactionCount(): Promise<number> {
    const transactions = JSON.parse(
      localStorage.getItem("transactions") || "[]"
    ) as unknown[];
    return transactions.length;
  }

  async createNewWallet(password: string): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.CreateNewWallet(password)
    );
  }

  async makeNewAddress(): Promise<string> {
    this.ensureInitialized();
    const networkMode = await this.getNetworkMode();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.MakeNewAddress(this.getNetworkModeEnum(networkMode))
    );
  }

  async getAddress(index: number, networkMode: NetworkMode): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.GetAddress(index, networkMode)
    );
  }

  async getAddressesCount(): Promise<number> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.GetAddressesCount()
    );
  }

  async makeNewPastelID(
    address: string,
    passphrase: string,
    network: string,
    makeFullPair: boolean = false
  ): Promise<string> {
    this.ensureInitialized();
    const networkMode = this.getNetworkModeEnum(network);
    return this.executeWasmMethod(() =>
      this.pastelInstance!.MakeNewPastelID(
        address,
        passphrase,
        networkMode,
        makeFullPair
      )
    );
  }

  async getPastelIDByIndex(index: number): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.GetPastelIDByIndex(index)
    );
  }

  async getPastelIDsCount(): Promise<number> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.GetPastelIDsCount()
    );
  }

  async createSendToTransaction(
    sendTo: { address: string; amount: number }[],
    fromAddress: string
  ): Promise<string> {
    this.ensureInitialized();
    const utxos = await this.getAddressUtxos(fromAddress);
    const blockHeight = await this.getCurrentPastelBlockHeight();
    const networkMode = await this.getNetworkMode();
    const sendToJson = JSON.stringify(sendTo);
    const utxosJson = JSON.stringify(utxos);

    return this.executeWasmMethod(() =>
      this.pastelInstance!.CreateSendToTransaction(
        this.getNetworkModeEnum(networkMode),
        sendToJson,
        fromAddress,
        utxosJson,
        blockHeight,
        0
      )
    );
  }

  async createRegisterPastelIdTransaction(
    pastelID: string,
    fundingAddress: string,
    passphrase: string,
    fee: number
  ): Promise<string> {
    this.ensureInitialized();
    const utxos = await this.getAddressUtxos(fundingAddress);
    const blockHeight = await this.getCurrentPastelBlockHeight();
    const networkMode = await this.getNetworkMode();
    const utxosJson = JSON.stringify(utxos);
  
    // Get the LegRoast key (pqKey)
    const pqKey = await this.executeWasmMethod(() =>
      this.pastelInstance!.GetPastelID(pastelID, PastelIDType.LegRoast)
    );
  
    return this.executeWasmMethod(() =>
      this.pastelInstance!.CreateRegisterPastelIdTransaction(
        this.getNetworkModeEnum(networkMode),
        pastelID,
        pqKey,
        fundingAddress,
        passphrase,
        utxosJson,
        fee,
        blockHeight
      )
    );
  }

  async signWithWalletKey(message: string): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.SignWithWalletKey(message)
    );
  }

  async getAddressUtxos(address: string): Promise<unknown[]> {
    return this.fetchJson<unknown[]>(`/get_address_utxos?addresses=${address}`);
  }

  async getPastelTicket(
    txid: string,
    decodeProperties: boolean = true
  ): Promise<unknown> {
    return this.fetchJson<unknown>(
      `/tickets/get/${txid}?decode_properties=${decodeProperties}`
    );
  }

  async listContractTickets(
    ticketTypeIdentifier: string,
    startingBlockHeight: number = 0
  ): Promise<unknown[]> {
    return this.fetchJson<unknown[]>(
      `/tickets/contract/list/${ticketTypeIdentifier}/${startingBlockHeight}`
    );
  }

  async findContractTicket(key: string): Promise<unknown> {
    return this.fetchJson<unknown>(`/tickets/contract/find/${key}`);
  }

  async getContractTicket(
    txid: string,
    decodeProperties: boolean = true
  ): Promise<unknown> {
    return this.fetchJson<unknown>(
      `/tickets/contract/get/${txid}?decode_properties=${decodeProperties}`
    );
  }

  async listAddressAmounts(
    includeEmpty: boolean = false
  ): Promise<{ [address: string]: number }> {
    this.ensureInitialized();
    const addresses = await this.getAllAddresses();
    const result: { [address: string]: number } = {};
    for (const address of addresses) {
      const balance = await this.checkPSLAddressBalance(address);
      if (includeEmpty || balance > 0) {
        result[address] = balance;
      }
    }
    return result;
  }

  async checkForRegisteredPastelID(): Promise<string | null> {
    this.ensureInitialized();
    const pastelIDs = await this.getAllPastelIDs();
    for (const pastelID of pastelIDs) {
      const isRegistered = await this.isPastelIDRegistered(pastelID);
      if (isRegistered) {
        return pastelID;
      }
    }
    return null;
  }

  async getAllPastelIDs(): Promise<string[]> {
    this.ensureInitialized();
    const count = await this.getPastelIDsCount();
    const pastelIDs: string[] = [];
    for (let i = 0; i < count; i++) {
      pastelIDs.push(await this.getPastelIDByIndex(i));
    }
    return pastelIDs;
  }

  async isCreditPackConfirmed(txid: string): Promise<boolean> {
    const ticket = await this.getPastelTicket(txid);
    return (
      typeof ticket === "object" &&
      ticket !== null &&
      "height" in ticket &&
      (ticket as { height: number }).height > 0
    );
  }

  async ensureTrackingAddressesHaveMinimalPSLBalance(
    addressesList: string[] | null = null
  ): Promise<void> {
    this.ensureInitialized();
    const addresses = addressesList || (await this.getAllAddresses());

    for (const address of addresses) {
      const balance = await this.checkPSLAddressBalance(address);
      if (balance < 1.0) {
        const amountNeeded = Math.round((1.0 - balance) * 10000) / 10000;
        if (amountNeeded > 0.0001) {
          await this.sendToAddress(address, amountNeeded);
        }
      }
    }
  }

  formatNumberWithCommas(number: number): string {
    return new Intl.NumberFormat("en-US").format(number);
  }

  async getAddressHistory(address: string): Promise<unknown> {
    return this.fetchJson<unknown>(`/get_address_history/${address}`);
  }

  async getBestBlockHash(): Promise<string> {
    return this.fetchJson<string>("/getbestblockhash");
  }

  async getMempoolInfo(): Promise<MempoolInfo> {
    return this.fetchJson<MempoolInfo>("/getmempoolinfo");
  }

  async getRawMempool(): Promise<string[]> {
    return this.fetchJson<string[]>("/getrawmempool");
  }

  async estimateFee(nblocks: number): Promise<number> {
    return this.fetchJson<number>(`/estimatefee/${nblocks}`);
  }

  async validateAddress(address: string): Promise<ValidatedAddress> {
    return this.fetchJson<ValidatedAddress>(`/validateaddress/${address}`);
  }

  async getBlockchainInfo(): Promise<BlockchainInfo> {
    return this.fetchJson<BlockchainInfo>("/getblockchaininfo");
  }

  async getTxOutSetInfo(): Promise<TxOutSetInfo> {
    return this.fetchJson<TxOutSetInfo>("/gettxoutsetinfo");
  }

  async getChainTips(): Promise<ChainTip[]> {
    return this.fetchJson<ChainTip[]>("/getchaintips");
  }

  async getDifficulty(): Promise<number> {
    return this.fetchJson<number>("/getdifficulty");
  }

  async getBlockHeader(blockhash: string): Promise<BlockHeader> {
    return this.fetchJson<BlockHeader>(`/getblockheader/${blockhash}`);
  }

  async getTxOut(
    txid: string,
    vout_value: number,
    includemempool: boolean = true
  ): Promise<TxOutInfo | null> {
    return this.fetchJson<TxOutInfo | null>(
      `/gettxout/${txid}/${vout_value}?includemempool=${includemempool}`
    );
  }

  async getTxOutProof(txid: string): Promise<string> {
    return this.fetchJson<string>(`/gettxoutproof/${txid}`);
  }

  async verifyTxOutProof(proof: string): Promise<string[]> {
    return this.fetchJson<string[]>(`/verifytxoutproof/${proof}`);
  }

  async getInfo(): Promise<unknown> {
    return this.fetchJson<unknown>("/getinfo");
  }

  async getMemoryInfo(): Promise<MemoryInfo> {
    return this.fetchJson<MemoryInfo>("/getmemoryinfo");
  }

  async getBlockSubsidy(height: number): Promise<BlockSubsidy> {
    return this.fetchJson<BlockSubsidy>(`/getblocksubsidy/${height}`);
  }

  async getBlockTemplate(): Promise<BlockTemplate> {
    return this.fetchJson<BlockTemplate>("/getblocktemplate");
  }

  async getMiningInfo(): Promise<MiningInfo> {
    return this.fetchJson<MiningInfo>("/getmininginfo");
  }

  async getNextBlockSubsidy(): Promise<BlockSubsidy> {
    return this.fetchJson<BlockSubsidy>("/getnextblocksubsidy");
  }

  async getNetworkSolPs(blocks: number, height: number): Promise<NetworkSolPs> {
    return this.fetchJson<NetworkSolPs>(`/getnetworksolps/${blocks}/${height}`);
  }

  async getAddedNodeInfo(): Promise<NodeInfo[]> {
    return this.fetchJson<NodeInfo[]>("/getaddednodeinfo");
  }

  async getPeerInfo(): Promise<PeerInfo[]> {
    return this.fetchJson<PeerInfo[]>("/getpeerinfo");
  }

  async decodeRawTransaction(
    hexstring: string
  ): Promise<DecodedRawTransaction> {
    return this.fetchJson<DecodedRawTransaction>(
      `/decoderawtransaction/${hexstring}`
    );
  }

  async decodeScript(hexstring: string): Promise<DecodedScript> {
    return this.fetchJson<DecodedScript>(`/decodescript/${hexstring}`);
  }

  async zValidateAddress(shieldedAddress: string): Promise<ValidatedAddress> {
    return this.fetchJson<ValidatedAddress>(
      `/z_validateaddress/${shieldedAddress}`
    );
  }

  async listPastelIDTicketsOld(
    filter: string = "mine",
    minheight: number | null = null
  ): Promise<PastelIDInfo[]> {
    let endpoint = `/list_pastelid_tickets/${filter}`;
    if (minheight !== null) {
      endpoint += `/${minheight}`;
    }
    return this.fetchJson<PastelIDInfo[]>(endpoint);
  }

  async findPastelIDTicketOld(key: string): Promise<PastelIDInfo> {
    return this.fetchJson<PastelIDInfo>(`/find_pastelid_ticket/${key}`);
  }

  async isPastelIDRegistered(pastelID: string): Promise<boolean> {
    return this.fetchJson<boolean>(`/tickets/id/is_registered/${pastelID}`);
  }

  private async getNetworkMode(): Promise<string> {
    const networkInfo = await this.getNetworkInfo();
    return networkInfo.network;
  }

  private getNetworkModeEnum(mode: string): NetworkMode {
    switch (mode) {
      case "Mainnet":
        return NetworkMode.Mainnet;
      case "Testnet":
        return NetworkMode.Testnet;
      case "Devnet":
        return NetworkMode.Devnet;
      default:
        throw new Error(`Unsupported network mode: ${mode}`);
    }
  }

  async importPrivKey(privKey: string): Promise<string> {
    this.ensureInitialized();
    console.warn(
      "importPrivKey called in browser context. This operation may expose sensitive information."
    );
    const networkMode = await this.getNetworkMode();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.ImportLegacyPrivateKey(
        privKey,
        this.getNetworkModeEnum(networkMode)
      )
    );
  }

  async dumpPrivKey(tAddr: string): Promise<string> {
    this.ensureInitialized();
    console.warn(
      "dumpPrivKey called in browser context. This operation may expose sensitive information."
    );
    const networkMode = await this.getNetworkMode();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.GetAddressSecret(
        tAddr,
        this.getNetworkModeEnum(networkMode)
      )
    );
  }

  async changeNetwork(
    newNetwork: string
  ): Promise<{ success: boolean; message: string }> {
    if (["Mainnet", "Testnet", "Devnet"].includes(newNetwork)) {
      await setNetworkInLocalStorage(newNetwork);
      await this.configureRPCAndSetBurnAddress();
      await this.initialize();
      return { success: true, message: `Network changed to ${newNetwork}` };
    } else {
      return { success: false, message: "Invalid network specified" };
    }
  }

  private async configureRPCAndSetBurnAddress(): Promise<{
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

  async getNetworkInfo(): Promise<{ network: string }> {
    const network = await getNetworkFromLocalStorage();
    return { network };
  }

  public convertNetworkModeToString(mode: NetworkMode): string {
    switch (mode) {
      case NetworkMode.Mainnet:
        return "Mainnet";
      case NetworkMode.Testnet:
        return "Testnet";
      case NetworkMode.Devnet:
        return "Devnet";
      default:
        throw new Error(`Unknown NetworkMode: ${mode}`);
    }
  }

  private extractPrivateKeys(walletData: ArrayBuffer): string[] {
    const dataView = new DataView(walletData);
    const privateKeys: string[] = [];
    const magicBytes = [0x30, 0x81, 0xD3, 0x02, 0x01, 0x01, 0x04, 0x20];
    for (let i = 0; i < dataView.byteLength - magicBytes.length - 32; i++) {
      if (magicBytes.every((byte, index) => dataView.getUint8(i + index) === byte)) {
        const keyBuffer = new Uint8Array(walletData, i + magicBytes.length, 32);
        privateKeys.push(Buffer.from(keyBuffer).toString('hex'));
      }
    }
    console.log('Found ' + privateKeys.length + ' keys');
    return privateKeys;
  }

  private createWalletData(privateKeys: string[]): ArrayBuffer {
    const magicBytes = new Uint8Array([0x30, 0x81, 0xD3, 0x02, 0x01, 0x01, 0x04, 0x20]);
    const walletData = new Uint8Array(privateKeys.length * (magicBytes.length + 32));
    
    privateKeys.forEach((key, index) => {
      const offset = index * (magicBytes.length + 32);
      walletData.set(magicBytes, offset);
      walletData.set(Buffer.from(key, 'hex'), offset + magicBytes.length);
    });

    return walletData.buffer;
  }

  async loadWalletFromDatFile(walletData: ArrayBuffer): Promise<boolean> {
    this.ensureInitialized();
    try {
      const privateKeys = this.extractPrivateKeys(walletData);
      const networkMode = await this.getNetworkMode();
      for (const privKey of privateKeys) {
        await this.pastelInstance!.ImportLegacyPrivateKey(privKey, this.getNetworkModeEnum(networkMode));
      }
      const addressCount = await this.pastelInstance!.GetAddressesCount();
      return addressCount > 0;
    } catch (error) {
      console.error("Error loading wallet:", error);
      return false;
    }
  }

  async downloadWalletToDatFile(filename: string = "pastel_wallet.dat"): Promise<boolean> {
    this.ensureInitialized();
    try {
      const addressCount = await this.pastelInstance!.GetAddressesCount();
      const addresses = [];
      const networkMode = await this.getNetworkMode();
      for (let i = 0; i < addressCount; i++) {
        addresses.push(await this.pastelInstance!.GetAddress(i, this.getNetworkModeEnum(networkMode)));
      }
      const privateKeys = await Promise.all(addresses.map(addr => 
        this.pastelInstance!.GetAddressSecret(addr, this.getNetworkModeEnum(networkMode))
      ));
      const walletData = this.createWalletData(privateKeys);
      const blob = new Blob([walletData], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error("Error downloading wallet:", error);
      return false;
    }
  }

}


export default BrowserRPCReplacement;
