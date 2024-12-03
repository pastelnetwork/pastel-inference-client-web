// src/app/components/ExistingPromotionalPacks.tsx

"use client";

import { useState, useEffect } from "react";
import { Button, Select } from "antd";
import useStore from "../store/useStore";
import { CreditPack } from "@/app/types";
import BrowserRPCReplacement from "@/app/lib/BrowserRPCReplacement";
import { NetworkMode } from "@/app/types";

export default function ExistingPromotionalPacks() {
  const { setPromoGeneratorMessage, getMyValidCreditPacks } = useStore();
  const [selectedExistingPacks, setSelectedExistingPacks] = useState("");
  const [filteredPacks, setFilteredPacks] = useState<CreditPack[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadCreditPacks() {
      setIsLoading(true);
      try {
        // Initialize RPC client
        const rpc = BrowserRPCReplacement.getInstance();
        await rpc.initialize();

        // Get all credit packs
        const allPacks = await getMyValidCreditPacks();

        // Get stored private keys
        const storedKeys = JSON.parse(
          localStorage.getItem("psltKeyStore") || "{}"
        );

        // Filter packs to only include ones where we have the private key in our wallet
        const validPacks: CreditPack[] = [];

        for (const pack of allPacks) {
          try {
            const addr = pack.credit_usage_tracking_psl_address;

            // First check localStorage
            const addresses = await rpc.getAllAddresses();
            const hasAddress = addresses.includes(addr);

            if (!hasAddress) {
              // If not in wallet, check if we have the key stored
              if (!storedKeys[addr]) {
                console.log(`No stored key found for address ${addr}`);
                continue;
              }

              try {
                // Try importing the key
                const importedAddr = await rpc.importLegacyPrivateKey(
                  storedKeys[addr],
                  NetworkMode.Mainnet
                );

                // Double check the imported address matches
                if (importedAddr !== addr) {
                  console.log(`Address mismatch for ${addr}`);
                  continue;
                }

                // Verify we can use it
                await rpc.initializeWalletForTransaction(addr);

                console.log(
                  `Successfully imported and verified key for ${addr}`
                );
                validPacks.push(pack);
              } catch (error) {
                console.log(`Failed to import key for ${addr}:`, error);
                continue;
              }
            } else {
              // Address already in wallet
              try {
                await rpc.initializeWalletForTransaction(addr);
                validPacks.push(pack);
                console.log(`Using existing key in wallet for ${addr}`);
              } catch (error) {
                console.log(`Failed to use existing key for ${addr}:`, error);
                continue;
              }
            }
          } catch (error) {
            console.log(
              `Error processing pack with tracking address ${pack.credit_usage_tracking_psl_address}:`,
              error
            );
          }
        }

        setFilteredPacks(validPacks);
      } catch (error) {
        console.error("Error loading credit packs:", error);
        setPromoGeneratorMessage("Error loading credit packs");
      } finally {
        setIsLoading(false);
      }
    }

    loadCreditPacks();
  }, [getMyValidCreditPacks, setPromoGeneratorMessage]);

  const handleExistingPacksChange = (value: string) => {
    setSelectedExistingPacks(value);
  };

  const downloadExistingPack = () => {
    if (!selectedExistingPacks) {
      setPromoGeneratorMessage("Please select a pack to download.");
      return;
    }
    setPromoGeneratorMessage("");
    const selectedPack = filteredPacks.find(
      (p) => p.credit_pack_registration_txid === selectedExistingPacks
    );
    if (selectedPack) {
      console.log("Downloading pack:", selectedPack);
      // Add your download logic here
    }
  };

  const downloadAllPromoPacks = () => {
    if (filteredPacks.length === 0) {
      setPromoGeneratorMessage("No packs available to download.");
      return;
    }
    // Add your bulk download logic here
    console.log("Downloading all packs:", filteredPacks);
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-700">
        Existing Promotional Packs
      </h2>
      <Select
        loading={isLoading}
        onChange={handleExistingPacksChange}
        options={[
          {
            value: "",
            label: "--",
          },
          ...filteredPacks.map((pack) => ({
            value: pack.credit_pack_registration_txid,
            label: `Pack ${pack.credit_pack_registration_txid.slice(
              0,
              8
            )}... (${pack.credit_usage_tracking_psl_address})`,
          })),
        ]}
        className="w-full mb-4 min-h-10"
      />
      <div className="flex justify-between">
        <Button
          onClick={downloadExistingPack}
          disabled={!selectedExistingPacks || isLoading}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition duration-300 h-auto disabled:opacity-50"
        >
          Download Selected Pack
        </Button>
        <Button
          onClick={downloadAllPromoPacks}
          disabled={filteredPacks.length === 0 || isLoading}
          className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition duration-300 h-auto disabled:opacity-50"
        >
          Download All Packs (ZIP)
        </Button>
      </div>
    </div>
  );
}
