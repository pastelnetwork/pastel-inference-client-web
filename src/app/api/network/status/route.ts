// src/app/api/network/status/route.ts

import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';

/**
 * @swagger
 * /api/network/status:
 *   get:
 *     tags: [Network]
 *     summary: Get blockchain status
 *     description: Retrieve current blockchain height and other status information
 *     responses:
 *       200:
 *         description: Blockchain status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 currentHeight:
 *                   type: number
 *                 bestBlockHash:
 *                   type: string
 *                 merkleRoot:
 *                   type: string
 */
export async function GET() {
  try {
    const currentHeight = await api.getCurrentPastelBlockHeight();
    const [bestBlockHash, merkleRoot] = await api.getBestBlockHashAndMerkleRoot();
    return NextResponse.json({
      currentHeight,
      bestBlockHash,
      merkleRoot
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}