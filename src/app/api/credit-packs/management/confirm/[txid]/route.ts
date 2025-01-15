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
 *     parameters:
 *       - in: path
 *         name: txid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Confirmation status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 confirmed:
 *                   type: boolean
 */
export async function GET(
  request: Request,
  { params }: { params: { txid: string } }
) {
  try {
    const isConfirmed = await api.isCreditPackConfirmed(params.txid);
    return NextResponse.json({ confirmed: isConfirmed });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     BalanceInfo:
 *       type: object
 *       properties:
 *         credit_pack_current_credit_balance:
 *           type: number
 *         balance_as_of_datetime:
 *           type: string
 *           format: date-time
 */