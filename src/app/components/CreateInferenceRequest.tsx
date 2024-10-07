// src/app/components/CreateInferenceRequest.tsx

/* eslint-disable @next/next/no-img-element */
'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react';
import compress from 'browser-image-compression';
import { ModelMenu, ModelInfo, ModelParameter, InferenceResultDict, InferenceRequestParams } from '@/app/types';

interface CreateInferenceRequestProps {
  modelMenu: ModelMenu | null;
  supernodeUrl: string;
}

export default function CreateInferenceRequest({ modelMenu, supernodeUrl }: CreateInferenceRequestProps) {
  const [inferenceType, setInferenceType] = useState<string>('text_completion');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('Write me a Shakespeare-style sonnet about Pastel Network and how it\'s really decentralized and powerful.');
  const [imagePrompt, setImagePrompt] = useState<string>('A picture of a clown holding a sign that says PASTEL');
  const [question, setQuestion] = useState<string>('');
  const [maxCost, setMaxCost] = useState<string>('200');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const [modelParameters, setModelParameters] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string>('');
  const [inferenceResult, setInferenceResult] = useState<InferenceResultDict | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const generateModelParameterFields = useCallback((model: ModelInfo) => {
    const params: Record<string, string> = {};
    model.model_parameters.forEach((param: ModelParameter) => {
      if (param.inference_types_parameter_applies_to.includes(inferenceType)) {
        params[param.name] = param.default.toString();
      }
    });
    setModelParameters(params);
  }, [inferenceType]);
  
  useEffect(() => {
    if (modelMenu) {
      const defaultModel = modelMenu.models.find(model => 
        model.supported_inference_type_strings.includes(inferenceType)
      );
      if (defaultModel) {
        setSelectedModel(defaultModel.model_name);
        generateModelParameterFields(defaultModel);
      }
    }
  }, [generateModelParameterFields, inferenceType, modelMenu]);

  const handleInferenceTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setInferenceType(e.target.value);
    setPrompt('');
    setImagePrompt('');
    setQuestion('');
    setModelParameters({});
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedModelName = e.target.value;
    setSelectedModel(selectedModelName);
    if (modelMenu) {
      const model = modelMenu.models.find(m => m.model_name === selectedModelName);
      if (model) {
        generateModelParameterFields(model);
      }
    }
  };

  const handleParameterChange = (name: string, value: string) => {
    setModelParameters(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus('Creating new inference request...');
    setInferenceResult(null);

    try {
      let modelInputData: Record<string, any> = {};
      let fileData: string | null = null;

      if (inferenceType === 'text_completion') {
        modelInputData.prompt = prompt;
      } else if (inferenceType === 'text_to_image') {
        modelInputData.imagePrompt = imagePrompt;
      } else if (inferenceType === 'ask_question_about_an_image') {
        if (fileInputRef.current && fileInputRef.current.files && fileInputRef.current.files[0]) {
          fileData = await compressAndEncodeImage(fileInputRef.current.files[0]);
        }
        modelInputData = { image: fileData, question };
      } else if (inferenceType === 'embedding_document' || inferenceType === 'embedding_audio') {
        if (fileInputRef.current && fileInputRef.current.files && fileInputRef.current.files[0]) {
          fileData = await encodeFile(fileInputRef.current.files[0]);
        }
        const semanticQueryString = document.querySelector<HTMLInputElement>(
          inferenceType === 'embedding_document' ? '#document_semantic_query_string' : '#audio_semantic_query_string'
        )?.value || '';
        modelInputData = { 
          [inferenceType === 'embedding_document' ? 'document' : 'audio']: fileData,
          question: semanticQueryString
        };
      }

      const response = await fetch('/create-inference-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedCreditPackTicketId: (document.querySelector('input[name="creditPackTicket"]:checked') as HTMLInputElement)?.value,
          selectedInferenceType: inferenceType,
          selectedModelCanonicalName: selectedModel,
          maxCost: parseFloat(maxCost),
          modelParametersJSONBase64Encoded: btoa(JSON.stringify(modelParameters)),
          modelInputDataJSONBase64Encoded: btoa(JSON.stringify(modelInputData)),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setStatus('Inference request created successfully.');
        setInferenceResult(result.result.inferenceResultDict);
        saveInferenceRequestToLocalStorage(result.result.inferenceResultDict);
      } else {
        throw new Error(result.message || 'Failed to create inference request');
      }
    } catch (error) {
      console.error('Error creating inference request:', error);
      setStatus(`Failed to create inference request: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const compressAndEncodeImage = async (file: File): Promise<string> => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };
    const compressedFile = await compress(file, options);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(compressedFile);
    });
  };

  const encodeFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const saveInferenceRequestToLocalStorage = (inferenceResultDict: InferenceResultDict) => {
    const requests = JSON.parse(localStorage.getItem('inferenceRequests') || '[]');
    const elapsedTimeInSeconds = Math.floor(
      (new Date().getTime() - new Date(inferenceResultDict.request_data.inference_request_utc_iso_string).getTime()) / 1000
    );

    const newRequest = {
      selectedInferenceType: inferenceType,
      selectedModelCanonicalName: selectedModel,
      inputFields: inferenceResultDict.model_input_data_json,
      parameterFields: modelParameters,
      maxCost: parseFloat(maxCost),
      inferenceResultsDecoded: inferenceResultDict.inference_result_decoded || '',
      prompt: prompt,
      elapsedTimeInSeconds: elapsedTimeInSeconds,
      actualCreditsUsed: inferenceResultDict.usage_request_response.proposed_cost_of_request_in_inference_credits,
      remainingCredits: inferenceResultDict.usage_request_response.remaining_credits_in_pack_after_request_processed,
      respondingSupernode: inferenceResultDict.output_results.responding_supernode_pastelid,
      requestTimestamp: inferenceResultDict.request_data.inference_request_utc_iso_string,
    };
    requests.push(newRequest);
    localStorage.setItem('inferenceRequests', JSON.stringify(requests));
  };

  const renderInferenceResult = () => {
    if (!inferenceResult) return null;

    let content;
    if (inferenceType === 'text_to_image') {
      content = (
        <div className="m-8">
          <img 
            src={`data:image/png;base64,${inferenceResult.generated_image_decoded || ''}`} 
            alt="Generated Image" 
            className="max-w-full max-h-96 mx-auto mb-4"
          />
          <p className="text-center">
            <a 
              href={`data:image/png;base64,${inferenceResult.generated_image_decoded || ''}`} 
              download="generated_image.png" 
              className="btn success outline m-4"
            >
              Download Image
            </a>
          </p>
        </div>
      );
    } else if (inferenceType === 'embedding_audio') {
      let formattedResult = '';
      try {
        formattedResult = JSON.stringify(JSON.parse(inferenceResult.inference_result_decoded || '{}'), null, 2);
      } catch {
        formattedResult = inferenceResult.inference_result_decoded || '';
      }
      const inputData = inferenceResult.model_input_data_json as { audio_file_name?: string; question?: string };
      content = (
        <div>
          <p>Original File Name: {inputData.audio_file_name || 'N/A'}</p>
          <p>Semantic Query String: {inputData.question || 'N/A'}</p>
          <div style={{ maxHeight: '1000px', overflowY: 'auto' }}>
            <pre>{formattedResult}</pre>
          </div>
        </div>
      );
    } else if (inferenceType === 'ask_question_about_an_image') {
      const inputData = inferenceResult.model_input_data_json as { image?: string; question?: string };
      content = (
        <div>
          <img 
            src={inputData.image || ''} 
            alt="Input Image" 
            style={{ maxWidth: '100%', maxHeight: '400px' }}
          />
          <p>Question: {inputData.question || 'N/A'}</p>
          <p>Answer:</p>
          <div dangerouslySetInnerHTML={{ __html: inferenceResult.inference_result_decoded || '' }} />
        </div>
      );
    } else {
      content = <div dangerouslySetInnerHTML={{ __html: inferenceResult.inference_result_decoded || '' }} />;
    }

    const inputData = inferenceResult.model_input_data_json as { 
      prompt?: string; 
      imagePrompt?: string; 
      question?: string; 
    };

    return (
      <div className="inference-result">
        <h3 className="font-bold text-xl mb-4">Inference Result:</h3>
        <div className="mb-4">{content}</div>
        <h3 className="font-bold text-xl mt-6 mb-4">Misc. Inference Parameters and Statistics:</h3>
        <table className="inference-table">
          <tbody>
            <tr>
              <th>Input Prompt to LLM</th>
              <td>{inputData.prompt || inputData.imagePrompt || inputData.question || 'N/A'}</td>
            </tr>
            <tr>
              <th>Actual Cost (Credits)</th>
              <td>{inferenceResult.usage_request_response.proposed_cost_of_request_in_inference_credits}</td>
            </tr>
            <tr>
              <th>Remaining Credits</th>
              <td>{inferenceResult.usage_request_response.remaining_credits_in_pack_after_request_processed}</td>
            </tr>
            <tr>
              <th>Request Timestamp</th>
              <td>{new Date(inferenceResult.request_data.inference_request_utc_iso_string).toISOString()}</td>
            </tr>
            <tr>
              <th>Model</th>
              <td>{selectedModel}</td>
            </tr>
            <tr>
              <th>Total Time in Seconds to Process Request</th>
              <td>{Math.floor((new Date().getTime() - new Date(inferenceResult.request_data.inference_request_utc_iso_string).getTime()) / 1000)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 p-4 has-border rounded-xl bg-white shadow-md">
      <h2 className="text-2xl text-bw-800">Create New Inference Request</h2>
      <form id="inferenceRequestForm" className="grid grid-cols-2 gap-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-bw-700 font-bold mb-2" htmlFor="inferenceType">Inference Type</label>
          <select 
            id="inferenceType" 
            className="select w-full"
            value={inferenceType}
            onChange={handleInferenceTypeChange}
          >
            <option value="text_completion">Text Completion</option>
            <option value="ask_question_about_an_image">Ask a Question About an Image</option>
            <option value="text_to_image">Image Generation</option>
            <option value="embedding_document">Embedding Document</option>
            <option value="embedding_audio">Audio Transcript and Embedding</option>
          </select>
        </div>
        <div>
          <label className="block text-bw-700 font-bold mb-2" htmlFor="model">Model/Service</label>
          <select 
            id="model" 
            className="select w-full"
            value={selectedModel}
            onChange={handleModelChange}
          >
            {modelMenu?.models
              .filter(model => model.supported_inference_type_strings.includes(inferenceType))
              .map(model => (
                <option key={model.model_name} value={model.model_name}>
                  {model.model_name}
                </option>
              ))
            }
          </select>
        </div>

        {inferenceType === 'text_completion' && (
          <div id="textCompletionSettings" className="col-span-full">
            <div className="mb-4">
              <label className="block text-bw-700 font-bold mb-2" htmlFor="prompt">Prompt</label>
              <textarea 
                className="input w-full" 
                id="prompt" 
                rows={5} 
                placeholder="Enter your prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              ></textarea>
            </div>
          </div>
        )}

        {inferenceType === 'text_to_image' && (
          <div id="imageGenerationSettings" className="col-span-full">
            <div className="mb-4">
              <label className="block text-bw-700 font-bold mb-2" htmlFor="imagePrompt">Image Prompt</label>
              <textarea 
                className="input w-full" 
                id="imagePrompt" 
                rows={5} 
                placeholder="Enter your image prompt"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
              ></textarea>
            </div>
          </div>
        )}

        {inferenceType === 'embedding_document' && (
          <div id="embeddingDocumentSettings" className="col-span-full">
            <div className="mb-4">
              <label className="block text-bw-700 font-bold mb-2" htmlFor="embeddingDocumentFile">Document to Embed</label>
              <input 
                type="file" 
                className="input w-full" 
                id="embeddingDocumentFile" 
                accept=".pdf,.doc,.docx,.txt"
                ref={fileInputRef}
              />
            </div>
            <div className="mb-4">
              <label className="block text-bw-700 font-bold mb-2" htmlFor="document_semantic_query_string">Semantic Query String (Optional):</label>
              <input 
                className="input w-full" 
                id="document_semantic_query_string" 
                type="text"
                placeholder="Enter your query"
              />
            </div>
          </div>
        )}

        {inferenceType === 'embedding_audio' && (
          <div id="embeddingAudioSettings" className="col-span-full">
            <div className="mb-4">
              <label className="block text-bw-700 font-bold mb-2" htmlFor="embeddingAudioFile">Audio File to Transcribe and Embed</label>
              <input 
                type="file" 
                className="input w-full" 
                id="embeddingAudioFile" 
                accept="audio/*"
                ref={fileInputRef}
              />
            </div>
            <div className="mb-4">
              <label className="block text-bw-700 font-bold mb-2" htmlFor="audio_semantic_query_string">Semantic Query String (Optional):</label>
              <input 
                className="input w-full" 
                id="audio_semantic_query_string" 
                type="text"
                placeholder="Enter your query"
              />
            </div>
          </div>
        )}

        {inferenceType === 'ask_question_about_an_image' && (
          <div id="askQuestionAboutImageSettings" className="col-span-full">
            <div className="mb-4">
              <label className="block text-bw-700 font-bold mb-2" htmlFor="imageFile">Image File</label>
              <input 
                type="file" 
                className="input w-full" 
                id="imageFile" 
                accept="image/*"
                ref={fileInputRef}
              />
            </div>
            <div className="mb-4">
              <label className="block text-bw-700 font-bold mb-2" htmlFor="question">Question</label>
              <input 
                className="input w-full" 
                id="question" 
                type="text" 
                placeholder="Enter your question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-bw-700 font-bold mb-2" htmlFor="maxCost">Maximum Cost (Credits)</label>
          <input 
            className="input w-full" 
            id="maxCost" 
            type="text" 
            placeholder="Enter maximum cost" 
            value={maxCost}
            onChange={(e) => setMaxCost(e.target.value)}
          />
        </div>

        <div className="col-span-full">
          <button 
            type="button" 
            className="btn success outline" 
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
          >
            {showAdvancedSettings ? 'Hide advanced settings' : 'Show advanced settings'}
          </button>
        </div>

        {showAdvancedSettings && (
          <div id="modelAdvancedSettingsContent" className="col-span-full mt-4">
            <div id="modelParametersContainer">
              {Object.entries(modelParameters).map(([key, value]) => (
                <div key={key} className="mb-4">
                  <label className="block text-bw-700 font-bold mb-2" htmlFor={key}>{key}</label>
                  <input 
                    className="input w-full" 
                    id={key} 
                    type="text" 
                    value={value}
                    onChange={(e) => handleParameterChange(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="col-span-full flex justify-between">
          <div className="flex gap-4 items-center" style={{ width: '100%' }}>
            <button 
              className="btn success outline" 
              type="submit" 
              style={{ width: '180px' }}
              disabled={isLoading}
            >
              Create Inference Request
            </button>
            {isLoading && <div className="btn is-loading">Processing...</div>}
            <div className="prompt success xs" id="currentStatusContainer">
              <label className="text-bw-800 font-bold mb-4" htmlFor="currentStatus">Current Status:</label>
              <div className="content p-2" id="currentStatus">{status}</div>
            </div>
          </div>
        </div>
      </form>

      <div id="inferenceRequestResult">
        {renderInferenceResult()}
      </div>
    </div>
  );
}
