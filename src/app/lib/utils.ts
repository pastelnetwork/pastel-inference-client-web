// src/app/lib/utils.ts

'use client'

import { Sha3Wasm, Memory, keccak256 } from "@hazae41/sha3.wasm";
import { sha3_256 } from 'js-sha3';
import pako from "pako";
import browserLogger from "@/app/lib/logger";
import BrowserRPCReplacement from "@/app/lib/BrowserRPCReplacement";
import { cacheInstance } from "@/app/lib/cache";
import {
  SupernodeInfo,
  ValidationError,
  AuditResult,
  InferenceResultDict,
  InferenceAPIUsageResponse,
  InferenceAPIOutputResult,
  ValidationResult,
  CreditPackPurchaseRequestResponse,
  SupernodeWithDistance,
  PastelIDType,
} from "@/app/types";

// Initialize WASM SHA3
let sha3Initialized = false;
async function initializeSha3() {
  if (!sha3Initialized) {
    await Sha3Wasm.initBundled();
    sha3Initialized = true;
  }
}

const rpc = BrowserRPCReplacement.getInstance();

const MAX_CACHE_AGE_MS = 1 * 60 * 1000; // 1 minute in milliseconds

function safeLocalStorage() {
  if (typeof window !== 'undefined') {
    return window.localStorage;
  }
  return null;
}

// Constants
const TARGET_VALUE_PER_CREDIT_IN_USD = parseFloat(
  safeLocalStorage()?.getItem("TARGET_VALUE_PER_CREDIT_IN_USD") || "0.01"
);
const TARGET_PROFIT_MARGIN = parseFloat(
  safeLocalStorage()?.getItem("TARGET_PROFIT_MARGIN") || "0.1"
);
const MAXIMUM_LOCAL_CREDIT_PRICE_DIFFERENCE_TO_ACCEPT_CREDIT_PRICING =
  parseFloat(
    safeLocalStorage()?.getItem(
      "MAXIMUM_LOCAL_CREDIT_PRICE_DIFFERENCE_TO_ACCEPT_CREDIT_PRICING"
    ) || "0.001"
  );
const MAXIMUM_LOCAL_PASTEL_BLOCK_HEIGHT_DIFFERENCE_IN_BLOCKS = parseInt(
  safeLocalStorage()?.getItem(
    "MAXIMUM_LOCAL_PASTEL_BLOCK_HEIGHT_DIFFERENCE_IN_BLOCKS"
  ) || "10"
);


// Helper functions
export function safeStringify(obj: unknown): string {
  return JSON.stringify(obj, (key, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function retryPromise<T>(
  promiseFunc: () => Promise<T>,
  retryLimit: number
): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i < retryLimit; i++) {
    try {
      return await promiseFunc();
    } catch (error) {
      lastError = error as Error;
    }
  }
  throw lastError;
}

// Cache functions

export async function clearOldCache(): Promise<void> {
  const keys = cacheInstance.findAll();
  const currentTime = Date.now();
  for (const key of keys) {
    const item = cacheInstance.findByPk(key);
    if (item && item.timestamp) {
      if (currentTime - item.timestamp > MAX_CACHE_AGE_MS) {
        cacheInstance.destroy({ where: { key } });
      }
    } else {
      cacheInstance.destroy({ where: { key } });
    }
  }
}

export async function storeInCache<T>(key: string, data: T): Promise<void> {
  cacheInstance.set(key, data);
}

export async function getFromCache<T>(key: string): Promise<T | null> {
  return cacheInstance.get(key) as T | null;
}

// Market price functions
export async function fetchCurrentPSLMarketPrice(): Promise<number> {
  async function checkPrices(): Promise<{
    priceCMC: number | null;
    priceCG: number | null;
  }> {
    try {
    const myHeaders = new Headers();
    const requestOptions = {
      method: "GET",
      headers: myHeaders,
      redirect: "follow"
    };

    const [responseCMC, responseCG] = await Promise.all([
        fetch("https://min-api.cryptocompare.com/data/price?fsym=PSL&tsyms=USD", requestOptions as RequestInit),
        fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=pastel&vs_currencies=usd", requestOptions as RequestInit
        ),
      ]);

      const jsonCMS = await responseCMC.json();
      const jsonCG = await responseCG.json();
      const priceCMC = jsonCMS.USD ?? null;
      const priceCG = jsonCG.pastel?.usd ?? null;
      return { priceCMC, priceCG };
    } catch (error) {
      browserLogger.error(
        `Error fetching PSL market prices: ${(error as Error).message}`
      );
      return { priceCMC: null, priceCG: null };
    }
  }

  let { priceCMC, priceCG } = await checkPrices();
  if (priceCMC === null && priceCG === null) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    ({ priceCMC, priceCG } = await checkPrices());
  }

  const prices = [priceCMC, priceCG].filter(
    (price): price is number => price !== null
  );
  if (prices.length === 0) {
    throw new Error("Could not retrieve PSL price from any source.");
  }

  const averagePrice =
    prices.reduce((sum, price) => sum + price, 0) / prices.length;
  if (averagePrice < 0.0000001 || averagePrice > 0.02) {
    throw new Error(`Invalid PSL price: ${averagePrice}`);
  }

  browserLogger.info(
    `The current Average PSL price is: $${averagePrice.toFixed(8)} based on ${
      prices.length
    } sources`
  );
  return averagePrice;
}

export async function estimatedMarketPriceOfInferenceCreditsInPSLTerms(): Promise<number> {
  try {
    const pslPriceUSD = await fetchCurrentPSLMarketPrice();
    const costPerCreditUSD =
      TARGET_VALUE_PER_CREDIT_IN_USD / (1 - TARGET_PROFIT_MARGIN);
    const costPerCreditPSL = costPerCreditUSD / pslPriceUSD;
    browserLogger.info(
      `Estimated market price of 1.0 inference credit: ${costPerCreditPSL.toFixed(
        4
      )} PSL`
    );
    return costPerCreditPSL;
  } catch (error) {
    browserLogger.error(
      `Error calculating estimated market price of inference credits: ${safeStringify(
        (error as Error).message
      )}`
    );
    throw error;
  }
}

// Utility functions
export function parseAndFormat(value: unknown): string {
  try {
    if (typeof value === "string") {
      if (value.includes("\n")) {
        return value;
      }
      const parsedValue = JSON.parse(value);
      return JSON.stringify(parsedValue, null, 4);
    }
    return JSON.stringify(value, null, 4);
  } catch {
    return String(value);
  }
}

export function prettyJSON(data: unknown): string {
  if (data instanceof Map) {
    data = Object.fromEntries(data);
  }
  if (Array.isArray(data) || (typeof data === "object" && data !== null)) {
    const formattedData: { [key: string]: unknown } = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string" && key.endsWith("_json")) {
        formattedData[key] = parseAndFormat(value);
      } else if (typeof value === "object" && value !== null) {
        formattedData[key] = prettyJSON(value);
      } else {
        formattedData[key] = value;
      }
    }
    return JSON.stringify(formattedData, null, 4);
  } else if (typeof data === "string") {
    return parseAndFormat(data);
  }
  return String(data);
}

export function abbreviateJSON(jsonString: string, maxLength: number): string {
  if (jsonString.length <= maxLength) return jsonString;
  const abbreviated = jsonString.slice(0, maxLength) + "...";
  const openBraces =
    (jsonString.match(/{/g) || []).length -
    (abbreviated.match(/{/g) || []).length;
  const openBrackets =
    (jsonString.match(/\[/g) || []).length -
    (abbreviated.match(/\[/g) || []).length;
  return abbreviated + "}".repeat(openBraces) + "]".repeat(openBrackets);
}

export function logActionWithPayload(
  action: string,
  payloadName: string,
  jsonPayload: unknown
): void {
  const maxPayloadLength = 10000;
  let formattedPayload = prettyJSON(jsonPayload);
  if (formattedPayload.length > maxPayloadLength) {
    formattedPayload = abbreviateJSON(formattedPayload, maxPayloadLength);
  }
  browserLogger.info(
    `Now ${action} ${payloadName} with payload:\n${formattedPayload}`
  );
}

export function transformCreditPackPurchaseRequestResponse(
  result: CreditPackPurchaseRequestResponse
): CreditPackPurchaseRequestResponse {
  const transformedResult = { ...result };
  const fieldsToConvert = [
    "list_of_potentially_agreeing_supernodes",
    "list_of_blacklisted_supernode_pastelids",
    "list_of_supernode_pastelids_agreeing_to_credit_pack_purchase_terms",
    "list_of_supernode_pastelids_agreeing_to_credit_pack_purchase_terms_selected_for_signature_inclusion",
    "selected_agreeing_supernodes_signatures_dict",
  ] as const;
  fieldsToConvert.forEach((field) => {
    if (transformedResult[field]) {
      transformedResult[field] = safeStringify(transformedResult[field]);
    }
  });
  return transformedResult;
}

// No encoding specified - matches Node.js behavior
export async function computeSHA3256Hexdigest(input: string): Promise<string> {
  await initializeSha3();
  const data = new TextEncoder().encode(input);
  using memory = new Memory(data);
  using digest = keccak256(memory);
  return Array.from(digest.bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}


// Explicitly UTF-8 encoded - matches Node.js behavior
export async function getSHA256HashOfInputData(inputData: string): Promise<string> {
  await initializeSha3();
  const data = new TextEncoder().encode(inputData);
  using memory = new Memory(data);
  using digest = keccak256(memory);
  return Array.from(digest.bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// No encoding specified - matches Node.js behavior
export async function computeJSSHA3256Hexdigest(input: string): Promise<string> {
  const hash = sha3_256.create();
  hash.update(input);
  return hash.hex();
}

// Explicitly UTF-8 encoded - matches Node.js behavior
export async function getJSSHA256HashOfInputData(inputData: string): Promise<string> {
  const hash = sha3_256.create();
  hash.update(inputData);
  return hash.hex();
}

export async function compressDataWithZstd(
  inputData: string
): Promise<{ compressedData: Uint8Array; base64EncodedData: string }> {
  const compressedData = pako.deflate(inputData);
  const base64EncodedData = btoa(
    String.fromCharCode.apply(null, Array.from(compressedData))
  );
  return { compressedData, base64EncodedData };
}

export async function decompressDataWithZstd(
  compressedInputData: string
): Promise<string> {
  const binaryString = atob(compressedInputData);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return pako.inflate(bytes, { to: "string" });
}

export async function calculateXORDistance(
  pastelID1: string,
  pastelID2: string
): Promise<bigint> {
  const hash1 = await computeSHA3256Hexdigest(pastelID1);
  const hash2 = await computeSHA3256Hexdigest(pastelID2);
  const xorResult = BigInt(`0x${hash1}`) ^ BigInt(`0x${hash2}`);
  return xorResult;
}

export function adjustJSONSpacing(jsonString: string): string {
  return jsonString.replace(/(?<!\d):(\s*)/g, ": ").replace(/,(\s*)/g, ", ");
}

export function escapeJsonString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function pythonCompatibleStringify(obj: unknown): string {
  function sortObjectByKeys(
    unsortedObj: Record<string, unknown>
  ): Record<string, unknown> {
    const priorityKeys = ["challenge", "challenge_id", "challenge_signature"];
    return Object.keys(unsortedObj)
      .sort((a, b) => {
        const aPriority = priorityKeys.indexOf(a);
        const bPriority = priorityKeys.indexOf(b);

        if (aPriority !== -1 && bPriority !== -1) {
          return aPriority - bPriority;
        }
        if (aPriority !== -1) {
          return 1;
        }
        if (bPriority !== -1) {
          return -1;
        }
        return a.localeCompare(b);
      })
      .reduce((acc: Record<string, unknown>, key) => {
        const value = unsortedObj[key];
        if (
          typeof value === "object" &&
          value !== null &&
          !(value instanceof Date)
        ) {
          acc[key] = Array.isArray(value)
            ? value.map((item) =>
                sortObjectByKeys(item as Record<string, unknown>)
              )
            : sortObjectByKeys(value as Record<string, unknown>);
        } else {
          acc[key] = value;
        }
        return acc;
      }, {});
  }

  function customReplacer(_key: string, value: unknown): unknown {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "object" && value !== null) {
      return sortObjectByKeys(value as Record<string, unknown>);
    }
    if (
      typeof value === "string" &&
      value.startsWith("{") &&
      value.endsWith("}")
    ) {
      return escapeJsonString(value);
    }
    if (typeof value === "number") {
      return value;
    }
    return value;
  }
  const sortedObject = sortObjectByKeys(obj as Record<string, unknown>);
  let jsonString = JSON.stringify(sortedObject, customReplacer);
  jsonString = jsonString.replace(/"(true|false)"/g, "$1");
  jsonString = adjustJSONSpacing(jsonString);
  return jsonString;
}

export function base64EncodeJson(jsonInput: string): string {
  return btoa(pythonCompatibleStringify(JSON.parse(jsonInput)));
}

export async function extractResponseFieldsFromCreditPackTicketMessageDataAsJSON(
  modelInstance: Record<string, unknown>
): Promise<string> {
  const responseFields: { [key: string]: unknown } = {};
  const plainObject = modelInstance;

  let lastHashFieldName: string | null = null;
  const lastSignatureFieldNames: string[] = [];
  for (const fieldName in plainObject) {
    if (fieldName.startsWith("sha3_256_hash_of")) {
      lastHashFieldName = fieldName;
    } else if (fieldName.includes("_signature_on_")) {
      lastSignatureFieldNames.push(fieldName);
    }
  }
  Object.keys(plainObject)
    .sort()
    .forEach((fieldName) => {
      if (
        ![
          lastHashFieldName,
          lastSignatureFieldNames[lastSignatureFieldNames.length - 1],
          "id",
          "_changed",
          "_options",
          "_previousDataValues",
          "dataValues",
          "isNewRecord",
          "uniqno",
        ].includes(fieldName)
      ) {
        const fieldValue = plainObject[fieldName];
        if (fieldValue instanceof Date) {
          responseFields[fieldName] = fieldValue.toISOString();
        } else if (typeof fieldValue === "boolean") {
          responseFields[fieldName] = fieldValue ? 1 : 0;
        } else if (typeof fieldValue === "object" && fieldValue !== null) {
          responseFields[fieldName] = pythonCompatibleStringify(fieldValue);
        } else {
          responseFields[fieldName] =
            typeof fieldValue === "number" ? fieldValue : String(fieldValue);
        }
      }
    });
  return pythonCompatibleStringify(responseFields);
}

export async function computeSHA3256HashOfSQLModelResponseFields(
  modelInstance: Record<string, unknown>
): Promise<string> {
  const responseFieldsJSON =
    await extractResponseFieldsFromCreditPackTicketMessageDataAsJSON(
      modelInstance
    );
  const sha256HashOfResponseFields =
    await getJSSHA256HashOfInputData(responseFieldsJSON);
  return sha256HashOfResponseFields;
}

export async function computeSHA3256HashOfSQLModelResponseFields2(
  modelInstance: Record<string, unknown>
): Promise<string> {
  const responseFieldsJSON =
    await extractResponseFieldsFromCreditPackTicketMessageDataAsJSON(
      modelInstance
    );
  const sha256HashOfResponseFields =
    await getSHA256HashOfInputData(responseFieldsJSON);
  return sha256HashOfResponseFields;
}

export async function prepareModelForEndpoint<T extends Record<string, unknown>>(
  modelInstance: T
): Promise<Record<string, unknown>> {
  const preparedModelInstance: Record<string, unknown> = {};
  for (const key in modelInstance) {
    if (Object.prototype.hasOwnProperty.call(modelInstance, key)) {
      if (key.endsWith("_json")) {
        if (typeof modelInstance[key] === "string") {
          try {
            const parsedJson = JSON.parse(modelInstance[key] as string);
            preparedModelInstance[key] = pythonCompatibleStringify(parsedJson);
          } catch (e) {
            browserLogger.error(
              `Failed to parse JSON for key: ${key}. Error: ${e}`
            );
            preparedModelInstance[key] = modelInstance[key];
          }
        } else {
          preparedModelInstance[key] = pythonCompatibleStringify(
            modelInstance[key]
          );
        }
      } else {
        preparedModelInstance[key] = modelInstance[key];
      }
    }
  }
  return preparedModelInstance;
}

export function removeSequelizeFields(
  plainObject: Record<string, unknown>
): void {
  const fieldsToRemove = [
    "id",
    "_changed",
    "_options",
    "_previousDataValues",
    "dataValues",
    "isNewRecord",
    "uniqno",
  ];
  Object.keys(plainObject).forEach((fieldName) => {
    if (fieldsToRemove.includes(fieldName)) {
      delete plainObject[fieldName];
    }
  });
}

export async function prepareModelForValidation<T>(modelInstance: Record<string, unknown>): Promise<T> {
  const preparedModelInstance: Record<string, unknown> = {};
  for (const key in modelInstance) {
    if (Object.prototype.hasOwnProperty.call(modelInstance, key)) {
      if (key.endsWith("_json") && typeof modelInstance[key] === "string") {
        try {
          preparedModelInstance[key] = JSON.parse(modelInstance[key] as string);
        } catch (error) {
          console.error(`Error parsing ${key}: ${error}`);
          preparedModelInstance[key] = modelInstance[key];
        }
      } else {
        preparedModelInstance[key] = modelInstance[key];
      }
    }
  }
  return preparedModelInstance as T;
}

export function compareDatetimes(
  datetime1: Date,
  datetime2: Date
): { diffInSeconds: number; areCloseEnough: boolean } {
  const diffInSeconds =
    Math.abs(datetime1.getTime() - datetime2.getTime()) / 1000;
  const areCloseEnough =
    diffInSeconds <=
    MAXIMUM_LOCAL_CREDIT_PRICE_DIFFERENCE_TO_ACCEPT_CREDIT_PRICING;
  return { diffInSeconds, areCloseEnough };
}

export function validateTimestampFields(
  modelInstance: Record<string, unknown>,
  validationErrors: ValidationError[]
): void {
  for (const [fieldName, fieldValue] of Object.entries(modelInstance)) {
    if (fieldName.endsWith("_timestamp_utc_iso_string")) {
      try {
        const timestamp = new Date(fieldValue as string);
        const currentTimestamp = new Date();
        const { areCloseEnough } = compareDatetimes(
          timestamp,
          currentTimestamp
        );
        if (!areCloseEnough) {
          validationErrors.push({
            message: `Timestamp in field ${fieldName} is too far from the current time`,
          });
        }
      } catch {
        validationErrors.push({
          message: `Invalid timestamp format for field ${fieldName}`,
        });
      }
    }
  }
}

export async function validatePastelBlockHeightFields(
  modelInstance: Record<string, unknown>,
  validationErrors: ValidationError[]
): Promise<void> {
  const [, , bestBlockHeight] = await rpc.getBestBlockHashAndMerkleRoot();
  for (const [fieldName, fieldValue] of Object.entries(modelInstance)) {
    if (fieldName.endsWith("_pastel_block_height")) {
      if (
        Math.abs((fieldValue as number) - bestBlockHeight) >
        MAXIMUM_LOCAL_PASTEL_BLOCK_HEIGHT_DIFFERENCE_IN_BLOCKS
      ) {
        validationErrors.push({
          message: `Pastel block height in field ${fieldName} does not match the current block height; difference is ${Math.abs(
            (fieldValue as number) - bestBlockHeight
          )} blocks (local: ${fieldValue}, remote: ${bestBlockHeight})`,
        });
      }
    }
  }
}

export async function validateHashFields(
  modelInstance: Record<string, unknown>,
  validationErrors: ValidationError[]
): Promise<void> {
  const expectedHash = await computeSHA3256HashOfSQLModelResponseFields(
    modelInstance
  );
  let hashFieldName: string | null = null;
  for (const fieldName in modelInstance) {
    if (
      fieldName.includes("sha3_256_hash_of_") &&
      fieldName.endsWith("_fields")
    ) {
      hashFieldName = fieldName;
      break;
    }
  }
  if (hashFieldName) {
    const actualHash = modelInstance[hashFieldName] as string;
    if (actualHash !== expectedHash) {
      validationErrors.push({
        message: `SHA3-256 hash in field ${hashFieldName} does not match the computed hash of the response fields`,
      });
    }
  }
}

export async function getClosestSupernodePastelIDFromList(
  localPastelID: string,
  filteredSupernodes: SupernodeInfo[],
  maxResponseTimeInMilliseconds: number = 800
): Promise<string | null> {
  await clearOldCache();
  if (!filteredSupernodes || filteredSupernodes.length === 0) {
    browserLogger.warn("No filtered supernodes available");
    return null;
  }

  const xorDistances = await Promise.all(
    filteredSupernodes.map(async (supernode) => {
      let pastelID: string;
      if (typeof supernode === "string") {
        pastelID = supernode;
      } else if (supernode && supernode.extKey) {
        pastelID = supernode.extKey;
      } else {
        browserLogger.warn(
          `Invalid supernode data: ${JSON.stringify(supernode)}`
        );
        return null;
      }

      try {
        const startTime = Date.now();
        const distanceResult = await Promise.race([
          calculateXORDistance(localPastelID, pastelID),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("XOR calculation timed out")), maxResponseTimeInMilliseconds)
          )
        ]);
        const endTime = Date.now();
        
        if (endTime - startTime > maxResponseTimeInMilliseconds) {
          browserLogger.warn(`XOR calculation for ${pastelID} exceeded time limit`);
          return null;
        }

        if (distanceResult === null) {
          browserLogger.warn(`XOR calculation for ${pastelID} returned null`);
          return null;
        }

        return { pastelID, distance: BigInt(distanceResult) };
      } catch (error) {
        browserLogger.error(
          `Error calculating XOR distance: ${(error as Error).message}`
        );
        return null;
      }
    })
  );

  const validDistances = xorDistances.filter(
    (distance): distance is { pastelID: string; distance: bigint } =>
      distance !== null
  );

  if (validDistances.length === 0) {
    browserLogger.warn("No valid XOR distances calculated");
    return null;
  }

  const sortedXorDistances = validDistances.sort((a, b) => {
    if (a.distance < b.distance) return -1;
    if (a.distance > b.distance) return 1;
    return 0;
  });

  return sortedXorDistances[0].pastelID;
}

export function checkIfPastelIDIsValid(inputString: string): boolean {
  const pattern = /^jX[A-Za-z0-9]{84}$/;
  return pattern.test(inputString);
}

export async function getSupernodeUrlFromPastelID(
  pastelID: string,
  supernodeListDF: SupernodeInfo[]
): Promise<string> {
  const isValidPastelID = checkIfPastelIDIsValid(pastelID);
  if (!isValidPastelID) {
    throw new Error(`Invalid PastelID: ${pastelID}`);
  }
  const supernodeEntry = supernodeListDF.find(
    (node) => node.extKey === pastelID
  );
  if (!supernodeEntry) {
    throw new Error(
      `Supernode with PastelID ${pastelID} not found in the supernode list`
    );
  }
  const ipaddress = supernodeEntry.ipaddress_port.split(":")[0];
  const supernodeURL = `http://${ipaddress}:7123`;
  return supernodeURL;
}

export async function validatePastelIDSignatureFields(
  modelInstance: Record<string, unknown>,
  validationErrors: ValidationError[]
): Promise<void> {
  let lastSignatureFieldName: string | null = null;
  let lastHashFieldName: string | null = null;
  let firstPastelID: string | undefined;
  let pastelID: string;
  let messageToVerify: string;
  let signature: string | undefined;

  const fields = modelInstance;
  for (const fieldName in fields) {
    if (
      fieldName.toLowerCase().includes("_pastelid") &&
      fields[fieldName] !== "NA"
    ) {
      firstPastelID = fields[fieldName] as string;
      break;
    }
  }
  for (const fieldName in fields) {
    if (fieldName.includes("_signature_on_")) {
      lastSignatureFieldName = fieldName;
    } else if (
      fieldName.includes("sha3_256_hash_of_") &&
      fieldName.endsWith("_fields")
    ) {
      lastHashFieldName = fieldName;
    }
  }
  const embeddedField = fields[
    "supernode_pastelid_and_signature_on_inference_request_response_hash"
  ] as string | undefined;
  if (embeddedField) {
    try {
      const parsedData = JSON.parse(embeddedField);
      firstPastelID = parsedData["signing_sn_pastelid"];
      signature = parsedData["sn_signature_on_response_hash"];
    } catch (e) {
      validationErrors.push({
        message:
          "Error parsing JSON from signature field: " + (e as Error).message,
      });
      return;
    }
  }
  if (
    firstPastelID &&
    lastHashFieldName &&
    lastSignatureFieldName
  ) {
    pastelID = firstPastelID;
    messageToVerify = fields[lastHashFieldName] as string;
    if (!embeddedField) {
      signature = fields[lastSignatureFieldName] as string;
    }
    if (signature) {
      const verificationResult = await rpc.verifyMessageWithPastelID(
        pastelID,
        messageToVerify,
        signature
      );
      if (verificationResult !== true) {
        validationErrors.push({
          message: `PastelID signature in field ${lastSignatureFieldName} failed verification`,
        });
      }
    } else {
      validationErrors.push({
        message: `Signature is missing`,
      });
    }
  } else {
    validationErrors.push({
      message: `Necessary fields for validation are missing`,
    });
  }
}

export async function getClosestSupernodeToPastelIDURL(
  inputPastelID: string,
  supernodeListDF: SupernodeInfo[],
  maxResponseTimeInMilliseconds: number = 1200
): Promise<{ url: string | null; pastelID: string | null }> {
  browserLogger.info(
    `Attempting to find closest supernode for PastelID: ${inputPastelID}`
  );
  if (!inputPastelID) {
    browserLogger.warn("No input PastelID provided");
    return { url: null, pastelID: null };
  }
  await clearOldCache();
  const filteredSupernodes = await filterSupernodes(
    supernodeListDF,
    maxResponseTimeInMilliseconds
  );
  if (filteredSupernodes.length > 0) {
    const closestSupernodePastelID = await getClosestSupernodePastelIDFromList(
      inputPastelID,
      filteredSupernodes,
      maxResponseTimeInMilliseconds
    );
    if (!closestSupernodePastelID) {
      browserLogger.warn("No closest supernode PastelID found");
      return { url: null, pastelID: null };
    }

    const closestSupernode = supernodeListDF.find(
      (supernode) => supernode.extKey === closestSupernodePastelID
    );

    if (closestSupernode) {
      const supernodeURL = `http://${
        closestSupernode.ipaddress_port.split(":")[0]
      }:7123`;
      try {
        await fetch(supernodeURL, {
          signal: AbortSignal.timeout(maxResponseTimeInMilliseconds),
        });
        return { url: supernodeURL, pastelID: closestSupernodePastelID };
      } catch {
        return { url: null, pastelID: null };
      }
    }
  }
  browserLogger.warn("No filtered supernodes available");
  return { url: null, pastelID: null };
}

export async function getNClosestSupernodesToPastelIDURLs(
  n: number,
  inputPastelID: string,
  supernodeListDF: SupernodeInfo[],
  maxResponseTimeInMilliseconds: number = 800
): Promise<{ url: string; pastelID: string }[]> {
  if (!inputPastelID) {
    browserLogger.warn("No input PastelID provided");
    return [];
  }

  await clearOldCache();

  try {
    const filteredSupernodes = await filterSupernodes(
      supernodeListDF,
      maxResponseTimeInMilliseconds
    );

    if (filteredSupernodes.length === 0) {
      browserLogger.warn("No filtered supernodes available");
      return [];
    }

    const xorDistances = await Promise.all(
      filteredSupernodes.map(async (supernode) => {
        try {
          const distance = await calculateXORDistance(
            inputPastelID,
            supernode.extKey
          );
          return { ...supernode, distance };
        } catch (error) {
          browserLogger.error(
            `Error calculating XOR distance for supernode ${
              supernode.extKey
            }: ${(error as Error).message}`
          );
          return null;
        }
      })
    );

    const validXorDistances = xorDistances.filter(
      (distance): distance is SupernodeWithDistance => distance !== null
    );

    if (validXorDistances.length === 0) {
      browserLogger.warn("No valid XOR distances calculated");
      return [];
    }

    const sortedXorDistances = validXorDistances.sort((a, b) => {
      if (a.distance < b.distance) return -1;
      if (a.distance > b.distance) return 1;
      return 0;
    });

    const closestSupernodes = sortedXorDistances.slice(0, n);

    const validSupernodePromises = closestSupernodes.map(
      async ({ ipaddress_port, extKey }) => {
        const url = `http://${ipaddress_port.split(":")[0]}:7123`;
        try {
          await fetch(url, {
            signal: AbortSignal.timeout(maxResponseTimeInMilliseconds),
          });
          return { url, pastelID: extKey };
        } catch {
          return null;
        }
      }
    );

    const validSupernodes = (await Promise.all(validSupernodePromises)).filter(
      (supernode): supernode is { url: string; pastelID: string } =>
        supernode !== null
    );

    if (validSupernodes.length === 0) {
      browserLogger.warn("No valid supernodes found after connectivity check");
    } else {
      browserLogger.info(`Found ${validSupernodes.length} valid supernodes`);
    }

    return validSupernodes;
  } catch (error) {
    browserLogger.error(
      `Error in getNClosestSupernodesToPastelIDURLs: ${
        (error as Error).message
      }`
    );
    return [];
  }
}

export async function validateCreditPackTicketMessageData(
  modelInstance: Record<string, unknown>
): Promise<ValidationError[]> {
  const validationErrors: ValidationError[] = [];
  validateTimestampFields(modelInstance, validationErrors);
  await validatePastelBlockHeightFields(modelInstance, validationErrors);
  await validateHashFields(modelInstance, validationErrors);
  await validatePastelIDSignatureFields(modelInstance, validationErrors);
  return validationErrors;
}

export function validateInferenceResponseFields(
  responseAuditResults: AuditResult[],
  usageRequestResponse: InferenceAPIUsageResponse
): ValidationResult {
  const inferenceResponseIDCounts: { [key: string]: number } = {};
  const inferenceRequestIDCounts: { [key: string]: number } = {};
  const proposedCostInCreditsCounts: { [key: number]: number } = {};
  const remainingCreditsAfterRequestCounts: { [key: number]: number } = {};
  const creditUsageTrackingPSLAddressCounts: { [key: string]: number } = {};
  const requestConfirmationMessageAmountInPatoshisCounts: { [key: number]: number } = {};
  const maxBlockHeightToIncludeConfirmationTransactionCounts: { [key: number]: number } = {};
  const supernodePastelIDAndSignatureOnInferenceResponseIDCounts: { [key: string]: number } = {};

  for (const result of responseAuditResults) {
    inferenceResponseIDCounts[result.inference_response_id] = (inferenceResponseIDCounts[result.inference_response_id] || 0) + 1;
    inferenceRequestIDCounts[result.inference_request_id] = (inferenceRequestIDCounts[result.inference_request_id] || 0) + 1;
    proposedCostInCreditsCounts[result.proposed_cost_of_request_in_inference_credits] = (proposedCostInCreditsCounts[result.proposed_cost_of_request_in_inference_credits] || 0) + 1;
    remainingCreditsAfterRequestCounts[result.remaining_credits_in_pack_after_request_processed] = (remainingCreditsAfterRequestCounts[result.remaining_credits_in_pack_after_request_processed] || 0) + 1;
    creditUsageTrackingPSLAddressCounts[result.credit_usage_tracking_psl_address] = (creditUsageTrackingPSLAddressCounts[result.credit_usage_tracking_psl_address] || 0) + 1;
    requestConfirmationMessageAmountInPatoshisCounts[result.request_confirmation_message_amount_in_patoshis] = (requestConfirmationMessageAmountInPatoshisCounts[result.request_confirmation_message_amount_in_patoshis] || 0) + 1;
    maxBlockHeightToIncludeConfirmationTransactionCounts[result.max_block_height_to_include_confirmation_transaction] = (maxBlockHeightToIncludeConfirmationTransactionCounts[result.max_block_height_to_include_confirmation_transaction] || 0) + 1;
    supernodePastelIDAndSignatureOnInferenceResponseIDCounts[result.supernode_pastelid_and_signature_on_inference_request_response_hash] = (supernodePastelIDAndSignatureOnInferenceResponseIDCounts[result.supernode_pastelid_and_signature_on_inference_request_response_hash] || 0) + 1;
  }

  const getMajorityValue = <T>(counts: { [key: string]: number }): T => {
    return Object.keys(counts).reduce((a, b) =>
      counts[a] > counts[b] ? a : b
    ) as unknown as T;
  };

  const majorityInferenceResponseID = getMajorityValue<string>(inferenceResponseIDCounts);
  const majorityInferenceRequestID = getMajorityValue<string>(inferenceRequestIDCounts);
  const majorityProposedCostInCredits = getMajorityValue<number>(proposedCostInCreditsCounts);
  const majorityRemainingCreditsAfterRequest = getMajorityValue<number>(remainingCreditsAfterRequestCounts);
  const majorityCreditUsageTrackingPSLAddress = getMajorityValue<string>(creditUsageTrackingPSLAddressCounts);
  const majorityRequestConfirmationMessageAmountInPatoshis = getMajorityValue<number>(requestConfirmationMessageAmountInPatoshisCounts);
  const majorityMaxBlockHeightToIncludeConfirmationTransaction = getMajorityValue<number>(maxBlockHeightToIncludeConfirmationTransactionCounts);
  const majoritySupernodePastelIDAndSignatureOnInferenceResponseID = getMajorityValue<string>(supernodePastelIDAndSignatureOnInferenceResponseIDCounts);

  const validationResults: ValidationResult = {
    inference_result_id: '', // This field is not present in the response validation
    inference_response_id: majorityInferenceResponseID === usageRequestResponse.inference_response_id ? majorityInferenceResponseID : '',
    inference_request_id: majorityInferenceRequestID === usageRequestResponse.inference_request_id ? majorityInferenceRequestID : '',
    proposed_cost_in_credits: majorityProposedCostInCredits === usageRequestResponse.proposed_cost_of_request_in_inference_credits ? majorityProposedCostInCredits : 0,
    remaining_credits_after_request: majorityRemainingCreditsAfterRequest === usageRequestResponse.remaining_credits_in_pack_after_request_processed ? majorityRemainingCreditsAfterRequest : 0,
    credit_usage_tracking_psl_address: majorityCreditUsageTrackingPSLAddress === usageRequestResponse.credit_usage_tracking_psl_address ? majorityCreditUsageTrackingPSLAddress : '',
    request_confirmation_message_amount_in_patoshis: majorityRequestConfirmationMessageAmountInPatoshis === usageRequestResponse.request_confirmation_message_amount_in_patoshis ? majorityRequestConfirmationMessageAmountInPatoshis : 0,
    max_block_height_to_include_confirmation_transaction: majorityMaxBlockHeightToIncludeConfirmationTransaction === usageRequestResponse.max_block_height_to_include_confirmation_transaction ? majorityMaxBlockHeightToIncludeConfirmationTransaction : 0,
    supernode_pastelid_and_signature_on_inference_response_id: majoritySupernodePastelIDAndSignatureOnInferenceResponseID === usageRequestResponse.supernode_pastelid_and_signature_on_inference_request_response_hash ? majoritySupernodePastelIDAndSignatureOnInferenceResponseID : '',
    responding_supernode_pastelid: '', // This field is not present in the response validation
    inference_result_json_base64: '', // This field is not present in the response validation
    inference_result_file_type_strings: '', // This field is not present in the response validation
    responding_supernode_signature_on_inference_result_id: '', // This field is not present in the response validation
  };

  return validationResults;
}

export function validateInferenceResultFields(
  resultAuditResults: AuditResult[],
  usageResult: InferenceAPIOutputResult
): ValidationResult {
  const inferenceResultIDCounts: { [key: string]: number } = {};
  const inferenceRequestIDCounts: { [key: string]: number } = {};
  const inferenceResponseIDCounts: { [key: string]: number } = {};
  const respondingSupernodePastelIDCounts: { [key: string]: number } = {};
  const inferenceResultJSONBase64Counts: { [key: string]: number } = {};
  const inferenceResultFileTypeStringsCounts: { [key: string]: number } = {};
  const respondingSupernodeSignatureOnInferenceResultIDCounts: { [key: string]: number } = {};

  for (const result of resultAuditResults) {
    inferenceResultIDCounts[result.inference_result_id] = (inferenceResultIDCounts[result.inference_result_id] || 0) + 1;
    inferenceRequestIDCounts[result.inference_request_id] = (inferenceRequestIDCounts[result.inference_request_id] || 0) + 1;
    inferenceResponseIDCounts[result.inference_response_id] = (inferenceResponseIDCounts[result.inference_response_id] || 0) + 1;
    respondingSupernodePastelIDCounts[result.responding_supernode_pastelid] = (respondingSupernodePastelIDCounts[result.responding_supernode_pastelid] || 0) + 1;
    inferenceResultJSONBase64Counts[result.inference_result_json_base64.slice(0, 32)] = (inferenceResultJSONBase64Counts[result.inference_result_json_base64.slice(0, 32)] || 0) + 1;
    inferenceResultFileTypeStringsCounts[result.inference_result_file_type_strings] = (inferenceResultFileTypeStringsCounts[result.inference_result_file_type_strings] || 0) + 1;
    respondingSupernodeSignatureOnInferenceResultIDCounts[result.responding_supernode_signature_on_inference_result_id] = (respondingSupernodeSignatureOnInferenceResultIDCounts[result.responding_supernode_signature_on_inference_result_id] || 0) + 1;
  }

  const getMajorityValue = <T>(counts: { [key: string]: number }): T => {
    return Object.keys(counts).reduce((a, b) =>
      counts[a] > counts[b] ? a : b
    ) as unknown as T;
  };

  const majorityInferenceResultID = getMajorityValue<string>(inferenceResultIDCounts);
  const majorityInferenceRequestID = getMajorityValue<string>(inferenceRequestIDCounts);
  const majorityInferenceResponseID = getMajorityValue<string>(inferenceResponseIDCounts);
  const majorityRespondingSupernodePastelID = getMajorityValue<string>(respondingSupernodePastelIDCounts);
  const majorityInferenceResultJSONBase64 = getMajorityValue<string>(inferenceResultJSONBase64Counts);
  const majorityInferenceResultFileTypeStrings = getMajorityValue<string>(inferenceResultFileTypeStringsCounts);
  const majorityRespondingSupernodeSignatureOnInferenceResultID = getMajorityValue<string>(respondingSupernodeSignatureOnInferenceResultIDCounts);

  const validationResults: ValidationResult = {
    inference_result_id: majorityInferenceResultID === usageResult.inference_result_id ? majorityInferenceResultID : '',
    inference_request_id: majorityInferenceRequestID === usageResult.inference_request_id ? majorityInferenceRequestID : '',
    inference_response_id: majorityInferenceResponseID === usageResult.inference_response_id ? majorityInferenceResponseID : '',
    responding_supernode_pastelid: majorityRespondingSupernodePastelID === usageResult.responding_supernode_pastelid ? majorityRespondingSupernodePastelID : '',
    inference_result_json_base64: majorityInferenceResultJSONBase64 === usageResult.inference_result_json_base64.slice(0, 32) ? majorityInferenceResultJSONBase64 : '',
    inference_result_file_type_strings: majorityInferenceResultFileTypeStrings === usageResult.inference_result_file_type_strings ? majorityInferenceResultFileTypeStrings : '',
    responding_supernode_signature_on_inference_result_id: majorityRespondingSupernodeSignatureOnInferenceResultID === usageResult.responding_supernode_signature_on_inference_result_id ? majorityRespondingSupernodeSignatureOnInferenceResultID : '',
    proposed_cost_in_credits: 0, // This field is not present in the result validation
    remaining_credits_after_request: 0, // This field is not present in the result validation
    credit_usage_tracking_psl_address: '', // This field is not present in the result validation
    request_confirmation_message_amount_in_patoshis: 0, // This field is not present in the result validation
    max_block_height_to_include_confirmation_transaction: 0, // This field is not present in the result validation
    supernode_pastelid_and_signature_on_inference_response_id: '', // This field is not present in the result validation
  };

  return validationResults;
}

export function validateInferenceData(
  inferenceResultDict: InferenceResultDict,
  auditResults: AuditResult[]
): ValidationResult {
  const usageRequestResponse = inferenceResultDict.usage_request_response;
  const usageResult = inferenceResultDict.output_results;

  const responseValidationResults = validateInferenceResponseFields(
    auditResults,
    usageRequestResponse
  );

  const resultValidationResults = validateInferenceResultFields(
    auditResults,
    usageResult
  );

  return {
    ...responseValidationResults,
    ...resultValidationResults,
  };
}

export async function filterSupernodes(
  supernodeList: (SupernodeInfo | string)[],
  maxResponseTimeInMilliseconds: number = 700,
  minPerformanceRatio: number = 0.75,
  maxSupernodes: number = 130
): Promise<SupernodeInfo[]> {
  const cacheKey = "filteredSupernodes";

  const stats = {
    totalProcessed: 0,
    removedDueToPing: 0,
    removedDueToPerformance: 0,
    removedDueToError: 0,
    timeouts: 0,
  };

  const logResults = () => {
    const USE_VERBOSE_LOGGING = false;
    const totalRemoved =
      stats.removedDueToPing +
      stats.removedDueToPerformance +
      stats.removedDueToError;
    const removedPercentage = (
      (totalRemoved / stats.totalProcessed) *
      100
    ).toFixed(2);
    if (USE_VERBOSE_LOGGING) {
      browserLogger.info(`Total supernodes processed: ${stats.totalProcessed}`);
      browserLogger.info(
        `Total supernodes removed: ${totalRemoved} (${removedPercentage}%)`
      );
      browserLogger.info(`- Removed due to ping: ${stats.removedDueToPing}`);
      browserLogger.info(
        `- Removed due to performance: ${stats.removedDueToPerformance}`
      );
      browserLogger.info(`- Removed due to errors: ${stats.removedDueToError}`);
      if (stats.timeouts > 0) {
        browserLogger.info(`Total timeouts: ${stats.timeouts}`);
      }
    }
  };

  const cachedData = await getFromCache<SupernodeInfo[]>(cacheKey);

  if (cachedData && cachedData.length >= maxSupernodes) {
    browserLogger.info("Returning cached supernodes.");
    return cachedData.slice(0, maxSupernodes);
  }

  let fullSupernodeList: SupernodeInfo[] = [];
  if (typeof supernodeList[0] === "string") {
    const validMasternodeListFullDF = await rpc.checkSupernodeList();
    fullSupernodeList = validMasternodeListFullDF.validMasternodeListFullDF.filter((supernode: SupernodeInfo) =>
      (supernodeList as string[]).includes(supernode.extKey)
    );
  } else {
    fullSupernodeList = supernodeList as SupernodeInfo[];
  }

  const filteredSupernodes: SupernodeInfo[] = [];
  const completed = false;

  const checkSupernode = async (
    supernode: SupernodeInfo
  ): Promise<SupernodeInfo | null> => {
    stats.totalProcessed++;
    if (completed) return null;
    const cacheKey = `supernode_${supernode.extKey}`;
    const cachedResult = await getFromCache<SupernodeInfo>(cacheKey);

    if (cachedResult) return cachedResult;

    try {
      const ipAddressPort = supernode.ipaddress_port;
      if (!ipAddressPort) return null;
      const ipAddress = ipAddressPort.split(":")[0];

      // Replace ping with a simple fetch request for browser compatibility
      const pingStart = performance.now();
      try {
        await Promise.race([
          fetch(`http://${ipAddress}:7123/ping`),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), maxResponseTimeInMilliseconds))
        ]);
      } catch {
        stats.removedDueToPing++;
        return null;
      }
      const pingTime = performance.now() - pingStart;

      if (pingTime > maxResponseTimeInMilliseconds) {
        stats.removedDueToPing++;
        return null;
      }

      const performanceResponse = await Promise.race([
        fetch(`http://${ipAddress}:7123/liveness_ping`),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), maxResponseTimeInMilliseconds))
      ]) as Response;

      if (!performanceResponse.ok) {
        throw new Error(`HTTP error! status: ${performanceResponse.status}`);
      }

      const performanceData: { performance_ratio_score: number } = await performanceResponse.json();
      
      if (performanceData.performance_ratio_score < minPerformanceRatio) {
        stats.removedDueToPerformance++;
        return null;
      }
      const result: SupernodeInfo = {
        ...supernode,
        url: `http://${ipAddress}:7123`,
      };
      await storeInCache(cacheKey, result);
      return result;
    } catch {
      stats.removedDueToError++;
      return null;
    }
  };

  const promises = fullSupernodeList.map(checkSupernode);
  const results = await Promise.all(promises);
  filteredSupernodes.push(
    ...results.filter((result): result is SupernodeInfo => result !== null)
  );

  await storeInCache(cacheKey, filteredSupernodes);
  logResults();
  return filteredSupernodes.slice(0, maxSupernodes);
}

type CheckFunction = (arg: string) => Promise<boolean>;
interface ConfirmationOptions {
  maxRetries: number;
  retryDelay: number;
  actionName: string;
}

export async function waitForConfirmation(
  checkFunction: CheckFunction,
  arg: string,
  options?: Partial<ConfirmationOptions>
): Promise<boolean> {
  const defaultOptions: ConfirmationOptions = {
    maxRetries: 30,
    retryDelay: 10000,
    actionName: "condition",
  };
  const finalOptions = { ...defaultOptions, ...options };

  for (let attempt = 1; attempt <= finalOptions.maxRetries; attempt++) {
    try {
      const result = await checkFunction(arg);
      if (result) {
        browserLogger.info(
          `${finalOptions.actionName} confirmed after ${attempt} attempt(s).`
        );
        return true;
      }
    } catch (error) {
      browserLogger.warn(
        `Error checking ${finalOptions.actionName} (attempt ${attempt}/${
          finalOptions.maxRetries
        }): ${(error as Error).message}`
      );
    }

    if (attempt < finalOptions.maxRetries) {
      browserLogger.info(
        `${finalOptions.actionName} not yet confirmed. Attempt ${attempt}/${
          finalOptions.maxRetries
        }. Waiting ${finalOptions.retryDelay / 1000} seconds before next check...`
      );
      await new Promise((resolve) => setTimeout(resolve, finalOptions.retryDelay));
    }
  }

  browserLogger.warn(
    `${finalOptions.actionName} not confirmed after ${finalOptions.maxRetries} attempts.`
  );
  return false;
}

export async function waitForPastelIDRegistration(
  pastelID: string
): Promise<boolean> {
  const isRegistered = await waitForConfirmation(
    rpc.isPastelIDRegistered,
    pastelID,
    {
      maxRetries: 20,
      retryDelay: 15000,
      actionName: "PastelID registration",
    }
  );

  if (isRegistered) {
    browserLogger.info(
      `PastelID ${pastelID} has been successfully registered.`
    );
  } else {
    browserLogger.error(
      `PastelID ${pastelID} registration could not be confirmed.`
    );
  }

  return isRegistered;
}

export async function waitForCreditPackConfirmation(
  txid: string
): Promise<boolean> {
  const isConfirmed = await waitForConfirmation(
    rpc.isCreditPackConfirmed,
    txid,
    {
      maxRetries: 40,
      retryDelay: 20000,
      actionName: "Credit pack confirmation",
    }
  );

  if (isConfirmed) {
    browserLogger.info(`Credit pack with TXID ${txid} has been confirmed.`);
  } else {
    browserLogger.error(
      `Credit pack with TXID ${txid} could not be confirmed.`
    );
  }

  return isConfirmed;
}

export async function importPromotionalPack(jsonData: string): Promise<{
  success: boolean;
  message: string;
  processedPacks?: { pub_key: string; passphrase: string }[];
}> {
  browserLogger.info(`Starting import of promotional pack`);
  const processedPacks: { pub_key: string; passphrase: string }[] = [];

  try {
    // Initialize WASM
    browserLogger.info("Initializing WASM...");
    const rpc = BrowserRPCReplacement.getInstance();
    await rpc.initialize(true);
    browserLogger.info("WASM initialized successfully");

    // Parse the JSON data
    let packData: {
      pastel_id_pubkey: string;
      pastel_id_passphrase: string;
      secureContainerBase64: string;
      requested_initial_credits_in_credit_pack: number;
      psl_credit_usage_tracking_address: string;
      psl_credit_usage_tracking_address_private_key: string;
      wallet_address: string;
      wallet_file_content: string;
      wallet_password: string;
    }[] = JSON.parse(jsonData);
    if (!Array.isArray(packData)) {
      packData = [packData];
    }

    for (let i = 0; i < packData.length; i++) {
      const pack = packData[i];
      browserLogger.info(`Processing pack ${i + 1} of ${packData.length}`);

      // // 1. Import Wallet
      try {
        await rpc.importWallet(pack.wallet_file_content);
        await rpc.unlockWallet(pack.wallet_password)
        browserLogger.info(
          `Wallet imported successfully for tracking address: ${pack.wallet_address}`
        );
      } catch (error) {
        browserLogger.warn("Failed to import wallet");
      }

      // 2. Import PastelID
      const importResult = await rpc.importPastelIDFileIntoWallet(pack.secureContainerBase64, pack.pastel_id_pubkey, pack.pastel_id_passphrase);

      if (importResult.success) {
        browserLogger.info(`PastelID ${pack.pastel_id_pubkey} imported successfully`);
      } else {
        throw new Error(`Failed to import PastelID: ${importResult.message}`);
      }

      // 3. Import the tracking address private key
      browserLogger.info(
        `Importing private key for tracking address: ${pack.psl_credit_usage_tracking_address}`
      );

      const importPrivKeyResult = await rpc.importPrivKey(pack.psl_credit_usage_tracking_address_private_key);
      if (importPrivKeyResult) {
        browserLogger.info(
          `Private key imported successfully for tracking address: ${pack.psl_credit_usage_tracking_address}`
        );
      } else {
        browserLogger.warn("Failed to import private key");
      }

      // 4. Verify PastelID import and functionality
      try {
        const testMessage = "This is a test message for PastelID verification";
        const signature = await rpc.signMessageWithPastelID(
          pack.pastel_id_pubkey,
          testMessage,
          PastelIDType.PastelID
        );
        browserLogger.info(
          `Signature created successfully for PastelID: ${pack.pastel_id_pubkey}`
        );

        const verificationResult = await rpc.verifyMessageWithPastelID(
          pack.pastel_id_pubkey,
          testMessage,
          signature
        );

        if (verificationResult === true) {
          browserLogger.info(
            `PastelID ${pack.pastel_id_pubkey} verified successfully`
          );
        } else {
          browserLogger.warn(
            `PastelID ${pack.pastel_id_pubkey} verification failed`
          );
        }

        processedPacks.push({
          pub_key: pack.pastel_id_pubkey,
          passphrase: pack.pastel_id_passphrase,
        });

        // Log other important information
        browserLogger.info(`Credit Pack Ticket: ${JSON.stringify({
          requested_initial_credits_in_credit_pack: pack.requested_initial_credits_in_credit_pack,
          psl_credit_usage_tracking_address: pack.psl_credit_usage_tracking_address,
        }, null, 2)}`);

      } catch (error) {
        browserLogger.error(
          `Error verifying pack ${i + 1}: ${(error as Error).message}`
        );
      }
    }

    browserLogger.info(
      "All promo packs in the file have been processed and verified"
    );
    return {
      success: true,
      message: "Promotional pack(s) imported and verified successfully",
      processedPacks: processedPacks,
    };
  } catch (error) {
    browserLogger.error(
      `Error importing promotional pack: ${(error as Error).message}`
    );
    return {
      success: false,
      message: `Failed to import promotional pack: ${(error as Error).message}`,
    };
  }
}

function formatNumberWithCommas(number: number, fractionDigits: number = 1) {
  return number.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function parseAndFormatNumber(value: string, fractionDigits: number = 1) {
  const number = parseFloat(value.replace(/,/g, ""));
  return isNaN(number) ? value : formatNumberWithCommas(number, fractionDigits);
}

// Export all functions
const utils  = {
  safeStringify,
  clearOldCache,
  storeInCache,
  getFromCache,
  fetchCurrentPSLMarketPrice,
  estimatedMarketPriceOfInferenceCreditsInPSLTerms,
  parseAndFormat,
  prettyJSON,
  abbreviateJSON,
  logActionWithPayload,
  transformCreditPackPurchaseRequestResponse,
  computeSHA3256Hexdigest,
  getSHA256HashOfInputData,
  compressDataWithZstd,
  decompressDataWithZstd,
  calculateXORDistance,
  adjustJSONSpacing,
  escapeJsonString,
  pythonCompatibleStringify,
  base64EncodeJson,
  extractResponseFieldsFromCreditPackTicketMessageDataAsJSON,
  computeSHA3256HashOfSQLModelResponseFields,
  prepareModelForEndpoint,
  removeSequelizeFields,
  prepareModelForValidation,
  compareDatetimes,
  validateTimestampFields,
  validatePastelBlockHeightFields,
  validateHashFields,
  getClosestSupernodePastelIDFromList,
  checkIfPastelIDIsValid,
  getSupernodeUrlFromPastelID,
  validatePastelIDSignatureFields,
  getClosestSupernodeToPastelIDURL,
  getNClosestSupernodesToPastelIDURLs,
  validateCreditPackTicketMessageData,
  validateInferenceResponseFields,
  validateInferenceResultFields,
  validateInferenceData,
  filterSupernodes,
  waitForConfirmation,
  waitForPastelIDRegistration,
  waitForCreditPackConfirmation,
  importPromotionalPack,
  parseAndFormatNumber,
};

export default utils;