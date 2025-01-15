// src/app/api/inference/route.ts

import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';

/**
 * @swagger
 * /api/inference/request:
 *   post:
 *     tags: [Inference]
 *     summary: Create new inference request
 *     description: Makes a new inference request using specified model and parameters
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - creditPackTicketPastelTxid
 *               - modelInputData
 *               - requestedModelCanonicalString
 *               - modelInferenceTypeString
 *               - modelParameters
 *               - maximumInferenceCostInCredits
 *             properties:
 *               creditPackTicketPastelTxid:
 *                 type: string
 *                 description: Pastel transaction ID of credit pack ticket
 *               modelInputData:
 *                 oneOf:
 *                   - $ref: '#/components/schemas/TextCompletionInput'
 *                   - $ref: '#/components/schemas/ImageGenerationInput' 
 *                   - $ref: '#/components/schemas/ImageQuestionInput'
 *               requestedModelCanonicalString:
 *                 type: string
 *                 description: Canonical name of requested model
 *               modelInferenceTypeString:
 *                 type: string
 *                 enum: [text_completion, text_to_image, ask_question_about_an_image]
 *               modelParameters:
 *                 type: object
 *                 description: Model-specific parameters
 *               maximumInferenceCostInCredits:
 *                 type: number
 *                 description: Maximum number of credits to spend
 *     responses:
 *       200:
 *         description: Inference request completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InferenceResult'
 *       400:
 *         description: Invalid request parameters
 *       402:
 *         description: Insufficient credits
 */
export async function POST(request: Request) {
    try {
      const params = await request.json();
      const result = await api.createInferenceRequest(
        params,
        (msg) => console.log(msg)
      );
      return NextResponse.json(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
  }
  

/**
 * @swagger
 * /api/inference/models:
 *   get:
 *     tags: [Inference]
 *     summary: Get available inference models
 *     description: Retrieves list of available models and their capabilities
 *     responses:
 *       200:
 *         description: List of models
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModelMenu'
 */
export async function GET() {
    try {
      const modelMenu = await api.getInferenceModelMenu();
      return NextResponse.json(modelMenu);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
  }

/**
 * @swagger
 * components:
 *   schemas:
 *     TextCompletionInput:
 *       type: object
 *       required:
 *         - prompt
 *       properties:
 *         prompt:
 *           type: string
 *     ImageGenerationInput:
 *       type: object
 *       required:
 *         - imagePrompt
 *       properties:
 *         imagePrompt:
 *           type: string
 *     ImageQuestionInput:
 *       type: object
 *       required:
 *         - image
 *         - question
 *       properties:
 *         image:
 *           type: string
 *           format: byte
 *           description: Base64 encoded image data
 *         question:
 *           type: string
 *     ModelMenu:
 *       type: object
 *       properties:
 *         models:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               model_name:
 *                 type: string
 *               supported_inference_type_strings:
 *                 type: array
 *                 items:
 *                   type: string
 *               model_parameters:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     type:
 *                       type: string
 *                     default:
 *                       oneOf:
 *                         - type: string
 *                         - type: number
 *     InferenceResult:
 *       type: object
 *       properties:
 *         supernode_url:
 *           type: string
 *         request_data:
 *           $ref: '#/components/schemas/InferenceAPIUsageRequest'
 *         usage_request_response:
 *           $ref: '#/components/schemas/InferenceAPIUsageResponse'
 *         model_input_data_json:
 *           type: object
 *         output_results:
 *           $ref: '#/components/schemas/InferenceAPIOutputResult'
 *         generated_image_decoded:
 *           type: string
 *         inference_result_decoded:
 *           type: string
 */