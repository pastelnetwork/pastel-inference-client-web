// src/app/components/GeneratingPromotionalPacks.tsx

'use client'

export default function GeneratingPromotionalPacks() {
  return (
    <div id="loadingIndicator" className="text-center hidden">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      <p className="mt-2 text-gray-600">Generating promotional packs...</p>
    </div>
  );
}