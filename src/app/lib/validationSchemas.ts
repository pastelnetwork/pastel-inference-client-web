// src/lib/validationSchemas.ts

import { z } from 'zod';

// Helper function to create a UUID validator
const uuidv4 = () => z.string().uuid();

export const supernodeListSchema = z.object({
  txid_vout: z.string(),
  supernode_status: z.string(),
  protocol_version: z.number(),
  supernode_psl_address: z.string(),
  lastseentime: z.number(),
  activeseconds: z.number(),
  activedays: z.number(),
  lastpaidtime: z.number(),
  lastpaidblock: z.number(),
  ipaddress_port: z.string(),
  rank: z.number(),
  pubkey: z.string(),
  extAddress: z.string(),
  extP2P: z.string(),
  extKey: z.string(),
});

export const messageSchema = z.object({
  id: uuidv4(),
  sending_sn_pastelid: z.string(),
  receiving_sn_pastelid: z.string(),
  sending_sn_txid_vout: z.string(),
  receiving_sn_txid_vout: z.string(),
  message_type: z.string(),
  message_body: z.string(),
  signature: z.string(),
  timestamp: z.string().datetime(),
});

export const userMessageSchema = z.object({
  id: uuidv4(),
  from_pastelid: z.string(),
  to_pastelid: z.string(),
  message_body: z.string(),
  message_signature: z.string(),
  timestamp: z.string().datetime(),
});

export const creditPackPurchaseRequestSchema = z.object({
  id: uuidv4(),
  requesting_end_user_pastelid: z.string(),
  requested_initial_credits_in_credit_pack: z.number().int(),
  list_of_authorized_pastelids_allowed_to_use_credit_pack: z.string(),
  credit_usage_tracking_psl_address: z.string(),
  request_timestamp_utc_iso_string: z.string(),
  request_pastel_block_height: z.number().int(),
  credit_purchase_request_message_version_string: z.string(),
  sha3_256_hash_of_credit_pack_purchase_request_fields: z.string(),
  requesting_end_user_pastelid_signature_on_request_hash: z.string(),
});

export const creditPackPurchaseRequestRejectionSchema = z.object({
  sha3_256_hash_of_credit_pack_purchase_request_fields: z.string(),
  credit_pack_purchase_request_fields_json_b64: z.string(),
  rejection_reason_string: z.string(),
  rejection_timestamp_utc_iso_string: z.string(),
  rejection_pastel_block_height: z.number().int(),
  credit_purchase_request_rejection_message_version_string: z.string(),
  responding_supernode_pastelid: z.string(),
  sha3_256_hash_of_credit_pack_purchase_request_rejection_fields: z.string(),
  responding_supernode_signature_on_credit_pack_purchase_request_rejection_hash: z.string(),
});

export const creditPackPurchaseRequestPreliminaryPriceQuoteSchema = z.object({
  sha3_256_hash_of_credit_pack_purchase_request_fields: z.string(),
  credit_usage_tracking_psl_address: z.string(),
  credit_pack_purchase_request_fields_json_b64: z.string(),
  preliminary_quoted_price_per_credit_in_psl: z.number(),
  preliminary_total_cost_of_credit_pack_in_psl: z.number(),
  preliminary_price_quote_timestamp_utc_iso_string: z.string(),
  preliminary_price_quote_pastel_block_height: z.number().int(),
  preliminary_price_quote_message_version_string: z.string(),
  responding_supernode_pastelid: z.string(),
  sha3_256_hash_of_credit_pack_purchase_request_preliminary_price_quote_fields: z.string(),
  responding_supernode_signature_on_credit_pack_purchase_request_preliminary_price_quote_hash: z.string(),
});

export const creditPackPurchaseRequestPreliminaryPriceQuoteResponseSchema = z.object({
  id: uuidv4(),
  sha3_256_hash_of_credit_pack_purchase_request_fields: z.string(),
  sha3_256_hash_of_credit_pack_purchase_request_preliminary_price_quote_fields: z.string(),
  credit_pack_purchase_request_fields_json_b64: z.string(),
  agree_with_preliminary_price_quote: z.boolean(),
  credit_usage_tracking_psl_address: z.string(),
  preliminary_quoted_price_per_credit_in_psl: z.number(),
  preliminary_price_quote_response_timestamp_utc_iso_string: z.string(),
  preliminary_price_quote_response_pastel_block_height: z.number().int(),
  preliminary_price_quote_response_message_version_string: z.string(),
  requesting_end_user_pastelid: z.string(),
  sha3_256_hash_of_credit_pack_purchase_request_preliminary_price_quote_response_fields: z.string(),
  requesting_end_user_pastelid_signature_on_preliminary_price_quote_response_hash: z.string(),
});

export const creditPackPurchaseRequestResponseTerminationSchema = z.object({
  sha3_256_hash_of_credit_pack_purchase_request_fields: z.string(),
  credit_pack_purchase_request_fields_json_b64: z.string(),
  termination_reason_string: z.string(),
  termination_timestamp_utc_iso_string: z.string(),
  termination_pastel_block_height: z.number().int(),
  credit_purchase_request_termination_message_version_string: z.string(),
  responding_supernode_pastelid: z.string(),
  sha3_256_hash_of_credit_pack_purchase_request_termination_fields: z.string(),
  responding_supernode_signature_on_credit_pack_purchase_request_termination_hash: z.string(),
});

export const creditPackPurchaseRequestResponseSchema = z.object({
  id: uuidv4(),
  sha3_256_hash_of_credit_pack_purchase_request_fields: z.string(),
  credit_pack_purchase_request_fields_json_b64: z.string(),
  psl_cost_per_credit: z.number(),
  proposed_total_cost_of_credit_pack_in_psl: z.number(),
  credit_usage_tracking_psl_address: z.string(),
  request_response_timestamp_utc_iso_string: z.string(),
  request_response_pastel_block_height: z.number().int(),
  best_block_merkle_root: z.string(),
  best_block_height: z.number().int(),
  credit_purchase_request_response_message_version_string: z.string(),
  responding_supernode_pastelid: z.string(),
  list_of_blacklisted_supernode_pastelids: z.string(),
  list_of_potentially_agreeing_supernodes: z.string(),
  list_of_supernode_pastelids_agreeing_to_credit_pack_purchase_terms: z.string(),
  list_of_supernode_pastelids_agreeing_to_credit_pack_purchase_terms_selected_for_signature_inclusion: z.string(),
  selected_agreeing_supernodes_signatures_dict: z.string(),
  sha3_256_hash_of_credit_pack_purchase_request_response_fields: z.string(),
  responding_supernode_signature_on_credit_pack_purchase_request_response_hash: z.string(),
});

export const creditPackPurchaseRequestConfirmationSchema = z.object({
  id: uuidv4(),
  sha3_256_hash_of_credit_pack_purchase_request_fields: z.string(),
  sha3_256_hash_of_credit_pack_purchase_request_response_fields: z.string(),
  credit_pack_purchase_request_fields_json_b64: z.string(),
  requesting_end_user_pastelid: z.string(),
  txid_of_credit_purchase_burn_transaction: z.string(),
  credit_purchase_request_confirmation_utc_iso_string: z.string(),
  credit_purchase_request_confirmation_pastel_block_height: z.number().int(),
  credit_purchase_request_confirmation_message_version_string: z.string(),
  sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields: z.string(),
  requesting_end_user_pastelid_signature_on_sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields: z.string(),
});

export const creditPackPurchaseRequestConfirmationResponseSchema = z.object({
  id: uuidv4(),
  sha3_256_hash_of_credit_pack_purchase_request_fields: z.string(),
  sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields: z.string(),
  credit_pack_confirmation_outcome_string: z.string(),
  pastel_api_credit_pack_ticket_registration_txid: z.string(),
  credit_pack_confirmation_failure_reason_if_applicable: z.string().nullable(),
  credit_purchase_request_confirmation_response_utc_iso_string: z.string(),
  credit_purchase_request_confirmation_response_pastel_block_height: z.number().int(),
  credit_purchase_request_confirmation_response_message_version_string: z.string(),
  responding_supernode_pastelid: z.string(),
  sha3_256_hash_of_credit_pack_purchase_request_confirmation_response_fields: z.string(),
  responding_supernode_signature_on_credit_pack_purchase_request_confirmation_response_hash: z.string(),
});

export const creditPackRequestStatusCheckSchema = z.object({
  id: uuidv4(),
  sha3_256_hash_of_credit_pack_purchase_request_fields: z.string(),
  requesting_end_user_pastelid: z.string(),
  requesting_end_user_pastelid_signature_on_sha3_256_hash_of_credit_pack_purchase_request_fields: z.string(),
});

export const creditPackPurchaseRequestStatusSchema = z.object({
  sha3_256_hash_of_credit_pack_purchase_request_fields: z.string(),
  sha3_256_hash_of_credit_pack_purchase_request_response_fields: z.string(),
  status: z.string(),
  status_details: z.string(),
  status_update_timestamp_utc_iso_string: z.string(),
  status_update_pastel_block_height: z.number().int(),
  credit_purchase_request_status_message_version_string: z.string(),
  responding_supernode_pastelid: z.string(),
  sha3_256_hash_of_credit_pack_purchase_request_status_fields: z.string(),
  responding_supernode_signature_on_credit_pack_purchase_request_status_hash: z.string(),
});

export const creditPackStorageRetryRequestSchema = z.object({
  sha3_256_hash_of_credit_pack_purchase_request_response_fields: z.string(),
  credit_pack_purchase_request_fields_json_b64: z.string(),
  requesting_end_user_pastelid: z.string(),
  closest_agreeing_supernode_to_retry_storage_pastelid: z.string(),
  credit_pack_storage_retry_request_timestamp_utc_iso_string: z.string(),
  credit_pack_storage_retry_request_pastel_block_height: z.number().int(),
  credit_pack_storage_retry_request_message_version_string: z.string(),
  sha3_256_hash_of_credit_pack_storage_retry_request_fields: z.string(),
  requesting_end_user_pastelid_signature_on_credit_pack_storage_retry_request_hash: z.string(),
});

export const creditPackStorageRetryRequestResponseSchema = z.object({
  sha3_256_hash_of_credit_pack_purchase_request_fields: z.string(),
  sha3_256_hash_of_credit_pack_purchase_request_confirmation_fields: z.string(),
  credit_pack_storage_retry_confirmation_outcome_string: z.string(),
  pastel_api_credit_pack_ticket_registration_txid: z.string(),
  credit_pack_storage_retry_confirmation_failure_reason_if_applicable: z.string(),
  credit_pack_storage_retry_confirmation_response_utc_iso_string: z.string(),
  credit_pack_storage_retry_confirmation_response_pastel_block_height: z.number().int(),
  credit_pack_storage_retry_confirmation_response_message_version_string: z.string(),
  closest_agreeing_supernode_to_retry_storage_pastelid: z.string(),
  sha3_256_hash_of_credit_pack_storage_retry_confirmation_response_fields: z.string(),
  closest_agreeing_supernode_to_retry_storage_pastelid_signature_on_credit_pack_storage_retry_confirmation_response_hash: z.string(),
});

export const inferenceAPIUsageRequestSchema = z.object({
  inference_request_id: uuidv4(),
  requesting_pastelid: z.string(),
  credit_pack_ticket_pastel_txid: z.string(),
  requested_model_canonical_string: z.string(),
  model_inference_type_string: z.string(),
  model_parameters_json_b64: z.string(),
  model_input_data_json_b64: z.string(),
  inference_request_utc_iso_string: z.string(),
  inference_request_pastel_block_height: z.number().int(),
  status: z.string(),
  inference_request_message_version_string: z.string(),
  sha3_256_hash_of_inference_request_fields: z.string(),
  requesting_pastelid_signature_on_request_hash: z.string(),
});

export const inferenceAPIUsageResponseSchema = z.object({
  inference_response_id: uuidv4(),
  inference_request_id: z.string(),
  proposed_cost_of_request_in_inference_credits: z.number(),
  remaining_credits_in_pack_after_request_processed: z.number(),
  credit_usage_tracking_psl_address: z.string(),
  request_confirmation_message_amount_in_patoshis: z.number().int(),
  max_block_height_to_include_confirmation_transaction: z.number().int(),
  inference_request_response_utc_iso_string: z.string(),
  inference_request_response_pastel_block_height: z.number().int(),
  inference_request_response_message_version_string: z.string(),
  sha3_256_hash_of_inference_request_response_fields: z.string(),
  supernode_pastelid_and_signature_on_inference_request_response_hash: z.string(),
});

export const inferenceAPIOutputResultSchema = z.object({
    inference_result_id: uuidv4(),
    inference_request_id: z.string(),
    inference_response_id: z.string(),
    responding_supernode_pastelid: z.string(),
    inference_result_json_base64: z.string(),
    inference_result_file_type_strings: z.string(),
    inference_result_utc_iso_string: z.string(),
    inference_result_pastel_block_height: z.number().int(),
    inference_result_message_version_string: z.string(),
    sha3_256_hash_of_inference_result_fields: z.string(),
    responding_supernode_signature_on_inference_result_id: z.string(),
  });
  
  export const inferenceConfirmationSchema = z.object({
    inference_request_id: z.string(),
    requesting_pastelid: z.string(),
    confirmation_transaction: z.object({
      txid: z.string(),
    }),
  });
  
  // Utility function to validate data against a schema
  export async function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): Promise<{ isValid: boolean; errors: string[] | null; data: T | null }> {
    try {
      const validatedData = await schema.parseAsync(data);
      return { isValid: true, errors: null, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, errors: error.errors.map(e => e.message), data: null };
      }
      throw error;
    }
  }
  
  // Type exports
  export type SupernodeList = z.infer<typeof supernodeListSchema>;
  export type Message = z.infer<typeof messageSchema>;
  export type UserMessage = z.infer<typeof userMessageSchema>;
  export type CreditPackPurchaseRequest = z.infer<typeof creditPackPurchaseRequestSchema>;
  export type CreditPackPurchaseRequestRejection = z.infer<typeof creditPackPurchaseRequestRejectionSchema>;
  export type CreditPackPurchaseRequestPreliminaryPriceQuote = z.infer<typeof creditPackPurchaseRequestPreliminaryPriceQuoteSchema>;
  export type CreditPackPurchaseRequestPreliminaryPriceQuoteResponse = z.infer<typeof creditPackPurchaseRequestPreliminaryPriceQuoteResponseSchema>;
  export type CreditPackPurchaseRequestResponseTermination = z.infer<typeof creditPackPurchaseRequestResponseTerminationSchema>;
  export type CreditPackPurchaseRequestResponse = z.infer<typeof creditPackPurchaseRequestResponseSchema>;
  export type CreditPackPurchaseRequestConfirmation = z.infer<typeof creditPackPurchaseRequestConfirmationSchema>;
  export type CreditPackPurchaseRequestConfirmationResponse = z.infer<typeof creditPackPurchaseRequestConfirmationResponseSchema>;
  export type CreditPackRequestStatusCheck = z.infer<typeof creditPackRequestStatusCheckSchema>;
  export type CreditPackPurchaseRequestStatus = z.infer<typeof creditPackPurchaseRequestStatusSchema>;
  export type CreditPackStorageRetryRequest = z.infer<typeof creditPackStorageRetryRequestSchema>;
  export type CreditPackStorageRetryRequestResponse = z.infer<typeof creditPackStorageRetryRequestResponseSchema>;
  export type InferenceAPIUsageRequest = z.infer<typeof inferenceAPIUsageRequestSchema>;
  export type InferenceAPIUsageResponse = z.infer<typeof inferenceAPIUsageResponseSchema>;
  export type InferenceAPIOutputResult = z.infer<typeof inferenceAPIOutputResultSchema>;
  export type InferenceConfirmation = z.infer<typeof inferenceConfirmationSchema>;