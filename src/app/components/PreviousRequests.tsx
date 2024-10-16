// src/app/components/PreviousRequests.tsx

/* eslint-disable @next/next/no-img-element */
'use client'

import React, { useState, useEffect } from 'react';

interface InferenceRequest {
  selectedInferenceType: string;
  prompt: string;
  inputFields: {
    imagePrompt?: string;
    question?: string;
    document_file_name?: string;
    audio_file_name?: string;
  };
  selectedModelCanonicalName: string;
  actualCreditsUsed: number;
  remainingCredits: number;
  requestTimestamp: string;
  elapsedTimeInSeconds: number;
  inferenceResultsDecoded: string;
}

export default function PreviousRequests() {
  const [requests, setRequests] = useState<InferenceRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<InferenceRequest | null>(null);

  useEffect(() => {
    const storedRequests = localStorage.getItem('inferenceRequests');
    if (storedRequests) {
      setRequests(JSON.parse(storedRequests));
    }
  }, []);

  const getInferenceTypeIcon = (type: string) => {
    switch (type) {
      case 'text_completion':
        return '🖹';
      case 'text_to_image':
        return '🖼️';
      case 'ask_question_about_an_image':
        return '🖺';
      case 'embedding_document':
        return '🔢';
      case 'embedding_audio':
        return '🕪';
      default:
        return '❔';
    }
  };

  const getPromptPreview = (request: InferenceRequest) => {
    if (request.selectedInferenceType === 'text_to_image') {
      return request.inputFields.imagePrompt?.substring(0, 40) || 'No prompt available';
    } else if (request.selectedInferenceType === 'ask_question_about_an_image') {
      return request.inputFields.question?.substring(0, 40) || 'No question available';
    } else if (request.selectedInferenceType === 'embedding_document') {
      return request.inputFields.document_file_name || 'No document name available';
    } else if (request.selectedInferenceType === 'embedding_audio') {
      return request.inputFields.audio_file_name || 'No audio file name available';
    } else {
      return request.prompt?.substring(0, 40) || 'No prompt available';
    }
  };

  const deleteRequest = (index: number) => {
    const updatedRequests = requests.filter((_, i) => i !== index);
    setRequests(updatedRequests);
    localStorage.setItem('inferenceRequests', JSON.stringify(updatedRequests));
    if (selectedRequest === requests[index]) {
      setSelectedRequest(null);
    }
  };

  const exportRequests = () => {
    if (requests.length === 0) {
      alert('No saved inference requests to export.');
      return;
    }

    let markdownContent = "# Saved Inference Requests\n\n";
    requests.forEach((request, index) => {
      markdownContent += `## Inference Request ${index + 1}\n`;
      markdownContent += `**Prompt**: ${request.prompt || request.inputFields.imagePrompt || request.inputFields.question || ''}\n\n`;
      markdownContent += `**Inference Results**:\n\n`;

      if (request.selectedInferenceType === 'text_to_image') {
        markdownContent += `![Generated Image](${request.inferenceResultsDecoded})\n\n`;
      } else {
        markdownContent += `\`\`\`\n${request.inferenceResultsDecoded}\n\`\`\`\n\n`;
      }

      markdownContent += `**Model**: ${request.selectedModelCanonicalName}\n`;
      markdownContent += `**Actual Cost (Credits)**: ${request.actualCreditsUsed}\n`;
      markdownContent += `**Remaining Credits**: ${request.remainingCredits}\n`;
      markdownContent += `**Misc. Inference Parameters and Statistics**:\n`;
      markdownContent += `| Parameter | Value |\n`;
      markdownContent += `| --- | --- |\n`;
      markdownContent += `| Input Prompt to LLM | ${request.prompt || request.inputFields.imagePrompt || request.inputFields.question || ''} |\n`;
      markdownContent += `| Actual Cost (Credits) | ${request.actualCreditsUsed} |\n`;
      markdownContent += `| Remaining Credits | ${request.remainingCredits} |\n`;
      markdownContent += `| Model | ${request.selectedModelCanonicalName} |\n`;
      markdownContent += `| Request Timestamp | ${request.requestTimestamp} |\n`;
      markdownContent += `| Total Time (Seconds) | ${request.elapsedTimeInSeconds} |\n`;
      markdownContent += `\n\n`;
    });

    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inference_requests.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderRequestPreview = (request: InferenceRequest) => {
    let content: JSX.Element;

    if (request.selectedInferenceType === 'text_to_image') {
      content = (
        <div className="mb-4">
          <img src={request.inferenceResultsDecoded} alt="Generated Image" style={{maxWidth: '100%', maxHeight: '400px'}} />
          <p className="text-sm italic m-2">(This is a compressed version of the original generated image.)</p>
        </div>
      );
    } else {
      content = (
        <div className="mb-4">
          <pre className="whitespace-pre-wrap">{request.inferenceResultsDecoded}</pre>
        </div>
      );
    }

    return (
      <div className="previous-inference">
        <h3 className="font-bold text-xl mb-4">Inference Result:</h3>
        {content}
        <h3 className="font-bold text-xl mt-6 mb-4">Misc. Inference Parameters and Statistics:</h3>
        <table className="inference-table">
          <tbody>
            <tr>
              <th>
                {request.selectedInferenceType === 'ask_question_about_an_image'
                  ? "Question"
                  : request.selectedInferenceType === 'embedding_document'
                  ? "Input Document Name"
                  : request.selectedInferenceType === 'text_to_image'
                  ? "Image Generation Prompt"
                  : "Input Prompt to LLM"}
              </th>
              <td>
                {request.selectedInferenceType === 'ask_question_about_an_image'
                  ? request.inputFields.question
                  : request.selectedInferenceType === 'embedding_document'
                  ? request.inputFields.document_file_name
                  : request.selectedInferenceType === 'text_to_image'
                  ? request.inputFields.imagePrompt
                  : request.prompt}
              </td>
            </tr>
            <tr><th>Actual Cost (Credits)</th><td>{request.actualCreditsUsed}</td></tr>
            <tr><th>Remaining Credits</th><td>{request.remainingCredits}</td></tr>
            <tr><th>Request Timestamp</th><td>{request.requestTimestamp}</td></tr>
            <tr><th>Model</th><td>{request.selectedModelCanonicalName}</td></tr>
            <tr><th>Total Time in Seconds to Process Request</th><td>{request.elapsedTimeInSeconds}</td></tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-4 has-border rounded-xl bg-white shadow-md" style={{height: '1000px', overflowY: 'auto'}}>
      <div className="lg:col-span-1 flex flex-col">
        <h2 className="text-2xl mb-4 text-bw-800">
          View Previous Inference Requests
        </h2>
        <div id="previousRequestsList" className="bg-gray-100 p-4 rounded-lg overflow-y-auto flex-grow" style={{maxHeight: '1200px'}}>
          {requests.length === 0 ? (
            <p className="text-gray-500">No saved inference requests to display. Create new ones and they will display here when they finish successfully.</p>
          ) : (
            requests.map((request, index) => (
              <div 
                key={index}
                className="mb-2 p-2 bg-white rounded-lg flex justify-between items-center cursor-pointer"
                onClick={() => setSelectedRequest(request)}
              >
                <span>
                  <span className="icon-large">{getInferenceTypeIcon(request.selectedInferenceType)}</span> {getPromptPreview(request)}...
                </span>
                <button 
                  className="delete-btn" 
                  style={{fontSize: '0.75rem'}} 
                  title="Delete entry?" 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteRequest(index);
                  }}
                >
                  ❌
                </button>
              </div>
            ))
          )}
        </div>
        <button 
          id="exportRequestsButton" 
          className="btn success outline mt-4 flex items-center self-start"
          onClick={exportRequests}
        >
          💾 Export all Saved Inference Requests
        </button>
      </div>
      <div id="requestPreview" className="lg:col-span-2 bg-gray-50 p-4 rounded-lg">
        {selectedRequest ? (
          renderRequestPreview(selectedRequest)
        ) : (
          <p className="text-gray-500">Select a request to view details</p>
        )}
      </div>
    </div>
  );
}