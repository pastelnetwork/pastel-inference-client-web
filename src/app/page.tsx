// src/app/page.tsx

"use client";

import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import Header from "./components/Header";
import UserInfo from "./components/UserInfo";
import CreateCreditPackTicket from "./components/CreateCreditPackTicket";
import SelectCreditPackTicket from "./components/SelectCreditPackTicket";
import CreateInferenceRequest from "./components/CreateInferenceRequest";
import PreviousRequests from "./components/PreviousRequests";
import MessageSystem from "./components/MessageSystem";
import WalletManagement from "./components/WalletManagement";
import ErrorBoundary from "./components/ErrorBoundary";
import useStore from "./store/useStore";
import browserLogger from "./lib/logger";
import PasswordQRCode from "./components/PasswordQRCode";
import QRCodeScanner from "./components/QRCodeScanner";

const DynamicTerminal = dynamic(() => import("./components/Terminal"), {
  ssr: false,
});

export default function Home() {
  const {
    initializeWallet,
    isLoading,
    error,
    pastelId,
    modelMenu,
    fetchModelMenu,
    isInitialized,
    isLocked,
    setShowQRScanner,
    setError,
  } = useStore();

  useEffect(() => {
    const init = async () => {
      browserLogger.info("Initializing wallet...");
      try {
        await initializeWallet();
        browserLogger.info("Wallet initialized successfully");
      } catch (err) {
        browserLogger.error("Initialization error:", err);
        setError(
          "Failed to initialize the application. Please refresh and try again."
        );
      }
    };
    init();
  }, [initializeWallet, setError]);

  useEffect(() => {
    const fetchData = async () => {
      if (isInitialized && pastelId) {
        browserLogger.info("Fetching model menu...");
        try {
          await fetchModelMenu();
          browserLogger.info("Model menu fetched successfully");
        } catch (err) {
          browserLogger.error("Data fetching error:", err);
          setError("Failed to fetch necessary data. Please try again.");
        }
      }
    };
    fetchData();
  }, [isInitialized, pastelId, fetchModelMenu, setError]);

  if (isLoading || !isInitialized) {
    return (
      <div className="flex justify-center items-center h-screen">
        Initializing application...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen text-red-500">
        {error}
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <main className="flex flex-col gap-6 transition-all duration-300 bg-bw-50">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <Header />
          <PasswordQRCode />
          <QRCodeScanner />
          {isLocked ? (
            <div className="text-center py-10">
              <h2 className="text-2xl font-bold mb-4">Wallet is locked</h2>
              <button
                className="bg-blue-500 text-white px-4 py-2 rounded"
                onClick={() => setShowQRScanner(true)}
              >
                Scan QR Code to Unlock
              </button>
            </div>
          ) : (
            <>
              <UserInfo />
              <CreateCreditPackTicket />
              <SelectCreditPackTicket />
              <CreateInferenceRequest modelMenu={modelMenu} />
              <PreviousRequests />
              <MessageSystem />
              <WalletManagement />
              <DynamicTerminal />
            </>
          )}
        </div>
      </main>
    </ErrorBoundary>
  );
}
