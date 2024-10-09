// src/app/page.tsx

'use client';

import React, { useEffect } from "react";

import ErrorBoundary from '../components/ErrorBoundary';
import GeneratePromotionalPacks from '../components/GeneratePromotionalPacks';
import RecoverExistingCreditPacks from '../components/RecoverExistingCreditPacks';
import OperationLog from '../components/OperationLog';
import GenerationResult from '../components/GenerationResult';
import ExistingPromotionalPacks from '../components/ExistingPromotionalPacks';
import GeneratingPromotionalPacks from '../components/GeneratingPromotionalPacks';
import GeneratePromotionalPacksErrorMessage from '../components/GeneratePromotionalPacksErrorMessage';
import useStore from '../store/useStore';
import browserLogger from "../lib/logger";

export default function Home() {
  const {
    initializeWallet,
    isLoading,
    error,
    isInitialized,
    setError
  } = useStore();

  useEffect(() => {
    const init = async () => {
      browserLogger.info("Initializing wallet...");
      try {
        await initializeWallet();
        browserLogger.info("Wallet initialized successfully");
      } catch (err) {
        browserLogger.error("Initialization error:", err);
        setError("Failed to initialize the application. Please refresh and try again.");
      }
    };
    init();
  }, [initializeWallet, setError]);

  if (isLoading || !isInitialized) {
    return <div className="flex justify-center items-center h-screen">Initializing application...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen text-red-500">{error}</div>;
  }

  return (
    <ErrorBoundary>
      <main className="bg-gray-100">
        <div className="container mx-auto p-4">
          <h1 className="text-3xl font-bold mb-6 text-center text-blue-600">Promotional Pack Generator</h1>
          <GeneratePromotionalPacks />
          <RecoverExistingCreditPacks />
          <OperationLog />
          <GenerationResult />
          <ExistingPromotionalPacks />
          <GeneratingPromotionalPacks />
          <GeneratePromotionalPacksErrorMessage />
        </div>
      </main>
    </ErrorBoundary>
  );
}