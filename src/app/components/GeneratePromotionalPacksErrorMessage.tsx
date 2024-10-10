// src/app/components/GeneratePromotionalPacksErrorMessage.tsx

'use client'

import useStore from '../store/useStore';

export default function GeneratePromotionalPacksErrorMessage() {
  const { promoGeneratorMessage } = useStore();
  if (!promoGeneratorMessage) {
    return
  }
  return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4" role="alert">
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline ml-1">{promoGeneratorMessage}</span>
    </div>
  );
}