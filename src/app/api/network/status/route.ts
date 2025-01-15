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
 *     security:
 *       - pastelIDAuth: []
 *     responses:
 *       200:
 *         description: Blockchain status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - currentHeight
 *                 - bestBlockHash
 *                 - merkleRoot
 *               properties:
 *                 currentHeight:
 *                   type: number
 *                   description: Current block height
 *                   example: 1234567
 *                 bestBlockHash:
 *                   type: string
 *                   description: Hash of the latest block
 *                   example: "000000000000000000024bead8df69990852c202db0e0097c1a12ea637d7e96d"
 *                 merkleRoot:
 *                   type: string
 *                   description: Merkle root of the latest block
 *                   example: "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export async function GET(): Promise<NextResponse> {
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
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}