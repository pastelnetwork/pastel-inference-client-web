// src/app/api/pastelid/route.ts

import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';

/**
 * @swagger
 * /api/pastelid/list:
 *   get:
 *     tags: [PastelID]
 *     summary: List PastelIDs
 *     description: Returns list of PastelIDs associated with the wallet
 *     responses:
 *       200:
 *         description: List of PastelIDs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
export async function GET() {
  try {
    const pastelIDs = await api.listPastelIDs();
    return NextResponse.json(pastelIDs);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

/**
 * @swagger
 * /api/pastelid/create:
 *   post:
 *     tags: [PastelID]
 *     summary: Create new PastelID
 *     description: Creates and registers a new PastelID on the network
 *     responses:
 *       200:
 *         description: PastelID created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pastelID:
 *                   type: string
 *                 txid:
 *                   type: string
 */
export async function POST() {
  try {
    // Even though we don't use the request body for creation,
    // we keep the parameter as it's part of the handler signature
    const result = await api.createAndRegisterPastelID();
    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

/**
 * @swagger
 * /api/pastelid/import:
 *   put:
 *     tags: [PastelID]
 *     summary: Import PastelID
 *     description: Imports an existing PastelID into the wallet
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileContent
 *               - network
 *               - passphrase
 *               - pastelID
 *             properties:
 *               fileContent:
 *                 type: string
 *               network:
 *                 type: string
 *                 enum: [mainnet, testnet, devnet]
 *               passphrase:
 *                 type: string
 *               pastelID:
 *                 type: string
 *     responses:
 *       200:
 *         description: PastelID imported successfully
 */
export async function PUT(request: Request) {
  try {
    const { fileContent, network, passphrase, pastelID } = await request.json();
    const result = await api.importPastelID(fileContent, network, passphrase, pastelID);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

/**
 * @swagger
 * /api/pastelid/sign:
 *   patch:
 *     tags: [PastelID]
 *     summary: Sign message with PastelID
 *     description: Signs a message using specified PastelID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pastelID
 *               - message
 *             properties:
 *               pastelID:
 *                 type: string
 *               message:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [PastelID, LegRoast]
 *                 default: PastelID
 *     responses:
 *       200:
 *         description: Message signed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 signature:
 *                   type: string
 */
export async function PATCH(request: Request) {
  try {
    const { pastelID, message, type = 'PastelID' } = await request.json();
    const signature = await api.signMessageWithPastelID(pastelID, message, type);
    return NextResponse.json({ signature });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

// Move verification endpoint to a separate route file: src/app/api/pastelid/verify/route.ts