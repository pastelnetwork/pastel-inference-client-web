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
 *               required:
 *                 - network
 *               properties:
 *                 network:
 *                   type: string
 *                   enum: [mainnet, testnet, devnet]
 *                   description: The current network mode
 *                   example: mainnet
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export async function GET(): Promise<NextResponse> {
  try {
    const networkInfo = await api.getNetworkInfo();
    return NextResponse.json(networkInfo);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}