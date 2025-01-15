// src/app/api/network/info/route.ts

import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';

/**
 * @swagger
 * /api/network/info:
 *   get:
 *     tags: [Network]
 *     summary: Get network information
 *     description: Retrieve current network status and information
 *     responses:
 *       200:
 *         description: Network information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 network:
 *                   type: string
 *                   enum: [mainnet, testnet, devnet]
 */
export async function GET() {
  try {
    const networkInfo = await api.getNetworkInfo();
    return NextResponse.json(networkInfo);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}