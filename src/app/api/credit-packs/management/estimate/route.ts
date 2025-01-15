// src/app/api/credit-packs/management/estimate/route.ts

import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';

/**
 * @swagger
 * /api/credit-packs/management/estimate:
 *   post:
 *     tags: [Credit Packs]
 *     summary: Estimate credit pack cost
 *     description: Estimate the PSL cost for purchasing specified number of credits
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - desiredNumberOfCredits
 *               - creditPriceCushionPercentage
 *             properties:
 *               desiredNumberOfCredits:
 *                 type: number
 *               creditPriceCushionPercentage:
 *                 type: number
 *     responses:
 *       200:
 *         description: Cost estimation successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 estimatedCost:
 *                   type: number
 */
export async function POST(request: Request) {
  try {
    const { desiredNumberOfCredits, creditPriceCushionPercentage } = await request.json();
    const estimatedCost = await api.estimateCreditPackCost(
      desiredNumberOfCredits,
      creditPriceCushionPercentage
    );
    return NextResponse.json({ estimatedCost });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}