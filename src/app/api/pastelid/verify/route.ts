// src/app/api/pastelid/verify/route.ts

import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';

/**
 * @swagger
 * /api/pastelid/verify:
 *   post:
 *     tags: [PastelID]
 *     summary: Verify signed message
 *     description: Verifies a message signed with PastelID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pastelID
 *               - message
 *               - signature
 *             properties:
 *               pastelID:
 *                 type: string
 *               message:
 *                 type: string
 *               signature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isValid:
 *                   type: boolean
 */
export async function POST(request: Request) {
  try {
    const { pastelID, message, signature } = await request.json();
    const isValid = await api.verifyMessageWithPastelID(pastelID, message, signature);
    return NextResponse.json({ isValid });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}