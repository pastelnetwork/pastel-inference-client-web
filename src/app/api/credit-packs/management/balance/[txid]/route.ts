// src/app/api/credit-packs/management/balance/[txid]/route.ts
import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';

/**
 * @swagger
 * /api/credit-packs/management/balance/{txid}:
 *   get:
 *     tags: [Credit Packs]
 *     summary: Check credit pack balance
 *     description: Get current balance and status of a credit pack ticket
 *     security:
 *       - pastelIDAuth: []
 *     parameters:
 *       - in: path
 *         name: txid
 *         required: true
 *         schema:
 *           type: string
 *         description: The transaction ID of the credit pack ticket
 *     responses:
 *       200:
 *         description: Balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - address
 *                 - balance
 *               properties:
 *                 address:
 *                   type: string
 *                   description: The tracking address of the credit pack
 *                 balance:
 *                   type: number
 *                   format: float
 *                   description: Current balance in credits
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
    const { address, balance } = await api.checkTrackingAddressBalance(params.txid);
    return NextResponse.json({ address, balance });
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