// src/app/api/network/supernodes/route.ts

import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';

/**
 * @swagger
 * /api/network/supernodes:
 *   get:
 *     tags: [Network]
 *     summary: Get supernode list
 *     description: Retrieve list of active supernodes and their status
 *     security:
 *       - pastelIDAuth: []
 *     responses:
 *       200:
 *         description: Supernode list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - validMasternodeListFullDF
 *               properties:
 *                 validMasternodeListFullDF:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SupernodeInfo'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supernodeList = await api.checkSupernodeList();
    return NextResponse.json(supernodeList);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     SupernodeInfo:
 *       type: object
 *       required:
 *         - txid_vout
 *         - supernode_status
 *         - protocol_version
 *         - supernode_psl_address
 *         - ipaddress_port
 *         - extKey
 *         - rank
 *       properties:
 *         txid_vout:
 *           type: string
 *           description: Transaction ID and output index
 *         supernode_status:
 *           type: string
 *           enum: [ENABLED, PRE_ENABLED, EXPIRED, OUTPOINT_SPENT]
 *         protocol_version:
 *           type: number
 *         supernode_psl_address:
 *           type: string
 *           description: PSL address of the supernode
 *         ipaddress_port:
 *           type: string
 *           description: IP address and port of the supernode
 *         extKey:
 *           type: string
 *           description: External key (PastelID) of the supernode
 *         rank:
 *           type: number
 *           description: Supernode rank
 *         lastseentime:
 *           type: number
 *           description: Unix timestamp of last seen time
 *         activeseconds:
 *           type: number
 *           description: Number of seconds the node has been active
 *         lastpaidtime:
 *           type: number
 *           description: Unix timestamp of last payment
 *         lastpaidblock:
 *           type: number
 *           description: Block height of last payment
 */