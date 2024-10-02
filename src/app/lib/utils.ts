import CryptoJS from "crypto-js";
import pako from "pako";
import browserLogger from "@/app/lib/logger";
import pastelGlobals from "@/app/lib/globals";
import {
  SupernodeInfo,
  SupernodeWithDistance,
  ModelParameter,
  Model,
  ModelMenu,
  CachedItem,
  ValidationError,
  AuditResult,
  InferenceResultDict,
  InferenceAPIUsageRequest,
  InferenceAPIUsageResponse,
  InferenceAPIOutputResult,
  PreliminaryPriceQuote,
  CreditPackPurchaseRequestResponse,
  CreditPackPurchaseRequestConfirmation,
  ValidationResult,
} from "@/app/types";
import { models } from "@/app/lib/BrowserDatabase";

const MAX_CACHE_AGE_MS = 1 * 60 * 1000; // 1 minute in milliseconds

// Constants
const TARGET_VALUE_PER_CREDIT_IN_USD = parseFloat(
  localStorage.getItem("TARGET_VALUE_PER_CREDIT_IN_USD") || "0.01"
);
const TARGET_PROFIT_MARGIN = parseFloat(
  localStorage.getItem("TARGET_PROFIT_MARGIN") || "0.1"
);
const MAXIMUM_LOCAL_CREDIT_PRICE_DIFFERENCE_TO_ACCEPT_CREDIT_PRICING =
  parseFloat(
    localStorage.getItem(
      "MAXIMUM_LOCAL_CREDIT_PRICE_DIFFERENCE_TO_ACCEPT_CREDIT_PRICING"
    ) || "0.001"
  );
const MAXIMUM_LOCAL_PASTEL_BLOCK_HEIGHT_DIFFERENCE_IN_BLOCKS = parseInt(
  localStorage.getItem(
    "MAXIMUM_LOCAL_PASTEL_BLOCK_HEIGHT_DIFFERENCE_IN_BLOCKS"
  ) || "10"
);

// Helper functions
export function safeStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

// Cache functions
export async function clearOldCache(): Promise<void> {
  const keys = await models.cache.findAll();
  const currentTime = Date.now();
  for (const key of keys) {
    const item = await models.cache.findByPk(key);
    if (item && item.timestamp) {
      if (currentTime - item.timestamp > MAX_CACHE_AGE_MS) {
        await models.cache.destroy({ where: { key } });
      }
    } else {
      await models.cache.destroy({ where: { key } });
    }
  }
}

export async function storeInCache<T>(key: string, data: T): Promise<void> {
  await models.cache.create({ key, data, timestamp: Date.now() });
}

export async function getFromCache<T>(key: string): Promise<T | null> {
  const item = (await models.cache.findByPk(key)) as CachedItem<T> | null;
  if (item && item.timestamp) {
    if (Date.now() - item.timestamp <= MAX_CACHE_AGE_MS) {
      return item.data;
    } else {
      await models.cache.destroy({ where: { key } });
    }
  }
  return null;
}

// Market price functions
export async function fetchCurrentPSLMarketPrice(): Promise<number> {
  async function checkPrices(): Promise<{
    priceCMC: number | null;
    priceCG: number | null;
  }> {
    try {
      const [responseCMC, responseCG] = await Promise.all([
        fetch("https://coinmarketcap.com/currencies/pastel/"),
        fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=pastel&vs_currencies=usd"
        ),
      ]);
      const textCMC = await responseCMC.text();
      const priceCMCMatch = textCMC.match(/price today is \$([0-9.]+) USD/);
      const priceCMC = priceCMCMatch ? parseFloat(priceCMCMatch[1]) : null;
      const jsonCG = await responseCG.json();
      const priceCG = jsonCG.pastel?.usd ?? null;
      return { priceCMC, priceCG };
    } catch (error) {
      console.error(
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

  console.log(
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
    console.log(
      `Estimated market price of 1.0 inference credit: ${costPerCreditPSL.toFixed(
        4
      )} PSL`
    );
    return costPerCreditPSL;
  } catch (error) {
    console.error(
      `Error calculating estimated market price of inference credits: ${safeStringify(
        (error as Error).message
      )}`
    );
    throw error;
  }
}

// Utility functions
export function parseAndFormat(value: any): string {
  try {
    if (typeof value === "string") {
      if (value.includes("\n")) {
        return value;
      }
      const parsedValue = JSON.parse(value);
      return JSON.stringify(parsedValue, null, 4);
    }
    return JSON.stringify(value, null, 4);
  } catch (error) {
    return value;
  }
}

export function prettyJSON(data: any): string {
  if (data instanceof Map) {
    data = Object.fromEntries(data);
  }
  if (Array.isArray(data) || (typeof data === "object" && data !== null)) {
    const formattedData: { [key: string]: any } = {};
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
  return data;
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
  jsonPayload: any
): void {
  const maxPayloadLength = 10000;
  let formattedPayload = prettyJSON(jsonPayload);
  if (formattedPayload.length > maxPayloadLength) {
    formattedPayload = abbreviateJSON(formattedPayload, maxPayloadLength);
  }
  console.log(
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

export function computeSHA3256Hexdigest(input: string): string {
  return CryptoJS.SHA3(input, { outputLength: 256 }).toString();
}

export function getSHA256HashOfInputData(inputData: string): string {
  return CryptoJS.SHA256(inputData).toString();
}

export async function compressDataWithZstd(
  inputData: string
): Promise<{ compressedData: Uint8Array; base64EncodedData: string }> {
  const compressedData = pako.deflate(inputData);
  const base64EncodedData = btoa(
    String.fromCharCode.apply(null, compressedData)
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
  const hash1 = CryptoJS.SHA3(pastelID1, { outputLength: 256 }).toString();
  const hash2 = CryptoJS.SHA3(pastelID2, { outputLength: 256 }).toString();
  const xorResult = BigInt(`0x${hash1}`) ^ BigInt(`0x${hash2}`);
  return xorResult;
}

export function adjustJSONSpacing(jsonString: string): string {
  return jsonString.replace(/(?<!\d):(\s*)/g, ": ").replace(/,(\s*)/g, ", ");
}

export function escapeJsonString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function pythonCompatibleStringify(obj: any): string {
  function sortObjectByKeys(unsortedObj: any): any {
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
      .reduce((acc: any, key) => {
        const value = unsortedObj[key];
        if (
          typeof value === "object" &&
          value !== null &&
          !(value instanceof Date)
        ) {
          acc[key] = Array.isArray(value)
            ? value.map(sortObjectByKeys)
            : sortObjectByKeys(value);
        } else {
          acc[key] = value;
        }
        return acc;
      }, {});
  }

  function customReplacer(key: string, value: any): any {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "object" && value !== null) {
      return sortObjectByKeys(value);
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
  const sortedObject = sortObjectByKeys(obj);
  let jsonString = JSON.stringify(sortedObject, customReplacer);
  jsonString = jsonString.replace(/"(true|false)"/g, "$1");
  jsonString = adjustJSONSpacing(jsonString);
  return jsonString;
}

export function base64EncodeJson(jsonInput: string): string {
  return btoa(pythonCompatibleStringify(JSON.parse(jsonInput)));
}

export async function extractResponseFieldsFromCreditPackTicketMessageDataAsJSON(
  modelInstance: any
): Promise<string> {
  const responseFields: { [key: string]: any } = {};
  const plainObject = modelInstance;

  let lastHashFieldName: string | null = null;
  let lastSignatureFieldNames: string[] = [];
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
            typeof fieldValue === "number" ? fieldValue : fieldValue.toString();
        }
      }
    });
  return pythonCompatibleStringify(responseFields);
}

export async function computeSHA3256HashOfSQLModelResponseFields(
  modelInstance: any
): Promise<string> {
  let responseFieldsJSON =
    await extractResponseFieldsFromCreditPackTicketMessageDataAsJSON(
      modelInstance
    );
  const sha256HashOfResponseFields =
    getSHA256HashOfInputData(responseFieldsJSON);
  return sha256HashOfResponseFields;
}

export async function prepareModelForEndpoint(
  modelInstance: any
): Promise<any> {
  let preparedModelInstance: { [key: string]: any } = {};
  let instanceData = modelInstance;
  for (const key in instanceData) {
    if (Object.prototype.hasOwnProperty.call(instanceData, key)) {
      if (key.endsWith("_json")) {
        if (typeof instanceData[key] === "string") {
          try {
            const parsedJson = JSON.parse(instanceData[key]);
            preparedModelInstance[key] = pythonCompatibleStringify(parsedJson);
          } catch (e) {
            console.error("Failed to parse JSON for key:", key, "Error:", e);
            preparedModelInstance[key] = instanceData[key];
          }
        } else {
          preparedModelInstance[key] = pythonCompatibleStringify(
            instanceData[key]
          );
        }
      } else {
        preparedModelInstance[key] = instanceData[key];
      }
    }
  }
  return preparedModelInstance;
}

export function removeSequelizeFields(plainObject: any): void {
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

export async function prepareModelForValidation(
  modelInstance: any
): Promise<any> {
  let preparedModelInstance = { ...modelInstance };
  Object.keys(preparedModelInstance).forEach((key) => {
    if (
      key.endsWith("_json") &&
      typeof preparedModelInstance[key] === "string"
    ) {
      try {
        preparedModelInstance[key] = JSON.parse(preparedModelInstance[key]);
      } catch (error) {
        console.error(`Error parsing ${key}: ${error}`);
      }
    }
  });
  return preparedModelInstance;
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
  modelInstance: any,
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
      } catch (error) {
        validationErrors.push({
          message: `Invalid timestamp format for field ${fieldName}`,
        });
      }
    }
  }
}

export async function validatePastelBlockHeightFields(
  modelInstance: any,
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
  modelInstance: any,
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
    const actualHash = modelInstance[hashFieldName];
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
    console.warn("No filtered supernodes available");
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
        console.warn(`Invalid supernode data: ${JSON.stringify(supernode)}`);
        return null;
      }

      try {
        const distance = await calculateXORDistance(localPastelID, pastelID);
        return { pastelID, distance: BigInt(distance) };
      } catch (error) {
        console.error(
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
    console.warn("No valid XOR distances calculated");
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
  modelInstance: any,
  validationErrors: ValidationError[]
): Promise<void> {
  let lastSignatureFieldName: string | null = null;
  let lastHashFieldName: string | null = null;
  let firstPastelID: string | undefined;
  let pastelID: string, messageToVerify: string, signature: string;

  const fields = modelInstance;
  for (const fieldName in fields) {
    if (
      fieldName.toLowerCase().includes("_pastelid") &&
      fields[fieldName] !== "NA"
    ) {
      firstPastelID = fields[fieldName];
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
  const embeddedField =
    fields[
      "supernode_pastelid_and_signature_on_inference_request_response_hash"
    ];
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
    lastSignatureFieldName &&
    signature
  ) {
    pastelID = firstPastelID;
    messageToVerify = fields[lastHashFieldName];
    if (!embeddedField) {
      signature = fields[lastSignatureFieldName];
    }
    const verificationResult = await rpc.verifyMessageWithPastelID(
      pastelID,
      messageToVerify,
      signature
    );
    if (verificationResult !== "OK") {
      validationErrors.push({
        message: `PastelID signature in field ${lastSignatureFieldName} failed verification`,
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
  console.log(
    `Attempting to find closest supernode for PastelID: ${inputPastelID}`
  );
  if (!inputPastelID) {
    console.warn("No input PastelID provided");
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
      console.warn("No closest supernode PastelID found");
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
      } catch (error) {
        return { url: null, pastelID: null };
      }
    }
  }
  console.warn("No filtered supernodes available");
  return { url: null, pastelID: null };
}

export async function getNClosestSupernodesToPastelIDURLs(
  n: number,
  inputPastelID: string,
  supernodeListDF: SupernodeInfo[],
  maxResponseTimeInMilliseconds: number = 800
): Promise<{ url: string; pastelID: string }[]> {
  if (!inputPastelID) {
    console.warn("No input PastelID provided");
    return [];
  }

  await clearOldCache();

  try {
    const filteredSupernodes = await filterSupernodes(
      supernodeListDF,
      maxResponseTimeInMilliseconds
    );

    if (filteredSupernodes.length === 0) {
      console.warn("No filtered supernodes available");
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
          console.error(
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
      console.warn("No valid XOR distances calculated");
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
        } catch (error) {
          return null;
        }
      }
    );

    const validSupernodes = (await Promise.all(validSupernodePromises)).filter(
      (supernode): supernode is { url: string; pastelID: string } =>
        supernode !== null
    );

    if (validSupernodes.length === 0) {
      console.warn("No valid supernodes found after connectivity check");
    } else {
      console.log(`Found ${validSupernodes.length} valid supernodes`);
    }

    return validSupernodes;
  } catch (error) {
    console.error(
      `Error in getNClosestSupernodesToPastelIDURLs: ${
        (error as Error).message
      }`
    );
    return [];
  }
}

export async function validateCreditPackTicketMessageData(
  modelInstance: any
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
  const requestConfirmationMessageAmountInPatoshisCounts: {
    [key: number]: number;
  } = {};
  const maxBlockHeightToIncludeConfirmationTransactionCounts: {
    [key: number]: number;
  } = {};
  const supernodePastelIDAndSignatureOnInferenceResponseIDCounts: {
    [key: string]: number;
  } = {};

  for (const result of responseAuditResults) {
    inferenceResponseIDCounts[result.inference_response_id] =
      (inferenceResponseIDCounts[result.inference_response_id] || 0) + 1;
    inferenceRequestIDCounts[result.inference_request_id] =
      (inferenceRequestIDCounts[result.inference_request_id] || 0) + 1;
    proposedCostInCreditsCounts[
      result.proposed_cost_of_request_in_inference_credits
    ] =
      (proposedCostInCreditsCounts[
        result.proposed_cost_of_request_in_inference_credits
      ] || 0) + 1;
    remainingCreditsAfterRequestCounts[
      result.remaining_credits_in_pack_after_request_processed
    ] =
      (remainingCreditsAfterRequestCounts[
        result.remaining_credits_in_pack_after_request_processed
      ] || 0) + 1;
    creditUsageTrackingPSLAddressCounts[
      result.credit_usage_tracking_psl_address
    ] =
      (creditUsageTrackingPSLAddressCounts[
        result.credit_usage_tracking_psl_address
      ] || 0) + 1;
    requestConfirmationMessageAmountInPatoshisCounts[
      result.request_confirmation_message_amount_in_patoshis
    ] =
      (requestConfirmationMessageAmountInPatoshisCounts[
        result.request_confirmation_message_amount_in_patoshis
      ] || 0) + 1;
    maxBlockHeightToIncludeConfirmationTransactionCounts[
      result.max_block_height_to_include_confirmation_transaction
    ] =
      (maxBlockHeightToIncludeConfirmationTransactionCounts[
        result.max_block_height_to_include_confirmation_transaction
      ] || 0) + 1;
    supernodePastelIDAndSignatureOnInferenceResponseIDCounts[
      result.supernode_pastelid_and_signature_on_inference_request_response_hash
    ] =
      (supernodePastelIDAndSignatureOnInferenceResponseIDCounts[
        result
          .supernode_pastelid_and_signature_on_inference_request_response_hash
      ] || 0) + 1;
  }

  const getMajorityValue = <T>(counts: { [key: string]: number }): T => {
    return Object.keys(counts).reduce((a, b) =>
      counts[a] > counts[b] ? a : b
    ) as unknown as T;
  };

  const majorityInferenceResponseID = getMajorityValue<string>(
    inferenceResponseIDCounts
  );
  const majorityInferenceRequestID = getMajorityValue<string>(
    inferenceRequestIDCounts
  );
  const majorityProposedCostInCredits = getMajorityValue<number>(
    proposedCostInCreditsCounts
  );
  const majorityRemainingCreditsAfterRequest = getMajorityValue<number>(
    remainingCreditsAfterRequestCounts
  );
  const majorityCreditUsageTrackingPSLAddress = getMajorityValue<string>(
    creditUsageTrackingPSLAddressCounts
  );
  const majorityRequestConfirmationMessageAmountInPatoshis =
    getMajorityValue<number>(requestConfirmationMessageAmountInPatoshisCounts);
  const majorityMaxBlockHeightToIncludeConfirmationTransaction =
    getMajorityValue<number>(
      maxBlockHeightToIncludeConfirmationTransactionCounts
    );
  const majoritySupernodePastelIDAndSignatureOnInferenceResponseID =
    getMajorityValue<string>(
      supernodePastelIDAndSignatureOnInferenceResponseIDCounts
    );

  const validationResults: ValidationResult = {
    inference_response_id:
      majorityInferenceResponseID ===
      usageRequestResponse.inference_response_id,
    inference_request_id:
      majorityInferenceRequestID === usageRequestResponse.inference_request_id,
    proposed_cost_in_credits:
      majorityProposedCostInCredits ===
      usageRequestResponse.proposed_cost_of_request_in_inference_credits,
    remaining_credits_after_request:
      majorityRemainingCreditsAfterRequest ===
      usageRequestResponse.remaining_credits_in_pack_after_request_processed,
    credit_usage_tracking_psl_address:
      majorityCreditUsageTrackingPSLAddress ===
      usageRequestResponse.credit_usage_tracking_psl_address,
    request_confirmation_message_amount_in_patoshis:
      majorityRequestConfirmationMessageAmountInPatoshis ===
      usageRequestResponse.request_confirmation_message_amount_in_patoshis,
    max_block_height_to_include_confirmation_transaction:
      majorityMaxBlockHeightToIncludeConfirmationTransaction ===
      usageRequestResponse.max_block_height_to_include_confirmation_transaction,
    supernode_pastelid_and_signature_on_inference_response_id:
      majoritySupernodePastelIDAndSignatureOnInferenceResponseID ===
      usageRequestResponse.supernode_pastelid_and_signature_on_inference_request_response_hash,
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
  const respondingSupernodeSignatureOnInferenceResultIDCounts: {
    [key: string]: number;
  } = {};

  for (const result of resultAuditResults) {
    inferenceResultIDCounts[result.inference_result_id] =
      (inferenceResultIDCounts[result.inference_result_id] || 0) + 1;
    inferenceRequestIDCounts[result.inference_request_id] =
      (inferenceRequestIDCounts[result.inference_request_id] || 0) + 1;
    inferenceResponseIDCounts[result.inference_response_id] =
      (inferenceResponseIDCounts[result.inference_response_id] || 0) + 1;
    respondingSupernodePastelIDCounts[result.responding_supernode_pastelid] =
      (respondingSupernodePastelIDCounts[
        result.responding_supernode_pastelid
      ] || 0) + 1;
    inferenceResultJSONBase64Counts[
      result.inference_result_json_base64.slice(0, 32)
    ] =
      (inferenceResultJSONBase64Counts[
        result.inference_result_json_base64.slice(0, 32)
      ] || 0) + 1;
    inferenceResultFileTypeStringsCounts[
      result.inference_result_file_type_strings
    ] =
      (inferenceResultFileTypeStringsCounts[
        result.inference_result_file_type_strings
      ] || 0) + 1;
    respondingSupernodeSignatureOnInferenceResultIDCounts[
      result.responding_supernode_signature_on_inference_result_id
    ] =
      (respondingSupernodeSignatureOnInferenceResultIDCounts[
        result.responding_supernode_signature_on_inference_result_id
      ] || 0) + 1;
  }

  const getMajorityValue = <T>(counts: { [key: string]: number }): T => {
    return Object.keys(counts).reduce((a, b) =>
      counts[a] > counts[b] ? a : b
    ) as unknown as T;
  };

  const majorityInferenceResultID = getMajorityValue<string>(
    inferenceResultIDCounts
  );
  const majorityInferenceRequestID = getMajorityValue<string>(
    inferenceRequestIDCounts
  );
  const majorityInferenceResponseID = getMajorityValue<string>(
    inferenceResponseIDCounts
  );
  const majorityRespondingSupernodePastelID = getMajorityValue<string>(
    respondingSupernodePastelIDCounts
  );
  const majorityInferenceResultJSONBase64 = getMajorityValue<string>(
    inferenceResultJSONBase64Counts
  );
  const majorityInferenceResultFileTypeStrings = getMajorityValue<string>(
    inferenceResultFileTypeStringsCounts
  );
  const majorityRespondingSupernodeSignatureOnInferenceResultID =
    getMajorityValue<string>(
      respondingSupernodeSignatureOnInferenceResultIDCounts
    );

  const validationResults: ValidationResult = {
    inference_result_id:
      majorityInferenceResultID === usageResult.inference_result_id,
    inference_request_id:
      majorityInferenceRequestID === usageResult.inference_request_id,
    inference_response_id:
      majorityInferenceResponseID === usageResult.inference_response_id,
    responding_supernode_pastelid:
      majorityRespondingSupernodePastelID ===
      usageResult.responding_supernode_pastelid,
    inference_result_json_base64:
      majorityInferenceResultJSONBase64 ===
      usageResult.inference_result_json_base64.slice(0, 32),
    inference_result_file_type_strings:
      majorityInferenceResultFileTypeStrings ===
      usageResult.inference_result_file_type_strings,
    responding_supernode_signature_on_inference_result_id:
      majorityRespondingSupernodeSignatureOnInferenceResultID ===
      usageResult.responding_supernode_signature_on_inference_result_id,
  };

  return validationResults;
}

export function validateInferenceData(
  inferenceResultDict: InferenceResultDict,
  auditResults: AuditResult[]
): {
  response_validation: ValidationResult;
  result_validation: ValidationResult;
} {
  const usageRequestResponse = inferenceResultDict.usage_request_response;
  const usageResult = inferenceResultDict.output_results;

  const responseValidationResults = validateInferenceResponseFields(
    auditResults.filter((result) => result.inference_response_id),
    usageRequestResponse
  );

  const resultValidationResults = validateInferenceResultFields(
    auditResults.filter((result) => result.inference_result_id),
    usageResult
  );

  const validationResults = {
    response_validation: responseValidationResults,
    result_validation: resultValidationResults,
  };

  return validationResults;
}

export async function filterSupernodes(
  supernodeList: SupernodeInfo[],
  maxResponseTimeInMilliseconds: number = 700,
  minPerformanceRatio: number = 0.75,
  maxSupernodes: number = 130,
  totalTimeoutMs: number = 1100
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
    let USE_VERBOSE_LOGGING = false;
    const totalRemoved =
      stats.removedDueToPing +
      stats.removedDueToPerformance +
      stats.removedDueToError;
    const removedPercentage = (
      (totalRemoved / stats.totalProcessed) *
      100
    ).toFixed(2);
    if (USE_VERBOSE_LOGGING) {
      console.log(`Total supernodes processed: ${stats.totalProcessed}`);
      console.log(
        `Total supernodes removed: ${totalRemoved} (${removedPercentage}%)`
      );
      console.log(`- Removed due to ping: ${stats.removedDueToPing}`);
      console.log(
        `- Removed due to performance: ${stats.removedDueToPerformance}`
      );
      console.log(`- Removed due to errors: ${stats.removedDueToError}`);
      if (stats.timeouts > 0) {
        console.log(`Total timeouts: ${stats.timeouts}`);
      }
    }
  };

  const cachedData = await getFromCache<SupernodeInfo[]>(cacheKey);

  if (cachedData && cachedData.length >= maxSupernodes) {
    console.log("Returning cached supernodes.");
    return cachedData.slice(0, maxSupernodes);
  }

  let fullSupernodeList = supernodeList;
  if (typeof supernodeList[0] === "string") {
    const validMasternodeListFullDF = await rpc.checkSupernodeList();
    fullSupernodeList = validMasternodeListFullDF.filter((supernode) =>
      supernodeList.includes(supernode.extKey)
    );
  }

  const filteredSupernodes: SupernodeInfo[] = [];
  let completed = false;

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
        await fetch(`http://${ipAddress}:7123/ping`, {
          signal: AbortSignal.timeout(maxResponseTimeInMilliseconds),
        });
      } catch (error) {
        stats.removedDueToPing++;
        return null;
      }
      const pingTime = performance.now() - pingStart;

      if (pingTime > maxResponseTimeInMilliseconds) {
        stats.removedDueToPing++;
        return null;
      }

      const performanceResponse = await fetch(
        `http://${ipAddress}:7123/liveness_ping`,
        {
          signal: AbortSignal.timeout(maxResponseTimeInMilliseconds),
        }
      );
      const performanceData = await performanceResponse.json();
      if (performanceData.performance_ratio_score < minPerformanceRatio) {
        stats.removedDueToPerformance++;
        return null;
      }
      const result = {
        ...supernode,
        url: `http://${ipAddress}:7123`,
      };
      await storeInCache(cacheKey, result);
      return result;
    } catch (error) {
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

export async function waitForConfirmation(
  checkFunction: (...args: any[]) => Promise<boolean>,
  ...checkFunctionArgs: any[]
): Promise<boolean> {
  const options = {
    maxRetries: 30,
    retryDelay: 10000,
    actionName: "condition",
    ...(typeof checkFunctionArgs[checkFunctionArgs.length - 1] === "object"
      ? checkFunctionArgs.pop()
      : {}),
  };

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      const result = await checkFunction(...checkFunctionArgs);
      if (result) {
        console.log(
          `${options.actionName} confirmed after ${attempt} attempt(s).`
        );
        return true;
      }
    } catch (error) {
      console.warn(
        `Error checking ${options.actionName} (attempt ${attempt}/${
          options.maxRetries
        }): ${(error as Error).message}`
      );
    }

    if (attempt < options.maxRetries) {
      console.log(
        `${options.actionName} not yet confirmed. Attempt ${attempt}/${
          options.maxRetries
        }. Waiting ${options.retryDelay / 1000} seconds before next check...`
      );
      await new Promise((resolve) => setTimeout(resolve, options.retryDelay));
    }
  }

  console.warn(
    `${options.actionName} not confirmed after ${options.maxRetries} attempts.`
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
    console.log(`PastelID ${pastelID} has been successfully registered.`);
  } else {
    console.error(`PastelID ${pastelID} registration could not be confirmed.`);
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
    console.log(`Credit pack with TXID ${txid} has been confirmed.`);
  } else {
    console.error(`Credit pack with TXID ${txid} could not be confirmed.`);
  }

  return isConfirmed;
}

export async function importPromotionalPack(jsonData: string): Promise<{
  success: boolean;
  message: string;
  processedPacks?: { pub_key: string; passphrase: string }[];
}> {
  console.log(`Starting import of promotional pack`);
  const processedPacks: { pub_key: string; passphrase: string }[] = [];

  try {
    // Initialize RPC connection
    console.log("Initializing RPC connection...");
    await rpc.initializeRPCConnection();
    console.log("RPC connection initialized successfully");

    // Parse the JSON data
    let packData: any[] = JSON.parse(jsonData);

    // Process each promotional pack in the data
    if (!Array.isArray(packData)) {
      packData = [packData]; // Wrap it in an array if it's not already
    }

    for (let i = 0; i < packData.length; i++) {
      const pack = packData[i];
      console.log(`Processing pack ${i + 1} of ${packData.length}`);

      // 1. Save the PastelID secure container
      const { rpcport } = await rpc.getLocalRPCSettings();
      const network =
        rpcport === "9932"
          ? "mainnet"
          : rpcport === "19932"
          ? "testnet"
          : "devnet";

      // Store the secure container in IndexedDB
      await models.secureContainers.create({
        pastelID: pack.pastel_id_pubkey,
        container: pack.secureContainerBase64,
        network: network,
      });

      // 2. Import the tracking address private key
      console.log(
        `Importing private key for tracking address: ${pack.psl_credit_usage_tracking_address}`
      );

      const startingBlockHeight = 730000;
      const importResult = await rpc.importPrivKey(
        pack.psl_credit_usage_tracking_address_private_key,
        "Imported from promotional pack",
        true,
        startingBlockHeight
      );
      if (importResult) {
        console.log(
          `Private key imported successfully for tracking address: ${importResult}`
        );
      } else {
        console.warn("Failed to import private key");
      }

      // 3. Log other important information
      console.log(`PastelID: ${pack.pastel_id_pubkey}`);
      console.log(`Passphrase: ${pack.pastel_id_passphrase}`);
      console.log(`Credit Pack Ticket: ${JSON.stringify(pack, null, 2)}`);

      // Add the processed pack info to our array
      processedPacks.push({
        pub_key: pack.pastel_id_pubkey,
        passphrase: pack.pastel_id_passphrase,
      });

      console.log(`Pack ${i + 1} processed successfully`);
    }

    // Wait for RPC connection to be re-established
    await rpc.waitForRPCConnection();

    // Verify PastelID import and wait for blockchain confirmation
    for (let i = 0; i < packData.length; i++) {
      const pack = packData[i];
      console.log(`Verifying PastelID import for pack ${i + 1}`);

      try {
        // Wait for PastelID to be confirmed in the blockchain
        await waitForPastelIDRegistration(pack.pastel_id_pubkey);
        console.log(
          `PastelID ${pack.pastel_id_pubkey} confirmed in blockchain`
        );

        // Verify PastelID functionality
        const testMessage = "This is a test message for PastelID verification";
        const signature = await rpc.signMessageWithPastelID(
          pack.pastel_id_pubkey,
          testMessage,
          pack.pastel_id_passphrase
        );
        console.log(
          `Signature created successfully for PastelID: ${pack.pastel_id_pubkey}`
        );

        const verificationResult = await rpc.verifyMessageWithPastelID(
          pack.pastel_id_pubkey,
          testMessage,
          signature
        );

        if (verificationResult) {
          console.log(
            `PastelID ${pack.pastel_id_pubkey} verified successfully`
          );
        } else {
          console.warn(`PastelID ${pack.pastel_id_pubkey} verification failed`);
        }

        // Verify Credit Pack Ticket
        await waitForCreditPackConfirmation(pack.credit_pack_registration_txid);
        console.log(
          `Credit Pack Ticket ${pack.credit_pack_registration_txid} confirmed in blockchain`
        );
      } catch (error) {
        console.error(
          `Error verifying pack ${i + 1}: ${(error as Error).message}`
        );
      }
    }

    console.log("All promo packs in the file have been processed and verified");
    return {
      success: true,
      message: "Promotional pack(s) imported and verified successfully",
      processedPacks: processedPacks,
    };
  } catch (error) {
    console.error(
      `Error importing promotional pack: ${(error as Error).message}`
    );
    return {
      success: false,
      message: `Failed to import promotional pack: ${(error as Error).message}`,
    };
  }
}
