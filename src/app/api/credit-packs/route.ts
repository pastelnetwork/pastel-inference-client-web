// src/app/api/credit-packs/route.ts
import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';
import { z } from 'zod';

// Input validation schemas
const createCreditPackSchema = z.object({
  numCredits: z.number()
    .positive()
    .min(1, "Must request at least 1 credit"),
  creditUsageTrackingPSLAddress: z.string()
    .min(1, "PSL address is required")
    .regex(/^[a-zA-Z0-9]+$/, "Invalid PSL address format"),
  maxTotalPrice: z.number()
    .positive()
    .min(0.00000001, "Minimum price must be at least 0.00000001"),
  maxPerCreditPrice: z.number()
    .positive()
    .min(0.00000001, "Minimum per credit price must be at least 0.00000001")
});

type CreateCreditPackRequest = z.infer<typeof createCreditPackSchema>;

/**
 * @swagger
 * /api/credit-packs:
 *   get:
 *     tags: [Credit Packs]
 *     summary: Get list of valid credit packs
 *     description: Retrieves list of valid credit pack tickets for the authenticated user
 *     security:
 *       - pastelIDAuth: []
 *     responses:
 *       200:
 *         description: List of credit packs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CreditPack'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export async function GET(): Promise<NextResponse> {
  try {
    const creditPacks = await api.getMyValidCreditPacks();
    return NextResponse.json(creditPacks);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { 
        error: errorMessage 
      }, 
      { 
        status: 500 
      }
    );
  }
}

/**
 * @swagger
 * /api/credit-packs:
 *   post:
 *     tags: [Credit Packs]
 *     summary: Create a new credit pack ticket
 *     description: Creates a new credit pack ticket with specified credits and price limits
 *     security:
 *       - pastelIDAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - numCredits
 *               - creditUsageTrackingPSLAddress
 *               - maxTotalPrice
 *               - maxPerCreditPrice
 *             properties:
 *               numCredits:
 *                 type: number
 *                 minimum: 1
 *                 description: Number of credits to purchase
 *                 example: 100
 *               creditUsageTrackingPSLAddress:
 *                 type: string
 *                 description: PSL address for tracking credit usage
 *                 example: "Pxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
 *               maxTotalPrice:
 *                 type: number
 *                 minimum: 0.00000001
 *                 description: Maximum total price willing to pay in PSL
 *                 example: 1000.5
 *               maxPerCreditPrice:
 *                 type: number
 *                 minimum: 0.00000001
 *                 description: Maximum price per credit willing to pay in PSL
 *                 example: 10.5
 *     responses:
 *       200:
 *         description: Credit pack created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreditPackCreationResult'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    // Validate request body
    const validatedData = createCreditPackSchema.parse(body) as CreateCreditPackRequest;
    
    const result = await api.createCreditPackTicket(
      validatedData.numCredits,
      validatedData.creditUsageTrackingPSLAddress,
      validatedData.maxTotalPrice,
      validatedData.maxPerCreditPrice,
      (msg) => console.log(msg)  // Progress callback
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.errors
        },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { 
        error: errorMessage 
      }, 
      { 
        status: error instanceof Error && error.message.includes('insufficient') ? 402 : 500 
      }
    );
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     CreditPack:
 *       type: object
 *       required:
 *         - id
 *         - credit_pack_registration_txid
 *         - credit_pack_current_credit_balance
 *         - credit_usage_tracking_psl_address
 *         - psl_cost_per_credit
 *         - requested_initial_credits_in_credit_pack
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         credit_pack_registration_txid:
 *           type: string
 *         credit_pack_current_credit_balance:
 *           type: number
 *         credit_usage_tracking_psl_address:
 *           type: string
 *         psl_cost_per_credit:
 *           type: number
 *         requested_initial_credits_in_credit_pack:
 *           type: number
 *     CreditPackCreationResult:
 *       type: object
 *       required:
 *         - creditPackRequest
 *         - creditPackPurchaseRequestConfirmation
 *       properties:
 *         creditPackRequest:
 *           $ref: '#/components/schemas/CreditPackRequest'
 *         creditPackPurchaseRequestConfirmation:
 *           $ref: '#/components/schemas/CreditPackConfirmation'
 *     CreditPackRequest:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         requesting_end_user_pastelid:
 *           type: string
 *         requested_initial_credits_in_credit_pack:
 *           type: number
 *         credit_usage_tracking_psl_address:
 *           type: string
 *         request_timestamp_utc_iso_string:
 *           type: string
 *           format: date-time
 *     CreditPackConfirmation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         txid_of_credit_purchase_burn_transaction:
 *           type: string
 *         credit_purchase_request_confirmation_utc_iso_string:
 *           type: string
 *           format: date-time
 *         pastel_api_credit_pack_ticket_registration_txid:
 *           type: string
 */