// src/app/api/credit-packs/management/confirm/[txid]/route.ts
import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';

/**
 * @swagger
 * /api/credit-packs/management/confirm/{txid}:
 *   get:
 *     tags: [Credit Packs]
 *     summary: Check credit pack confirmation status
 *     description: Check if a credit pack ticket has been confirmed on the blockchain
 *     security:
 *       - pastelIDAuth: []
 *     parameters:
 *       - in: path
 *         name: txid
 *         required: true
 *         schema:
 *           type: string
 *         description: The transaction ID of the credit pack ticket to check
 *     responses:
 *       200:
 *         description: Confirmation status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - confirmed
 *               properties:
 *                 confirmed:
 *                   type: boolean
 *                   description: Whether the credit pack ticket is confirmed
 *                   example: true
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export async function GET(
  request: Request,
  { params }: { params: { txid: string } }
): Promise<NextResponse> {
  try {
    const isConfirmed = await api.isCreditPackConfirmed(params.txid);
    return NextResponse.json({ confirmed: isConfirmed });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { 
        error: errorMessage 
      }, 
      { 
        status: 400 
      }
    );
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     CreditPackConfirmationResponse:
 *       type: object
 *       required:
 *         - confirmed
 *       properties:
 *         confirmed:
 *           type: boolean
 *           description: Whether the credit pack ticket is confirmed
 *           example: true
 *         error:
 *           type: string
 *           description: Error message if the confirmation check failed
 *           example: "Invalid transaction ID"
 */