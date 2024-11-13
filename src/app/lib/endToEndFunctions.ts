// src/app/lib/endToEndFunctions.ts

'use client'

import { v4 as uuidv4 } from 'uuid';

import api from "@/app/lib/api";
import BrowserRPCReplacement from "@/app/lib/BrowserRPCReplacement";
import { BrowserDatabase } from "@/app/lib/BrowserDatabase";
import PastelInferenceClient from "@/app/lib/PastelInferenceClient";
import * as utils from "./utils";
import * as schemas from "./validationSchemas";
import browserLogger from "@/app/lib/logger";
import pastelGlobals from "@/app/lib/globals";

import {
  CreditPack,
  CreditPackTicketInfo,
  InferenceRequestParams,
  InferenceResult,
  CreditPackCreationResult,
  SupernodeURL,
  CreditPackPurchaseRequest,
  CreditPackPurchaseRequestConfirmation,
  CreditPackPurchaseRequestResponse,
  SupernodeInfo,
  InferenceAPIUsageRequest,
  InferenceConfirmation,
  UserMessage,
  CreditPackStorageRetryRequest,
  CreditPackStorageRetryRequestResponse,
  PastelIDType
} from "@/app/types";

// Utilize singleton instances
const rpc = BrowserRPCReplacement.getInstance();
const db = BrowserDatabase.getInstance();

function getIsoStringWithMicroseconds(): string {
  const now = new Date();
  return now.toISOString().replace("Z", "+00:00").replace(/\s/g, "");
}

export async function checkForNewIncomingMessages(): Promise<UserMessage[]> {
  try {
    const pastelID = pastelGlobals.getPastelId();
    const passphrase = pastelGlobals.getPassphrase();

    if (!pastelID || !passphrase) {
      browserLogger.error("PastelID or passphrase is not set");
      return [];
    }

    const inferenceClient = new PastelInferenceClient({ pastelID, passphrase });
    const { validMasternodeListFullDF } = await rpc.checkSupernodeList();

    browserLogger.info(`My local pastelid: ${inferenceClient.getPastelID()}`);

    const closestSupernodesToLocal =
      await utils.getNClosestSupernodesToPastelIDURLs(
        3,
        inferenceClient.getPastelID(),
        validMasternodeListFullDF
      );
    browserLogger.info(
      `Closest Supernodes to local pastelid: ${closestSupernodesToLocal
        .map((sn) => `PastelID: ${sn.pastelID}, URL: ${sn.url}`)
        .join(", ")}`
    );

    const messageRetrievalTasks = closestSupernodesToLocal.map(({ url }) =>
      inferenceClient.getUserMessages(url).catch((error) => {
        browserLogger.warn(
          `Failed to retrieve messages from supernode ${url}: ${error.message}`
        );
        return [];
      })
    );
    const messageLists = await Promise.all(messageRetrievalTasks);

    const uniqueMessages: UserMessage[] = [];
    const messageIDs = new Set<string>();
    for (const messageList of messageLists) {
      for (const message of messageList) {
        if (message.id && !messageIDs.has(message.id)) {
          uniqueMessages.push(message);
          messageIDs.add(message.id);
        }
      }
    }

    return uniqueMessages;
  } catch (error) {
    browserLogger.error(
      `Error in checkForNewIncomingMessages: ${(error as Error).message}`
    );
    throw error;
  }
}

export async function sendMessageAndCheckForNewIncomingMessages(
  toPastelID: string,
  messageBody: string
): Promise<{ sent_messages: UserMessage[]; received_messages: UserMessage[] }> {
  try {
    const pastelID = pastelGlobals.getPastelId();
    const passphrase = pastelGlobals.getPassphrase();

    if (!pastelID || !passphrase) {
      throw new Error("PastelID or passphrase is not set");
    }

    const inferenceClient = new PastelInferenceClient({ pastelID, passphrase });
    const { validMasternodeListFullDF } = await rpc.checkSupernodeList();

    browserLogger.info("Sending user message...");
    browserLogger.info(`Recipient pastelid: ${toPastelID}`);

    const closestSupernodesToRecipient =
      await utils.getNClosestSupernodesToPastelIDURLs(
        3,
        toPastelID,
        validMasternodeListFullDF
      );
    browserLogger.info(
      `Closest Supernodes to recipient pastelid: ${closestSupernodesToRecipient.map(
        (sn) => sn.pastelID
      )}`
    );

    const userMessage: UserMessage = {
      from_pastelid: pastelID,
      to_pastelid: toPastelID,
      message_body: utils.safeStringify(messageBody),
      message_signature: await rpc.signMessageWithPastelID(
        pastelID,
        messageBody,
        PastelIDType.PastelID
      ),
      timestamp: new Date().toISOString(),
      id: uuidv4(),
    };

    const { error } = schemas.userMessageSchema.safeParse(userMessage);
    if (error) {
      throw new Error(`Invalid user message: ${error.message}`);
    }

    const sendTasks = closestSupernodesToRecipient.map(({ url }) =>
      inferenceClient.sendUserMessage(url, userMessage)
    );

    const sendResults = await Promise.all(sendTasks);

    browserLogger.info(
      `Sent user messages: ${utils.safeStringify(sendResults)}`
    );

    const receivedMessages = await checkForNewIncomingMessages();

    return {
      sent_messages: sendResults,
      received_messages: receivedMessages,
    };
  } catch (error) {
    browserLogger.error(
      `Error in sendMessageAndCheckForNewIncomingMessages: ${
        (error as Error).message
      }`
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
    pastelID = pastelGlobals.getPastelId() || "";
    passphrase = pastelGlobals.getPassphrase() || "";
  }

  if (!pastelID || !passphrase) {
    throw new Error("PastelID or passphrase is not set");
  }

  const inferenceClient = new PastelInferenceClient({ pastelID, passphrase });

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
    creditPackRequest.id = uuidv4();
    creditPackRequest.sha3_256_hash_of_credit_pack_purchase_request_fields =
      await utils.computeSHA3256HashOfSQLModelResponseFields(creditPackRequest);
    creditPackRequest.requesting_end_user_pastelid_signature_on_request_hash =
      await rpc.signMessageWithPastelID(
        pastelID,
        creditPackRequest.sha3_256_hash_of_credit_pack_purchase_request_fields,
        PastelIDType.PastelID
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
        browserLogger.info(
          `Attempting credit pack request with supernode: ${supernode.url}`
        );

        const preliminaryPriceQuote =
          await inferenceClient.creditPackTicketInitialPurchaseRequest(
            supernode.url,
            creditPackRequest
          );

        if ("rejection_reason_string" in preliminaryPriceQuote) {
          browserLogger.info(
            `Credit pack purchase request rejected: ${preliminaryPriceQuote.rejection_reason_string}`
          );
          continue;
        }

        const signedCreditPackTicketOrRejection =
          await inferenceClient.creditPackTicketPreliminaryPriceQuoteResponse(
            supernode.url,
            creditPackRequest,
            preliminaryPriceQuote,
            maximumTotalCreditPackPriceInPSL,
            maximumPerCreditPriceInPSL
          );

        if ("termination_reason_string" in signedCreditPackTicketOrRejection) {
          browserLogger.info(
            `Credit pack purchase request terminated: ${signedCreditPackTicketOrRejection.termination_reason_string}`
          );
          continue;
        }

        const signedCreditPackTicket =
          signedCreditPackTicketOrRejection as CreditPackPurchaseRequestResponse;

        await new Promise<void>((resolve) => {
          const checkAcknowledgement = async () => {
            const utxos = await rpc.getAddressUtxos(creditUsageTrackingPSLAddress);
            if (utxos?.length) {
              resolve();
            } else {
              setTimeout(checkAcknowledgement, 5000);
            }
          };
          checkAcknowledgement();
        });

        const burnTransactionResponse = await rpc.sendToAddress(
          burnAddress,
          Math.round(
            signedCreditPackTicket.proposed_total_cost_of_credit_pack_in_psl *
              100000
          ) / 100000,
          creditUsageTrackingPSLAddress,
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
            pastelID
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

        const creditPackPurchaseRequestStatus =
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
              pastelID
            );

          return {
            creditPackRequest,
            creditPackPurchaseRequestConfirmation: {
              ...creditPackPurchaseRequestConfirmation,
              pastel_api_credit_pack_ticket_registration_txid: creditPackPurchaseRequestConfirmationResponse.pastel_api_credit_pack_ticket_registration_txid
            },
            creditPackStorageRetryRequestResponse,
          };
        } else {
          return {
            creditPackRequest,
            creditPackPurchaseRequestConfirmation: {
              ...creditPackPurchaseRequestConfirmation,
              pastel_api_credit_pack_ticket_registration_txid: creditPackPurchaseRequestConfirmationResponse.pastel_api_credit_pack_ticket_registration_txid
            },
            creditPackPurchaseRequestConfirmationResponse,
          };
        }
      } catch (error) {
        browserLogger.warn(
          `Failed to create credit pack with supernode ${supernode.url}: ${
            (error as Error).message
          }`
        );
      }
    }

    throw new Error(
      "Failed to create credit pack ticket with all available supernodes"
    );
  } catch (error) {
    browserLogger.error(
      `Error in handleCreditPackTicketEndToEnd: ${(error as Error).message}`
    );
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
    credit_purchase_request_confirmation_utc_iso_string:
      new Date().toISOString(),
    credit_purchase_request_confirmation_pastel_block_height:
      await rpc.getCurrentPastelBlockHeight(),
    credit_purchase_request_confirmation_message_version_string: "1.0",
    sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields: "",
    requesting_end_user_pastelid_signature_on_sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields:
      "",
    id: uuidv4(),
  };

  confirmation.sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields =
    await utils.computeSHA3256HashOfSQLModelResponseFields(confirmation);
  confirmation.requesting_end_user_pastelid_signature_on_sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields =
    await rpc.signMessageWithPastelID(
      pastelID,
      confirmation.sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields,
      PastelIDType.PastelID
    );

  const { success, error } =
    schemas.creditPackPurchaseRequestConfirmationSchema.safeParse(confirmation);
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
): Promise<schemas.CreditPackPurchaseRequestStatus> {
  try {
    const status = await inferenceClient.checkStatusOfCreditPurchaseRequest(
      highestRankedSupernodeURL,
      creditPackRequest.sha3_256_hash_of_credit_pack_purchase_request_fields
    );
    browserLogger.info(
      `Credit pack purchase request status from the original supernode: ${JSON.stringify(
        status
      )}`
    );
    return status;
  } catch (error) {
    browserLogger.debug(
      `Error checking status with original supernode: ${
        (error as Error).message
      }. Trying other supernodes.`
    );
    for (const supernode of closestSupernodes) {
      try {
        const status = await inferenceClient.checkStatusOfCreditPurchaseRequest(
          supernode.url,
          creditPackRequest.sha3_256_hash_of_credit_pack_purchase_request_fields
        );
        browserLogger.info(
          `Credit pack purchase request status: ${JSON.stringify(status)}`
        );
        return status;
      } catch (retryError) {
        browserLogger.debug(
          `Error checking status with supernode ${supernode.url}: ${
            (retryError as Error).message
          }`
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
): Promise<CreditPackStorageRetryRequestResponse> {
  const closestAgreeingSupernodePastelID =
    await utils.getClosestSupernodePastelIDFromList(
      pastelID,
      JSON.parse(
        signedCreditPackTicket.list_of_supernode_pastelids_agreeing_to_credit_pack_purchase_terms
      )
    );

  if (closestAgreeingSupernodePastelID === null) {
    throw new Error("No agreeing Supernode found for credit pack storage retry");
  }

  const creditPackStorageRetryRequest =
    await buildCreditPackStorageRetryRequest(
      creditPackRequest,
      signedCreditPackTicket,
      closestAgreeingSupernodePastelID,
      pastelID
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
    schemas.creditPackStorageRetryRequestResponseSchema.safeParse(
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
          creditPackStorageRetryRequestResponse as unknown as CreditPackPurchaseRequestConfirmation
        );
      } catch {
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
      PastelIDType.PastelID
    );

  const { success, error } =
    schemas.creditPackStorageRetryRequestSchema.safeParse(storageRetryRequest);
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
    browserLogger.info("getCreditPackTicketInfoEndToEnd called with:", {
      creditPackTicketPastelTxid,
      optionalPastelID: optionalPastelID ? "[PROVIDED]" : "[NOT PROVIDED]",
      optionalPassphrase: optionalPassphrase ? "[PROVIDED]" : "[NOT PROVIDED]",
    });
    let pastelID: string, passphrase: string;

    if (optionalPastelID && optionalPassphrase) {
      pastelID = optionalPastelID;
      passphrase = optionalPassphrase;
    } else {
      pastelID = pastelGlobals.getPastelId() || "";
      passphrase = pastelGlobals.getPassphrase() || "";
    }
    browserLogger.info("Using PastelID:", pastelID);

    if (!pastelID || !passphrase) {
      throw new Error("PastelID or passphrase is not set");
    }
    const inferenceClient = new PastelInferenceClient({ pastelID, passphrase });
    const { validMasternodeListFullDF } = await rpc.checkSupernodeList();
    const { url: supernodeURL } = await utils.getClosestSupernodeToPastelIDURL(
      pastelID,
      validMasternodeListFullDF
    );
    if (!supernodeURL) {
      throw new Error("Supernode URL is undefined");
    }
    browserLogger.info(
      `Getting credit pack ticket data from Supernode URL: ${supernodeURL}...`
    );

    const { requestResponse, requestConfirmation } =
      await inferenceClient.getCreditPackTicketFromTxid(
        supernodeURL,
        creditPackTicketPastelTxid
      );

    const balanceInfo = await inferenceClient.checkCreditPackBalance(
      supernodeURL,
      creditPackTicketPastelTxid
    );

    return {
      requestResponse,
      requestConfirmation,
      balanceInfo: {
        credit_pack_current_credit_balance: Number(balanceInfo.credit_pack_current_credit_balance),
        balance_as_of_datetime: String(balanceInfo.balance_as_of_datetime),
      },
    };
  } catch (error) {
    browserLogger.error(
      `Error in getCreditPackTicketInfoEndToEnd: ${(error as Error).message}`
    );
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

    const inferenceClient = new PastelInferenceClient({ pastelID, passphrase });
    const { validMasternodeListFullDF } = await rpc.checkSupernodeList();

    const closestSupernodes = await utils.getNClosestSupernodesToPastelIDURLs(
      120,
      pastelID,
      validMasternodeListFullDF
    );

    const allResponses: { response: CreditPack[]; url: string }[] = [];
    const nonEmptyResponses: { response: CreditPack[]; url: string }[] = [];
    let isResolved = false;

    await new Promise<void>((resolve) => {
      let completedRequests = 0;

      const handleResponse = () => {
        if (isResolved) return;

        if (nonEmptyResponses.length >= initialMinimumNonEmptyResponses) {
          browserLogger.info(
            `Received ${nonEmptyResponses.length} non-empty responses out of ${allResponses.length} total responses`
          );
          isResolved = true;
          resolve();
        } else if (allResponses.length >= maxTotalResponsesIfAllEmpty) {
          browserLogger.info(
            `Reached maximum total responses (${maxTotalResponsesIfAllEmpty}) with ${nonEmptyResponses.length} non-empty responses`
          );
          isResolved = true;
          resolve();
        } else if (completedRequests >= closestSupernodes.length) {
          browserLogger.warn(
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

            browserLogger.info(
              `Response received from supernode at ${url}; response length: ${response.length}`
            );
            allResponses.push({ response: response as unknown as CreditPack[], url });
            if (response.length > 0) {
              nonEmptyResponses.push({ response: response as unknown as CreditPack[], url });
            }
            completedRequests++;
            handleResponse();
          })
          .catch((error) => {
            if (isResolved) return;

            browserLogger.error(
              `Error querying supernode at ${url}: ${(error as Error).message}`
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
      browserLogger.info(
        `Returning longest non-empty response with length: ${longestResponse.length}`
      );
      return longestResponse;
    } else {
      browserLogger.info("All responses were empty. Returning empty list.");
      return [];
    }
  } catch (error) {
    browserLogger.error(
      `Error in getMyValidCreditPackTicketsEndToEnd: ${
        (error as Error).message
      }`
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
    const inferenceClient = new PastelInferenceClient({ pastelID, passphrase });
    const estimatedTotalCostOfTicket =
      await inferenceClient.internalEstimateOfCreditPackTicketCostInPSL(
        desiredNumberOfCredits,
        creditPriceCushionPercentage
      );
    return estimatedTotalCostOfTicket;
  } catch (error) {
    browserLogger.error(
      `Error in estimateCreditPackCostEndToEnd: ${(error as Error).message}`
    );
    throw error;
  }
}

type T = {
  [key: string]: string | number | boolean | bigint;
}

function safeStringify(obj: unknown, space = 2) {
  const seen = new WeakSet();

  const replacer = (key: string, value: T) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
      if (value.isJoi) {
        return `Joi Schema for ${value.type}`;
      }
      if (value instanceof Map) {
        return Array.from(value.entries());
      }
      if (value instanceof Set) {
        return Array.from(value);
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (value.constructor === Object) {
        const sortedObj: any = {};
        Object.keys(value)
          .sort()
          .forEach((key) => {
            sortedObj[key] = value[key];
          });
        return sortedObj;
      }
    } else if (typeof value === "bigint") {
      return `${value}`;
    }
    return value;
  };

  return JSON.stringify(obj, replacer, space);
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
    const inferenceClient = new PastelInferenceClient({ pastelID, passphrase });
    const modelParametersJSON = safeStringify(params.modelParameters);

    const supernodeURLs =
      await inferenceClient.getClosestSupernodeURLsThatSupportsDesiredModel(
        params.requestedModelCanonicalString,
        params.modelInferenceTypeString,
        modelParametersJSON,
        12
      );

    if (!supernodeURLs || supernodeURLs.length === 0) {
      console.error(
        `No supporting supernode found with adequate performance for the desired model: ${params.requestedModelCanonicalString} with inference type: ${params.modelInferenceTypeString}`
      );
      return null;
    }

    const maxTries = Math.min(5, supernodeURLs.length);

    for (let i = 0; i < maxTries; i++) {
      const supernodeURL = supernodeURLs[i];
      console.log(
        `Attempting inference request to Supernode URL: ${supernodeURL}`
      );

      try {
        const modelInputDataJSONBase64Encoded = btoa(JSON.stringify(params.modelInputData));
        const modelParametersJSONBase64Encoded = btoa(modelParametersJSON);

        const currentBlockHeight = await rpc.getCurrentPastelBlockHeight();
        const inferenceRequestData: InferenceAPIUsageRequest = {
          inference_request_id: uuidv4(),
          requesting_pastelid: pastelID,
          credit_pack_ticket_pastel_txid: params.creditPackTicketPastelTxid,
          requested_model_canonical_string: params.requestedModelCanonicalString,
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

        inferenceRequestData.sha3_256_hash_of_inference_request_fields =
          await utils.computeSHA3256HashOfSQLModelResponseFields(
            inferenceRequestData
          );
        inferenceRequestData.requesting_pastelid_signature_on_request_hash =
          await rpc.signMessageWithPastelID(
            pastelID,
            inferenceRequestData.sha3_256_hash_of_inference_request_fields,
            PastelIDType.PastelID
          );

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

        const inferenceRequestID = usageRequestResponse.inference_request_id;
        const inferenceResponseID = usageRequestResponse.inference_response_id;
        const proposedCostInCredits = parseFloat(
          usageRequestResponse.proposed_cost_of_request_in_inference_credits.toString()
        );
        const getAddress = async () => {
          return api.getMyPslAddressWithLargestBalance();
        }
        const creditUsageTrackingPSLAddress = await getAddress();
        const creditUsageTrackingAmountInPSL =
          parseFloat(
            usageRequestResponse.request_confirmation_message_amount_in_patoshis.toString()
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
          const burnAddress = await rpc.getBurnAddress();
          const trackingTransactionTxid =
            await rpc.sendTrackingAmountFromControlAddressToBurnAddressToConfirmInferenceRequest(
              inferenceRequestID,
              creditUsageTrackingPSLAddress,
              creditUsageTrackingAmountInPSL,
              burnAddress
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
            const initialWaitTimeInSeconds = 3;
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

                const inferenceResult: InferenceResult = {
                  supernode_url: supernodeURL,
                  request_data: inferenceRequestData,
                  usage_request_response: usageRequestResponse,
                  model_input_data_json: params.modelInputData,
                  output_results: outputResults,
                };

                if (params.modelInferenceTypeString === "text_to_image") {
                  const jsonString = atob(
                    outputResults.inference_result_json_base64
                  );
                  const jsonObject = JSON.parse(jsonString);
                  const imageBase64 = jsonObject.image;
                  inferenceResult.generated_image_decoded = atob(imageBase64);
                } else if (
                  params.modelInferenceTypeString === "embedding_document"
                ) {
                  const inferenceResultDecoded = atob(
                    outputResults.inference_result_json_base64
                  );
                  const zipBinary = atob(inferenceResultDecoded);
                  inferenceResult.zip_file_data = zipBinary;
                } else {
                  const inferenceResultDecoded = atob(
                    outputResults.inference_result_json_base64
                  );
                  console.log(`Decoded response:\n${inferenceResultDecoded}`);
                  inferenceResult.inference_result_decoded = inferenceResultDecoded;
                }

                const useAuditFeature = false;

                if (useAuditFeature) {
                  console.log(
                    "Waiting 3 seconds for audit results to be available..."
                  );
                  await new Promise((resolve) => setTimeout(resolve, 3000));

                  const auditResults =
                    await inferenceClient.auditInferenceRequestResponseID(
                      inferenceResponseID
                    );
                  const validationResults = utils.validateInferenceData(
                    inferenceResult,
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
                }

                return inferenceResult;
              } else {
                console.log("Inference results not available yet; retrying...");
              }
            }
          }
        } else {
          console.log(
            `Quoted price of ${proposedCostInCredits} credits exceeds the maximum allowed cost of ${params.maximumInferenceCostInCredits} credits. Inference request not confirmed.`
          );
        }
      } catch (err) {
        console.warn(
          `Failed inference request to Supernode URL ${supernodeURL}. Moving on to the next one. Error: ${(err as Error).message}`
        );
      }
    }

    console.error(
      `Failed to make inference request after ${maxTries} tries.`
    );
    return null;
  } catch (error) {
    console.error(
      `Error in handleInferenceRequestEndToEnd: ${(error as Error).message}`
    );
    throw error;
  }
}
