// src/app/api/messages/route.ts

import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';
import { z } from 'zod';

// Input validation schema
const sendMessageSchema = z.object({
  toPastelID: z.string()
    .min(1, "Recipient PastelID is required")
    .regex(/^jX[A-Za-z0-9]{84}$/, "Invalid PastelID format"),
  messageBody: z.string()
    .min(1, "Message body is required")
    .max(10000, "Message too long - maximum 10000 characters")
});

type SendMessageRequest = z.infer<typeof sendMessageSchema>;

/**
 * @swagger
 * /api/messages:
 *   get:
 *     tags: [Messages]
 *     summary: Get messages
 *     description: Retrieve received messages for authenticated PastelID
 *     security:
 *       - pastelIDAuth: []
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserMessage'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export async function GET(): Promise<NextResponse> {
  try {
    const messages = await api.getReceivedMessages();
    return NextResponse.json(messages);
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
 * /api/messages:
 *   post:
 *     tags: [Messages]
 *     summary: Send message
 *     description: Send a message to another PastelID
 *     security:
 *       - pastelIDAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - toPastelID
 *               - messageBody
 *             properties:
 *               toPastelID:
 *                 type: string
 *                 description: Recipient's PastelID
 *                 pattern: ^jX[A-Za-z0-9]{84}$
 *                 example: jXYourPastelIDHere...
 *               messageBody:
 *                 type: string
 *                 description: Message content
 *                 maxLength: 10000
 *                 example: Hello, this is a test message
 *     responses:
 *       200:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - sent_messages
 *                 - received_messages
 *               properties:
 *                 sent_messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserMessage'
 *                 received_messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserMessage'
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
    const validatedData = sendMessageSchema.parse(body) as SendMessageRequest;
    
    const result = await api.sendMessage(
      validatedData.toPastelID,
      validatedData.messageBody
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
 * components:
 *   schemas:
 *     UserMessage:
 *       type: object
 *       required:
 *         - id
 *         - from_pastelid
 *         - to_pastelid
 *         - message_body
 *         - message_signature
 *         - timestamp
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         from_pastelid:
 *           type: string
 *           pattern: ^jX[A-Za-z0-9]{84}$
 *         to_pastelid:
 *           type: string
 *           pattern: ^jX[A-Za-z0-9]{84}$
 *         message_body:
 *           type: string
 *         message_signature:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 */