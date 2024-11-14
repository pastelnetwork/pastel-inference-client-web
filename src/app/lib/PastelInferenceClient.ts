// src/app/lib/PastelInferenceClient.ts

'use client';

import { v4 as uuidv4 } from 'uuid';

import BrowserRPCReplacement from "./BrowserRPCReplacement";
import { BrowserDatabase } from "./BrowserDatabase";
import * as utils from "./utils";
import * as validationSchemas from "./validationSchemas";
import browserLogger from "@/app/lib/logger";
import {
  PastelIDType,
  PastelInferenceClientConfig,
  ChallengeResponse,
  UserMessage,
  ModelMenu,
  SupernodeResponse,
  ValidCreditPackTicket,
  BalanceInfo,
  CreditPackTicketInfo,
  CreditPackPurchaseRequest,
  PreliminaryPriceQuote,
  CreditPackPurchaseRequestResponse,
  CreditPackPurchaseRequestConfirmation,
  CreditPackStorageRetryRequest,
  CreditPackStorageRetryRequestResponse,
  CreditPackPurchaseRequestConfirmationResponse,
  CreditPackRequestStatusCheck,
  CreditPackPurchaseRequestStatus,
  InferenceRequestData,
  InferenceAPIUsageResponse,
  InferenceAPIOutputResult,
  InferenceConfirmationData,
  CreditPackPurchaseRequestRejection,
  CreditPackPurchaseRequestResponseTermination,
  AuditResult,
} from "@/app/types";

const db = BrowserDatabase.getInstance();

class PastelInferenceClient {
  private pastelID: string;
  private passphrase: string;
  private rpc: BrowserRPCReplacement;

  constructor(config: PastelInferenceClientConfig) {
    this.pastelID = config.pastelID;
    this.passphrase = config.passphrase;
    this.rpc = BrowserRPCReplacement.getInstance();
  }

  public getPastelID(): string {
    return this.pastelID;
  }

  private async requestAndSignChallenge(
    supernodeURL: string
  ): Promise<ChallengeResponse> {
    try {
      const response = await fetch(
        `${supernodeURL}/request_challenge/${this.pastelID}`
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const { challenge, challenge_id } = await response.json();
      const challenge_signature = await this.rpc.signMessageWithPastelID(
        this.pastelID,
        challenge,
        PastelIDType.PastelID
      );
      return {
        challenge,
        challenge_id,
        challenge_signature,
      };
    } catch (error) {
      browserLogger.error(
        `Error requesting and signing challenge: ${utils.safeStringify(error)}`
      );
      throw error;
    }
  }

  async sendUserMessage(
    supernodeURL: string,
    userMessage: UserMessage
  ): Promise<UserMessage> {
    try {
      const validationResult =
        validationSchemas.userMessageSchema.safeParse(userMessage);
      if (!validationResult.success) {
        throw new Error(
          `Invalid user message: ${validationResult.error.message}`
        );
      }
      const { challenge, challenge_id, challenge_signature } =
        await this.requestAndSignChallenge(supernodeURL);

      const payload = userMessage;
      const response = await fetch(`${supernodeURL}/send_user_message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_message: payload,
          challenge,
          challenge_id,
          challenge_signature,
        }),
      });
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      const validatedResult = validationSchemas.userMessageSchema.parse(result);
      await db.addData("UserMessage", validatedResult);
      return validatedResult;
    } catch (error) {
      console.error(
        `Error sending user message: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  async getUserMessages(supernodeURL: string): Promise<UserMessage[]> {
    try {
      const { challenge, challenge_id, challenge_signature } =
        await this.requestAndSignChallenge(supernodeURL);
      const params = new URLSearchParams({
        pastelid: this.pastelID,
        challenge,
        challenge_id,
        challenge_signature,
      });
      const response = await fetch(
        `${supernodeURL}/get_user_messages?${params}`
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      const validatedResults = result.map((messageData: unknown) =>
        validationSchemas.userMessageSchema.parse(messageData)
      );
      await Promise.all(
        validatedResults.map((message: UserMessage) =>
          db.addData("UserMessage", message)
        )
      );
      return validatedResults;
    } catch (error) {
      console.error(
        `Error retrieving user messages: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  async getModelMenu(): Promise<ModelMenu> {
    const minimumNumberOfResponses = 5;
    const retryLimit = 1;
    try {
      const { validMasternodeListFullDF } = await this.rpc.checkSupernodeList();
      const closestSupernodes = await utils.getNClosestSupernodesToPastelIDURLs(
        60,
        this.pastelID,
        validMasternodeListFullDF
      );
      const validResponses: SupernodeResponse[] = [];

      await new Promise<void>((resolve, reject) => {
        let completedRequests = 0;
        closestSupernodes.forEach(({ url }) => {
          this.retryPromise(
            () => this.getModelMenuFromSupernode(url),
            retryLimit
          )
            .then((response) => {
              console.info(
                `Successful model menu response received from supernode at ${url}`
              );
              validResponses.push({ response, url });
              if (validResponses.length >= minimumNumberOfResponses) {
                resolve();
              }
            })
            .catch((error) => {
              console.error(
                `Error querying supernode at ${url}: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
              completedRequests++;
              if (
                completedRequests >
                closestSupernodes.length -
                  minimumNumberOfResponses +
                  validResponses.length
              ) {
                reject(
                  new Error(
                    "Insufficient valid responses received from supernodes"
                  )
                );
              }
            });
        });
      });

      const largestResponse = validResponses.reduce((prev, current) => {
        return JSON.stringify(current.response).length >
          JSON.stringify(prev.response).length
          ? current
          : prev;
      }).response as ModelMenu;

      return largestResponse;
    } catch (error) {
      console.error(
        `Error in getModelMenu: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  private async getModelMenuFromSupernode(
    supernodeURL: string
  ): Promise<ModelMenu | null> {
    try {
      const response = await fetch(`${supernodeURL}/get_inference_model_menu`);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch {
      return null;
    }
  }

  private async retryPromise<T>(
    promiseFunc: () => Promise<T>,
    limit: number,
    count = 0
  ): Promise<T> {
    try {
      return await promiseFunc();
    } catch (error) {
      if (count < limit) {
        return this.retryPromise(promiseFunc, limit, count + 1);
      } else {
        throw error;
      }
    }
  }

  async getValidCreditPackTicketsForPastelID(
    supernodeURL: string
  ): Promise<ValidCreditPackTicket[]> {
    const useVerbose = false;
    try {
      if (!this.pastelID) {
        return [];
      }
      const { challenge, challenge_id, challenge_signature } =
        await this.requestAndSignChallenge(supernodeURL);
      const payload = {
        pastelid: this.pastelID,
        challenge,
        challenge_id,
        challenge_signature,
      };
      if (useVerbose) {
        utils.logActionWithPayload(
          "retrieving",
          "valid credit pack tickets for PastelID",
          payload
        );
      }
      const response = await fetch(
        `${supernodeURL}/get_valid_credit_pack_tickets_for_pastelid`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        if (useVerbose) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return [];
      }
      const validCreditPackTickets: ValidCreditPackTicket[] =
        await response.json();
      if (useVerbose && validCreditPackTickets.length) {
        console.info(
          `Received ${validCreditPackTickets.length} valid credit pack tickets for PastelID ${this.pastelID}`
        );
      }

      return validCreditPackTickets;
    } catch (error) {
      if (useVerbose) {
        console.error(
          `Error retrieving valid credit pack tickets for PastelID: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      if (useVerbose) {
        throw error;
      }
      return [];
    }
  }

  async checkCreditPackBalance(
    supernodeURL: string,
    txid: string
  ): Promise<BalanceInfo> {
    try {
      const { challenge, challenge_id, challenge_signature } =
        await this.requestAndSignChallenge(supernodeURL);
      const payload = {
        credit_pack_ticket_txid: txid,
        challenge,
        challenge_id,
        challenge_signature,
      };
      utils.logActionWithPayload("checking", "credit pack balance", payload);

      const response = await fetch(
        `${supernodeURL}/check_credit_pack_balance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const balanceInfo: BalanceInfo = await response.json();
      console.info(
        `Received credit pack balance info for txid ${txid}: ${JSON.stringify(
          balanceInfo
        )}`
      );
      return balanceInfo;
    } catch (error) {
      console.error(
        `Error checking credit pack balance for txid ${txid}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  async getCreditPackTicketFromTxid(
    supernodeURL: string,
    txid: string
  ): Promise<CreditPackTicketInfo> {
    try {
      const { challenge, challenge_id, challenge_signature } =
        await this.requestAndSignChallenge(supernodeURL);
      const params = new URLSearchParams({
        txid,
        pastelid: this.pastelID,
        challenge,
        challenge_id,
        challenge_signature,
      });
      utils.logActionWithPayload(
        "retrieving",
        "credit pack ticket from txid",
        params
      );

      const response = await fetch(
        `${supernodeURL}/get_credit_pack_ticket_from_txid?${params}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const {
        credit_pack_purchase_request_response,
        credit_pack_purchase_request_confirmation,
      } = await response.json();

      utils.logActionWithPayload(
        "received",
        "credit pack ticket from Supernode",
        {
          credit_pack_purchase_request_response,
          credit_pack_purchase_request_confirmation,
        }
      );

      const validatedRequestResponse =
        validationSchemas.creditPackPurchaseRequestResponseSchema.parse(
          credit_pack_purchase_request_response
        );
      const validatedRequestConfirmation =
        validationSchemas.creditPackPurchaseRequestConfirmationSchema.parse(
          credit_pack_purchase_request_confirmation
        );

      return {
        requestResponse: validatedRequestResponse,
        requestConfirmation: {
          ...validatedRequestConfirmation,
          id: parseInt(validatedRequestConfirmation.id, 10),
        },
        balanceInfo: {
          credit_pack_current_credit_balance: 0,
          balance_as_of_datetime: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error(
        `Error retrieving credit pack ticket from txid: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  async creditPackTicketInitialPurchaseRequest(
    supernodeURL: string,
    creditPackRequest: CreditPackPurchaseRequest,
    callback: (value: string) => void,
  ): Promise<PreliminaryPriceQuote | CreditPackPurchaseRequestRejection> {
    try {
      const validatedCreditPackRequest =
        validationSchemas.creditPackPurchaseRequestSchema.parse(
          creditPackRequest
        );
      await db.saveData("CreditPackPurchaseRequest", validatedCreditPackRequest);
      callback(JSON.stringify({ message: `Now requesting a new Pastel credit pack ticket with payload:\n${utils.formattedPayload(validatedCreditPackRequest)}` }))
      utils.logActionWithPayload(
        "requesting",
        "a new Pastel credit pack ticket",
        validatedCreditPackRequest
      );
      const { challenge, challenge_id, challenge_signature } =
        await this.requestAndSignChallenge(supernodeURL);
      const preparedCreditPackRequest = await utils.prepareModelForEndpoint(
        validatedCreditPackRequest
      );
      const response = await fetch(
        `${supernodeURL}/credit_purchase_initial_request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            challenge,
            challenge_id,
            challenge_signature,
            credit_pack_request: preparedCreditPackRequest,
          }),
        }
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();

      if ("rejection_reason_string" in result) {
        callback(JSON.stringify({ message: `Credit pack purchase request rejected: ${result.rejection_reason_string}` }))
        console.error(
          `Credit pack purchase request rejected: ${result.rejection_reason_string}`
        );
        const rejectionResponse = await utils.prepareModelForValidation(result);
        const validatedRejection =
          validationSchemas.creditPackPurchaseRequestRejectionSchema.parse(
            rejectionResponse
          );
        await db.saveData(
          "CreditPackPurchaseRequestRejection",
          validatedRejection
        );
        return validatedRejection;
      } else {
        callback(JSON.stringify({ message: `Now receiving response to credit pack purchase request with payload:\n${utils.formattedPayload(result)}` }))
        utils.logActionWithPayload(
          "receiving",
          "response to credit pack purchase request",
          result
        );
        const preparedResult = await utils.prepareModelForValidation(result);
        const validatedPriceQuote =
          validationSchemas.creditPackPurchaseRequestPreliminaryPriceQuoteSchema.parse(
            preparedResult
          );
        await db.saveData(
          "CreditPackPurchaseRequestPreliminaryPriceQuote",
          validatedPriceQuote
        );
        return validatedPriceQuote;
      }
    } catch (error) {
      callback(JSON.stringify({ message: `Error initiating credit pack ticket purchase: ${utils.safeStringify(
        error
      )}` }))
      console.error(
        `Error initiating credit pack ticket purchase: ${utils.safeStringify(
          error
        )}`
      );
      throw error;
    }
  }

  private async calculatePriceDifferencePercentage(
    quotedPrice: number,
    estimatedPrice: number
  ): Promise<number> {
    if (estimatedPrice === 0) {
      throw new Error("Estimated price cannot be zero.");
    }
    return Math.abs(quotedPrice - estimatedPrice) / estimatedPrice;
  }

  async confirmPreliminaryPriceQuote(
    preliminaryPriceQuote: PreliminaryPriceQuote,
    maximumTotalCreditPackPriceInPSL: number,
    maximumPerCreditPriceInPSL: number,
    callback: (value: string) => void
  ): Promise<boolean> {
    if (!maximumTotalCreditPackPriceInPSL && !maximumPerCreditPriceInPSL) {
      maximumPerCreditPriceInPSL = parseFloat(
        localStorage.getItem("MAXIMUM_PER_CREDIT_PRICE_IN_PSL_FOR_CLIENT") ||
          "100.0"
      );
    }
    const {
      preliminary_quoted_price_per_credit_in_psl: quotedPricePerCredit,
      preliminary_total_cost_of_credit_pack_in_psl: quotedTotalPrice,
      credit_pack_purchase_request_fields_json_b64: requestFieldsB64,
    } = preliminaryPriceQuote;
    const requestFields = JSON.parse(atob(requestFieldsB64));
    const { requested_initial_credits_in_credit_pack: requestedCredits } =
      requestFields;
    if (!maximumTotalCreditPackPriceInPSL) {
      maximumTotalCreditPackPriceInPSL =
        maximumPerCreditPriceInPSL * requestedCredits;
    } else if (!maximumPerCreditPriceInPSL) {
      maximumPerCreditPriceInPSL =
        maximumTotalCreditPackPriceInPSL / requestedCredits;
    }
    const estimatedPricePerCredit =
      await utils.estimatedMarketPriceOfInferenceCreditsInPSLTerms();
    const priceDifferencePercentage =
      await this.calculatePriceDifferencePercentage(
        quotedPricePerCredit,
        estimatedPricePerCredit
      );

    const MAXIMUM_LOCAL_CREDIT_PRICE_DIFFERENCE_TO_ACCEPT_CREDIT_PRICING =
      parseFloat(
        localStorage.getItem(
          "MAXIMUM_LOCAL_CREDIT_PRICE_DIFFERENCE_TO_ACCEPT_CREDIT_PRICING"
        ) || "0.05"
      );

    const numberFormat = new Intl.NumberFormat("en-US");
    const percentageFormat = (value: number) => value.toFixed(2);

    if (
      quotedPricePerCredit <= maximumPerCreditPriceInPSL &&
      quotedTotalPrice <= maximumTotalCreditPackPriceInPSL &&
      priceDifferencePercentage <=
        MAXIMUM_LOCAL_CREDIT_PRICE_DIFFERENCE_TO_ACCEPT_CREDIT_PRICING
    ) {
      callback(JSON.stringify({ message: `Preliminary price quote is within the acceptable range: ${numberFormat.format(
        quotedPricePerCredit
      )} PSL per credit, ${numberFormat.format(
        quotedTotalPrice
      )} PSL total, which is within the maximum of ${numberFormat.format(
        maximumPerCreditPriceInPSL
      )} PSL per credit and ${numberFormat.format(
        maximumTotalCreditPackPriceInPSL
      )} PSL total. The price difference from the estimated fair market price is ${percentageFormat(
        priceDifferencePercentage * 100
      )}%, which is within the allowed maximum of ${percentageFormat(
        MAXIMUM_LOCAL_CREDIT_PRICE_DIFFERENCE_TO_ACCEPT_CREDIT_PRICING * 100
      )}%. Please be patient while the new credit pack request is initialized.` }))
      console.info(
        `Preliminary price quote is within the acceptable range: ${numberFormat.format(
          quotedPricePerCredit
        )} PSL per credit, ${numberFormat.format(
          quotedTotalPrice
        )} PSL total, which is within the maximum of ${numberFormat.format(
          maximumPerCreditPriceInPSL
        )} PSL per credit and ${numberFormat.format(
          maximumTotalCreditPackPriceInPSL
        )} PSL total. The price difference from the estimated fair market price is ${percentageFormat(
          priceDifferencePercentage * 100
        )}%, which is within the allowed maximum of ${percentageFormat(
          MAXIMUM_LOCAL_CREDIT_PRICE_DIFFERENCE_TO_ACCEPT_CREDIT_PRICING * 100
        )}%. Please be patient while the new credit pack request is initialized.`
      );
      return true;
    } else {
      callback(JSON.stringify({ message: `Preliminary price quote exceeds the maximum acceptable price or the price difference from the estimated fair price is too high! Quoted price: ${numberFormat.format(
        quotedPricePerCredit
      )} PSL per credit, ${numberFormat.format(
        quotedTotalPrice
      )} PSL total, maximum price: ${numberFormat.format(
        maximumPerCreditPriceInPSL
      )} PSL per credit, ${numberFormat.format(
        maximumTotalCreditPackPriceInPSL
      )} PSL total. The price difference from the estimated fair market price is ${percentageFormat(
        priceDifferencePercentage * 100
      )}%, which exceeds the allowed maximum of ${percentageFormat(
        MAXIMUM_LOCAL_CREDIT_PRICE_DIFFERENCE_TO_ACCEPT_CREDIT_PRICING * 100
      )}%.` }))
      console.warn(
        `Preliminary price quote exceeds the maximum acceptable price or the price difference from the estimated fair price is too high! Quoted price: ${numberFormat.format(
          quotedPricePerCredit
        )} PSL per credit, ${numberFormat.format(
          quotedTotalPrice
        )} PSL total, maximum price: ${numberFormat.format(
          maximumPerCreditPriceInPSL
        )} PSL per credit, ${numberFormat.format(
          maximumTotalCreditPackPriceInPSL
        )} PSL total. The price difference from the estimated fair market price is ${percentageFormat(
          priceDifferencePercentage * 100
        )}%, which exceeds the allowed maximum of ${percentageFormat(
          MAXIMUM_LOCAL_CREDIT_PRICE_DIFFERENCE_TO_ACCEPT_CREDIT_PRICING * 100
        )}%.`
      );
      return false;
    }
  }

  async internalEstimateOfCreditPackTicketCostInPSL(
    desiredNumberOfCredits: number,
    priceCushionPercentage: number
  ): Promise<number> {
    const estimatedPricePerCredit =
      await utils.estimatedMarketPriceOfInferenceCreditsInPSLTerms();
    return (
      Math.round(
        desiredNumberOfCredits *
          estimatedPricePerCredit *
          (1 + priceCushionPercentage) *
          100
      ) / 100
    );
  }

  async creditPackTicketPreliminaryPriceQuoteResponse(
    supernodeURL: string,
    creditPackRequest: CreditPackPurchaseRequest,
    preliminaryPriceQuote: PreliminaryPriceQuote,
    maximumTotalCreditPackPriceInPSL: number,
    maximumPerCreditPriceInPSL: number,
    callback: (value: string) => void
  ): Promise<
    | CreditPackPurchaseRequestResponse
    | CreditPackPurchaseRequestResponseTermination
  > {
    try {
      if ("rejection_reason_string" in preliminaryPriceQuote) {
        callback(JSON.stringify({ message: `Credit pack purchase request rejected: ${preliminaryPriceQuote.rejection_reason_string}` }))
        console.error(
          `Credit pack purchase request rejected: ${preliminaryPriceQuote.rejection_reason_string}`
        );
        return preliminaryPriceQuote as unknown as CreditPackPurchaseRequestResponseTermination;
      }

      const agreeWithPriceQuote = await this.confirmPreliminaryPriceQuote(
        preliminaryPriceQuote,
        maximumTotalCreditPackPriceInPSL,
        maximumPerCreditPriceInPSL,
        callback
      );
      if (agreeWithPriceQuote) {
        callback(JSON.stringify({ message: `Agree with price quote: ${agreeWithPriceQuote}; responding to preliminary price quote to Supernode at ${supernodeURL}...` }))
      }
      console.info(
        `Agree with price quote: ${agreeWithPriceQuote}; responding to preliminary price quote to Supernode at ${supernodeURL}...`
      );
      const priceQuoteResponse = {
        sha3_256_hash_of_credit_pack_purchase_request_fields:
          creditPackRequest.sha3_256_hash_of_credit_pack_purchase_request_fields,
        sha3_256_hash_of_credit_pack_purchase_request_preliminary_price_quote_fields:
          preliminaryPriceQuote.sha3_256_hash_of_credit_pack_purchase_request_preliminary_price_quote_fields,
        credit_pack_purchase_request_fields_json_b64:
          preliminaryPriceQuote.credit_pack_purchase_request_fields_json_b64,
        agree_with_preliminary_price_quote: agreeWithPriceQuote,
        credit_usage_tracking_psl_address:
          preliminaryPriceQuote.credit_usage_tracking_psl_address,
        preliminary_quoted_price_per_credit_in_psl: parseFloat(
          preliminaryPriceQuote.preliminary_quoted_price_per_credit_in_psl.toString()
        ),
        preliminary_price_quote_response_timestamp_utc_iso_string:
          new Date().toISOString(),
        preliminary_price_quote_response_pastel_block_height:
          await this.rpc.getCurrentPastelBlockHeight(),
        preliminary_price_quote_response_message_version_string: "1.0",
        requesting_end_user_pastelid:
          creditPackRequest.requesting_end_user_pastelid,
        sha3_256_hash_of_credit_pack_purchase_request_preliminary_price_quote_response_fields:
          "",
        requesting_end_user_pastelid_signature_on_preliminary_price_quote_response_hash:
          "",
        id: uuidv4(),
      };

      priceQuoteResponse.sha3_256_hash_of_credit_pack_purchase_request_preliminary_price_quote_response_fields =
        await utils.computeSHA3256HashOfSQLModelResponseFields(
          priceQuoteResponse
        );
      priceQuoteResponse.requesting_end_user_pastelid_signature_on_preliminary_price_quote_response_hash =
        await this.rpc.signMessageWithPastelID(
          creditPackRequest.requesting_end_user_pastelid,
          priceQuoteResponse.sha3_256_hash_of_credit_pack_purchase_request_preliminary_price_quote_response_fields,
          PastelIDType.PastelID
        );

      const validatedPriceQuoteResponse =
        validationSchemas.creditPackPurchaseRequestPreliminaryPriceQuoteResponseSchema.parse(
          priceQuoteResponse
        );

      const preparedPriceQuoteResponse = await utils.prepareModelForEndpoint(
        validatedPriceQuoteResponse
      );

      delete preparedPriceQuoteResponse.id;
      preparedPriceQuoteResponse.agree_with_preliminary_price_quote =
        preparedPriceQuoteResponse.agree_with_preliminary_price_quote ? 1 : 0;

      const { challenge, challenge_id, challenge_signature } =
        await this.requestAndSignChallenge(supernodeURL);
      const completePriceQuoteResponse = {
        challenge,
        challenge_id,
        challenge_signature,
        preliminary_price_quote_response: preparedPriceQuoteResponse,
      };

      const response = await fetch(
        `${supernodeURL}/credit_purchase_preliminary_price_quote_response`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(completePriceQuoteResponse),
        }
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();

      if ("termination_reason_string" in result) {
        callback(JSON.stringify({ message: `Credit pack purchase request response terminated: ${result.termination_reason_string}` }))
        console.error(
          `Credit pack purchase request response terminated: ${result.termination_reason_string}`
        );
        const terminationResponse = await utils.prepareModelForValidation(
          result
        );
        const validatedTermination =
          validationSchemas.creditPackPurchaseRequestResponseTerminationSchema.parse(
            terminationResponse
          );
        await db.addData(
          "CreditPackPurchaseRequestResponseTermination",
          validatedTermination
        );
        return validatedTermination;
      } else {
        const transformedResult =
          utils.transformCreditPackPurchaseRequestResponse(
            await utils.prepareModelForValidation(result)
          );
        callback(JSON.stringify({ message: `Now receiving response to credit pack purchase request with payload:\n${utils.formattedPayload(transformedResult)}` }))
        utils.logActionWithPayload(
          "receiving",
          "response to credit pack purchase request",
          transformedResult
        );
        const validatedResponse =
          validationSchemas.creditPackPurchaseRequestResponseSchema.parse(
            transformedResult as CreditPackPurchaseRequestResponse
          );
        await db.addData(
          "CreditPackPurchaseRequestResponse",
          validatedResponse
        );
        return validatedResponse;
      }
    } catch (error) {
      callback(JSON.stringify({ message: `Error responding to preliminary price quote: ${utils.safeStringify(
        error
      )}` }))
      console.error(
        `Error responding to preliminary price quote: ${utils.safeStringify(
          error
        )}`
      );
      throw error;
    }
  }

  async confirmCreditPurchaseRequest(
    supernodeURL: string,
    creditPackPurchaseRequestConfirmation: CreditPackPurchaseRequestConfirmation,
    callback: (value: string) => void
  ): Promise<CreditPackPurchaseRequestConfirmationResponse> {
    try {
      const { challenge, challenge_id, challenge_signature } =
        await this.requestAndSignChallenge(supernodeURL);
      const payload = await utils.prepareModelForEndpoint(
        creditPackPurchaseRequestConfirmation
      );
      callback(JSON.stringify({ message: `Now confirming credit pack purchase request with payload:\n${utils.formattedPayload(payload)}` }))
      utils.logActionWithPayload(
        "confirming",
        "credit pack purchase request",
        payload
      );
      const response = await fetch(
        `${supernodeURL}/confirm_credit_purchase_request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmation: payload,
            challenge,
            challenge_id,
            challenge_signature,
          }),
        }
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      callback(JSON.stringify({ message: `Now receiving response to credit pack purchase confirmation with payload:\n${utils.formattedPayload(result)}` }))
      utils.logActionWithPayload(
        "receiving",
        "response to credit pack purchase confirmation",
        result
      );
      const validatedResult =
        validationSchemas.creditPackPurchaseRequestConfirmationResponseSchema.parse(
          result
        );
      await db.addData(
        "CreditPackPurchaseRequestConfirmationResponse",
        validatedResult
      );
      return validatedResult as CreditPackPurchaseRequestConfirmationResponse;
    } catch (error) {
      callback(JSON.stringify({ message: `Error confirming credit pack purchase request: ${utils.safeStringify(
        error
      )}` }))
      console.error(
        `Error confirming credit pack purchase request: ${utils.safeStringify(
          error
        )}`
      );
      throw error;
    }
  }

  async checkStatusOfCreditPurchaseRequest(
    supernodeURL: string,
    creditPackPurchaseRequestHash: string,
    callback: (value: string) => void
  ): Promise<CreditPackPurchaseRequestStatus> {
    try {
      const { challenge, challenge_id, challenge_signature } =
        await this.requestAndSignChallenge(supernodeURL);
      const statusCheck = {
        sha3_256_hash_of_credit_pack_purchase_request_fields:
          creditPackPurchaseRequestHash,
        requesting_end_user_pastelid: this.pastelID,
        requesting_end_user_pastelid_signature_on_sha3_256_hash_of_credit_pack_purchase_request_fields:
          await this.rpc.signMessageWithPastelID(
            this.pastelID,
            creditPackPurchaseRequestHash,
            PastelIDType.PastelID
          ),
        id: uuidv4(),
      };
      const validatedStatusCheck =
        validationSchemas.creditPackRequestStatusCheckSchema.parse(statusCheck);
      delete (validatedStatusCheck as Partial<CreditPackRequestStatusCheck>).id;
      callback(JSON.stringify({ message: `Now checking status of credit pack purchase request with payload:\n${utils.formattedPayload(validatedStatusCheck)}` }))
      utils.logActionWithPayload(
        "checking",
        "status of credit pack purchase request",
        validatedStatusCheck
      );
      const response = await fetch(
        `${supernodeURL}/check_status_of_credit_purchase_request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            credit_pack_request_status_check: validatedStatusCheck,
            challenge,
            challenge_id,
            challenge_signature,
          }),
        }
      );
      if (!response.ok) {
        throw new Error(
          `HTTP error ${response.status}: ${response.statusText}`
        );
      }
      const responseData = await response.json();
      callback(JSON.stringify({ message: `Now receiving credit pack purchase request response from Supernode with payload:\n${utils.formattedPayload(responseData)}` }))
      utils.logActionWithPayload(
        "receiving",
        "credit pack purchase request response from Supernode",
        responseData
      );
      const transformedResult = await utils.prepareModelForValidation(
        responseData
      );
      delete (transformedResult as Partial<InferenceAPIUsageResponse>).id;
      const validatedResult =
        validationSchemas.creditPackPurchaseRequestStatusSchema.parse(
          transformedResult
        );
      await db.addData("CreditPackPurchaseRequestStatus", validatedResult);
      return validatedResult;
    } catch (error) {
      callback(JSON.stringify({ message: `Error checking status of credit purchase request: ${utils.safeStringify(
        error
      )}` }))
      console.error(
        `Error checking status of credit purchase request: ${utils.safeStringify(
          error
        )}`
      );
      throw error;
    }
  }

  async creditPackPurchaseCompletionAnnouncement(
    supernodeURL: string,
    creditPackPurchaseRequestConfirmation: CreditPackPurchaseRequestConfirmation
  ): Promise<void> {
    try {
      const validatedConfirmation =
        validationSchemas.creditPackPurchaseRequestConfirmationSchema.parse(
          creditPackPurchaseRequestConfirmation
        );

      await db.addData(
        "CreditPackPurchaseRequestConfirmation",
        validatedConfirmation
      );

      const { challenge, challenge_id, challenge_signature } =
        await this.requestAndSignChallenge(supernodeURL);

      const payload = { ...validatedConfirmation };
      delete (payload as Partial<typeof validatedConfirmation>).id;

      const response = await fetch(
        `${supernodeURL}/credit_pack_purchase_completion_announcement`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmation: payload,
            challenge,
            challenge_id,
            challenge_signature,
          }),
        }
      );
      if (!response.ok) {
        console.error(`HTTP error ${response.status}: ${response.statusText}`);
      } else {
        console.info(
          `Credit pack purchase completion announcement sent successfully to ${supernodeURL}`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error(
          `Timeout error sending credit pack purchase completion announcement to ${supernodeURL}: ${error.message}`
        );
      } else {
        console.error(
          `Error sending credit pack purchase completion announcement to ${supernodeURL}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }

  async creditPackStorageRetryRequest(
    supernodeURL: string,
    creditPackStorageRetryRequest: CreditPackStorageRetryRequest,
    callback: (value: string) => void
  ): Promise<CreditPackStorageRetryRequestResponse> {
    try {
      const validatedRequest =
        validationSchemas.creditPackStorageRetryRequestSchema.parse(
          creditPackStorageRetryRequest
        );

      await db.addData("CreditPackStorageRetryRequest", validatedRequest);

      const { challenge, challenge_id, challenge_signature } =
        await this.requestAndSignChallenge(supernodeURL);

      const payload = await utils.prepareModelForEndpoint(validatedRequest);
      callback(JSON.stringify({ message: `Now sending credit pack storage retry request with payload:\n${utils.formattedPayload(payload)}` }))
      utils.logActionWithPayload(
        "sending",
        "credit pack storage retry request",
        payload
      );

      const response = await fetch(
        `${supernodeURL}/credit_pack_storage_retry_request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request: payload,
            challenge,
            challenge_id,
            challenge_signature,
          }),
        }
      );

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      callback(JSON.stringify({ message: `Now receiving response to credit pack storage retry request with payload:\n${utils.formattedPayload(result)}` }))
      utils.logActionWithPayload(
        "receiving",
        "response to credit pack storage retry request",
        result
      );

      const transformedResult = await utils.prepareModelForValidation(
        result
      );
      const validatedResponse =
        validationSchemas.creditPackStorageRetryRequestResponseSchema.parse(
          transformedResult
        );

      await db.addData(
        "CreditPackStorageRetryRequestResponse",
        validatedResponse
      );
      return validatedResponse;
    } catch (error) {
      callback(JSON.stringify({ message: `Error sending credit pack storage retry request: ${utils.safeStringify(
        error
      )}` }))
      console.error(
        `Error sending credit pack storage retry request: ${utils.safeStringify(
          error
        )}`
      );
      throw error;
    }
  }

  async creditPackStorageRetryCompletionAnnouncement(
    supernodeURL: string,
    creditPackStorageRetryRequestResponse: CreditPackStorageRetryRequestResponse
  ): Promise<void> {
    try {
      const validatedResponse =
        validationSchemas.creditPackStorageRetryRequestResponseSchema.parse(
          creditPackStorageRetryRequestResponse
        );

      await db.addData(
        "CreditPackStorageRetryRequestResponse",
        validatedResponse
      );

      const { challenge, challenge_id, challenge_signature } =
        await this.requestAndSignChallenge(supernodeURL);

      const payload = await utils.prepareModelForEndpoint(
        validatedResponse
      );
      utils.logActionWithPayload(
        "sending",
        "storage retry completion announcement message",
        payload
      );

      const response = await fetch(
        `${supernodeURL}/credit_pack_storage_retry_completion_announcement`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            response: payload,
            challenge,
            challenge_id,
            challenge_signature,
          }),
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error(
        `Error sending credit pack storage retry completion announcement: ${utils.safeStringify(
          error
        )}`
      );
      throw error;
    }
  }

  async retrieveCreditPackTicketFromPurchaseBurnTxid(
    supernodeURL: string,
    txid: string
  ): Promise<unknown> {
    try {
      const { challenge, challenge_id, challenge_signature } =
        await this.requestAndSignChallenge(supernodeURL);
      const payload = {
        purchase_burn_txid: txid,
        challenge,
        challenge_id,
        challenge_signature,
      };
      utils.logActionWithPayload(
        "retrieving",
        "credit pack ticket from purchase burn txid",
        payload
      );

      const response = await fetch(
        `${supernodeURL}/retrieve_credit_pack_ticket_from_purchase_burn_txid`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);

      const ticketInfo = await response.json();
      console.info(
        `Received credit pack ticket for purchase burn txid ${txid}: ${JSON.stringify(
          ticketInfo
        )}`
      );
      return ticketInfo;
    } catch (error) {
      console.error(
        `Error retrieving credit pack ticket for purchase burn txid ${txid}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  async getFinalCreditPackRegistrationTxidFromPurchaseBurnTxid(
    supernodeURL: string,
    purchaseBurnTxid: string
  ): Promise<string> {
    try {
      const { challenge, challenge_id, challenge_signature } =
        await this.requestAndSignChallenge(supernodeURL);
      const payload = {
        purchase_burn_txid: purchaseBurnTxid,
        challenge,
        challenge_id,
        challenge_signature,
      };
      utils.logActionWithPayload(
        "retrieving",
        "final credit pack registration txid",
        payload
      );

      const response = await fetch(
        `${supernodeURL}/get_final_credit_pack_registration_txid_from_credit_purchase_burn_txid`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);

      const responseData = await response.json();
      const finalTxid = responseData.final_credit_pack_registration_txid;
      console.info(
        `Received final credit pack registration txid for purchase burn txid ${purchaseBurnTxid}: ${finalTxid}`
      );
      return finalTxid;
    } catch (error) {
      console.error(
        `Error retrieving final credit pack registration txid for purchase burn txid ${purchaseBurnTxid}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  async makeInferenceAPIUsageRequest(
    supernodeURL: string,
    requestData: InferenceRequestData,
    callback: (value: string) => void
  ): Promise<InferenceAPIUsageResponse> {
    try {
      const validatedRequest =
        validationSchemas.inferenceAPIUsageRequestSchema.parse(requestData);
      delete (validatedRequest as Partial<InferenceRequestData>).id;
      await db.addData("InferenceAPIUsageRequest", validatedRequest);
      const { challenge, challenge_id, challenge_signature } =
        await this.requestAndSignChallenge(supernodeURL);
      utils.logActionWithPayload(
        "making",
        "inference usage request",
        validatedRequest
      );
      callback(JSON.stringify({ message: `Now making inference usage request with payload:\n${utils.formattedPayload(validatedRequest)}` }))
      const response = await fetch(
        `${supernodeURL}/make_inference_api_usage_request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inference_api_usage_request: validatedRequest,
            challenge,
            challenge_id,
            challenge_signature,
          }),
        }
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      utils.logActionWithPayload(
        "received",
        "response to inference usage request",
        result
      );
      callback(JSON.stringify({ message: `Now received response to inference usage request with payload:\n${utils.formattedPayload(result)}` }))
      const transformedResult = await utils.prepareModelForValidation(result);
      delete (transformedResult as Partial<InferenceAPIUsageResponse>).id;
      const validatedResponse =
        validationSchemas.inferenceAPIUsageResponseSchema.parse(
          transformedResult
        );
      await db.addData("InferenceAPIUsageResponse", validatedResponse);
      return validatedResponse;
    } catch (error) {
      callback(JSON.stringify({ message: `Error making inference API usage request: ${utils.safeStringify(
        error
      )}` }))
      console.error(
        `Error making inference API usage request: ${utils.safeStringify(
          error
        )}`
      );
      throw error;
    }
  }

  async sendInferenceConfirmation(
    supernodeURL: string,
    confirmationData: InferenceConfirmationData,
    callback: (value: string) => void
  ): Promise<unknown> {
    try {
      const confirmationDataJSON = { ...confirmationData };
      delete (confirmationDataJSON as Partial<InferenceConfirmationData>).id;

      const validatedConfirmation =
        validationSchemas.inferenceConfirmationSchema.parse(
          confirmationDataJSON
        );
      await db.addData("InferenceConfirmation", validatedConfirmation);
      const { challenge, challenge_id, challenge_signature } =
        await this.requestAndSignChallenge(supernodeURL);

      const payload = await utils.prepareModelForEndpoint(
        validatedConfirmation
      );
      callback(JSON.stringify({ message: `Now sending inference confirmation with payload:\n${utils.formattedPayload(payload)}` }))
      utils.logActionWithPayload(
        "sending",
        "inference confirmation",
        payload
      );
      const response = await fetch(
        `${supernodeURL}/confirm_inference_request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inference_confirmation: confirmationDataJSON,
            challenge,
            challenge_id,
            challenge_signature,
          }),
          signal: AbortSignal.timeout(30000)
        }
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      callback(JSON.stringify({ message: `Now receiving response to inference confirmation with payload:\n${utils.formattedPayload(result)}` }))
      utils.logActionWithPayload(
        "receiving",
        "response to inference confirmation",
        result
      );

      return result;
    } catch (error) {
      console.error(
        `Error sending inference confirmation: ${utils.safeStringify(error)}`
      );
      return false
    }
  }

  async checkStatusOfInferenceRequestResults(
    supernodeURL: string,
    inferenceResponseID: string,
    callback: (value: string) => void
  ): Promise<boolean> {
    try {
      console.info(
        `Checking status of inference request results for ID ${inferenceResponseID}`
      );
      callback(JSON.stringify({ message: `Checking status of inference request results for ID ${inferenceResponseID}` }))
      const response = await fetch(
        `${supernodeURL}/check_status_of_inference_request_results/${inferenceResponseID}`
      );

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      callback(JSON.stringify({ message: `Now receiving status of inference request results for ID ${inferenceResponseID} with payload:\n${utils.formattedPayload(result)}` }))
      utils.logActionWithPayload(
        "receiving",
        `status of inference request results for ID ${inferenceResponseID}`,
        result
      );

      return typeof result === "boolean" ? result : false;
    } catch (error) {
      callback(JSON.stringify({ message: `Error checking status of inference request results from Supernode URL: ${supernodeURL}: ${utils.safeStringify(
        error
      )}` }))
      console.error(
        `Error checking status of inference request results from Supernode URL: ${supernodeURL}: ${utils.safeStringify(
          error
        )}`
      );
      return false;
    }
  }

  async retrieveInferenceOutputResults(
    supernodeURL: string,
    inferenceRequestID: string,
    inferenceResponseID: string,
    callback: (value: string) => void
  ): Promise<InferenceAPIOutputResult> {
    try {
      const { challenge, challenge_id, challenge_signature } =
        await this.requestAndSignChallenge(supernodeURL);
      const params = new URLSearchParams({
        inference_response_id: inferenceResponseID,
        pastelid: this.pastelID,
        challenge,
        challenge_id,
        challenge_signature,
      });
      callback(JSON.stringify({ message: `Now attempting to retrieve inference output results for response ID ${inferenceResponseID} with payload:\n${utils.formattedPayload(params)}` }))
      utils.logActionWithPayload(
        "attempting",
        `to retrieve inference output results for response ID ${inferenceResponseID}`,
        params
      );
      const response = await fetch(
        `${supernodeURL}/retrieve_inference_output_results?${params}`,
        {
          method: "POST",
        }
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      delete (result as Partial<InferenceAPIUsageResponse>).id;
      callback(JSON.stringify({ message: `Now receiving inference output results with payload:\n${utils.formattedPayload(result)}` }))
      utils.logActionWithPayload(
        "receiving",
        "inference output results",
        result
      );
      const transformedResult = await utils.prepareModelForValidation(result);
      const validatedResult =
        validationSchemas.inferenceAPIOutputResultSchema.parse(
          transformedResult
        );
      await db.addData("InferenceAPIOutputResult", validatedResult);
      return validatedResult;
    } catch (error) {
      callback(JSON.stringify({ message: `Error retrieving inference output results: ${utils.safeStringify(
        error
      )}` }))
      console.error(
        `Error retrieving inference output results: ${utils.safeStringify(
          error
        )}`
      );
      throw error;
    }
  }

  async callAuditInferenceRequestResponse(
    supernodeURL: string,
    inferenceResponseID: string
  ): Promise<InferenceAPIUsageResponse> {
    try {
      const signature = await this.rpc.signMessageWithPastelID(
        this.pastelID,
        inferenceResponseID,
        PastelIDType.PastelID
      );
      const payload = {
        inference_response_id: inferenceResponseID,
        pastel_id: this.pastelID,
        signature,
      };
      const response = await fetch(
        `${supernodeURL}/audit_inference_request_response`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      delete (result as Partial<InferenceAPIOutputResult>).id;
      const transformedResult = await utils.prepareModelForValidation(result);
      const validatedResult =
        validationSchemas.inferenceAPIUsageResponseSchema.parse(
          transformedResult
        );
      return validatedResult;
    } catch (error) {
      console.error(
        `Error calling audit inference request response from Supernode URL: ${supernodeURL}: ${utils.safeStringify(
          error
        )}`
      );
      throw error;
    }
  }

  async callAuditInferenceRequestResult(
    supernodeURL: string,
    inferenceResponseID: string
  ): Promise<InferenceAPIOutputResult> {
    try {
      const signature = await this.rpc.signMessageWithPastelID(
        this.pastelID,
        inferenceResponseID,
        PastelIDType.PastelID
      );
      const payload = {
        inference_response_id: inferenceResponseID,
        pastel_id: this.pastelID,
        signature,
      };
      const response = await fetch(
        `${supernodeURL}/audit_inference_request_result`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      delete (result as Partial<InferenceAPIOutputResult>).id;
      const transformedResult = await utils.prepareModelForValidation(result);
      const validatedResult =
        validationSchemas.inferenceAPIOutputResultSchema.parse(
          transformedResult
        );
      return validatedResult;
    } catch (error) {
      console.error(
        `Error calling audit inference request result from Supernode URL: ${supernodeURL}: ${utils.safeStringify(
          error
        )}`
      );
      throw error;
    }
  }

  async auditInferenceRequestResponseID(
    inferenceResponseID: string
  ): Promise<AuditResult[]> {
    try {
      const { validMasternodeListFullDF } = await this.rpc.checkSupernodeList();
      const filteredSupernodes = await utils.filterSupernodes(
        validMasternodeListFullDF
      );

      const supernodeURLsAndPastelIDs = filteredSupernodes.slice(0, 5);

      const listOfSupernodeURLs = supernodeURLsAndPastelIDs.map(
        (supernode) => `http://${supernode.ipaddress_port.split(":")[0]}:7123`
      );

      const responseAuditTasks = listOfSupernodeURLs.map((url) =>
        this.callAuditInferenceRequestResponse(url, inferenceResponseID)
      );
      const responseAuditResults = await Promise.all(responseAuditTasks);

      await new Promise((resolve) => setTimeout(resolve, 20000));

      const resultAuditTasks = listOfSupernodeURLs.map((url) =>
        this.callAuditInferenceRequestResult(url, inferenceResponseID)
      );
      const resultAuditResults = await Promise.all(resultAuditTasks);

      const auditResults: AuditResult[] = responseAuditResults.map(
        (response, index) => ({
          ...response,
          ...resultAuditResults[index],
        })
      );

      return auditResults;
    } catch (error) {
      console.error(
        `Error auditing inference request response ID: ${utils.safeStringify(
          error
        )}`
      );
      throw error;
    }
  }

  async checkIfSupernodeSupportsDesiredModel(
    supernodeURL: string,
    modelCanonicalString: string,
    modelInferenceTypeString: string,
    modelParametersJSON: string
  ): Promise<boolean> {
    try {
      const response = await fetch(`${supernodeURL}/get_inference_model_menu`);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const modelMenu: ModelMenu = await response.json();
      const desiredParameters = JSON.parse(modelParametersJSON);

      for (const model of modelMenu.models) {
        if (
          model.model_name === modelCanonicalString &&
          model.supported_inference_type_strings.includes(
            modelInferenceTypeString
          )
        ) {
          const unsupportedParameters: string[] = [];

          for (const [desiredParam, desiredValue] of Object.entries(
            desiredParameters
          )) {
            let paramFound = false;

            for (const param of model.model_parameters) {
              if (
                param.name === desiredParam &&
                param.inference_types_parameter_applies_to.includes(
                  modelInferenceTypeString
                )
              ) {
                if ("type" in param) {
                  if (
                    param.type === "int" &&
                    Number.isInteger(Number(desiredValue))
                  ) {
                    paramFound = true;
                  } else if (
                    param.type === "float" &&
                    !isNaN(parseFloat(desiredValue as string))
                  ) {
                    paramFound = true;
                  } else if (
                    param.type === "string" &&
                    typeof desiredValue === "string"
                  ) {
                    if (
                      "options" in param &&
                      Array.isArray(param.options) &&
                      param.options.includes(desiredValue)
                    ) {
                      paramFound = true;
                    } else if (!("options" in param)) {
                      paramFound = true;
                    }
                  }
                } else {
                  paramFound = true;
                }
                break;
              }
            }

            if (!paramFound) {
              unsupportedParameters.push(desiredParam);
            }
          }

          if (unsupportedParameters.length === 0) {
            return true;
          } else {
            const unsupportedParamStr = unsupportedParameters.join(", ");
            console.error(
              `Unsupported model parameters for ${modelCanonicalString}: ${unsupportedParamStr}`
            );
            return false;
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  async getClosestSupernodeURLsThatSupportsDesiredModel(
    desiredModelCanonicalString: string,
    desiredModelInferenceTypeString: string,
    desiredModelParametersJSON: string,
    N = 12
  ): Promise<string[]> {
    const timeoutPeriod = 3000;

    try {
      const { validMasternodeListFullDF } = await this.rpc.checkSupernodeList();
      const filteredSupernodes = await utils.filterSupernodes(
        validMasternodeListFullDF
      );

      const checkSupernodePromises = filteredSupernodes.map((supernode) => {
        const startTime = Date.now();
        const url = `http://${supernode.ipaddress_port.split(":")[0]}:7123`;

        return Promise.race([
          this.checkIfSupernodeSupportsDesiredModel(
            url,
            desiredModelCanonicalString,
            desiredModelInferenceTypeString,
            desiredModelParametersJSON
          ).then((result) => ({
            result,
            url,
            responseTime: Date.now() - startTime,
          })),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), timeoutPeriod)
          ).catch(() => null),
        ]).catch(() => null);
      });

      const results = await Promise.allSettled(checkSupernodePromises);

      const validResponses = results
        .filter(
          (
            res
          ): res is PromiseFulfilledResult<{
            result: boolean;
            url: string;
            responseTime: number;
          }> => res.status === "fulfilled" && res.value !== null
        )
        .map((res) => res.value)
        .filter(({ result }) => result);

      const sortedResponses = validResponses.sort(
        (a, b) => a.responseTime - b.responseTime
      );

      return sortedResponses.slice(0, N).map((response) => response.url);
    } catch (error) {
      throw new Error(
        `Failed to get closest supernodes: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

export default PastelInferenceClient;