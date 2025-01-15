// src/app/api/wallet/route.ts

import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';

/**
 * @swagger
 * /api/wallet/create:
 *   post:
 *     tags: [Wallet]
 *     summary: Create new wallet
 *     description: Creates a new wallet with provided password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Wallet created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 walletInfo:
 *                   $ref: '#/components/schemas/WalletInfo'
 */
export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const walletData = await api.createNewWallet(password);
    await api.unlockWallet(password);
    return NextResponse.json({ success: true, data: walletData });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

/**
 * @swagger
 * /api/wallet/import:
 *   post:
 *     tags: [Wallet]
 *     summary: Import existing wallet
 *     description: Import a wallet from .dat file or private key
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - importType
 *             properties:
 *               importType:
 *                 type: string
 *                 enum: [privateKey, walletFile]
 *               privateKey:
 *                 type: string
 *               walletData:
 *                 type: string
 *                 format: binary
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Wallet imported successfully
 */
export async function PUT(request: Request) {
  try {
    const { importType, privateKey, walletData, password } = await request.json();
    
    if (importType === 'privateKey' && privateKey) {
      await api.importPrivKey(privateKey);
    } else if (importType === 'walletFile' && walletData && password) {
      await api.importWalletFromDatFile(walletData, password);
    } else {
      throw new Error('Invalid import parameters');
    }
    
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

/**
 * @swagger
 * /api/wallet/balance:
 *   get:
 *     tags: [Wallet]
 *     summary: Get wallet balance and address info
 *     description: Returns wallet balance and list of addresses
 *     responses:
 *       200:
 *         description: Wallet info retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   type: number
 *                 addresses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       address:
 *                         type: string
 *                       balance:
 *                         type: number
 */
export async function GET() {
  try {
    const balance = await api.getBalance();
    const addresses = await api.listAddressAmounts();
    return NextResponse.json({ balance, addresses });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     WalletInfo:
 *       type: object
 *       properties:
 *         walletversion:
 *           type: number
 *         balance:
 *           type: number
 *         unconfirmed_balance:
 *           type: number
 *         immature_balance:
 *           type: number
 */