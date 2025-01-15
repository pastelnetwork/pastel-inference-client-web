// src/app/api/wallet/backup/route.ts

import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';

/**
 * @swagger
 * /api/wallet/backup/export:
 *   get:
 *     tags: [Wallet]
 *     summary: Export wallet backup
 *     description: Export wallet data as encrypted backup file
 *     responses:
 *       200:
 *         description: Wallet exported successfully
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 */
export async function GET() {
  try {
    const walletData = await api.exportWallet();
    return new Response(walletData, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename=pastel-wallet-backup.dat'
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during wallet export';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

/**
 * @swagger
 * /api/wallet/backup/restore:
 *   post:
 *     tags: [Wallet]
 *     summary: Restore wallet from backup
 *     description: Restore wallet from encrypted backup file
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - backupFile
 *               - password
 *             properties:
 *               backupFile:
 *                 type: string
 *                 format: binary
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Wallet restored successfully
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const backupFile = formData.get('backupFile') as File;
    const password = formData.get('password') as string;

    if (!backupFile || !password) {
      throw new Error('Missing required backup file or password');
    }

    const arrayBuffer = await backupFile.arrayBuffer();
    const success = await api.importWalletFromDatFile(arrayBuffer, password);
    
    if (success) {
      return NextResponse.json({ message: 'Wallet restored successfully' });
    } else {
      throw new Error('Failed to restore wallet');
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during wallet restore';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

/**
 * @swagger
 * /api/wallet/backup/mnemonic:
 *   post:
 *     tags: [Wallet]
 *     summary: Create wallet from mnemonic
 *     description: Create new wallet using BIP39 mnemonic phrase
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mnemonic
 *               - password
 *             properties:
 *               mnemonic:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Wallet created successfully from mnemonic
 */
export async function PUT(request: Request) {
  try {
    const { mnemonic, password } = await request.json();
    
    if (!mnemonic || !password) {
      throw new Error('Missing required mnemonic or password');
    }

    const result = await api.createWalletFromMnemonic(password, mnemonic);
    return NextResponse.json({ message: 'Wallet created successfully', result });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during wallet creation';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}