// src/app/api/credit-packs/route.ts

import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';

/**
 * @swagger
 * /api/credit-packs/create:
 *   post:
 *     tags: [Credit Packs]
 *     summary: Create a new credit pack ticket
 *     description: Creates a new credit pack ticket with specified credits and price limits
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
 *                 description: Number of credits to purchase
 *               creditUsageTrackingPSLAddress:
 *                 type: string
 *                 description: PSL address for tracking credit usage
 *               maxTotalPrice:
 *                 type: number
 *                 description: Maximum total price in PSL
 *               maxPerCreditPrice:
 *                 type: number
 *                 description: Maximum price per credit in PSL
 *     responses:
 *       200:
 *         description: Credit pack created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 creditPackRequest:
 *                   $ref: '#/components/schemas/CreditPackPurchaseRequest'
 *                 creditPackPurchaseRequestConfirmation:
 *                   $ref: '#/components/schemas/CreditPackPurchaseRequestConfirmation'
 *       400:
 *         description: Invalid input parameters
 *       401:
 *         description: Not authenticated
 */
export async function POST(request: Request) {
    try {
      const { 
        numCredits, 
        creditUsageTrackingPSLAddress, 
        maxTotalPrice, 
        maxPerCreditPrice 
      } = await request.json();
  
      const result = await api.createCreditPackTicket(
        numCredits,
        creditUsageTrackingPSLAddress, 
        maxTotalPrice,
        maxPerCreditPrice,
        (msg) => console.log(msg)
      );
  
      return NextResponse.json(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
  }
  

/**
 * @swagger
 * /api/credit-packs/list:
 *   get:
 *     tags: [Credit Packs] 
 *     summary: Get list of valid credit packs
 *     description: Retrieves list of valid credit pack tickets for the authenticated user
 *     responses:
 *       200:
 *         description: List of credit packs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CreditPack'
 */
export async function GET() {
    try {
      const creditPacks = await api.getMyValidCreditPacks();
      return NextResponse.json(creditPacks);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
  }

// Common component schemas
/**
 * @swagger
 * components:
 *   schemas:
 *     CreditPackPurchaseRequest:
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
 *     CreditPack:
 *       type: object  
 *       properties:
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
 */