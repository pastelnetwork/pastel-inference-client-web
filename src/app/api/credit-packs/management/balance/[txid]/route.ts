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
 *     parameters:
 *       - in: path
 *         name: txid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BalanceInfo'
 */
export async function GET(
  request: Request,
  { params }: { params: { txid: string } }
) {
  try {
    const { address, balance } = await api.checkTrackingAddressBalance(params.txid);
    return NextResponse.json({ address, balance });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}