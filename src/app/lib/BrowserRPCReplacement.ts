// src/app/lib/BrowserRPCReplacement.ts

import axios from "axios";

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
  PastelModule,
  AddressBalance,
} from "@/app/types";
import {
  getNetworkFromLocalStorage,
  setNetworkInLocalStorage,
} from "@/app/lib/storage";

class BrowserRPCReplacement {
  private static instance: BrowserRPCReplacement | null = null;

  private apiBaseUrl: string;
  private pastelInstance: PastelInstance | null = null;
  private isInitialized: boolean = false;
  private wasmModule: PastelModule | null = null;

  private constructor(apiBaseUrl: string = "https://opennode-fastapi.pastel.network") {
    this.apiBaseUrl = apiBaseUrl;
    this.pastelInstance = null;
    this.isInitialized = false;
    this.wasmModule = null;
  }

  /**
   * Retrieves the singleton instance of BrowserRPCReplacement.
   * @param apiBaseUrl - Optional API base URL to override the default.
   * @returns The singleton instance.
   */
  public static getInstance(apiBaseUrl?: string): BrowserRPCReplacement {
    if (!BrowserRPCReplacement.instance) {
      BrowserRPCReplacement.instance = new BrowserRPCReplacement(apiBaseUrl);
    }
    return BrowserRPCReplacement.instance;
  }

  /**
   * Initializes the WASM module and Pastel instance.
   * Must be called before any other method.
   */
  public async initialize(forceNew: boolean = false): Promise<void> {
    if (forceNew) {
      this.wasmModule = await initWasm();
      if (!this.wasmModule) {
        throw new Error("WASM module not loaded");
      }
      this.pastelInstance = new this.wasmModule.Pastel();
      this.isInitialized = true;
      return
    }
    if (!this.isInitialized) {
      this.wasmModule = await initWasm();
      if (!this.wasmModule) {
        throw new Error("WASM module not loaded");
      }
      this.pastelInstance = new this.wasmModule.Pastel();
      this.isInitialized = true;
    }
  }

  /**
   * Ensures that the RPC is initialized before proceeding.
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error("RPC not initialized. Call initialize first.");
    }
  }

  /**
   * Executes a method on the PastelInstance within a Promise.
   * @param method - The method to execute.
   * @returns A promise resolving to the method's result.
   */
  private executeWasmMethod<T>(method: () => T): Promise<T> {
    if (!this.pastelInstance) {
      return Promise.reject(new Error("Pastel instance not initialized"));
    }
    try {
      const result = method();
      return Promise.resolve(result);
    } catch (error) {
      console.error("WASM method execution failed:", error);
      return Promise.reject(error);
    }
  }

  /**
   * Fetches JSON data from the specified endpoint.
   * @param endpoint - The API endpoint to fetch.
   * @returns A promise resolving to the parsed JSON data.
   */
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

  // -------------------------
  // Wallet Management Methods
  // -------------------------

  /**
   * Creates a new wallet with the provided password.
   * @param password - The password to secure the new wallet.
   * @returns The generated mnemonic phrase.
   */
  public async createNewWallet(password: string): Promise<string> {
    this.ensureInitialized();
    console.log("RPC: Creating new wallet");
    return this.executeWasmMethod(() => this.pastelInstance!.CreateNewWallet(password));
  }

  /**
   * Creates a wallet from an existing mnemonic phrase.
   * @param password - The password to secure the wallet.
   * @param mnemonic - The mnemonic phrase used to restore the wallet.
   * @returns The restored mnemonic phrase (should match the input mnemonic).
   */
  public async createWalletFromMnemonic(password: string, mnemonic: string): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.CreateWalletFromMnemonic(password, mnemonic)
    );
  }

  /**
   * Exports the current wallet data.
   * @returns The exported wallet data as a string.
   */
  public async exportWallet(): Promise<string> {
    this.ensureInitialized();
    const data = await this.executeWasmMethod(() =>
      this.pastelInstance!.ExportWallet()
    );
    if (data) {
      return JSON.parse(data).data;
    }
    return '';
  }

  /**
   * Imports wallet data from a serialized string.
   * @param walletData - The wallet data to import.
   * @returns `true` if the import was successful, otherwise `false`.
   */
  public async importWallet(walletData: string | ArrayBuffer): Promise<boolean> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.ImportWallet(walletData)
    );
  }

  /**
   * Unlocks the wallet using the provided password.
   * @param password - The password to unlock the wallet.
   * @returns `true` if the wallet was successfully unlocked, otherwise `false`.
   */
  public async unlockWallet(password: string): Promise<boolean> {
    this.ensureInitialized();
    console.log("RPC: Unlocking wallet");
    return this.executeWasmMethod(() => this.pastelInstance!.UnlockWallet(password));
  }

  /**
   * Locks the currently unlocked wallet.
   * @returns `true` if the wallet was successfully locked, otherwise `false`.
   */
  public async lockWallet(): Promise<boolean> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.LockWallet()
    );
  }

  // -------------------------
  // Address Management Methods
  // -------------------------

  /**
   * Generates a new address based on the specified network mode.
   * @param mode - The network mode (Mainnet, Testnet, Devnet).
   * @returns The newly generated address.
   */
  public async makeNewAddress(mode?: NetworkMode): Promise<string> {
    this.ensureInitialized();
    const networkMode = mode !== undefined ? mode : this.getNetworkModeEnum(await this.getNetworkMode());
    const data = await this.executeWasmMethod(() =>
      this.pastelInstance!.MakeNewAddress(networkMode)
    );
    if (data) {
      return JSON.parse(data).data;
    }
    return '';
  }

  /**
   * Retrieves an address by its index and network mode.
   * @param index - The index of the address to retrieve.
   * @param mode - The network mode (Mainnet, Testnet, Devnet).
   * @returns The address corresponding to the given index and mode.
   */
  public async getAddress(index: number, mode: NetworkMode): Promise<string> {
    this.ensureInitialized();
    const data = await this.executeWasmMethod(() =>
      this.pastelInstance!.GetAddress(index, mode)
    );
    if (data) {
      return JSON.parse(data)?.data || ''
    }
    return ''
  }

  /**
   * Retrieves all addresses, optionally filtered by network mode.
   * @param mode - (Optional) The network mode. If omitted, retrieves addresses for all modes.
   * @returns An array of wallet addresses.
   */
public async getAllAddresses(mode?: NetworkMode): Promise<string[]> {
  this.ensureInitialized();
  try {
    const addressCount = await this.getAddressesCount();
    if (!addressCount) {
      console.warn("GetAddresses returned undefined or null");
      return [];
    }
    const addresses = [];
    const networkMode = mode || this.getNetworkModeEnum(await this.getNetworkMode());
    for (let i = 0; i < addressCount; i++) {
      const address = await this.getAddress(i, networkMode as NetworkMode);
      addresses.push(address)
    }
    return addresses;
  } catch (error) {
    console.error("Error in getAllAddresses:", error);
    return [];
  }
}

  /**
   * Retrieves the total count of addresses in the wallet.
   * @returns The total number of addresses.
   */
  public async getAddressesCount(): Promise<number> {
    this.ensureInitialized();
    const resAdresss = await this.executeWasmMethod(() => this.pastelInstance!.GetAddressesCount());
    if (resAdresss) {
      const parseAddress = JSON.parse(resAdresss);
      return parseAddress?.data || 0
    }
    return 0;
  }

  // -------------------------
  // PastelID Management Methods
  // -------------------------

  /**
   * Creates a new PastelID.
   * @param flag - A boolean flag, purpose inferred from context.
   * @returns The newly generated PastelID.
   */
  public async makeNewPastelID(flag: boolean): Promise<string> {
    this.ensureInitialized();
    const data = await this.executeWasmMethod(() =>
      this.pastelInstance!.MakeNewPastelID(flag)
    );
    if (data) {
      return JSON.parse(data).data
    }
    return ''
  }

  /**
   * Retrieves a PastelID by its index and type.
   * @param index - The index of the PastelID to retrieve.
   * @param type - The type of PastelID (PastelID, LegRoast).
   * @returns The PastelID corresponding to the given index and type.
   */
  public async getPastelIDByIndex(index: number, type: PastelIDType = PastelIDType.PastelID): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.GetPastelIDByIndex(index, type)
    );
  }

  /**
   * Retrieves a PastelID based on its identifier and type.
   * @param pastelID - The PastelID identifier.
   * @param type - The type of PastelID (PastelID, LegRoast).
   * @returns The PastelID data based on the provided type.
   */
  public async getPastelID(pastelID: string, type: PastelIDType): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.GetPastelID(pastelID, type)
    );
  }

  /**
   * Imports PastelID keys from a specified directory.
   * @param pastelID - The PastelID identifier.
   * @param passPhrase - The passphrase associated with the PastelID.
   * @param dirPath - The directory path where the keys are stored.
   * @returns The result of the import operation.
   */
  public async importPastelID (pastelID: string, passPhrase: string, dirPath: string = "/wallet_data"): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.ImportPastelIDKeys(pastelID, passPhrase, dirPath)
    );
  }

  /**
   * Retrieves a list of all PastelIDs associated with the wallet.
   * @returns An array of PastelIDs.
   */
  public async getPastelIDs(): Promise<string[]> {
    this.ensureInitialized();
    let data = await this.executeWasmMethod(() => this.pastelInstance!.GetPastelIDs())
    if (typeof data === 'string') {
      data = JSON.parse(data)?.data
    }
    return data;
  }

  // -------------------------
  // Signing and Verification Methods
  // -------------------------

  /**
   * Signs data using a specific PastelID.
   * @param pastelID - The PastelID identifier used for signing.
   * @param data - The data to be signed.
   * @param type - The type of PastelID (PastelID, LegRoast).
   * @param flag - A boolean flag, purpose inferred from context.
   * @returns The generated signature.
   */
  public async signMessageWithPastelID(
    pastelID: string,
    data: string,
    type: PastelIDType,
    flag: boolean = true
  ): Promise<string> {
    this.ensureInitialized();
    const result = await this.executeWasmMethod(() =>
      this.pastelInstance!.SignWithPastelID(pastelID, data, type, flag)
    );
    if (result) {
      return JSON.parse(result).data
    }
    return ''
  }

  /**
   * Verifies a signature using a specific PastelID.
   * @param pastelID - The PastelID identifier used for verification.
   * @param data - The original data that was signed.
   * @param signature - The signature to verify against the data.
   * @param flag - A boolean flag, purpose inferred from context.
   * @returns `true` if the signature is valid, otherwise `false`.
   */
  public async verifyMessageWithPastelID(
    pastelID: string,
    data: string,
    signature: string,
    flag: boolean = true
  ): Promise<boolean> {
    this.ensureInitialized();
    const response = await this.executeWasmMethod(() =>
      this.pastelInstance!.VerifyWithPastelID(pastelID, data, signature, flag)
    );
    if (response) {
      return JSON.parse(response).data
    }
    return false;
  }

  /**
   * Verifies a signature using a LegRoast public key.
   * @param pubLegRoast - The public key of the LegRoast.
   * @param data - The original data that was signed.
   * @param signature - The signature to verify against the data.
   * @param flag - A boolean flag, purpose inferred from context.
   * @returns `true` if the signature is valid, otherwise `false`.
   */
  public async verifyMessageWithLegRoast(
    pubLegRoast: string,
    data: string,
    signature: string,
    flag: boolean = true
  ): Promise<boolean> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.VerifyWithLegRoast(pubLegRoast, data, signature, flag)
    );
  }

  // -------------------------
  // Key Management Methods
  // -------------------------

  /**
   * Retrieves the secret (private key) associated with a specific address.
   * @param address - The address whose secret is to be retrieved.
   * @param mode - The network mode (Mainnet, Testnet, Devnet).
   * @returns The private key associated with the address.
   */
  public async getAddressSecret(address: string, mode: NetworkMode): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.GetAddressSecret(address, mode)
    );
  }

  /**
   * Imports a legacy private key into the wallet.
   * @param privKey - The legacy private key to import.
   * @param mode - The network mode (Mainnet, Testnet, Devnet).
   * @returns The address associated with the imported private key.
   */
  public async importLegacyPrivateKey(privKey: string, mode: NetworkMode): Promise<string> {
    this.ensureInitialized();
    console.warn(
      "importLegacyPrivateKey called in browser context. This operation may expose sensitive information."
    );
    return this.executeWasmMethod(() =>
      this.pastelInstance!.ImportLegacyPrivateKey(privKey, mode)
    );
  }

  // -------------------------
  // Ticket Management Methods
  // -------------------------

  /**
   * Retrieves the available ticket types.
   * @returns An array of ticket type strings.
   */
  public async getTicketTypes(): Promise<string[]> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.GetTicketTypes()
    );
  }

  /**
   * Retrieves the type of a specific PastelID ticket.
   * @param pastelID - The PastelID identifier.
   * @returns The ticket type as a string.
   */
  public async getPastelIDTicketType(pastelID: string): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.GetPastelIDTicketType(pastelID)
    );
  }

  /**
   * Retrieves the JSON representation of a PastelID ticket.
   * @param pastelID - The PastelID identifier.
   * @returns The ticket data in JSON format.
   */
  public async getPastelIDTicketJson(pastelID: string): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.GetPastelIDTicketJson(pastelID)
    );
  }

  /**
   * Creates a PastelID ticket.
   * @param pastelID - The PastelID to associate with the ticket.
   * @param type - The type of ticket.
   * @param ticketDataJson - The ticket data in JSON format.
   * @param networkMode - The network mode (Mainnet, Testnet, Devnet).
   * @returns The created ticket data as a serialized string.
   */
  public async createPastelIDTicket(
    pastelID: string,
    type: string,
    ticketDataJson: string,
    networkMode: NetworkMode
  ): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.CreatePastelIDTicket(pastelID, type, ticketDataJson, networkMode)
    );
  }

  /**
   * Retrieves the total count of PastelID tickets.
   * @returns The total number of tickets.
   */
  public async getPastelIDTicketsCount(): Promise<number> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.GetPastelIDTicketsCount()
    );
  }

  /**
   * Retrieves a PastelID ticket by its index.
   * @param index - The index of the ticket to retrieve.
   * @returns The ticket data as a string.
   */
  public async getPastelIDTicketByIndex(index: number): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.GetPastelIDTicketByIndex(index)
    );
  }

  // -------------------------
  // Additional Wallet Methods
  // -------------------------

  /**
   * Signs data using the wallet's key.
   * @param message - The message to be signed using the wallet's key.
   * @returns The generated signature.
   */
  public async signWithWalletKey(message: string): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.SignWithWalletKey(message)
    );
  }

  /**
   * Retrieves the public key of the wallet.
   * @returns The wallet's public key.
   */
  public async getWalletPubKey(): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.GetWalletPubKey()
    );
  }

  /**
   * Retrieves the public key at a specific index.
   * @param index - The index of the public key to retrieve.
   * @returns The public key at the specified index.
   */
  public async getPubKeyAt(index: number): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.GetPubKeyAt(index)
    );
  }

  /**
   * Signs a message using the key at a specific index.
   * @param index - The index of the key to use for signing.
   * @param message - The message to be signed.
   * @returns The generated signature.
   */
  public async signWithKeyAt(index: number, message: string): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.SignWithKeyAt(index, message)
    );
  }

  // -------------------------
  // Transaction Management Methods
  // -------------------------

  /**
   * Creates a transaction to send funds to specified recipients.
   * @param sendTo - An array of recipients and amounts.
   * @param fromAddress - The address to send funds from.
   * @param fee - The transaction fee.
   * @returns The created transaction data as a serialized string.
   */
  public async createSendToTransaction(
    sendTo: { address: string; amount: number }[],
    fromAddress: string,
  ): Promise<string> {
    this.ensureInitialized();
    const utxos = await this.getAddressUtxos(fromAddress);
    const networkMode = this.getNetworkModeEnum(await this.getNetworkMode());
    const sendToJson = JSON.stringify(sendTo);
    const utxosJson = JSON.stringify(utxos);
    const currentBlockHeight = await this.getCurrentPastelBlockHeight();
    const response = await this.executeWasmMethod(() =>
      this.pastelInstance!.CreateSendToTransaction(
        networkMode,
        sendToJson,
        fromAddress,
        utxosJson,
        currentBlockHeight,
        0
      )
    );
    if (response) {
      const parseData = JSON.parse(JSON.parse(response).data)
      const { data } = await axios.post(`${this.apiBaseUrl}/sendrawtransaction?hex_string=${parseData.hex}&allow_high_fees=false`);
      return data.txid;
    }
    return "";
  }

  /**
   * Creates a transaction to send funds to specified recipients in JSON format.
   * @param sendToJson - A JSON string representing recipients and amounts.
   * @param fromAddress - The address to send funds from.
   * @param fee - The transaction fee.
   * @returns The created transaction data as a serialized string.
   */
  public async createSendToTransactionJson(
    sendToJson: string,
    fromAddress: string,
    fee: number = 0
  ): Promise<string> {
    this.ensureInitialized();
    const utxos = await this.getAddressUtxos(fromAddress);
    const utxosJson = JSON.stringify(utxos);
    const networkMode = this.getNetworkModeEnum(await this.getNetworkMode());
    return this.executeWasmMethod(() =>
      this.pastelInstance!.CreateSendToTransactionJson(
        networkMode,
        sendToJson,
        fromAddress,
        utxosJson,
        fee
      )
    );
  }

  /**
   * Creates a transaction to register a PastelID.
   * @param pastelID - The PastelID to register.
   * @param fundingAddress - The address associated with the PastelID.
   * @param utxosJson - A JSON string representing unspent transaction outputs.
   * @param fee - The transaction fee.
   * @returns The created PastelID registration transaction data as a serialized string.
   */
  public async createRegisterPastelIdTransaction(
    pastelID: string,
    fundingAddress: string,
  ): Promise<string> {
    this.ensureInitialized();
    const utxos = await this.getAddressUtxos(fundingAddress);
    const utxosJson = JSON.stringify(utxos);
    const networkMode = this.getNetworkModeEnum(await this.getNetworkMode());
    const currentBlockHeight = await this.getCurrentPastelBlockHeight();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.CreateRegisterPastelIdTransaction(
        networkMode,
        pastelID,
        fundingAddress,
        utxosJson,
        currentBlockHeight,
        0
      )
    );
  }

  /**
   * Creates a transaction to register a PastelID in JSON format.
   * @param pastelID - The PastelID to register.
   * @param fundingAddress - The address associated with the PastelID.
   * @param utxoJson - A JSON string representing unspent transaction outputs.
   * @param fee - The transaction fee.
   * @returns The created PastelID registration transaction data as a serialized string.
   */
  public async createRegisterPastelIdTransactionJson(
    pastelID: string,
    fundingAddress: string,
    utxoJson: string,
    fee: number
  ): Promise<string> {
    this.ensureInitialized();
    const networkMode = this.getNetworkModeEnum(await this.getNetworkMode());
    return this.executeWasmMethod(() =>
      this.pastelInstance!.CreateRegisterPastelIdTransactionJson(
        networkMode,
        pastelID,
        fundingAddress,
        utxoJson,
        fee
      )
    );
  }

  /**
   * Retrieves UTXOs for a specific address.
   * @param address - The address to retrieve UTXOs for.
   * @returns An array of UTXOs.
   */
  public async getAddressUtxos(address: string): Promise<unknown[]> {
    return this.fetchJson<unknown[]>(`/get_address_utxos?addresses=${address}`);
  }

  // -------------------------
  // PastelID Verification Methods
  // -------------------------

  /**
   * Checks if a PastelID is registered.
   * @param pastelID - The PastelID to check.
   * @returns `true` if registered, otherwise `false`.
   */
  public async isPastelIDRegistered(pastelID: string): Promise<boolean> {
    return this.fetchJson<boolean>(`/tickets/id/is_registered/${pastelID}`);
  }

  // -------------------------
  // Supernode Methods
  // -------------------------

  async checkSupernodeList(): Promise<{
    validMasternodeListFullDF: SupernodeInfo[];
  }> {
    const data = await this.fetchJson<string>(
      "/supernode_data"
    );
    if (data) {
      const parseData = JSON.parse(data);
      const validMasternodeListFullDF: SupernodeInfo[] = [];
      for (const [key] of Object.entries(parseData)) {
        const item = parseData[key];
        validMasternodeListFullDF.push({
          txid_vout: key,
          supernode_status: item.supernode_status,
          protocol_version: Number(item.protocol_version),
          supernode_psl_address: item.supernode_psl_address,
          lastseentime: item.lastseentime,
          activeseconds: item.activeseconds,
          lastpaidtime: item.lastpaidtime,
          lastpaidblock: item.lastpaidblock,
          ipaddress_port: item['ipaddress:port'],
          rank: item.rank,
          pubkey: item.pubkey,
          extAddress: item.extAddress,
          extP2P: item.extP2P,
          extKey: item.extKey,
          activedays: item.activedays,
        })
      }

      return {
        validMasternodeListFullDF: validMasternodeListFullDF.filter(
          (data) =>
            ["ENABLED", "PRE_ENABLED"].includes(data.supernode_status) &&
            data["ipaddress_port"] !== "154.38.164.75:29933" &&
            data.extP2P
        )
      }
    }
    return {
      validMasternodeListFullDF: []
    };
  }

  /**
   * Retrieves the current Pastel block height.
   * @returns The current block height.
   */
  public async getCurrentPastelBlockHeight(): Promise<number> {
    return this.fetchJson<number>("/getblockcount");
  }

  /**
   * Retrieves the best block hash and Merkle root.
   * @returns A tuple containing block hash, Merkle root, and block height.
   */
  public async getBestBlockHashAndMerkleRoot(): Promise<[string, string, number]> {
    const blockHeight = await this.getCurrentPastelBlockHeight();
    const blockHash = await this.getBlockHash(blockHeight);
    const block = await this.getBlock(blockHash);
    return [blockHash, block.merkleroot, blockHeight];
  }

  /**
   * Retrieves block hash by height.
   * @param blockHeight - The height of the block.
   * @returns The block hash.
   */
  public async getBlockHash(blockHeight: number): Promise<string> {
    return this.fetchJson<string>(`/getblockhash/${blockHeight}`);
  }

  /**
   * Retrieves block information by hash.
   * @param blockHash - The hash of the block.
   * @returns The block information.
   */
  public async getBlock(blockHash: string): Promise<BlockInfo> {
    return this.fetchJson<BlockInfo>(`/getblock/${blockHash}`);
  }

  /**
   * Retrieves blockchain information.
   * @returns The blockchain information.
   */
  public async getBlockchainInfo(): Promise<BlockchainInfo> {
    return this.fetchJson<BlockchainInfo>("/getblockchaininfo");
  }

  /**
   * Retrieves mempool information.
   * @returns The mempool information.
   */
  public async getMempoolInfo(): Promise<MempoolInfo> {
    return this.fetchJson<MempoolInfo>("/getmempoolinfo");
  }

  /**
   * Retrieves raw mempool transactions.
   * @returns An array of transaction IDs in the mempool.
   */
  public async getRawMempool(): Promise<string[]> {
    return this.fetchJson<string[]>("/getrawmempool");
  }

  /**
   * Estimates the fee for a given number of blocks.
   * @param nblocks - The number of blocks to estimate the fee for.
   * @returns The estimated fee.
   */
  public async estimateFee(nblocks: number): Promise<number> {
    return this.fetchJson<number>(`/estimatefee/${nblocks}`);
  }

  /**
   * Retrieves network difficulty.
   * @returns The current network difficulty.
   */
  public async getDifficulty(): Promise<number> {
    return this.fetchJson<number>("/getdifficulty");
  }

  /**
   * Retrieves the best block hash.
   * @returns The best block hash.
   */
  public async getBestBlockHash(): Promise<string> {
    return this.fetchJson<string>("/getbestblockhash");
  }

  /**
   * Retrieves chain tips.
   * @returns An array of chain tips.
   */
  public async getChainTips(): Promise<ChainTip[]> {
    return this.fetchJson<ChainTip[]>("/getchaintips");
  }

  /**
   * Retrieves transaction output set information.
   * @returns The transaction output set information.
   */
  public async getTxOutSetInfo(): Promise<TxOutSetInfo> {
    return this.fetchJson<TxOutSetInfo>("/gettxoutsetinfo");
  }

  /**
   * Retrieves node information.
   * @returns An array of NodeInfo.
   */
  public async getAddedNodeInfo(): Promise<NodeInfo[]> {
    return this.fetchJson<NodeInfo[]>("/getaddednodeinfo");
  }

  /**
   * Retrieves peer information.
   * @returns An array of PeerInfo.
   */
  public async getPeerInfo(): Promise<PeerInfo[]> {
    return this.fetchJson<PeerInfo[]>("/getpeerinfo");
  }

  /**
   * Retrieves mining information.
   * @returns The mining information.
   */
  public async getMiningInfo(): Promise<MiningInfo> {
    return this.fetchJson<MiningInfo>("/getmininginfo");
  }

  /**
   * Retrieves the next block subsidy.
   * @returns The next block subsidy.
   */
  public async getNextBlockSubsidy(): Promise<BlockSubsidy> {
    return this.fetchJson<BlockSubsidy>("/getnextblocksubsidy");
  }

  /**
   * Retrieves network hash rate in Sol/s.
   * @param blocks - The number of blocks to calculate the hash rate over.
   * @param height - The block height.
   * @returns The network hash rate.
   */
  public async getNetworkSolPs(blocks: number, height: number): Promise<NetworkSolPs> {
    return this.fetchJson<NetworkSolPs>(`/getnetworksolps/${blocks}/${height}`);
  }

  // -------------------------
  // Utility Methods
  // -------------------------

  /**
   * Changes the network mode.
   * @param newNetwork - The new network mode to switch to.
   * @returns An object indicating success and a message.
   */
  public async changeNetwork(newNetwork: string): Promise<{ success: boolean; message: string }> {
    if (["Mainnet", "Testnet", "Devnet"].includes(newNetwork)) {
      await setNetworkInLocalStorage(newNetwork);
      await this.configureRPCAndSetBurnAddress();
      await this.initialize();
      return { success: true, message: `Network changed to ${newNetwork}` };
    } else {
      return { success: false, message: "Invalid network specified" };
    }
  }

  /**
   * Configures RPC and sets the burn address based on the current network.
   * @returns An object containing the network and burn address.
   */
  private async configureRPCAndSetBurnAddress(): Promise<{ network: string; burnAddress: string }> {
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

  /**
   * Retrieves the current network mode.
   * @returns The current network mode as a string.
   */
  private async getNetworkMode(): Promise<string> {
    const networkInfo = await this.getNetworkInfo();
    return networkInfo.network;
  }

  /**
   * Maps a string network mode to the NetworkMode enum.
   * @param mode - The network mode as a string.
   * @returns The corresponding NetworkMode enum value.
   */
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

  /**
   * Retrieves network information from local storage.
   * @returns An object containing the current network mode.
   */
  public async getNetworkInfo(): Promise<{ network: string }> {
    const network = await getNetworkFromLocalStorage();
    return { network };
  }

  /**
   * Converts a NetworkMode enum value to its string representation.
   * @param mode - The NetworkMode enum value.
   * @returns The corresponding string representation.
   */
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

  // -------------------------
  // PastelID Import and Export Methods
  // -------------------------

  /**
   * Imports PastelID keys from file content.
   * @param fileContent - The base64 encoded file content.
   * @param network - The network mode (Mainnet, Testnet, Devnet).
   * @returns An object indicating success and a message.
   */
  public async importPastelIDFromFile(fileContent: string | ArrayBuffer | null, network: string, passphrase: string, pastelID: string): Promise<{ success: boolean; message: string; importedPastelID: string }> {
    this.ensureInitialized();
    let tempFilePath: string | null = null;
    const contentLength = 0;
    try {
      const FS = this.wasmModule!.FS;
  
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
  
      tempFilePath = `${dirPath}/${pastelID}`;
      // Write the decoded binary data to the Emscripten FS
      const bytes = new Uint8Array(fileContent as ArrayBufferLike);
      FS.writeFile(tempFilePath, bytes);
      // Sync the file system
      await new Promise<void>((resolve, reject) => {
        FS.syncfs(false, (err: Error | null) => {
          if (err) {
            console.error("Error syncing file system:", err);
            reject(err);
          } else {
            console.log("File system synced successfully.");
            resolve();
          }
        });
      });

      // Import the PastelID keys
      let result: string;
      try {
        result = await this.pastelInstance!.ImportPastelIDKeys(pastelID, passphrase, dirPath);
        if (result && typeof result === 'string') {
          result = JSON.parse(result);
        }
      } catch (error) {
        console.error("Error in ImportPastelIDKeys:", error);
        throw new Error(`ImportPastelIDKeys failed: ${(error as Error).message || "Unknown error"}`);
      }

      if (result) {
        // Verify the import by retrieving the PastelID
        let importedPastelID: string;
        try {
          importedPastelID = await this.executeWasmMethod(() =>
            this.pastelInstance!.GetPastelID(pastelID, PastelIDType.PastelID)
          );
        } catch (error) {
          console.error("Error in GetPastelID:", error);
          throw new Error(`GetPastelID failed: ${(error as Error).message || "Unknown error"}`);
        }

        if (importedPastelID) {
          console.log(`PastelID ${importedPastelID} imported successfully on network ${network}`);
          return { success: true, message: "PastelID imported successfully!", importedPastelID };
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
        importedPastelID: '',
      };
    } finally {
      // Clean up: overwrite the temporary file with zeros if it exists
      if (tempFilePath && this.wasmModule) {
        try {
          const FS = this.wasmModule.FS;
          const zeroBuffer = new Uint8Array(contentLength);
          FS.writeFile(tempFilePath, zeroBuffer);
  
          // Sync the file system after cleanup
          await new Promise<void>((resolve) => {
            FS.syncfs(false, (err: Error | null) => {
              if (err) {
                console.error("Error syncing file system during cleanup:", err);
              } else {
                console.log("File system synced successfully during cleanup.");
              }
              resolve();
            });
          });
  
          // Delete the temporary file
          FS.unlink(tempFilePath);
        } catch (error) {
          console.error("Error cleaning up temporary file:", error);
        }
      }
    }
  }

  /**
   * Retrieves the exported PastelID from the wallet.
   * @param pastelID - The PastelID identifier.
   * @param type - The type of PastelID (PastelID, LegRoast).
   * @returns The exported PastelID data.
   */
  public async getPastelIDFromWallet(pastelID: string, type: PastelIDType = PastelIDType.PastelID): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.GetPastelID(pastelID, type)
    );
  }

  // -------------------------
  // Signing and Verification with PastelID
  // -------------------------

  /**
   * Signs a message with a PastelID.
   * @param pastelID - The PastelID to use for signing.
   * @param message - The message to sign.
   * @returns The signature.
   */
  public async signWithPastelIDExported(pastelID: string, message: string): Promise<string> {
    return this.signMessageWithPastelID(pastelID, message, PastelIDType.PastelID);
  }

  /**
   * Verifies a signature with a PastelID.
   * @param pastelID - The PastelID used for verification.
   * @param message - The original message.
   * @param signature - The signature to verify.
   * @returns `true` if the signature is valid, otherwise `false`.
   */
  public async verifyWithPastelIDExported(pastelID: string, message: string, signature: string): Promise<boolean> {
    return this.verifyMessageWithPastelID(pastelID, message, signature);
  }

  // -------------------------
  // Tracking Addresses
  // -------------------------

  /**
   * Checks if an address is already imported in the local wallet.
   * @param addressToCheck - The address to check.
   * @returns `true` if already imported, otherwise `false`.
   */
  public async checkIfAddressIsAlreadyImportedInLocalWallet(addressToCheck: string): Promise<boolean> {
    this.ensureInitialized();
    const addresses = await this.getAllAddresses();
    return addresses.includes(addressToCheck);
  }

  /**
   * Imports an address to track for monitoring.
   * @param address - The address to import.
   */
  public async importAddress(address: string): Promise<void> {
    this.ensureInitialized();
    const importedAddresses = JSON.parse(localStorage.getItem("importedAddresses") || "[]") as string[];
    if (!importedAddresses.includes(address)) {
      importedAddresses.push(address);
      localStorage.setItem("importedAddresses", JSON.stringify(importedAddresses));
    }
    console.log(`Address ${address} has been tracked for monitoring.`);
  }

  // -------------------------
  // Wallet Export and Download Methods
  // -------------------------

  /**
   * Downloads the wallet data to a .dat file.
   * @param filename - The name of the file to download.
   * @returns `true` if the download was successful, otherwise `false`.
   */
  public async downloadWalletToDatFile(filename: string = "pastel_wallet.dat"): Promise<boolean> {
    this.ensureInitialized();
    try {
      const addressCount = await this.getAddressesCount();
      const addresses: string[] = [];
      const networkMode = this.getNetworkModeEnum(await this.getNetworkMode());
      for (let i = 0; i < addressCount; i++) {
        addresses.push(await this.pastelInstance!.GetAddress(i, networkMode));
      }
      const privateKeys = await Promise.all(
        addresses.map((addr) =>
          this.pastelInstance!.GetAddressSecret(addr, networkMode)
        )
      );
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

  /**
   * Creates wallet data from private keys.
   * @param privateKeys - An array of private keys.
   * @returns The wallet data as an ArrayBuffer.
   */
  private createWalletData(privateKeys: string[]): ArrayBuffer {
    const magicBytes = new Uint8Array([0x30, 0x81, 0xd3, 0x02, 0x01, 0x01, 0x04, 0x20]);
    const walletData = new Uint8Array(privateKeys.length * (magicBytes.length + 32));

    privateKeys.forEach((key, index) => {
      const offset = index * (magicBytes.length + 32);
      walletData.set(magicBytes, offset);
      walletData.set(Buffer.from(key, "hex"), offset + magicBytes.length);
    });

    return walletData.buffer;
  }

  /**
   * Extracts private keys from wallet data.
   * @param walletData - The wallet data as an ArrayBuffer.
   * @returns An array of extracted private keys.
   */
  private extractPrivateKeys(walletData: ArrayBuffer): string[] {
    const dataView = new DataView(walletData);
    const privateKeys: string[] = [];
    const magicBytes = [0x30, 0x81, 0xd3, 0x02, 0x01, 0x01, 0x04, 0x20];
    for (let i = 0; i < dataView.byteLength - magicBytes.length - 32; i++) {
      if (magicBytes.every((byte, index) => dataView.getUint8(i + index) === byte)) {
        const keyBuffer = new Uint8Array(walletData, i + magicBytes.length, 32);
        privateKeys.push(Buffer.from(keyBuffer).toString("hex"));
      }
    }
    console.log("Found " + privateKeys.length + " keys");
    return privateKeys;
  }

  /**
   * Loads a wallet from a .dat file.
   * @param walletData - The wallet data as an ArrayBuffer.
   * @returns `true` if the wallet was successfully loaded, otherwise `false`.
   */
  public async loadWalletFromDatFile(walletData: ArrayBuffer): Promise<boolean> {
    this.ensureInitialized();
    try {
      const privateKeys = this.extractPrivateKeys(walletData);
      const networkMode = this.getNetworkModeEnum(await this.getNetworkMode());
      for (const privKey of privateKeys) {
        await this.pastelInstance!.ImportLegacyPrivateKey(privKey, networkMode);
      }
      const addressCount = await this.getAddressesCount();
      return addressCount > 0;
    } catch (error) {
      console.error("Error loading wallet:", error);
      return false;
    }
  }

  // -------------------------
  // Misc. Additional Methods
  // -------------------------

  /**
   * Retrieves the address with the largest balance.
   * @returns The address with the largest balance.
   */
  public async getMyPslAddressWithLargestBalance(): Promise<string> {
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

  /**
   * Retrieves a PastelID ticket by its transaction ID.
   * @param txid - The transaction ID of the ticket.
   * @param decodeProperties - Whether to decode the properties of the ticket.
   * @returns The ticket data.
   */
  public async getPastelTicket(txid: string): Promise<unknown> {
    this.ensureInitialized();
    return this.fetchJson<unknown>(`/get_ticket_by_txid/${txid}`);
  }

  /**
   * Lists contract tickets based on type and starting block height.
   * @param ticketTypeIdentifier - The identifier for the ticket type.
   * @param startingBlockHeight - The block height to start listing from.
   * @returns An array of contract tickets.
   */
  public async listContractTickets(ticketTypeIdentifier: string, startingBlockHeight: number = 0): Promise<unknown[]> {
    this.ensureInitialized();
    return this.fetchJson<unknown[]>(`/tickets/contract/list/${ticketTypeIdentifier}/${startingBlockHeight}`);
  }

  /**
   * Finds a contract ticket based on a key.
   * @param key - The key to search for.
   * @returns The found contract ticket.
   */
  public async findContractTicket(key: string): Promise<unknown> {
    this.ensureInitialized();
    return this.fetchJson<unknown>(`/tickets/contract/find/${key}`);
  }

  /**
   * Retrieves a specific contract ticket.
   * @param txid - The transaction ID of the contract ticket.
   * @param decodeProperties - Whether to decode the properties of the ticket.
   * @returns The contract ticket data.
   */
  public async getContractTicket(txid: string, decodeProperties: boolean = true): Promise<unknown> {
    this.ensureInitialized();
    return this.fetchJson<unknown>(`/tickets/contract/get/${txid}?decode_properties=${decodeProperties}`);
  }

  /**
   * Lists the amounts for each address.
   * @param includeEmpty - Whether to include addresses with zero balance.
   * @returns An object mapping addresses to their respective balances.
   */
  public async listAddressAmounts(includeEmpty: boolean = false): Promise<{ [address: string]: number }> {
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

  // -------------------------
  // PastelSigner Class Methods
  // -------------------------

  /**
   * Signs data using the PastelSigner class.
   * @param message - The message to sign.
   * @param pastelID - The PastelID to use for signing.
   * @param passPhrase - The passphrase associated with the PastelID.
   * @returns The generated signature.
   */
  public async SignWithPastelIDClass(message: string, pastelID: string, passPhrase: string): Promise<string> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.SignWithPastelIDClass(message, pastelID, passPhrase)
    );
  }

  /**
   * Verifies a signature using the PastelSigner class.
   * @param message - The original message.
   * @param signature - The signature to verify.
   * @param pastelID - The PastelID used for verification.
   * @returns `true` if the signature is valid, otherwise `false`.
   */
  public async VerifyWithPastelIDClass(message: string, signature: string, pastelID: string): Promise<boolean> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.VerifyWithPastelIDClass(message, signature, pastelID)
    );
  }

  /**
   * Verifies a signature using a LegRoast public key with the PastelSigner class.
   * @param message - The original message.
   * @param signature - The signature to verify.
   * @param pubLegRoast - The public key of the LegRoast.
   * @param flag - A boolean flag, purpose inferred from context.
   * @returns `true` if the signature is valid, otherwise `false`.
   */
  public async VerifyWithLegRoastClass(message: string, signature: string, pubLegRoast: string, flag: boolean = true): Promise<boolean> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.VerifyWithLegRoastClass(message, signature, pubLegRoast, flag)
    );
  }

  // -------------------------
  // Exported PastelID Keys Methods
  // -------------------------

  /**
   * Exports PastelID keys to a specified path.
   * @param pastelID - The PastelID to export keys for.
   * @param password - The password to secure the exported keys.
   * @param path - The directory path to export the keys to.
   * @returns `true` if the export was successful, otherwise `false`.
   */
  public async ExportPastelIDKeys(pastelID: string, password: string, path: string): Promise<boolean> {
    this.ensureInitialized();
    return this.executeWasmMethod(() =>
      this.pastelInstance!.ExportPastelIDKeys(pastelID, password, path)
    );
  }

  // -------------------------
  // Tracking Addresses Methods
  // -------------------------

  /**
   * Ensures that tracking addresses have a minimal PSL balance.
   * @param addressesList - Optional list of addresses to check.
   */
  public async ensureTrackingAddressesHaveMinimalPSLBalance(addressesList: string[] | null = null): Promise<void> {
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

  /**
   * Sends funds to a specific address.
   * @param address - The address to send funds to.
   * @param amount - The amount of PSL to send.
   * @returns The transaction ID.
   */
  public async sendToAddress(address: string, amount: number, creditUsageTrackingPSLAddress: string = ''): Promise<string> {
    this.ensureInitialized();
    const sendTo = [{ address, amount }];
    const fromAddress = await this.getMyPslAddressWithLargestBalance();
    return this.createSendToTransaction(sendTo, creditUsageTrackingPSLAddress || fromAddress); // Assuming fee is 0
  }

  /**
   * Sends funds to multiple addresses.
   * @param amounts - An array of objects containing address and amount.
   * @returns The transaction ID.
   */
  public async sendMany(amounts: { address: string; amount: number }[]): Promise<string> {
    this.ensureInitialized();
    const fromAddress = await this.getMyPslAddressWithLargestBalance();
    return this.createSendToTransaction(amounts, fromAddress); // Assuming fee is 0
  }

  /**
   * Formats a number with commas.
   * @param number - The number to format.
   * @returns The formatted number as a string.
   */
  public formatNumberWithCommas(number: number): string {
    return new Intl.NumberFormat("en-US").format(number);
  }

  // -------------------------
  // Balance and Wallet Info Methods
  // -------------------------

  /**
   * Retrieves the total balance of the wallet.
   * @returns The total balance.
   */
  public async getBalance(): Promise<number> {
    this.ensureInitialized();
    const addresses = await this.getAllAddresses();
    let totalBalance = 0;
    for (const address of addresses) {
      const balance = await this.checkPSLAddressBalance(address);
      totalBalance += balance;
    }
    return totalBalance;
  }

  /**
   * Retrieves information about the wallet.
   * @returns The wallet information.
   */
  public async getWalletInfo(): Promise<WalletInfo> {
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

  /**
   * Retrieves the total count of wallet transactions.
   * @returns The number of transactions.
   */
  public async getWalletTransactionCount(): Promise<number> {
    const transactions = JSON.parse(localStorage.getItem("transactions") || "[]") as unknown[];
    return transactions.length;
  }

  // -------------------------
  // Balance and Transaction Methods
  // -------------------------

  /**
   * Retrieves the balance of a specific address.
   * @param addressToCheck - The address to check.
   * @returns The balance of the address.
   */
  public async checkPSLAddressBalance(addressToCheck: string): Promise<number> {
    const addressBalance = await this.fetchJson<AddressBalance>(`/get_address_balance?addresses=${addressToCheck}`)
    return addressBalance.balance ? addressBalance.balance / 100000 : 0;
  }

  /**
   * Retrieves the history of a specific address.
   * @param address - The address to retrieve history for.
   * @returns The address history.
   */
  public async getAddressHistory(address: string): Promise<unknown> {
    return this.fetchJson<unknown>(`/get_address_history/${address}`);
  }

  // -------------------------
  // Credit Tracking Methods
  // -------------------------

  /**
   * Sends tracking amount from a control address to a burn address to confirm an inference request.
   * @param inferenceRequestId - The ID of the inference request.
   * @param creditUsageTrackingPSLAddress - The control PSL address.
   * @param creditUsageTrackingAmountInPSL - The amount to track.
   * @param burnAddress - The burn address to send the tracking amount to.
   * @returns The transaction ID.
   */
  public async sendTrackingAmountFromControlAddressToBurnAddressToConfirmInferenceRequest(
    inferenceRequestId: string,
    creditUsageTrackingPSLAddress: string,
    creditUsageTrackingAmountInPSL: number,
    burnAddress: string,
    callback: (value: string) => void,
    onSaveLocalStorage: (value: string) => void,
  ): Promise<string> {
    const sendTo = [{ address: burnAddress, amount: creditUsageTrackingAmountInPSL }];
    callback(JSON.stringify({ message: `Sending ${creditUsageTrackingAmountInPSL} PSL to confirm an inference request.` }))
    const txID = await this.createSendToTransaction(sendTo, creditUsageTrackingPSLAddress); // Assuming fee is 0
    callback(JSON.stringify({ message: `Verifying the transaction id(${txID}) to confirm an inference request.` }))
    if (txID) {
      onSaveLocalStorage(txID);
      await new Promise<void>((resolve) => {
        const checkAcknowledgement = async () => {
          const { data } = await axios.get(`${this.apiBaseUrl}/gettransactionconfirmations/${txID}`);
          if (data?.confirmed) {
            setTimeout(() => {
              resolve();
            }, 1000);
          } else {
            setTimeout(checkAcknowledgement, 15000);
          }
        };
        checkAcknowledgement();
      });
      return txID;
    }
    return '';
  }

  // ------------------------- 
  // Misc Other Methods
  // -------------------------

  async getTransactionConfirmations(
    txid: string,
  ): Promise<boolean> {
    const { data } = await axios.get(`${this.apiBaseUrl}/gettransactionconfirmations/${txid}`);
    return data?.confirmed || false
  }

  async getTransactionDetails(
    txid: string,
    includeWatchonly: boolean = false
  ): Promise<TransactionDetail> {
    return this.fetchJson<TransactionDetail>(
      `/gettransaction/${txid}?includeWatchonly=${includeWatchonly}`
    );
  }

  async validateAddress(address: string): Promise<ValidatedAddress> {
    return this.fetchJson<ValidatedAddress>(`/validateaddress/${address}`);
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

  async isCreditPackConfirmed(txid: string): Promise<boolean> {
    const ticket = await this.getPastelTicket(txid);
    return (
      typeof ticket === "object" &&
      ticket !== null &&
      "height" in ticket &&
      (ticket as { height: number }).height > 0
    );
  }

  async getAndDecodeRawTransaction(
    txid: string
  ): Promise<DecodedRawTransaction> {
    const rawTx = await this.fetchJson<string>(`/getrawtransaction/${txid}`);
    return this.fetchJson<DecodedRawTransaction>(
      `/decoderawtransaction/${rawTx}`
    );
  }

  async createAndFundNewPSLCreditTrackingAddress(
    amountOfPSLToFundAddressWith: number
  ): Promise<{ newCreditTrackingAddress: string; txid: string }> {
    this.ensureInitialized();
    const addresses = await this.getAllAddresses();
    const localAddress = localStorage.getItem('MY_LOCAL_ADDRESSES');
    if (!localAddress) {
      localStorage.setItem('MY_LOCAL_ADDRESSES', JSON.stringify(addresses));
    } else {
      const parseAddress = JSON.parse(localAddress);
      const combined: string[] = Array.from(new Set([...addresses, ...parseAddress]));
      const newAddresses = [...combined]
      localStorage.setItem('MY_LOCAL_ADDRESSES', JSON.stringify(newAddresses));
    }
    const generateNewAddress = async (): Promise<string> => {
      const newAddress = await this.makeNewAddress();
      const data = await this.fetchJson<string[]>(`/get_address_txids?addresses=${newAddress}`);
      const localAddress = localStorage.getItem('MY_LOCAL_ADDRESSES');
      let parseAddress = [];
      if (localAddress) {
        parseAddress = JSON.parse(localAddress);
      }
      if (parseAddress.indexOf(newAddress) === -1 && !data?.length) {
        return newAddress;
      }
      return await generateNewAddress();
    }
    const newAddress = await generateNewAddress();
    const txid = await this.sendToAddress(
      newAddress,
      amountOfPSLToFundAddressWith
    );
    return { newCreditTrackingAddress: newAddress, txid };
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

  async checkForRegisteredPastelID(): Promise<string | null> {
    this.ensureInitialized();
    const pastelIDs = await this.getPastelIDs();
    for (const pastelID of pastelIDs) {
      const isRegistered = await this.isPastelIDRegistered(pastelID);
      if (isRegistered) {
        return pastelID;
      }
    }
    return null;
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

  async getPastelIDsCount(): Promise<number> {
    try {
      const rpc = BrowserRPCReplacement.getInstance();
      await rpc.initialize(); // Ensure RPC is initialized
  
      const pastelIDs = await rpc.getPastelIDs(); // Fetch all PastelIDs
      return pastelIDs.length; // Return the count
    } catch (error) {
      console.error("Error getting PastelIDs count:", error);
      throw error;
    }
  }

  public async importPastelIDFileIntoWallet(fileContent: string, pastelID: string, passPhrase: string): Promise<{ success: boolean; message: string }> {
    this.ensureInitialized();
    let tempFilePath: string | null = null;
    let contentLength = 0;
    try {
      const FS = this.wasmModule!.FS;
  
      // Decode the base64 encoded secure container
      const binaryString = atob(fileContent);
      contentLength = binaryString.length;
      const bytes = new Uint8Array(contentLength);
      for (let i = 0; i < contentLength; i++) {
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
      tempFilePath = `${dirPath}/${pastelID}`;
  
      // Write the decoded binary data to the Emscripten FS
      FS.writeFile(tempFilePath, bytes);
  
      // Sync the file system
      await new Promise<void>((resolve, reject) => {
        FS.syncfs(false, (err: Error | null) => {
          if (err) {
            console.error("Error syncing file system:", err);
            reject(err);
          } else {
            console.log("File system synced successfully.");
            resolve();
          }
        });
      });
      await this.pastelInstance!.ImportPastelIDKeys(pastelID, passPhrase, dirPath)

      return { success: true, message: "PastelID imported successfully!" };
    } catch (error) {
      console.error("Error importing PastelID:", error);
      return {
        success: false,
        message: `Failed to import PastelID: ${(error as Error).message}`,
      };
    } finally {
      // Clean up: overwrite the temporary file with zeros if it exists
      if (tempFilePath && this.wasmModule) {
        try {
          const FS = this.wasmModule.FS;
          const zeroBuffer = new Uint8Array(contentLength);
          FS.writeFile(tempFilePath, zeroBuffer);
  
          // Sync the file system after cleanup
          await new Promise<void>((resolve) => {
            FS.syncfs(false, (err: Error | null) => {
              if (err) {
                console.error("Error syncing file system during cleanup:", err);
              } else {
                console.log("File system synced successfully during cleanup.");
              }
              resolve();
            });
          });
  
          // Delete the temporary file
          FS.unlink(tempFilePath);
        } catch (error) {
          console.error("Error cleaning up temporary file:", error);
        }
      }
    }
  }

}

export default BrowserRPCReplacement;
