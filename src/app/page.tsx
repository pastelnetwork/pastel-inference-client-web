"use client";

import { useState, useEffect } from "react";
import Header from "./components/Header";
import UserInfo from "./components/UserInfo";
import CreateCreditPackTicket from "./components/CreateCreditPackTicket";
import SelectCreditPackTicket from "./components/SelectCreditPackTicket";
import CreateInferenceRequest from "./components/CreateInferenceRequest";
import PreviousRequests from "./components/PreviousRequests";
import MessageSystem from "./components/MessageSystem";
import WalletManagement from "./components/WalletManagement";
import Terminal from "./components/Terminal";

declare global {
  interface Window {
    axios: any;
  }
}

export default function Home() {
  const [pastelId, setPastelId] = useState<string | null>(null);
  const [networkName, setNetworkName] = useState<string>("");
  const [supernodeUrl, setSupernodeUrl] = useState<string>("");
  const [modelMenu, setModelMenu] = useState<any>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Use the global axios instance
        const { data: networkInfo } = await window.axios.get(
          "/get-network-info"
        );
        setNetworkName(networkInfo.network);

        if (pastelId) {
          const { data: url } = await window.axios.get(
            "/get-best-supernode-url",
            {
              params: { userPastelID: pastelId },
            }
          );
          setSupernodeUrl(url);

          const { data: menu } = await window.axios.get(
            "/get-inference-model-menu"
          );
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
        <Header networkName={networkName} />
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
        <Terminal />
      </div>
    </main>
  );
}
