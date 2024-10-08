// src/app/page.tsx

'use client';

import { useState, useEffect } from "react";
import Header from "./components/Header";
import UserInfo from "./components/UserInfo";
import CreateCreditPackTicket from "./components/CreateCreditPackTicket";
import SelectCreditPackTicket from "./components/SelectCreditPackTicket";
import CreateInferenceRequest from "./components/CreateInferenceRequest";
import PreviousRequests from "./components/PreviousRequests";
import MessageSystem from "./components/MessageSystem";
import WalletManagement from "./components/WalletManagement";
import dynamic from 'next/dynamic';
import { ModelMenu } from "./types";
import * as api from './lib/api';

const DynamicTerminal = dynamic(() => import('./components/Terminal'), { ssr: false });

export default function Home() {
  const [pastelId, setPastelId] = useState<string | null>(null);
  const [supernodeUrl, setSupernodeUrl] = useState<string>("");
  const [modelMenu, setModelMenu] = useState<ModelMenu | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        if (pastelId) {
          const url = await api.getBestSupernodeUrl(pastelId);
          setSupernodeUrl(url);

          const menu = await api.getInferenceModelMenu();
          setModelMenu(menu);
        }
      } catch (error) {
        console.error("Initialization error:", error);
      }
    };

    initialize();
  }, [pastelId]);

  return (
    <main className="flex flex-col gap-6 transition-all duration-300 bg-bw-50">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <Header />
        <UserInfo pastelId={pastelId} setPastelId={setPastelId} />
        <CreateCreditPackTicket />
        <SelectCreditPackTicket />
        <CreateInferenceRequest
          modelMenu={modelMenu}
          supernodeUrl={supernodeUrl}
        />
        <PreviousRequests />
        <MessageSystem pastelId={pastelId} />
        <WalletManagement />
        <DynamicTerminal />
      </div>
    </main>
  );
}