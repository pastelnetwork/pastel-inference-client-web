// src/app/api/credit-packs/management/estimate/route.ts
import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';
import { z } from 'zod';

// Input validation schema
const estimateRequestSchema = z.object({
  desiredNumberOfCredits: z.number()
    .positive()
    .min(1, "Must request at least 1 credit"),
  creditPriceCushionPercentage: z.number()
    .min(0, "Cushion percentage cannot be negative")
    .max(1, "Cushion percentage cannot exceed 100%")
});

type EstimateRequest = z.infer<typeof estimateRequestSchema>;

/**
 * @swagger
 * /api/credit-packs/management/estimate:
 *   post:
 *     tags: [Credit Packs]
 *     summary: Estimate credit pack cost
 *     description: Estimate the PSL cost for purchasing specified number of credits
 *     security:
 *       - pastelIDAuth: []
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
 *                 minimum: 1
 *                 description: Number of credits to purchase
 *                 example: 100
 *               creditPriceCushionPercentage:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 description: Price cushion as a decimal (e.g., 0.1 for 10%)
 *                 example: 0.1
 *     responses:
 *       200:
 *         description: Cost estimation successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - estimatedCost
 *               properties:
 *                 estimatedCost:
 *                   type: number
 *                   format: float
 *                   description: Estimated cost in PSL
 *                   example: 1000.50
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    // Validate request body
    const validatedData = estimateRequestSchema.parse(body) as EstimateRequest;
    
    const estimatedCost = await api.estimateCreditPackCost(
      validatedData.desiredNumberOfCredits,
      validatedData.creditPriceCushionPercentage
    );

    return NextResponse.json({ 
      estimatedCost: Number(estimatedCost.toFixed(8)) 
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.errors
        },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { 
        error: errorMessage 
      }, 
      { 
        status: 400 
      }
    );
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     EstimateResponse:
 *       type: object
 *       required:
 *         - estimatedCost
 *       properties:
 *         estimatedCost:
 *           type: number
 *           format: float
 *           description: Estimated cost in PSL
 *           example: 1000.50
 *     EstimateError:
 *       allOf:
 *         - $ref: '#/components/schemas/Error'
 *         - type: object
 *           properties:
 *             details:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   path:
 *                     type: array
 *                     items:
 *                       type: string
 *                   message:
 *                     type: string
 */