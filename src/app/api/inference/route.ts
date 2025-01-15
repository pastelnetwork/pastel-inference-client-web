// src/app/api/inference/route.ts

import { NextResponse } from 'next/server';
import * as api from '@/app/lib/api';
import { z } from 'zod';

// Input validation schemas
const baseModelInputSchema = z.object({
  creditPackTicketPastelTxid: z.string()
    .min(1, "Credit pack transaction ID is required"),
  requestedModelCanonicalString: z.string()
    .min(1, "Model name is required"),
  modelInferenceTypeString: z.enum([
    'text_completion',
    'text_to_image',
    'ask_question_about_an_image'
  ]),
  modelParameters: z.record(z.unknown()),
  maximumInferenceCostInCredits: z.number()
    .positive()
    .min(0.00000001, "Minimum cost must be positive")
});

const textCompletionInputSchema = z.object({
  prompt: z.string().min(1, "Prompt is required")
});

const imageGenerationInputSchema = z.object({
  imagePrompt: z.string().min(1, "Image prompt is required")
});

const imageQuestionInputSchema = z.object({
  image: z.string()
    .min(1, "Image data is required")
    .regex(/^data:image\/[a-z]+;base64,/, "Invalid image format"),
  question: z.string().min(1, "Question is required")
});

const inferenceRequestSchema = baseModelInputSchema.extend({
  modelInputData: z.union([
    textCompletionInputSchema,
    imageGenerationInputSchema,
    imageQuestionInputSchema
  ])
});

type InferenceRequest = z.infer<typeof inferenceRequestSchema>;

/**
 * @swagger
 * /api/inference:
 *   get:
 *     tags: [Inference]
 *     summary: Get available inference models
 *     description: Retrieves list of available models and their capabilities
 *     security:
 *       - pastelIDAuth: []
 *     responses:
 *       200:
 *         description: List of models retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModelMenu'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export async function GET(): Promise<NextResponse> {
  try {
    const modelMenu = await api.getInferenceModelMenu();
    return NextResponse.json(modelMenu);
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
 * /api/inference:
 *   post:
 *     tags: [Inference]
 *     summary: Create new inference request
 *     description: Makes a new inference request using specified model and parameters
 *     security:
 *       - pastelIDAuth: []
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
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       402:
 *         description: Insufficient credits
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    // Validate request body
    const validatedData = inferenceRequestSchema.parse(body) as InferenceRequest;
    
    const result = await api.createInferenceRequest(
      validatedData,
      (msg) => console.log(msg)  // Progress callback
    );

    if (!result) {
      throw new Error('Inference request failed');
    }

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
    const status = error instanceof Error && error.message.includes('insufficient') ? 402 : 500;
    
    return NextResponse.json(
      { error: errorMessage },
      { status }
    );
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     ModelMenu:
 *       type: object
 *       properties:
 *         models:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Model'
 *     Model:
 *       type: object
 *       required:
 *         - model_name
 *         - supported_inference_type_strings
 *       properties:
 *         model_name:
 *           type: string
 *         supported_inference_type_strings:
 *           type: array
 *           items:
 *             type: string
 *         model_parameters:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ModelParameter'
 *     ModelParameter:
 *       type: object
 *       required:
 *         - name
 *         - type
 *       properties:
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         type:
 *           type: string
 *         default:
 *           oneOf:
 *             - type: string
 *             - type: number
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
 *           format: base64
 *         question:
 *           type: string
 *     InferenceResult:
 *       type: object
 *       required:
 *         - supernode_url
 *         - request_data
 *         - usage_request_response
 *         - model_input_data_json
 *         - output_results
 *       properties:
 *         supernode_url:
 *           type: string
 *         request_data:
 *           $ref: '#/components/schemas/InferenceRequest'
 *         usage_request_response:
 *           $ref: '#/components/schemas/InferenceResponse'
 *         model_input_data_json:
 *           type: object
 *         output_results:
 *           $ref: '#/components/schemas/InferenceOutput'
 *         generated_image_decoded:
 *           type: string
 *         inference_result_decoded:
 *           type: string
 */