// src/app/components/GeneratePromotionalPacksErrorMessage.tsx

'use client'

export default function GeneratePromotionalPacksErrorMessage() {
  return (
    <div id="errorContainer"
        className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4 hidden" role="alert">
        <strong className="font-bold">Error!</strong>
        <span id="errorMessage" className="block sm:inline"></span>
    </div>
  );
}