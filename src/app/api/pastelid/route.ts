// src/app/api/pastelid/route.ts

import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';
import { z } from 'zod';
import { PastelIDType } from '@/app/types';

// Input validation schemas
const importPastelIDSchema = z.object({
  fileContent: z.string().min(1, "File content is required"),
  network: z.enum(['mainnet', 'testnet', 'devnet'], {
    errorMap: () => ({ message: "Invalid network - must be mainnet, testnet, or devnet" })
  }),
  passphrase: z.string().min(1, "Passphrase is required"),
  pastelID: z.string()
    .min(1, "PastelID is required")
    .regex(/^jX[A-Za-z0-9]{84}$/, "Invalid PastelID format")
});

const signMessageSchema = z.object({
  pastelID: z.string()
    .min(1, "PastelID is required")
    .regex(/^jX[A-Za-z0-9]{84}$/, "Invalid PastelID format"),
  message: z.string().min(1, "Message is required"),
  type: z.enum(['PastelID', 'LegRoast']).optional().default('PastelID')
});

type ImportPastelIDRequest = z.infer<typeof importPastelIDSchema>;
type SignMessageRequest = z.infer<typeof signMessageSchema>;

/**
 * @swagger
 * /api/pastelid:
 *   get:
 *     tags: [PastelID]
 *     summary: List PastelIDs
 *     description: Returns list of PastelIDs associated with the wallet
 *     security:
 *       - pastelIDAuth: []
 *     responses:
 *       200:
 *         description: List of PastelIDs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *                 pattern: ^jX[A-Za-z0-9]{84}$
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export async function GET(): Promise<NextResponse> {
  try {
    const pastelIDs = await api.listPastelIDs();
    return NextResponse.json(pastelIDs);
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
 * /api/pastelid:
 *   post:
 *     tags: [PastelID]
 *     summary: Create new PastelID
 *     description: Creates and registers a new PastelID on the network
 *     security:
 *       - pastelIDAuth: []
 *     responses:
 *       200:
 *         description: PastelID created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - pastelID
 *                 - txid
 *               properties:
 *                 pastelID:
 *                   type: string
 *                   pattern: ^jX[A-Za-z0-9]{84}$
 *                 txid:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export async function POST(): Promise<NextResponse> {
  try {
    const result = await api.createAndRegisterPastelID();
    return NextResponse.json(result);
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
 * /api/pastelid:
 *   put:
 *     tags: [PastelID]
 *     summary: Import PastelID
 *     description: Imports an existing PastelID into the wallet
 *     security:
 *       - pastelIDAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileContent
 *               - network
 *               - passphrase
 *               - pastelID
 *             properties:
 *               fileContent:
 *                 type: string
 *                 description: Base64 encoded PastelID file content
 *               network:
 *                 type: string
 *                 enum: [mainnet, testnet, devnet]
 *               passphrase:
 *                 type: string
 *               pastelID:
 *                 type: string
 *                 pattern: ^jX[A-Za-z0-9]{84}$
 *     responses:
 *       200:
 *         description: PastelID imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const validatedData = importPastelIDSchema.parse(body) as ImportPastelIDRequest;
    
    const result = await api.importPastelID(
      validatedData.fileContent,
      validatedData.network,
      validatedData.passphrase,
      validatedData.pastelID
    );

    return NextResponse.json(result);
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
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/pastelid/sign:
 *   patch:
 *     tags: [PastelID]
 *     summary: Sign message with PastelID
 *     description: Signs a message using specified PastelID
 *     security:
 *       - pastelIDAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pastelID
 *               - message
 *             properties:
 *               pastelID:
 *                 type: string
 *                 pattern: ^jX[A-Za-z0-9]{84}$
 *               message:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [PastelID, LegRoast]
 *                 default: PastelID
 *     responses:
 *       200:
 *         description: Message signed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - signature
 *               properties:
 *                 signature:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const validatedData = signMessageSchema.parse(body) as SignMessageRequest;
    
    const signature = await api.signMessageWithPastelID(
      validatedData.pastelID,
      validatedData.message,
      validatedData.type as unknown as PastelIDType
    );

    return NextResponse.json({ signature });
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
      { error: errorMessage },
      { status: 500 }
    );
  }
}