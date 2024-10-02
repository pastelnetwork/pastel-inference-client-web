// src/app/lib/endToEndFunctions.ts

import BrowserRPCReplacement from "@/app/lib/BrowserRPCReplacement";
import { BrowserDatabase } from "@/app/lib/BrowserDatabase";
import PastelInferenceClient from "@/app/lib/PastelInferenceClient";
import * as storage from "./storage";
import * as utils from "./utils";
import * as schemas from "./validationSchemas";
import browserLogger from '@/app/lib/logger';
import pastelGlobals from '@/app/lib/globals';

import {
  CreditPack,
  Message,
  CreditPackTicketInfo,
  CreditPackEstimation,
  InferenceRequestParams,
  InferenceResult,
  PreliminaryPriceQuote,
  CreditPackCreationResult,
  SupernodeURL,
  CreditPackPurchaseRequest,
  CreditPackPurchaseRequestConfirmation,
  CreditPackPurchaseRequestConfirmationResponse,
  CreditPackPurchaseRequestResponse,
} from "@/app/types";

const rpc = new BrowserRPCReplacement();
const db = new BrowserDatabase();

function getIsoStringWithMicroseconds(): string {
  const now = new Date();
  return now.toISOString().replace("Z", "+00:00").replace(/\s/g, "");
}

export async function checkForNewIncomingMessages(): Promise<Message[]> {
  try {
    const pastelID = pastelGlobals.getPastelId();
    const passphrase = pastelGlobals.getPassphrase();
    const inferenceClient = new PastelInferenceClient(pastelID, passphrase);

    if (!pastelID || !passphrase) {
      console.error("PastelID or passphrase is not set");
      return [];
    }
    const { validMasternodeListFullDF } = await rpc.checkSupernodeList();

    console.log(`My local pastelid: ${inferenceClient.pastelID}`);

    const closestSupernodesToLocal =
      await utils.getNClosestSupernodesToPastelIDURLs(
        3,
        inferenceClient.pastelID,
        validMasternodeListFullDF
      );
    console.log(
      `Closest Supernodes to local pastelid: ${closestSupernodesToLocal
        .map((sn) => `PastelID: ${sn.pastelID}, URL: ${sn.url}`)
        .join(", ")}`
    );

    const messageRetrievalTasks = closestSupernodesToLocal.map(({ url }) =>
      inferenceClient.getUserMessages(url).catch((error) => {
        console.warn(
          `Failed to retrieve messages from supernode ${url}: ${error.message}`
        );
        return []; // Return an empty array on error
      })
    );
    const messageLists = await Promise.all(messageRetrievalTasks);

    const uniqueMessages: Message[] = [];
    const messageIDs = new Set<string>();
    for (const messageList of messageLists) {
      for (const message of messageList) {
        if (!messageIDs.has(message.id)) {
          uniqueMessages.push(message);
          messageIDs.add(message.id);
        }
      }
    }

    return uniqueMessages;
  } catch (error) {
    console.error(`Error in checkForNewIncomingMessages: ${error.message}`);
    throw error;
  }
}

export async function sendMessageAndCheckForNewIncomingMessages(
  toPastelID: string,
  messageBody: string
): Promise<{ sent_messages: Message[]; received_messages: Message[] }> {
  try {
    const pastelID = pastelGlobals.getPastelId();
    const passphrase = pastelGlobals.getPassphrase();
    const inferenceClient = new PastelInferenceClient(pastelID, passphrase);
    const { validMasternodeListFullDF } = await rpc.checkSupernodeList();

    if (!pastelID || !passphrase) {
      throw new Error("PastelID or passphrase is not set");
    }

    console.log("Sending user message...");
    console.log(`Recipient pastelid: ${toPastelID}`);

    const closestSupernodesToRecipient =
      await utils.getNClosestSupernodesToPastelIDURLs(
        3,
        toPastelID,
        validMasternodeListFullDF
      );
    console.log(
      `Closest Supernodes to recipient pastelid: ${closestSupernodesToRecipient.map(
        (sn) => sn.pastelID
      )}`
    );

    const userMessage: Message = {
      from_pastelid: pastelID,
      to_pastelid: toPastelID,
      message_body: utils.safeStringify(messageBody),
      message_signature: await rpc.signMessageWithPastelID(
        pastelID,
        messageBody,
        passphrase
      ),
      timestamp: new Date().toISOString(),
    };

    const { error } = await schemas.userMessageSchema.safeParse(userMessage);
    if (error) {
      throw new Error(`Invalid user message: ${error.message}`);
    }

    const sendTasks = closestSupernodesToRecipient.map(({ url }) =>
      inferenceClient.sendUserMessage(url, userMessage)
    );
    const sendResults = await Promise.all(sendTasks);
    console.log(`Sent user messages: ${utils.safeStringify(sendResults)}`);

    const receivedMessages = await checkForNewIncomingMessages();

    return {
      sent_messages: sendResults,
      received_messages: receivedMessages,
    };
  } catch (error) {
    console.error(
      `Error in sendMessageAndCheckForNewIncomingMessages: ${error.message}`
    );
    throw error;
  }
}

export async function handleCreditPackTicketEndToEnd(
  numberOfCredits: number,
  creditUsageTrackingPSLAddress: string,
  burnAddress: string,
  maximumTotalCreditPackPriceInPSL: number,
  maximumPerCreditPriceInPSL: number,
  optionalPastelID?: string,
  optionalPassphrase?: string
): Promise<CreditPackCreationResult> {
  let pastelID: string, passphrase: string;

  if (optionalPastelID && optionalPassphrase) {
    pastelID = optionalPastelID;
    passphrase = optionalPassphrase;
  } else {
    pastelID = pastelGlobals.getPastelId();
    passphrase = pastelGlobals.getPassphrase();
  }

  if (!pastelID || !passphrase) {
    throw new Error("PastelID or passphrase is not set");
  }

  const inferenceClient = new PastelInferenceClient(pastelID, passphrase);

  try {
    const { validMasternodeListFullDF } = await rpc.checkSupernodeList();
    const requestTimestamp = getIsoStringWithMicroseconds();

    const creditPackRequest: CreditPackPurchaseRequest = {
      requesting_end_user_pastelid: pastelID,
      requested_initial_credits_in_credit_pack: numberOfCredits,
      list_of_authorized_pastelids_allowed_to_use_credit_pack: JSON.stringify([
        pastelID,
      ]),
      credit_usage_tracking_psl_address: creditUsageTrackingPSLAddress,
      request_timestamp_utc_iso_string: requestTimestamp,
      request_pastel_block_height: await rpc.getCurrentPastelBlockHeight(),
      credit_purchase_request_message_version_string: "1.0",
      sha3_256_hash_of_credit_pack_purchase_request_fields: "",
      requesting_end_user_pastelid_signature_on_request_hash: "",
    };

    creditPackRequest.sha3_256_hash_of_credit_pack_purchase_request_fields =
      await utils.computeSHA3256HashOfSQLModelResponseFields(creditPackRequest);
    creditPackRequest.requesting_end_user_pastelid_signature_on_request_hash =
      await rpc.signMessageWithPastelID(
        pastelID,
        creditPackRequest.sha3_256_hash_of_credit_pack_purchase_request_fields,
        passphrase
      );

    const closestSupernodes = await utils.getNClosestSupernodesToPastelIDURLs(
      12,
      pastelID,
      validMasternodeListFullDF
    );
    if (closestSupernodes.length === 0) {
      throw new Error("No responsive supernodes found.");
    }

    for (const supernode of closestSupernodes) {
      try {
        console.log(
          `Attempting credit pack request with supernode: ${supernode.url}`
        );

        const preliminaryPriceQuote =
          await inferenceClient.creditPackTicketInitialPurchaseRequest(
            supernode.url,
            creditPackRequest
          );

        const signedCreditPackTicketOrRejection =
          await inferenceClient.creditPackTicketPreliminaryPriceQuoteResponse(
            supernode.url,
            creditPackRequest,
            preliminaryPriceQuote,
            maximumTotalCreditPackPriceInPSL,
            maximumPerCreditPriceInPSL
          );

        if ("termination_reason_string" in signedCreditPackTicketOrRejection) {
          console.log(
            `Credit pack purchase request terminated: ${signedCreditPackTicketOrRejection.termination_reason_string}`
          );
          continue;
        }

        const signedCreditPackTicket =
          signedCreditPackTicketOrRejection as CreditPackPurchaseRequestResponse;

        const burnTransactionResponse = await rpc.sendToAddress(
          burnAddress,
          Math.round(
            signedCreditPackTicket.proposed_total_cost_of_credit_pack_in_psl *
              100000
          ) / 100000,
          "Burn transaction for credit pack ticket"
        );

        if (!burnTransactionResponse) {
          throw new Error(`Error sending PSL to burn address`);
        }

        const burnTransactionTxid = burnTransactionResponse;

        const creditPackPurchaseRequestConfirmation =
          await buildCreditPackPurchaseRequestConfirmation(
            creditPackRequest,
            signedCreditPackTicket,
            burnTransactionTxid,
            pastelID,
            passphrase
          );

        await db.addData(
          "CreditPackPurchaseRequestConfirmation",
          creditPackPurchaseRequestConfirmation
        );

        const creditPackPurchaseRequestConfirmationResponse =
          await inferenceClient.confirmCreditPurchaseRequest(
            supernode.url,
            creditPackPurchaseRequestConfirmation
          );

        if (!creditPackPurchaseRequestConfirmationResponse) {
          throw new Error("Credit pack ticket storage failed");
        }

        let creditPackPurchaseRequestStatus =
          await checkCreditPackPurchaseRequestStatus(
            inferenceClient,
            supernode.url,
            creditPackRequest,
            closestSupernodes
          );

        if (creditPackPurchaseRequestStatus.status !== "completed") {
          const creditPackStorageRetryRequestResponse =
            await initiateStorageRetry(
              inferenceClient,
              creditPackRequest,
              signedCreditPackTicket,
              validMasternodeListFullDF,
              pastelID,
              passphrase
            );

          return {
            creditPackRequest,
            creditPackPurchaseRequestConfirmation,
            creditPackStorageRetryRequestResponse,
          };
        } else {
          return {
            creditPackRequest,
            creditPackPurchaseRequestConfirmation,
            creditPackPurchaseRequestConfirmationResponse,
          };
        }
      } catch (error) {
        console.warn(
          `Failed to create credit pack with supernode ${supernode.url}: ${error.message}`
        );
      }
    }

    throw new Error(
      "Failed to create credit pack ticket with all available supernodes"
    );
  } catch (error) {
    console.error(`Error in handleCreditPackTicketEndToEnd: ${error.message}`);
    throw new Error(
      "An unexpected error occurred while processing your credit pack purchase. Please try again later."
    );
  }
}

async function buildCreditPackPurchaseRequestConfirmation(
    creditPackRequest: CreditPackPurchaseRequest,
    signedCreditPackTicket: CreditPackPurchaseRequestResponse,
    burnTransactionTxid: string,
    pastelID: string,
    passphrase: string
  ): Promise<CreditPackPurchaseRequestConfirmation> {
    const confirmation: CreditPackPurchaseRequestConfirmation = {
      sha3_256_hash_of_credit_pack_purchase_request_fields:
        creditPackRequest.sha3_256_hash_of_credit_pack_purchase_request_fields,
      sha3_256_hash_of_credit_pack_purchase_request_response_fields:
        signedCreditPackTicket.sha3_256_hash_of_credit_pack_purchase_request_response_fields,
      credit_pack_purchase_request_fields_json_b64:
        signedCreditPackTicket.credit_pack_purchase_request_fields_json_b64,
      requesting_end_user_pastelid: pastelID,
      txid_of_credit_purchase_burn_transaction: burnTransactionTxid,
      credit_purchase_request_confirmation_utc_iso_string: new Date().toISOString(),
      credit_purchase_request_confirmation_pastel_block_height: await rpc.getCurrentPastelBlockHeight(),
      credit_purchase_request_confirmation_message_version_string: "1.0",
      sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields: "",
      requesting_end_user_pastelid_signature_on_sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields: "",
    };{

  confirmation.sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields =
    await utils.computeSHA3256HashOfSQLModelResponseFields(confirmation);
  confirmation.requesting_end_user_pastelid_signature_on_sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields =
    await rpc.signMessageWithPastelID(
      pastelID,
      confirmation.sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields,
      passphrase
    );

  const { success, error } =
    await schemas.creditPackPurchaseRequestConfirmationSchema.safeParse(
      confirmation
    );
  if (!success) {
    throw new Error(
      `Invalid credit pack purchase request confirmation: ${error.message}`
    );
  }

  return confirmation;
}

async function checkCreditPackPurchaseRequestStatus(
  inferenceClient: PastelInferenceClient,
  highestRankedSupernodeURL: string,
  creditPackRequest: CreditPackPurchaseRequest,
  closestSupernodes: SupernodeURL[]
): Promise<CreditPackPurchaseRequestStatus> {
  try {
    const status = await inferenceClient.checkStatusOfCreditPurchaseRequest(
      highestRankedSupernodeURL,
      creditPackRequest.sha3_256_hash_of_credit_pack_purchase_request_fields
    );
    console.log(
      `Credit pack purchase request status from the original supernode: ${JSON.stringify(
        status
      )}`
    );
    return status;
  } catch (error) {
    console.debug(
      `Error checking status with original supernode: ${error.message}. Trying other supernodes.`
    );
    for (const supernode of closestSupernodes) {
      try {
        const status = await inferenceClient.checkStatusOfCreditPurchaseRequest(
          supernode.url,
          creditPackRequest.sha3_256_hash_of_credit_pack_purchase_request_fields
        );
        console.log(
          `Credit pack purchase request status: ${JSON.stringify(status)}`
        );
        return status;
      } catch (retryError) {
        console.debug(
          `Error checking status with supernode ${supernode.url}: ${retryError.message}`
        );
      }
    }
    throw new Error(
      "Failed to check status of credit purchase request with all Supernodes"
    );
  }
}

async function initiateStorageRetry(
  inferenceClient: PastelInferenceClient,
  creditPackRequest: CreditPackPurchaseRequest,
  signedCreditPackTicket: CreditPackPurchaseRequestResponse,
  validMasternodeListFullDF: SupernodeInfo[],
  pastelID: string,
  passphrase: string
): Promise<any> {
  const closestAgreeingSupernodePastelID =
    await utils.getClosestSupernodePastelIDFromList(
      pastelID,
      JSON.parse(
        signedCreditPackTicket.list_of_supernode_pastelids_agreeing_to_credit_pack_purchase_terms
      )
    );

  const creditPackStorageRetryRequest =
    await buildCreditPackStorageRetryRequest(
      creditPackRequest,
      signedCreditPackTicket,
      closestAgreeingSupernodePastelID,
      pastelID,
      passphrase
    );

  await db.addData(
    "CreditPackStorageRetryRequest",
    creditPackStorageRetryRequest
  );

  const closestAgreeingSupernodeURL = await utils.getSupernodeUrlFromPastelID(
    closestAgreeingSupernodePastelID,
    validMasternodeListFullDF
  );

  const creditPackStorageRetryRequestResponse =
    await inferenceClient.creditPackStorageRetryRequest(
      closestAgreeingSupernodeURL,
      creditPackStorageRetryRequest
    );

  const { success, error } =
    await schemas.creditPackStorageRetryRequestResponseSchema.safeParse(
      creditPackStorageRetryRequestResponse
    );

  if (!success) {
    throw new Error(
      `Invalid credit pack storage retry request response: ${error.message}`
    );
  }

  // Silently attempt to announce completion to all agreeing supernodes
  const announcementPromises = JSON.parse(
    signedCreditPackTicket.list_of_supernode_pastelids_agreeing_to_credit_pack_purchase_terms
  ).map(async (supernodePastelID: string) => {
    if (utils.checkIfPastelIDIsValid(supernodePastelID)) {
      try {
        const supernodeURL = await utils.getSupernodeUrlFromPastelID(
          supernodePastelID,
          validMasternodeListFullDF
        );
        await inferenceClient.creditPackPurchaseCompletionAnnouncement(
          supernodeURL,
          creditPackStorageRetryRequestResponse
        );
      } catch (error) {
        // Silently ignore errors in completion announcements
      }
    }
  });

  await Promise.allSettled(announcementPromises);

  return creditPackStorageRetryRequestResponse;
}

async function buildCreditPackStorageRetryRequest(
  creditPackRequest: CreditPackPurchaseRequest,
  signedCreditPackTicket: CreditPackPurchaseRequestResponse,
  closestAgreeingSupernodePastelID: string,
  pastelID: string,
  passphrase: string
): Promise<CreditPackStorageRetryRequest> {
  const storageRetryRequest: CreditPackStorageRetryRequest = {
    sha3_256_hash_of_credit_pack_purchase_request_response_fields:
      signedCreditPackTicket.sha3_256_hash_of_credit_pack_purchase_request_response_fields,
    credit_pack_purchase_request_fields_json_b64:
      signedCreditPackTicket.credit_pack_purchase_request_fields_json_b64,
    requesting_end_user_pastelid: pastelID,
    closest_agreeing_supernode_to_retry_storage_pastelid:
      closestAgreeingSupernodePastelID,
    credit_pack_storage_retry_request_timestamp_utc_iso_string:
      new Date().toISOString(),
    credit_pack_storage_retry_request_pastel_block_height:
      await rpc.getCurrentPastelBlockHeight(),
    credit_pack_storage_retry_request_message_version_string: "1.0",
    sha3_256_hash_of_credit_pack_storage_retry_request_fields: "",
    requesting_end_user_pastelid_signature_on_credit_pack_storage_retry_request_hash:
      "",
  };

  storageRetryRequest.sha3_256_hash_of_credit_pack_storage_retry_request_fields =
    await utils.computeSHA3256HashOfSQLModelResponseFields(storageRetryRequest);
  storageRetryRequest.requesting_end_user_pastelid_signature_on_credit_pack_storage_retry_request_hash =
    await rpc.signMessageWithPastelID(
      pastelID,
      storageRetryRequest.sha3_256_hash_of_credit_pack_storage_retry_request_fields,
      passphrase
    );

  const { success, error } =
    await schemas.creditPackStorageRetryRequestSchema.safeParse(
      storageRetryRequest
    );
  if (!success) {
    throw new Error(
      `Invalid credit pack storage retry request: ${error.message}`
    );
  }

  return storageRetryRequest;
}

export async function getCreditPackTicketInfoEndToEnd(
  creditPackTicketPastelTxid: string,
  optionalPastelID?: string,
  optionalPassphrase?: string
): Promise<CreditPackTicketInfo> {
  try {
    console.log("getCreditPackTicketInfoEndToEnd called with:", {
      creditPackTicketPastelTxid,
      optionalPastelID: optionalPastelID ? "[PROVIDED]" : "[NOT PROVIDED]",
      optionalPassphrase: optionalPassphrase ? "[PROVIDED]" : "[NOT PROVIDED]",
    });
    let pastelID: string, passphrase: string;

    if (optionalPastelID && optionalPassphrase) {
      pastelID = optionalPastelID;
      passphrase = optionalPassphrase;
    } else {
      pastelID = pastelGlobals.getPastelId();
      passphrase = pastelGlobals.getPassphrase();
    }
    console.log("Using PastelID:", pastelID);

    if (!pastelID || !passphrase) {
      throw new Error("PastelID or passphrase is not set");
    }
    const inferenceClient = new PastelInferenceClient(pastelID, passphrase);
    const { validMasternodeListFullDF } = await rpc.checkSupernodeList();
    const { url: supernodeURL } = await utils.getClosestSupernodeToPastelIDURL(
      pastelID,
      validMasternodeListFullDF
    );
    if (!supernodeURL) {
      throw new Error("Supernode URL is undefined");
    }
    console.log(
      `Getting credit pack ticket data from Supernode URL: ${supernodeURL}...`
    );

    const {
      creditPackPurchaseRequestResponse,
      creditPackPurchaseRequestConfirmation,
    } = await inferenceClient.getCreditPackTicketFromTxid(
      supernodeURL,
      creditPackTicketPastelTxid
    );

    const balanceInfo = await inferenceClient.checkCreditPackBalance(
      supernodeURL,
      creditPackTicketPastelTxid
    );

    return {
      requestResponse: creditPackPurchaseRequestResponse,
      requestConfirmation: creditPackPurchaseRequestConfirmation,
      balanceInfo,
    };
  } catch (error) {
    console.error(`Error in getCreditPackTicketInfoEndToEnd: ${error.message}`);
    throw error;
  }
}

export async function getMyValidCreditPackTicketsEndToEnd(): Promise<
  CreditPack[]
> {
  const initialMinimumNonEmptyResponses = 5;
  const maxTotalResponsesIfAllEmpty = 20;
  const retryLimit = 1;

  try {
    const pastelID = pastelGlobals.getPastelId();
    const passphrase = pastelGlobals.getPassphrase();
    if (!pastelID || !passphrase) {
      throw new Error("PastelID or passphrase is not set");
    }

    const inferenceClient = new PastelInferenceClient(pastelID, passphrase);
    const { validMasternodeListFullDF } = await rpc.checkSupernodeList();

    const closestSupernodes = await utils.getNClosestSupernodesToPastelIDURLs(
      120,
      pastelID,
      validMasternodeListFullDF
    );

    let allResponses: { response: CreditPack[]; url: string }[] = [];
    let nonEmptyResponses: { response: CreditPack[]; url: string }[] = [];
    let isResolved = false;

    await new Promise<void>((resolve, reject) => {
      let completedRequests = 0;

      const handleResponse = () => {
        if (isResolved) return;

        if (nonEmptyResponses.length >= initialMinimumNonEmptyResponses) {
          console.log(
            `Received ${nonEmptyResponses.length} non-empty responses out of ${allResponses.length} total responses`
          );
          isResolved = true;
          resolve();
        } else if (allResponses.length >= maxTotalResponsesIfAllEmpty) {
          console.log(
            `Reached maximum total responses (${maxTotalResponsesIfAllEmpty}) with ${nonEmptyResponses.length} non-empty responses`
          );
          isResolved = true;
          resolve();
        } else if (completedRequests >= closestSupernodes.length) {
          console.warn(
            `Queried all available supernodes. Got ${nonEmptyResponses.length} non-empty responses out of ${allResponses.length} total responses`
          );
          isResolved = true;
          resolve();
        }
      };

      closestSupernodes.forEach(({ url }) => {
        if (isResolved) return;

        utils
          .retryPromise(
            () => inferenceClient.getValidCreditPackTicketsForPastelID(url),
            retryLimit
          )
          .then((response) => {
            if (isResolved) return;

            console.log(
              `Response received from supernode at ${url}; response length: ${response.length}`
            );
            allResponses.push({ response, url });
            if (response.length > 0) {
              nonEmptyResponses.push({ response, url });
            }
            completedRequests++;
            handleResponse();
          })
          .catch((error) => {
            if (isResolved) return;

            console.error(
              `Error querying supernode at ${url}: ${error.message}`
            );
            completedRequests++;
            handleResponse();
          });
      });
    });

    if (nonEmptyResponses.length > 0) {
      // Return the longest non-empty response
      const longestResponse = nonEmptyResponses.reduce((prev, current) => {
        return current.response.length > prev.response.length ? current : prev;
      }).response;
      console.log(
        `Returning longest non-empty response with length: ${longestResponse.length}`
      );
      return longestResponse;
    } else {
      console.log("All responses were empty. Returning empty list.");
      return [];
    }
  } catch (error) {
    console.error(
      `Error in getMyValidCreditPackTicketsEndToEnd: ${error.message}`
    );
    return [];
  }
}

export async function estimateCreditPackCostEndToEnd(
  desiredNumberOfCredits: number,
  creditPriceCushionPercentage: number
): Promise<number> {
  try {
    const pastelID = pastelGlobals.getPastelId();
    const passphrase = pastelGlobals.getPassphrase();
    if (!pastelID || !passphrase) {
      throw new Error("PastelID or passphrase is not set");
    }
    const inferenceClient = new PastelInferenceClient(pastelID, passphrase);
    const estimatedTotalCostOfTicket =
      await inferenceClient.internalEstimateOfCreditPackTicketCostInPSL(
        desiredNumberOfCredits,
        creditPriceCushionPercentage
      );
    return estimatedTotalCostOfTicket;
  } catch (error) {
    console.error(`Error in estimateCreditPackCostEndToEnd: ${error.message}`);
    throw error;
  }
}

export async function handleInferenceRequestEndToEnd(
  params: InferenceRequestParams
): Promise<InferenceResult | null> {
  try {
    const pastelID = pastelGlobals.getPastelId();
    const passphrase = pastelGlobals.getPassphrase();
    if (!pastelID || !passphrase) {
      throw new Error("PastelID or passphrase is not set");
    }
    const inferenceClient = new PastelInferenceClient(pastelID, passphrase);
    const modelParametersJSON = utils.safeStringify(params.modelParameters);

    // Get the closest N supernode URLs that support the desired model, ordered by response time
    const supernodeURLs =
      await inferenceClient.getClosestSupernodeURLsThatSupportsDesiredModel(
        params.requestedModelCanonicalString,
        params.modelInferenceTypeString,
        modelParametersJSON,
        12 // Limit to the closest 12 supernodes
      );

    if (!supernodeURLs || supernodeURLs.length === 0) {
      console.error(
        `No supporting supernode found with adequate performance for the desired model: ${params.requestedModelCanonicalString} with inference type: ${params.modelInferenceTypeString}`
      );
      return null;
    }

    let inferenceResultDict: any = null;
    let auditResults: any = null;
    let validationResults: any = null;
    let error: Error | null = null;

    // Limit to trying the 5 fastest supernodes (based on response times)
    const maxTries = Math.min(5, supernodeURLs.length);

    for (let i = 0; i < maxTries; i++) {
      const supernodeURL = supernodeURLs[i];
      console.log(
        `Attempting inference request to Supernode URL: ${supernodeURL}`
      );

      try {
        const modelInputDataJSONBase64Encoded = btoa(
          JSON.stringify(params.modelInputData)
        );

        const modelParametersJSONBase64Encoded = btoa(modelParametersJSON);

        const currentBlockHeight = await rpc.getCurrentPastelBlockHeight();

        const inferenceRequestData: InferenceAPIUsageRequest = {
          inference_request_id: utils.generateUUID(),
          requesting_pastelid: pastelID,
          credit_pack_ticket_pastel_txid: params.creditPackTicketPastelTxid,
          requested_model_canonical_string:
            params.requestedModelCanonicalString,
          model_inference_type_string: params.modelInferenceTypeString,
          model_parameters_json_b64: modelParametersJSONBase64Encoded,
          model_input_data_json_b64: modelInputDataJSONBase64Encoded,
          inference_request_utc_iso_string: new Date().toISOString(),
          inference_request_pastel_block_height: currentBlockHeight,
          status: "initiating",
          inference_request_message_version_string: "1.0",
          sha3_256_hash_of_inference_request_fields: "",
          requesting_pastelid_signature_on_request_hash: "",
        };

        const sha3256HashOfInferenceRequestFields =
          await utils.computeSHA3256HashOfSQLModelResponseFields(
            inferenceRequestData
          );
        inferenceRequestData.sha3_256_hash_of_inference_request_fields =
          sha3256HashOfInferenceRequestFields;
        const requestingPastelIDSignatureOnRequestHash =
          await rpc.signMessageWithPastelID(
            pastelID,
            sha3256HashOfInferenceRequestFields,
            passphrase
          );
        inferenceRequestData.requesting_pastelid_signature_on_request_hash =
          requestingPastelIDSignatureOnRequestHash;

        const usageRequestResponse =
          await inferenceClient.makeInferenceAPIUsageRequest(
            supernodeURL,
            inferenceRequestData
          );

        const validationErrors =
          await utils.validateCreditPackTicketMessageData(usageRequestResponse);
        if (validationErrors && validationErrors.length > 0) {
          throw new Error(
            `Invalid inference request response from Supernode URL ${supernodeURL}: ${validationErrors.join(
              ", "
            )}`
          );
        }

        const usageRequestResponseDict = usageRequestResponse;
        const inferenceRequestID =
          usageRequestResponseDict.inference_request_id;
        const inferenceResponseID =
          usageRequestResponseDict.inference_response_id;
        const proposedCostInCredits = parseFloat(
          usageRequestResponseDict.proposed_cost_of_request_in_inference_credits
        );
        const creditUsageTrackingPSLAddress =
          usageRequestResponseDict.credit_usage_tracking_psl_address;
        const creditUsageTrackingAmountInPSL =
          parseFloat(
            usageRequestResponseDict.request_confirmation_message_amount_in_patoshis
          ) / 100000;
        const trackingAddressBalance = await rpc.checkPSLAddressBalance(
          creditUsageTrackingPSLAddress
        );

        if (trackingAddressBalance < creditUsageTrackingAmountInPSL) {
          console.error(
            `Insufficient balance in tracking address: ${creditUsageTrackingPSLAddress}; amount needed: ${creditUsageTrackingAmountInPSL}; current balance: ${trackingAddressBalance}; shortfall: ${
              creditUsageTrackingAmountInPSL - trackingAddressBalance
            }`
          );
          return null;
        }

        if (proposedCostInCredits <= params.maximumInferenceCostInCredits) {
          const trackingTransactionTxid =
            await rpc.sendTrackingAmountFromControlAddressToBurnAddressToConfirmInferenceRequest(
              inferenceRequestID,
              creditUsageTrackingPSLAddress,
              creditUsageTrackingAmountInPSL,
              pastelGlobals.getBurnAddress()
            );

          const txidLooksValid = /^[0-9a-fA-F]{64}$/.test(
            trackingTransactionTxid
          );

          if (txidLooksValid) {
            const confirmationData: InferenceConfirmation = {
              inference_request_id: inferenceRequestID,
              requesting_pastelid: pastelID,
              confirmation_transaction: { txid: trackingTransactionTxid },
            };

            const confirmationResult =
              await inferenceClient.sendInferenceConfirmation(
                supernodeURL,
                confirmationData
              );

            console.log(
              `Sent inference confirmation: ${utils.prettyJSON(
                confirmationResult
              )}`
            );

            const maxTriesToGetConfirmation = 60;
            let initialWaitTimeInSeconds = 3;
            let waitTimeInSeconds = initialWaitTimeInSeconds;

            for (let cnt = 0; cnt < maxTriesToGetConfirmation; cnt++) {
              waitTimeInSeconds = waitTimeInSeconds * 1.04 ** cnt;
              console.log(
                `Waiting for the inference results for ${Math.round(
                  waitTimeInSeconds
                )} seconds... (Attempt ${
                  cnt + 1
                }/${maxTriesToGetConfirmation}); Checking with Supernode URL: ${supernodeURL}`
              );

              await new Promise((resolve) =>
                setTimeout(resolve, waitTimeInSeconds * 1000)
              );

              if (
                inferenceRequestID.length === 0 ||
                inferenceResponseID.length === 0
              ) {
                throw new Error("Inference request ID or response ID is empty");
              }

              const resultsAvailable =
                await inferenceClient.checkStatusOfInferenceRequestResults(
                  supernodeURL,
                  inferenceResponseID
                );

              if (resultsAvailable) {
                const outputResults =
                  await inferenceClient.retrieveInferenceOutputResults(
                    supernodeURL,
                    inferenceRequestID,
                    inferenceResponseID
                  );

                const outputResultsDict = outputResults;
                const outputResultsSize =
                  outputResults.inference_result_json_base64.length;
                const maxResponseSizeToLog = 20000;

                inferenceResultDict = {
                  supernode_url: supernodeURL,
                  request_data: inferenceRequestData,
                  usage_request_response: usageRequestResponseDict,
                  model_input_data_json: params.modelInputData,
                  output_results: outputResultsDict,
                };

                if (params.modelInferenceTypeString === "text_to_image") {
                  let jsonString = atob(
                    outputResults.inference_result_json_base64
                  );
                  let jsonObject = JSON.parse(jsonString);
                  let imageBase64 = jsonObject.image;
                  inferenceResultDict.generated_image_decoded =
                    atob(imageBase64);
                } else if (
                  params.modelInferenceTypeString === "embedding_document"
                ) {
                  const inferenceResultDecoded = atob(
                    outputResults.inference_result_json_base64
                  );
                  let zipBinary = atob(inferenceResultDecoded);
                  inferenceResultDict.zip_file_data = zipBinary;
                } else {
                  const inferenceResultDecoded = atob(
                    outputResults.inference_result_json_base64
                  );
                  console.log(`Decoded response:\n${inferenceResultDecoded}`);
                  inferenceResultDict.inference_result_decoded =
                    inferenceResultDecoded;
                }

                const useAuditFeature = false;

                if (useAuditFeature) {
                  console.log(
                    "Waiting 3 seconds for audit results to be available..."
                  );
                  await new Promise((resolve) => setTimeout(resolve, 3000));

                  auditResults =
                    await inferenceClient.auditInferenceRequestResponseID(
                      inferenceResponseID,
                      supernodeURL
                    );
                  validationResults = utils.validateInferenceData(
                    inferenceResultDict,
                    auditResults
                  );
                  console.log(
                    `Validation results: ${utils.prettyJSON(validationResults)}`
                  );
                  if (!auditResults) {
                    console.warn("Audit results are null");
                  }
                  if (!validationResults) {
                    console.warn("Validation results are null");
                  }
                } else {
                  auditResults = null;
                  validationResults = null;
                }

                if (!inferenceResultDict) {
                  console.error("Inference result is null");
                  return {
                    inferenceResultDict: null,
                    auditResults: null,
                    validationResults: null,
                  };
                }
                return { inferenceResultDict, auditResults, validationResults };
              } else {
                console.log("Inference results not available yet; retrying...");
              }
            }
          }
        } else {
          console.log(
            `Quoted price of ${proposedCostInCredits} credits exceeds the maximum allowed cost of ${params.maximumInferenceCostInCredits} credits. Inference request not confirmed.`
          );
          return {
            inferenceResultDict: null,
            auditResults: null,
            validationResults: null,
          };
        }
      } catch (err) {
        error = err as Error;
        console.warn(
          `Failed inference request to Supernode URL ${supernodeURL}. Moving on to the next one.`
        );
      }
    }

    // If no inference request succeeded after all retries
    if (!inferenceResultDict) {
      throw new Error(
        `Failed to make inference request after ${maxTries} tries. Last error: ${
          error ? error.message : "Unknown error"
        }`
      );
    }
  } catch (error) {
    console.error(`Error in handleInferenceRequestEndToEnd: ${error.message}`);
    throw error;
  }

  return null;
}
