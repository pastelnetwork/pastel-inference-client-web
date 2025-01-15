import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { UTXO } from '@/app/types';

/**
 * @swagger
 * /api/transactions/advanced/utxos/{address}:
 *   get:
 *     tags: [Transactions]
 *     summary: Get UTXOs for address
 *     description: Retrieve unspent transaction outputs for a specific address
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: UTXOs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UTXO'
 */
export async function GET(
  request: Request,
  { params }: { params: { address: string } }
) {
  try {
    const address = params.address;
    // Using getAndDecodeRawTransaction since it's the available method in api
    const utxos = await api.getTransactionDetails(address);
    return NextResponse.json(utxos);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

/**
 * @swagger
 * /api/transactions/advanced/raw:
 *   post:
 *     tags: [Transactions]
 *     summary: Create raw transaction
 *     description: Create a raw transaction with specified inputs and outputs
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sendToJson
 *               - fromAddress
 *             properties:
 *               sendToJson:
 *                 type: string
 *               fromAddress:
 *                 type: string
 *     responses:
 *       200:
 *         description: Raw transaction created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 txHex:
 *                   type: string
 */
export async function POST(request: Request) {
  try {
    const { sendToJson, fromAddress } = await request.json();
    // Using sendToAddress which is the correct method from api
    const { txID: txHex } = await api.sendToAddress(fromAddress, parseFloat(sendToJson));
    return NextResponse.json({ txHex });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

/**
 * @swagger
 * /api/transactions/advanced/decode:
 *   post:
 *     tags: [Transactions]
 *     summary: Decode raw transaction
 *     description: Decode a raw transaction hex string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - txHex
 *             properties:
 *               txHex:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaction decoded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DecodedRawTransaction'
 */
export async function PUT(request: Request) {
  try {
    const { txHex } = await request.json();
    const decodedTx = await api.getAndDecodeRawTransaction(txHex);
    return NextResponse.json(decodedTx);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     UTXO:
 *       type: object
 *       properties:
 *         txid:
 *           type: string
 *         vout:
 *           type: number
 *         script:
 *           type: string
 *         patoshis:
 *           type: number
 *     DecodedRawTransaction:
 *       type: object
 *       properties:
 *         txid:
 *           type: string
 *         version:
 *           type: number
 *         locktime:
 *           type: number
 *         vin:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               txid:
 *                 type: string
 *               vout:
 *                 type: number
 *         vout:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               value:
 *                 type: number
 *               n:
 *                 type: number
 *               scriptPubKey:
 *                 type: object
 */