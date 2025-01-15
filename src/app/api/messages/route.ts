// src/app/api/messages/route.ts

import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';

/**
 * @swagger
 * /api/messages/send:
 *   post:
 *     tags: [Messages]
 *     summary: Send message
 *     description: Send a message to another PastelID
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
 *               messageBody:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sent_messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserMessage'
 *                 received_messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserMessage'
 */
export async function POST(request: Request) {
  try {
    const { toPastelID, messageBody } = await request.json();
    const result = await api.sendMessage(toPastelID, messageBody);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

/**
 * @swagger
 * /api/messages:
 *   get:
 *     tags: [Messages]
 *     summary: Get messages
 *     description: Retrieve received messages for authenticated PastelID
 *     responses:
 *       200:
 *         description: List of messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserMessage'
 */
export async function GET() {
  try {
    const messages = await api.getReceivedMessages();
    return NextResponse.json(messages);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     UserMessage:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         from_pastelid:
 *           type: string
 *         to_pastelid:
 *           type: string
 *         message_body:
 *           type: string
 *         message_signature:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 */