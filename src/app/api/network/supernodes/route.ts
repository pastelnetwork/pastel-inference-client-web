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
 *     responses:
 *       200:
 *         description: Supernode list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 validMasternodeListFullDF:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SupernodeInfo'
 */
export async function GET() {
  try {
    const supernodeList = await api.checkSupernodeList();
    return NextResponse.json(supernodeList);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     SupernodeInfo:
 *       type: object
 *       properties:
 *         txid_vout:
 *           type: string
 *         supernode_status:
 *           type: string
 *         protocol_version:
 *           type: number
 *         supernode_psl_address:
 *           type: string
 *         ipaddress_port:
 *           type: string
 *         extKey:
 *           type: string
 *         rank:
 *           type: number
 */