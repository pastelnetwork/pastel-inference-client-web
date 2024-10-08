// src/app/lib/BrowserRPCReplacement.ts

import { initWasm } from './wasmLoader';
import { PastelInstance, NetworkMode, SupernodeInfo, WalletInfo, PastelIDTicket, TransactionDetail, BlockInfo, MempoolInfo, BlockchainInfo, TxOutSetInfo, ChainTip, BlockHeader, TxOutInfo, MemoryInfo, BlockSubsidy, BlockTemplate, MiningInfo, NetworkSolPs, NodeInfo, PeerInfo, DecodedRawTransaction, DecodedScript, ValidatedAddress, PastelIDInfo } from "@/app/types";
import { getNetworkFromLocalStorage, setNetworkInLocalStorage } from "@/app/lib/storage";

class BrowserRPCReplacement {
  private apiBaseUrl: string;
  private pastelInstance: PastelInstance | null = null;
  private isInitialized: boolean = false;

  constructor(apiBaseUrl: string = "https://opennode-fastapi.pastel.network") {
    this.apiBaseUrl = apiBaseUrl;
    this.pastelInstance = null;
    this.isInitialized = false;
  }

  async initialize(): Promise<void> {
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

  private getNetworkMode(mode: string): NetworkMode {
    const modeMap: { [key: string]: NetworkMode } = {
      Mainnet: NetworkMode.Mainnet,
      Testnet: NetworkMode.Testnet,
      Devnet: NetworkMode.Devnet,
    };
    return modeMap[mode] || NetworkMode.Mainnet;
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

  private executeWasmMethod<T>(method: () => string | number): T {
    if (!this.pastelInstance) {
      throw new Error("Pastel instance not initialized");
    }
    try {
      const result = method();
      if (typeof result === 'number') {
        return result as T;
      }
      const response = JSON.parse(result);
      if (response.result) {
        return response.data as T;
      } else {
        throw new Error(response.error || "Unknown error in WASM response");
      }
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

  async createWalletFromMnemonic(password: string, mnemonic: string): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod<string>(() =>
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
  ): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod<string>(() =>
      this.pastelInstance!.VerifyWithPastelID(
        pastelid,
        messageToVerify,
        pastelIDSignatureOnMessage,
        "Mainnet"
      )
    );
  }
  
  async importPastelID(fileContent: string, network: string): Promise<{ success: boolean; message: string }> {
    // This looks wrong... 
    await this.ensureInitialized();
    try {
      // Parse the file content (assuming it's JSON)
      const pastelIDData = JSON.parse(fileContent);
      
      // Extract necessary information from the parsed data
      const { pastelID } = pastelIDData;
      
      // Import the PastelID using the WASM method
      this.executeWasmMethod<void>(() =>
        this.pastelInstance!.ImportWallet(JSON.stringify(pastelIDData))
      );
      
      // Verify the import by checking if the PastelID is now available
      const pastelIDCount = this.executeWasmMethod<number>(() =>
        this.pastelInstance!.GetPastelIDsCount()
      );
      
      const importedPastelID = this.executeWasmMethod<string>(() =>
        this.pastelInstance!.GetPastelIDByIndex(pastelIDCount - 1, "PastelID")
      );
      
      if (importedPastelID === pastelID) {
        console.log(`PastelID ${pastelID} imported successfully on network ${network}`);
        return { success: true, message: "PastelID imported successfully!" };
      } else {
        throw new Error("PastelID import could not be verified");
      }
    } catch (error) {
      console.error("Error importing PastelID:", error);
      return { success: false, message: `Failed to import PastelID: ${(error as Error).message}` };
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
    passphrase: string
  ): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod<string>(() =>
      this.pastelInstance!.SignWithPastelID(
        pastelid,
        messageToSign,
        passphrase,
        "Mainnet"
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

  async createAndRegisterNewPastelID(): Promise<{
    success: boolean;
    PastelID: string;
    PastelIDRegistrationTXID: string;
  }> {
    this.ensureInitialized();
    const pastelID = await this.makeNewPastelID(true);
    const fundingAddress = await this.getMyPslAddressWithLargestBalance();
    const txid = await this.createRegisterPastelIdTransaction(
      pastelID,
      fundingAddress
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

  async getAllAddresses(mode: string = "Mainnet"): Promise<string[]> {
    this.ensureInitialized();
    const addressCount = await this.getAddressesCount();
    const addresses: string[] = [];
    for (let i = 0; i < addressCount; i++) {
      addresses.push(await this.getAddress(i, mode));
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
    return this.executeWasmMethod<string>(() =>
      this.pastelInstance!.CreateNewWallet(password)
    );
  }

  async importWallet(serializedWallet: string): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod<string>(() =>
      this.pastelInstance!.ImportWallet(serializedWallet)
    );
  }

  async exportWallet(): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod<string>(() =>
      this.pastelInstance!.ExportWallet()
    );
  }

  async makeNewAddress(mode: string = "Mainnet"): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod<string>(() =>
      this.pastelInstance!.MakeNewAddress(this.getNetworkMode(mode))
    );
  }

  async getAddress(index: number, mode: string = "Mainnet"): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod<string>(() =>
      this.pastelInstance!.GetAddress(index, this.getNetworkMode(mode))
    );
  }

  async getAddressesCount(): Promise<number> {
    this.ensureInitialized();
    return this.executeWasmMethod<number>(() =>
      this.pastelInstance!.GetAddressesCount()
    );
  }

  async makeNewPastelID(makeFullPair: boolean = false): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod<string>(() =>
      this.pastelInstance!.MakeNewPastelID(makeFullPair)
    );
  }

  async getPastelIDByIndex(
    index: number,
    type: string = "PastelID"
  ): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod<string>(() =>
      this.pastelInstance!.GetPastelIDByIndex(index, type)
    );
  }

  async getPastelIDsCount(): Promise<number> {
    this.ensureInitialized();
    return this.executeWasmMethod<number>(() =>
      this.pastelInstance!.GetPastelIDsCount()
    );
  }

  async createSendToTransaction(
    sendTo: { address: string; amount: number }[],
    fromAddress: string,
    mode: string = "Mainnet"
  ): Promise<string> {
    this.ensureInitialized();
    const utxos = await this.getAddressUtxos(fromAddress);
    const blockHeight = await this.getCurrentPastelBlockHeight();
    const networkMode = this.getNetworkMode(mode);
    const sendToJson = JSON.stringify(sendTo);
    const utxosJson = JSON.stringify(utxos);

    return this.executeWasmMethod<string>(() =>
      this.pastelInstance!.CreateSendToTransaction(
        networkMode,
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
    mode: string = "Mainnet"
  ): Promise<string> {
    this.ensureInitialized();
    const utxos = await this.getAddressUtxos(fundingAddress);
    const blockHeight = await this.getCurrentPastelBlockHeight();
    const networkMode = this.getNetworkMode(mode);
    const utxosJson = JSON.stringify(utxos);

    return this.executeWasmMethod<string>(() =>
      this.pastelInstance!.CreateRegisterPastelIdTransaction(
        networkMode,
        pastelID,
        fundingAddress,
        utxosJson,
        blockHeight,
        0
      )
    );
  }

  async signWithWalletKey(message: string): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod<string>(() =>
      this.pastelInstance!.SignWithWalletKey(message)
    );
  }

  async unlockWallet(password: string): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod<string>(() =>
      this.pastelInstance!.UnlockWallet(password)
    );
  }

  async lockWallet(): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod<string>(() =>
      this.pastelInstance!.LockWallet()
    );
  }

  async getWalletPubKey(): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod<string>(() =>
      this.pastelInstance!.GetWalletPubKey()
    );
  }

  async getAddressUtxos(address: string): Promise<unknown[]> {
    return this.fetchJson<unknown[]>(`/get_address_utxos?addresses=${address}`);
  }

  async listPastelIDTickets(
    filter: string = "mine",
    minheight: number | null = null
  ): Promise<PastelIDTicket[]> {
    let endpoint = `/tickets/id/list/${filter}`;
    if (minheight !== null) {
      endpoint += `/${minheight}`;
    }
    return this.fetchJson<PastelIDTicket[]>(endpoint);
  }

  async findPastelIDTicket(key: string): Promise<PastelIDTicket> {
    return this.fetchJson<PastelIDTicket>(`/tickets/id/find/${key}`);
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

  async importPrivKey(
    privKey: string,
    label: string = "",
    rescan: boolean = true
  ): Promise<string> {
    this.ensureInitialized();
    console.warn(
      "importPrivKey called in browser context. This operation may expose sensitive information."
    );
    return this.executeWasmMethod<string>(() =>
      this.pastelInstance!.ImportPrivKey(privKey, label, rescan)
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

  async createAndRegisterPastelID(): Promise<{
    pastelID: string;
    txid: string;
  }> {
    this.ensureInitialized();
    const pastelID = await this.makeNewPastelID(true);
    const fundingAddress = await this.getMyPslAddressWithLargestBalance();
    const txid = await this.createRegisterPastelIdTransaction(
      pastelID,
      fundingAddress
    );
    return { pastelID, txid };
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

  async registerPastelID(
    pastelid: string,
    passphrase: string,
    address: string
  ): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod<string>(() =>
      this.pastelInstance!.RegisterPastelID(pastelid, passphrase, address)
    );
  }

  async isPastelIDRegistered(pastelID: string): Promise<boolean> {
    return this.fetchJson<boolean>(`/tickets/id/is_registered/${pastelID}`);
  }

  async dumpPrivKey(tAddr: string): Promise<string> {
    this.ensureInitialized();
    console.warn(
      "dumpPrivKey called in browser context. This operation may expose sensitive information."
    );
    return this.executeWasmMethod<string>(() =>
      this.pastelInstance!.DumpPrivKey(tAddr)
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
}

export default BrowserRPCReplacement;  