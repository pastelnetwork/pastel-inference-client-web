// src/app/types/index.ts

// WASM library related types:

/**
 * Interface representing the Emscripten File System (FS) object.
 */
export interface EmscriptenFS {
  mkdir(path: string): void;
  writeFile(path: string, data: Uint8Array): void;
  unlink(path: string): void;
  syncfs(populate: boolean, callback: (err: Error | null) => void): void;
  readdir(path: string): string[]; 
}

/**
 * Enumeration representing different network modes.
 */
export enum NetworkMode {
  Mainnet = 0,
  Testnet = 1,
  Devnet = 2,
}

/**
 * Enumeration representing different types of PastelIDs.
 */
export enum PastelIDType {
  PastelID = 0,
  LegRoast = 1,
}

/**
 * Interface representing the Pastel instance with all documented methods.
 */
export interface PastelInstance {
  // -------------------------
  // Wallet Management Methods
  // -------------------------
  
  CreateNewWallet(password: string): string;
  CreateWalletFromMnemonic(password: string, mnemonic: string): string;
  ExportWallet(): string;
  ImportWallet(walletData: string | ArrayBuffer): boolean;
  UnlockWallet(password: string): boolean;
  LockWallet(): boolean;

  // -------------------------
  // Address Management Methods
  // -------------------------
  
  MakeNewAddress(mode: NetworkMode): string;
  GetAddress(index: number, mode: NetworkMode): string;
  GetAddresses(mode?: NetworkMode): string[];
  GetAddressesCount(): string;

  // -------------------------
  // PastelID Management Methods
  // -------------------------
  
  MakeNewPastelID(flag: boolean): string;
  GetPastelIDByIndex(index: number, type: PastelIDType): string;
  GetPastelID(pastelID: string, type: PastelIDType): string;
  ImportPastelIDKeys(pastelID: string, passPhrase: string, dirPath: string): string;
  GetPastelIDs(): string[];

  // -------------------------
  // Signing and Verification Methods
  // -------------------------
  
  SignWithPastelID(pastelID: string, data: string, type: PastelIDType, flag: boolean): string;
  VerifyWithPastelID(pastelID: string, data: string, signature: string, flag: boolean): string;
  VerifyWithLegRoast(pubLegRoast: string, data: string, signature: string, flag: boolean): boolean;

  // -------------------------
  // Key Management Methods
  // -------------------------
  
  GetAddressSecret(address: string, mode: NetworkMode): string;
  ImportLegacyPrivateKey(privKey: string, mode: NetworkMode): string;

  // -------------------------
  // Ticket Management Methods
  // -------------------------
  
  GetTicketTypes(): string[];
  GetPastelIDTicketType(pastelID: string): string;
  GetPastelIDTicketJson(pastelID: string): string;
  CreatePastelIDTicket(
    pastelID: string,
    type: string,
    ticketDataJson: string,
    networkMode: NetworkMode
  ): string;
  GetPastelIDTicketsCount(): number;
  GetPastelIDTicketByIndex(index: number): string;

  // -------------------------
  // Additional Wallet Methods
  // -------------------------
  
  SignWithWalletKey(message: string): string;
  GetWalletPubKey(): string;
  GetPubKeyAt(index: number): string;
  SignWithKeyAt(index: number, message: string): string;

  // -------------------------
  // Transaction Management Methods
  // -------------------------
  
  CreateSendToTransaction(
    mode: NetworkMode,
    sendTo: string,
    optionalField: string,
    utxos: string,
    blockHeight: number,
    expiryBlockHeight: number,
  ): string;
  CreateSendToTransactionJson(
    mode: NetworkMode,
    sendToJson: string,
    optionalField: string,
    utxoJson: string,
    fee: number
  ): string;
  CreateRegisterPastelIdTransaction(
    mode: NetworkMode,
    pastelID: string,
    address: string,
    utxos: string,
    blockHeight: number,
    expiryHeight: number
  ): string;
  CreateRegisterPastelIdTransactionJson(
    mode: NetworkMode,
    pastelID: string,
    address: string,
    utxoJson: string,
    fee: number
  ): string;

  // -------------------------
  // PastelSigner Class Methods
  // -------------------------
  
  SignWithPastelIDClass(message: string, pastelID: string, passPhrase: string): string;
  VerifyWithPastelIDClass(message: string, signature: string, pastelID: string): boolean;
  VerifyWithLegRoastClass(message: string, signature: string, pubLegRoast: string, flag: boolean): boolean;

  // -------------------------
  // Exported PastelID Keys Methods
  // -------------------------
  
  ExportPastelIDKeys(pastelID: string, password: string, path: string): boolean;
}

/**
 * Interface representing the Emscripten Module.
 */
export interface EmscriptenModule {
  FS: EmscriptenFS;
  calledRun: boolean;
  onRuntimeInitialized: () => void;
  NetworkMode: typeof NetworkMode;
  PastelIDType: typeof PastelIDType;
}

/**
 * Interface representing the entire PastelModule, extending EmscriptenModule.
 */
export interface PastelModule extends EmscriptenModule {
  Pastel: new () => PastelInstance;
}

// Misc other types:

export interface LogEntry {
  level: string;
  msg: string;
  meta: unknown;
  timestamp: string;
}

export interface LoggerListener {
  (data: string): void;
}

export interface BrowserLogger {
  logBuffer: string[];
  MAX_LOG_ENTRIES: number;
  listeners: Map<string, Set<LoggerListener>>;
  log(level: string, msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  info(msg: string, meta?: unknown): void;
  debug(msg: string, meta?: unknown): void;
  safeStringify(obj: unknown): string;
  on(eventName: string, listener: LoggerListener): void;
  off(eventName: string, listener: LoggerListener): void;
  emit(eventName: string, data: string): void;
}

export interface PastelGlobals {
  MY_LOCAL_PASTELID: string | null;
  MY_PASTELID_PASSPHRASE: string | null;
  MAX_CHARACTERS_TO_DISPLAY_IN_ERROR_MESSAGE: number;
  setPastelIdAndPassphrase(pastelId: string, passphrase: string): void;
  getPastelIdAndPassphrase(): {
    pastelID: string | null;
    passphrase: string | null;
  };
  getPastelId(): string | null;
  getPassphrase(): string | null;
}

export interface PastelInferenceClientConfig {
  pastelID: string;
  passphrase: string;
}

export interface ChallengeResponse {
  challenge: string;
  challenge_id: string;
  challenge_signature: string;
}

export interface ModelParameter {
  name: string;
  description: string;
  type: string;
  default: string | number;
  inference_types_parameter_applies_to: string[];
  options?: string[];
}

export interface ModelInfo {
  model_name: string;
  supported_inference_type_strings: string[];
  model_parameters: ModelParameter[];
}

export interface ModelMenu {
  models: ModelInfo[];
}

export interface SupernodeResponse {
  response: unknown;
  url: string;
}

export interface ValidCreditPackTicket {
  credit_pack_registration_txid: string;
  credit_purchase_request_confirmation_pastel_block_height: number;
  requesting_end_user_pastelid: string;
  ticket_input_data_fully_parsed_sha3_256_hash: string;
  txid_of_credit_purchase_burn_transaction: string;
  credit_usage_tracking_psl_address: string;
  psl_cost_per_credit: number;
  requested_initial_credits_in_credit_pack: number;
  credit_pack_current_credit_balance: number;
  balance_as_of_datetime: string;
  number_of_confirmation_transactions: number;
}

export interface BalanceInfo {
  credit_pack_current_credit_balance: number;
  balance_as_of_datetime: string;
}


export interface SupernodeWithDistance extends SupernodeInfo {
  distance: bigint;
}

export interface ModelParameter {
  name: string;
  description: string;
  type: string;
  default: string | number;
  inference_types_parameter_applies_to: string[];
  options?: string[];
}

export interface CachedItem<T> {
  key: string;
  data: T;
  timestamp: number;
}

export interface ValidationError {
  message: string;
}

export interface SupernodeListResult {
  validMasternodeListFullDF: SupernodeInfo[];
  filter: (predicate: (supernode: SupernodeInfo) => boolean) => SupernodeInfo[];
}

export interface AuditResult {
  inference_response_id: string;
  inference_request_id: string;
  inference_result_id: string;
  proposed_cost_of_request_in_inference_credits: number;
  remaining_credits_in_pack_after_request_processed: number;
  credit_usage_tracking_psl_address: string;
  request_confirmation_message_amount_in_patoshis: number;
  max_block_height_to_include_confirmation_transaction: number;
  supernode_pastelid_and_signature_on_inference_request_response_hash: string;
  responding_supernode_pastelid: string;
  inference_result_json_base64: string;
  inference_result_file_type_strings: string;
  responding_supernode_signature_on_inference_result_id: string;
}

export interface InferenceResultDict {
  supernode_url: string;
  request_data: InferenceAPIUsageRequest;
  usage_request_response: InferenceAPIUsageResponse;
  model_input_data_json: unknown;
  output_results: InferenceAPIOutputResult;
  generated_image_decoded?: string;
  zip_file_data?: string;
  inference_result_decoded?: string;
}

export interface CreditPackTicketInfo {
  requestResponse: CreditPackPurchaseRequestResponse;
  requestConfirmation: CreditPackPurchaseRequestConfirmation;
  balanceInfo: BalanceInfo;
}

export interface PreliminaryPriceQuote {
  preliminary_quoted_price_per_credit_in_psl: number;
  preliminary_total_cost_of_credit_pack_in_psl: number;
  credit_pack_purchase_request_fields_json_b64: string;
  credit_usage_tracking_psl_address: string;
  preliminary_price_quote_timestamp_utc_iso_string: string;
  preliminary_price_quote_pastel_block_height: number;
  preliminary_price_quote_message_version_string: string;
  sha3_256_hash_of_credit_pack_purchase_request_preliminary_price_quote_fields: string;
  responding_supernode_pastelid: string;
  responding_supernode_signature_on_credit_pack_purchase_request_preliminary_price_quote_hash: string;
}

export interface InferenceRequestData {
  id?: number | string;
  requesting_pastelid: string;
  credit_pack_ticket_pastel_txid: string;
  requested_model_canonical_string: string;
  model_inference_type_string: string;
  model_parameters_json_b64: string;
  model_input_data_json_b64: string;
  inference_request_utc_iso_string: string;
  inference_request_pastel_block_height: number;
  status: string;
  inference_request_message_version_string: string;
  sha3_256_hash_of_inference_request_fields: string;
  requesting_pastelid_signature_on_request_hash: string;
}

export interface InferenceConfirmationData {
  id?: number | string;
  inference_request_id: string;
  requesting_pastelid: string;
  confirmation_transaction: {
    txid: string;
  };
}

export interface CreditPackEstimation {
  desiredNumberOfCredits: number;
  creditPriceCushionPercentage: number;
}

export interface PreliminaryPriceQuote {
  preliminary_quoted_price_per_credit_in_psl: number;
  preliminary_total_cost_of_credit_pack_in_psl: number;
  credit_pack_purchase_request_fields_json_b64: string;
  credit_usage_tracking_psl_address: string;
}

export interface CreditPackCreationResult {
  creditPackRequest: CreditPackPurchaseRequest;
  creditPackPurchaseRequestConfirmation: CreditPackPurchaseRequestConfirmation;
  creditPackStorageRetryRequestResponse?: unknown;
  creditPackPurchaseRequestConfirmationResponse?: CreditPackPurchaseRequestConfirmationResponse;
}

export interface SupernodeURL {
  url: string;
  pastelID: string;
}

export interface SupernodeInfo {
  txid_vout: string;
  supernode_status: string;
  protocol_version: number;
  supernode_psl_address: string;
  lastseentime: number;
  activeseconds: number;
  activedays: number;
  lastpaidtime: number;
  lastpaidblock: number;
  ipaddress_port: string;
  rank: number;
  pubkey: string;
  extAddress: string;
  extP2P: string;
  extKey: string;
  url?: string;
}

export interface WalletInfo {
  walletversion: number;
  balance: number;
  unconfirmed_balance: number;
  immature_balance: number;
  txcount: number;
  keypoololdest: number;
  keypoolsize: number;
  paytxfee: number;
  seedfp: string;
}

export interface CreditPack extends ValidCreditPackTicket {
  id: string;
  credits: number;
  balance: number;
  address: string;
}

// Define specific interfaces for each inference type
export interface ModelInputDataTextCompletion {
  prompt: string;
}

export interface ModelInputDataImageGeneration {
  imagePrompt: string;
}

export interface ModelInputDataAskQuestionAboutImage {
  image: string;
  question: string;
}

export interface ModelInputDataEmbeddingDocument {
  document?: string;
  question: string;
}

export interface ModelInputDataEmbeddingAudio {
  audio?: string;
  question: string;
}

// Union type for all possible model input data
export type ModelInputData = 
  | ModelInputDataTextCompletion
  | ModelInputDataImageGeneration
  | ModelInputDataAskQuestionAboutImage
  | ModelInputDataEmbeddingDocument
  | ModelInputDataEmbeddingAudio;


  export interface InferenceRequestParams {
    creditPackTicketPastelTxid: string;
    modelInputData: ModelInputData;
    requestedModelCanonicalString: string;
    modelInferenceTypeString: string;
    modelParameters: unknown;
    maximumInferenceCostInCredits: number;
  }

export interface InferenceResult {
  supernode_url: string;
  request_data: InferenceAPIUsageRequest;
  usage_request_response: InferenceAPIUsageResponse;
  model_input_data_json: unknown;
  output_results: InferenceAPIOutputResult;
  generated_image_decoded?: string;
  zip_file_data?: string;
  inference_result_decoded?: string;
}

export interface PastelIDTicket {
  ticket: {
    pastelID: string;
    [key: string]: unknown;
  };
}

export interface TransactionDetail {
  amount: number;
  confirmations: number;
  blockhash: string;
  blockindex: number;
  blocktime: number;
  txid: string;
  time: number;
  timereceived: number;
  details: {
    account: string;
    address: string;
    category: string;
    amount: number;
    vout: number;
  }[];
  hex: string;
}

export interface BlockInfo {
  hash: string;
  confirmations: number;
  size: number;
  height: number;
  version: number;
  merkleroot: string;
  tx: string[];
  time: number;
  nonce: string;
  bits: string;
  difficulty: number;
  previousblockhash: string;
  nextblockhash?: string;
}

export interface MempoolInfo {
  size: number;
  bytes: number;
  usage: number;
}

export interface BlockchainInfo {
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  verificationprogress: number;
  chainwork: string;
}

export interface TxOutSetInfo {
  height: number;
  bestblock: string;
  transactions: number;
  txouts: number;
  bytes_serialized: number;
  hash_serialized: string;
  total_amount: number;
}

export interface ChainTip {
  height: number;
  hash: string;
  branchlen: number;
  status: string;
}

export interface SendToAddressResult {
  success: boolean;
  result?: string;
  message?: string;
  newCreditTrackingAddress?: string;
  txid?: string;
}

export interface BlockHeader {
  hash: string;
  confirmations: number;
  height: number;
  version: number;
  merkleroot: string;
  time: number;
  nonce: string;
  bits: string;
  difficulty: number;
  previousblockhash: string;
  nextblockhash?: string;
}

export interface TxOutInfo {
  bestblock: string;
  confirmations: number;
  value: number;
  scriptPubKey: {
    asm: string;
    hex: string;
    reqSigs: number;
    type: string;
    addresses: string[];
  };
  version: number;
  coinbase: boolean;
}

export interface MemoryInfo {
  locked: {
    used: number;
    free: number;
    total: number;
    locked: number;
    chunks_used: number;
    chunks_free: number;
  };
}

export interface BlockSubsidy {
  miner: number;
  masternode: number;
  governance: number;
}

export interface BlockTemplate {
  version: number;
  previousblockhash: string;
  transactions: unknown[];
  coinbaseaux: {
    flags: string;
  };
  coinbasevalue: number;
  longpollid: string;
  target: string;
  mintime: number;
  mutable: string[];
  noncerange: string;
  sigoplimit: number;
  sizelimit: number;
  curtime: number;
  bits: string;
  height: number;
}

export interface MiningInfo {
  blocks: number;
  currentblocksize: number;
  currentblocktx: number;
  difficulty: number;
  errors: string;
  genproclimit: number;
  networkhashps: number;
  pooledtx: number;
  testnet: boolean;
  chain: string;
  generate: boolean;
}

export interface NetworkSolPs {
  networksolps: number;
}

export interface NodeInfo {
  addednode: string;
  connected: boolean;
  addresses: {
    address: string;
    connected: string;
  }[];
}

export interface PeerInfo {
  id: number;
  addr: string;
  addrlocal: string;
  services: string;
  lastsend: number;
  lastrecv: number;
  bytessent: number;
  bytesrecv: number;
  conntime: number;
  timeoffset: number;
  pingtime: number;
  version: number;
  subver: string;
  inbound: boolean;
  startingheight: number;
  banscore: number;
  synced_headers: number;
  synced_blocks: number;
  inflight: number[];
  whitelisted: boolean;
}

export interface DecodedRawTransaction {
  txid: string;
  version: number;
  locktime: number;
  vin: {
    txid: string;
    vout: number;
    scriptSig: {
      asm: string;
      hex: string;
    };
    sequence: number;
  }[];
  vout: {
    value: number;
    n: number;
    scriptPubKey: {
      asm: string;
      hex: string;
      reqSigs: number;
      type: string;
      addresses: string[];
    };
  }[];
}

export interface DecodedScript {
  asm: string;
  hex: string;
  type: string;
  reqSigs: number;
  addresses: string[];
  p2sh: string;
}

export interface ValidatedAddress {
  isvalid: boolean;
  address: string;
  scriptPubKey: string;
  ismine: boolean;
  iswatchonly: boolean;
  isscript: boolean;
}

export interface PastelIDInfo {
  pastelID: string;
  [key: string]: unknown;
}

export interface PastelID {
  pastelID: string | null;
  passphrase: string | null;
}

export interface NetworkInfo {
  network: string;
}

export interface AddressAmount {
  [address: string]: number;
}

export interface SupernodeList {
  id?: number | string;
  txid_vout: string;
  supernode_status: string;
  protocol_version: number;
  supernode_psl_address: string;
  lastseentime: number;
  activeseconds: number;
  activedays: number;
  lastpaidtime: number;
  lastpaidblock: number;
  ipaddress_port: string;
  rank: number;
  pubkey: string;
  extAddress: string;
  extP2P: string;
  extKey: string;
}

export interface Message {
  id: string;
  sending_sn_pastelid: string;
  receiving_sn_pastelid: string;
  sending_sn_txid_vout: string;
  receiving_sn_txid_vout: string;
  message_type: string;
  message_body: string;
  signature: string;
  timestamp?: string;
}

export interface UserMessage {
  id: string; // UUID v4
  from_pastelid: string;
  to_pastelid: string;
  message_body: string;
  message_signature: string;
  timestamp?: string; 
}

export interface CreditPackPurchaseRequest extends Record<string, unknown> {
  id?: number | string;
  requesting_end_user_pastelid: string;
  requested_initial_credits_in_credit_pack: number;
  list_of_authorized_pastelids_allowed_to_use_credit_pack: string;
  credit_usage_tracking_psl_address: string;
  request_timestamp_utc_iso_string: string;
  request_pastel_block_height: number;
  credit_purchase_request_message_version_string: string;
  sha3_256_hash_of_credit_pack_purchase_request_fields: string;
  requesting_end_user_pastelid_signature_on_request_hash: string;
}

export interface CreditPackPurchaseRequestRejection
  extends Record<string, unknown> {
  id?: number | string;
  sha3_256_hash_of_credit_pack_purchase_request_fields: string;
  credit_pack_purchase_request_fields_json_b64: string;
  rejection_reason_string: string;
  rejection_timestamp_utc_iso_string: string;
  rejection_pastel_block_height: number;
  credit_purchase_request_rejection_message_version_string: string;
  responding_supernode_pastelid: string;
  sha3_256_hash_of_credit_pack_purchase_request_rejection_fields: string;
  responding_supernode_signature_on_credit_pack_purchase_request_rejection_hash: string;
}

export interface CreditPackPurchaseRequestPreliminaryPriceQuote
  extends Record<string, unknown> {
  id?: number | string;
  sha3_256_hash_of_credit_pack_purchase_request_fields: string;
  credit_usage_tracking_psl_address: string;
  credit_pack_purchase_request_fields_json_b64: string;
  preliminary_quoted_price_per_credit_in_psl: number;
  preliminary_total_cost_of_credit_pack_in_psl: number;
  preliminary_price_quote_timestamp_utc_iso_string: string;
  preliminary_price_quote_pastel_block_height: number;
  preliminary_price_quote_message_version_string: string;
  responding_supernode_pastelid: string;
  sha3_256_hash_of_credit_pack_purchase_request_preliminary_price_quote_fields: string;
  responding_supernode_signature_on_credit_pack_purchase_request_preliminary_price_quote_hash: string;
}

export interface CreditPackPurchaseRequestPreliminaryPriceQuoteResponse
  extends Record<string, unknown> {
  id?: number | string;
  sha3_256_hash_of_credit_pack_purchase_request_fields: string;
  sha3_256_hash_of_credit_pack_purchase_request_preliminary_price_quote_fields: string;
  credit_pack_purchase_request_fields_json_b64: string;
  agree_with_preliminary_price_quote: boolean;
  credit_usage_tracking_psl_address: string;
  preliminary_quoted_price_per_credit_in_psl: number;
  preliminary_price_quote_response_timestamp_utc_iso_string: string;
  preliminary_price_quote_response_pastel_block_height: number;
  preliminary_price_quote_response_message_version_string: string;
  requesting_end_user_pastelid: string;
  sha3_256_hash_of_credit_pack_purchase_request_preliminary_price_quote_response_fields: string;
  requesting_end_user_pastelid_signature_on_preliminary_price_quote_response_hash: string;
}

export interface CreditPackPurchaseRequestResponseTermination
  extends Record<string, unknown> {
  id?: number | string;
  sha3_256_hash_of_credit_pack_purchase_request_fields: string;
  credit_pack_purchase_request_fields_json_b64: string;
  termination_reason_string: string;
  termination_timestamp_utc_iso_string: string;
  termination_pastel_block_height: number;
  credit_purchase_request_termination_message_version_string: string;
  responding_supernode_pastelid: string;
  sha3_256_hash_of_credit_pack_purchase_request_termination_fields: string;
  responding_supernode_signature_on_credit_pack_purchase_request_termination_hash: string;
}

export interface CreditPackPurchaseRequestResponse {
  id: string; // UUID v4
  sha3_256_hash_of_credit_pack_purchase_request_fields: string;
  credit_pack_purchase_request_fields_json_b64: string;
  psl_cost_per_credit: number;
  proposed_total_cost_of_credit_pack_in_psl: number;
  credit_usage_tracking_psl_address: string;
  request_response_timestamp_utc_iso_string: string;
  request_response_pastel_block_height: number;
  best_block_merkle_root: string;
  best_block_height: number;
  credit_purchase_request_response_message_version_string: string;
  responding_supernode_pastelid: string;
  list_of_blacklisted_supernode_pastelids: string;
  list_of_potentially_agreeing_supernodes: string;
  list_of_supernode_pastelids_agreeing_to_credit_pack_purchase_terms: string;
  list_of_supernode_pastelids_agreeing_to_credit_pack_purchase_terms_selected_for_signature_inclusion: string;
  selected_agreeing_supernodes_signatures_dict: string;
  sha3_256_hash_of_credit_pack_purchase_request_response_fields: string;
  responding_supernode_signature_on_credit_pack_purchase_request_response_hash: string;
}

export interface CreditPackPurchaseRequestConfirmation extends Record<string, unknown> {
  id?: number | string;
  sha3_256_hash_of_credit_pack_purchase_request_fields: string;
  sha3_256_hash_of_credit_pack_purchase_request_response_fields: string;
  credit_pack_purchase_request_fields_json_b64: string;
  requesting_end_user_pastelid: string;
  txid_of_credit_purchase_burn_transaction: string;
  credit_purchase_request_confirmation_utc_iso_string: string;
  credit_purchase_request_confirmation_pastel_block_height: number;
  credit_purchase_request_confirmation_message_version_string: string;
  sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields: string;
  requesting_end_user_pastelid_signature_on_sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields: string;
}

export interface CreditPackPurchaseRequestConfirmationResponse
  extends Record<string, unknown> {
  id?: number | string;
  sha3_256_hash_of_credit_pack_purchase_request_fields: string;
  sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields: string;
  credit_pack_confirmation_outcome_string: string;
  pastel_api_credit_pack_ticket_registration_txid: string;
  credit_pack_confirmation_failure_reason_if_applicable: string | null;
  credit_purchase_request_confirmation_response_utc_iso_string: string;
  credit_purchase_request_confirmation_response_pastel_block_height: number;
  credit_purchase_request_confirmation_response_message_version_string: string;
  responding_supernode_pastelid: string;
  sha3_256_hash_of_credit_pack_purchase_request_confirmation_response_fields: string;
  responding_supernode_signature_on_credit_pack_purchase_request_confirmation_response_hash: string;
}

export interface CreditPackRequestStatusCheck extends Record<string, unknown> {
  sha3_256_hash_of_credit_pack_purchase_request_fields: string;
  requesting_end_user_pastelid: string;
  requesting_end_user_pastelid_signature_on_sha3_256_hash_of_credit_pack_purchase_request_fields: string;
}

export interface CreditPackPurchaseRequestStatus
  extends Record<string, unknown> {
  id?: number | string;
  sha3_256_hash_of_credit_pack_purchase_request_fields: string;
  sha3_256_hash_of_credit_pack_purchase_request_response_fields: string;
  status: string;
  status_details: string;
  status_update_timestamp_utc_iso_string: string;
  status_update_pastel_block_height: number;
  credit_purchase_request_status_message_version_string: string;
  responding_supernode_pastelid: string;
  sha3_256_hash_of_credit_pack_purchase_request_status_fields: string;
  responding_supernode_signature_on_credit_pack_purchase_request_status_hash: string;
}

export interface CreditPackStorageRetryRequest extends Record<string, unknown> {
  id?: number | string;
  sha3_256_hash_of_credit_pack_purchase_request_response_fields: string;
  credit_pack_purchase_request_fields_json_b64: string;
  requesting_end_user_pastelid: string;
  closest_agreeing_supernode_to_retry_storage_pastelid: string;
  credit_pack_storage_retry_request_timestamp_utc_iso_string: string;
  credit_pack_storage_retry_request_pastel_block_height: number;
  credit_pack_storage_retry_request_message_version_string: string;
  sha3_256_hash_of_credit_pack_storage_retry_request_fields: string;
  requesting_end_user_pastelid_signature_on_credit_pack_storage_retry_request_hash: string;
}

export interface CreditPackStorageRetryRequestResponse
  extends Record<string, unknown> {
  id?: number | string;
  sha3_256_hash_of_credit_pack_purchase_request_fields: string;
  sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields: string;
  credit_pack_storage_retry_confirmation_outcome_string: string;
  pastel_api_credit_pack_ticket_registration_txid: string;
  credit_pack_storage_retry_confirmation_failure_reason_if_applicable: string;
  credit_pack_storage_retry_confirmation_response_utc_iso_string: string;
  credit_pack_storage_retry_confirmation_response_pastel_block_height: number;
  credit_pack_storage_retry_confirmation_response_message_version_string: string;
  closest_agreeing_supernode_to_retry_storage_pastelid: string;
  sha3_256_hash_of_credit_pack_storage_retry_confirmation_response_fields: string;
  closest_agreeing_supernode_to_retry_storage_pastelid_signature_on_credit_pack_storage_retry_confirmation_response_hash: string;
}

export interface InferenceAPIUsageRequest extends Record<string, unknown> {
  id?: number | string;
  inference_request_id: string;
  requesting_pastelid: string;
  credit_pack_ticket_pastel_txid: string;
  requested_model_canonical_string: string;
  model_inference_type_string: string;
  model_parameters_json_b64: string;
  model_input_data_json_b64: string;
  inference_request_utc_iso_string: string;
  inference_request_pastel_block_height: number;
  status: string;
  inference_request_message_version_string: string;
  sha3_256_hash_of_inference_request_fields: string;
  requesting_pastelid_signature_on_request_hash: string;
}

export interface InferenceAPIUsageResponse extends Record<string, unknown> {
  id?: number | string;
  inference_response_id: string;
  inference_request_id: string;
  proposed_cost_of_request_in_inference_credits: number;
  remaining_credits_in_pack_after_request_processed: number;
  credit_usage_tracking_psl_address: string;
  request_confirmation_message_amount_in_patoshis: number;
  max_block_height_to_include_confirmation_transaction: number;
  inference_request_response_utc_iso_string: string;
  inference_request_response_pastel_block_height: number;
  inference_request_response_message_version_string: string;
  sha3_256_hash_of_inference_request_response_fields: string;
  supernode_pastelid_and_signature_on_inference_request_response_hash: string;
}

export interface InferenceAPIOutputResult extends Record<string, unknown> {
  id?: number | string;
  inference_result_id: string;
  inference_request_id: string;
  inference_response_id: string;
  responding_supernode_pastelid: string;
  inference_result_json_base64: string;
  inference_result_file_type_strings: string;
  inference_result_utc_iso_string: string;
  inference_result_pastel_block_height: number;
  inference_result_message_version_string: string;
  sha3_256_hash_of_inference_result_fields: string;
  responding_supernode_signature_on_inference_result_id: string;
}

export interface InferenceConfirmation extends Record<string, unknown> {
  id?: number | string;
  inference_request_id: string;
  requesting_pastelid: string;
  confirmation_transaction: {
    txid: string;
  };
}

export interface ValidationResult extends Record<string, unknown> {
  inference_result_id: string;
  inference_response_id: string;
  inference_request_id: string;
  proposed_cost_in_credits: number;
  remaining_credits_after_request: number;
  credit_usage_tracking_psl_address: string;
  request_confirmation_message_amount_in_patoshis: number;
  max_block_height_to_include_confirmation_transaction: number;
  supernode_pastelid_and_signature_on_inference_response_id: unknown;
  responding_supernode_pastelid: string;
  inference_result_json_base64: string;
  inference_result_file_type_strings: unknown;
  responding_supernode_signature_on_inference_result_id: string;
}

export interface AddressBalanceItem {
  balance: number;
  address: string;
}

export interface AddressBalance {
  balance: number;
  received: number;
  addresses: AddressBalanceItem[]
}

export interface WalletData {
  wallet: string;
  balance: number;
  listPastelIDs: string[];
  addresses: string[];
  walletPassword: string;
  localPastelID: string;
}