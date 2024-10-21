// src/app/components/WalletManagement.tsx

'use client';

import React, { useState } from "react";
import { AddressAmount, WalletInfo } from "@/app/types";
import * as api from '@/app/lib/api';
import { parseAndFormatNumber } from '@/app/lib/utils';
import useStore from "@/app/store/useStore";

export default function WalletManagement() {
  const { fetchWalletInfo, fetchPastelIDs, fetchMyPslAddress } = useStore();
  const [privKey, setPrivKey] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [walletFile, setWalletFile] = useState<File | null>(null);
  const [pastelWalletFile, setPastelWalletFile] = useState<File | null>(null);
  const [addressAmounts, setAddressAmounts] = useState<AddressAmount | null>(
    null
  );
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [walletManagementLoading, setWalletManagementLoading] = useState<{
    isWalletInfoLoading: boolean;
    isListAddressAmountsLoading: boolean;
    isImportWalletLoading: boolean;
    isPrivateKeyLoading: boolean;
  }>({
    isWalletInfoLoading: false,
    isListAddressAmountsLoading: false,
    isImportWalletLoading: false,
    isPrivateKeyLoading: false,
  });

  const importPrivKey = async () => {
    if (!privKey) {
      alert("Please enter private key!");
      return;
    }
    setWalletManagementLoading({
      ...walletManagementLoading,
      isPrivateKeyLoading: true,
    });
    try {
      await api.importPrivKey(privKey);
      alert("Private key imported successfully!");
      setPrivKey("");
    } catch (error) {
      console.error("Error importing private key:", error);
      alert("Failed to import private key. Please try again.");
    } finally {
      setWalletManagementLoading({
        ...walletManagementLoading,
        isPrivateKeyLoading: false,
      });
    }
  };

  const importWallet = async () => {
    if (!walletFile) {
      alert("Please select a Wallet file to import.");
      return;
    }
    setWalletManagementLoading({
      ...walletManagementLoading,
      isImportWalletLoading: true,
    });
    try {
      const arrayBuffer = await walletFile.arrayBuffer();
      const success = await api.loadWalletFromDatFile(arrayBuffer);
      if (success) {
        alert("Wallet imported successfully!");
        setWalletFile(null);
      } else {
        throw new Error("Failed to import wallet");
      }
    } catch (error) {
      console.error("Error importing wallet:", error);
      alert("Failed to import wallet. Please try again.");
    } finally {
      setWalletManagementLoading({
        ...walletManagementLoading,
        isImportWalletLoading: false,
      });
    }
  };

  const readWalletFile = async (file: File): Promise<string | ArrayBuffer | null> => {
    return new Promise((resolve) => {
      let reader = new FileReader();

      reader.onload = () => {
          resolve(reader.result);
      };
      reader.onerror = () => {
          resolve(null);
      };
      reader.readAsText(file, 'UTF-8');
    });
}

  const importPastelWallet = async () => {
    if (!pastelWalletFile) {
      alert("Please select a Wallet file to import.");
      return;
    }
    if (!password) {
      alert("Please enter password.");
      return;
    }
    setWalletManagementLoading({
      ...walletManagementLoading,
      isImportWalletLoading: true,
    });
    try {
      const serializedWallet = await readWalletFile(pastelWalletFile);
      if (serializedWallet) {
        const success = await api.importWallet(serializedWallet);
        if (success) {
          await api.unlockWallet(password);
          await fetchWalletInfo();
          await fetchPastelIDs();
          await fetchMyPslAddress();

          alert("Wallet imported successfully!");
          setPastelWalletFile(null);
        } else {
          throw new Error("Failed to import wallet");
        }
      }
    } catch (error) {
      console.error("Error importing wallet:", error);
      alert("Failed to import wallet. Please try again.");
    } finally {
      setWalletManagementLoading({
        ...walletManagementLoading,
        isImportWalletLoading: false,
      });
    }
  };

  const listAddressAmounts = async () => {
    setWalletManagementLoading({
      ...walletManagementLoading,
      isListAddressAmountsLoading: true,
    });
    try {
      const data = await api.listAddressAmounts();
      setAddressAmounts(data);
    } catch (error) {
      console.error("Error retrieving address amounts:", error);
      alert("Failed to retrieve address amounts. Please try again.");
    } finally {
      setWalletManagementLoading({
        ...walletManagementLoading,
        isListAddressAmountsLoading: false,
      });
    }
  };

  const getWalletInfo = async () => {
    setWalletManagementLoading({
      ...walletManagementLoading,
      isWalletInfoLoading: true,
    });
    try {
      const data = await api.getWalletInfo();
      setWalletInfo(data);
    } catch (error) {
      console.error("Error retrieving wallet info:", error);
      alert("Failed to retrieve wallet info. Please try again.");
    } finally {
      setWalletManagementLoading({
        ...walletManagementLoading,
        isWalletInfoLoading: false,
      });
    }
  };

  const clearLocalStorage = () => {
    if (
      confirm(
        "Are you sure you want to clear all local storage data for this page?"
      )
    ) {
      localStorage.clear();
      alert("Local storage cleared. The page will now reload.");
      window.location.reload();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert("Copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  return (
    <div className="grid grid-cols-1 gap-4 p-4 has-border rounded-xl">
      <h2 className="text-2xl">Manage Wallet</h2>
      <div className="mb-4">
        <label
          className="block text-bw-700 font-bold mb-2"
          htmlFor="importPrivKey"
        >
          Import Private Key
          <span
            className="tooltip"
            data-tooltip="Import a private key into your wallet."
          >
            &#9432;
          </span>
        </label>
        <input
          id="importPrivKey"
          className="input w-full"
          type="text"
          placeholder="Enter private key"
          value={privKey}
          onChange={(e) => setPrivKey(e.target.value)}
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            id="importPrivKeyButton"
            className="btn success outline"
            onClick={importPrivKey}
            disabled={walletManagementLoading.isPrivateKeyLoading}
          >
            Import Private Key
          </button>
          {walletManagementLoading.isPrivateKeyLoading && <div className="btn is-loading">Importing...</div>}
        </div>
      </div>

      <div className="mb-4">
        <label
          className="block text-bw-700 font-bold mb-2"
          htmlFor="importWallet"
        >
          Import Wallet
          <span
            className="tooltip"
            data-tooltip="Import a wallet file into your wallet."
          >
            &#9432;
          </span>
        </label>
        <input
          id="importWallet"
          className="input w-full"
          type="file"
          accept=".dat"
          onChange={(e) =>
            setWalletFile(e.target.files ? e.target.files[0] : null)
          }
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            id="importWalletButton"
            className="btn success outline mt-2"
            onClick={importWallet}
            disabled={walletManagementLoading.isImportWalletLoading}
          >
            Import Wallet
          </button>
          {walletManagementLoading.isImportWalletLoading && <div className="btn is-loading">Importing...</div>}
        </div>
      </div>

      <div className="mb-4">
        <div className="">
          <label
            className="block text-bw-700 font-bold mb-2"
            id="importWalletFile"
          >
            Import Wallet
            <span
              className="tooltip"
              data-tooltip="Import a wallet file into your wallet."
            >
              &#9432;
            </span>
          </label>
          <input
            id="importWalletFile"
            className="input w-full"
            type="file"
            accept=".wallet"
            onChange={(e) =>
              setPastelWalletFile(e.target.files ? e.target.files[0] : null)
            }
          />
        </div>
        <div className="mt-2">
          <label
            className="block text-bw-700 font-bold mb-2"
            htmlFor="password"
          >
            Password
            <span
              className="tooltip"
              data-tooltip="Password"
            >
              &#9432;
            </span>
          </label>
          <input
            id="password"
            className="input w-full"
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button
            className="btn success outline mt-2"
            onClick={importPastelWallet}
            disabled={walletManagementLoading.isImportWalletLoading}
          >
            Import Wallet
          </button>
          {walletManagementLoading.isImportWalletLoading && <div className="btn is-loading">Importing...</div>}
        </div>
      </div>
      <label
        className="block text-bw-700 font-bold mb-2"
        htmlFor="listAddressAmountsButton"
      >
        Misc Functions:
      </label>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <button
            id="listAddressAmountsButton"
            className="btn success outline"
            onClick={listAddressAmounts}
            disabled={walletManagementLoading.isListAddressAmountsLoading}
          >
            List Address Amounts
            <span
              className="tooltip"
              data-tooltip="List the amounts associated with each address in your wallet."
            >
              &#9432;
            </span>
          </button>
          {walletManagementLoading.isListAddressAmountsLoading && <div className="btn is-loading">Loading...</div>}
        </div>
        {addressAmounts && (
          <div
            id="addressAmountsContainer"
            className="mt-4"
            style={{ position: "relative" }}
          >
            <h2 className="text-2xl text-bw-800">Address Amounts:</h2>
            <button
              id="copyAddressAmountsButton"
              className="btn success outline"
              style={{ position: "absolute", top: "-1.5rem", right: "0.5rem" }}
              onClick={() => copyToClipboard(JSON.stringify(addressAmounts))}
            >
              📋
            </button>
            <div className="table-responsive">
              <table id="addressAmountsTable" className="table bordered bw">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(addressAmounts).map(([address, amount]) => (
                    <tr key={address}>
                      <td>{address}</td>
                      <td>{parseAndFormatNumber(`${amount}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <button
            id="getWalletInfoButton"
            className="btn success outline"
            onClick={getWalletInfo}
            disabled={walletManagementLoading.isWalletInfoLoading}
          >
            Get Wallet Info
            <span
              className="tooltip"
              data-tooltip="Retrieve information about your wallet."
            >
              &#9432;
            </span>
          </button>
          {walletManagementLoading.isWalletInfoLoading && <div className="btn is-loading">Loading...</div>}
        </div>
        {walletInfo && (
          <div
            id="walletInfoContainer"
            className="mt-4"
            style={{ position: "relative" }}
          >
            <h2 className="text-2xl text-bw-800">Wallet Info:</h2>
            <button
              id="copyWalletInfoButton"
              className="btn success outline"
              style={{ position: "absolute", top: "-1.5rem", right: "0.5rem" }}
              onClick={() => copyToClipboard(JSON.stringify(walletInfo))}
            >
              📋
            </button>
            <div className="table-responsive">
              <table id="walletInfoTable" className="table bordered bw">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(walletInfo).map(([key, value]) => (
                    <tr key={key}>
                      <td>{key}</td>
                      <td>{JSON.stringify(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <div className="mb-4">
        <button
          id="clearLocalStorageButton"
          className="btn success outline"
          onClick={clearLocalStorage}
        >
          Clear Inference Client Local Storage
          <span
            className="tooltip"
            data-tooltip="Clear all local storage data for this page."
          >
            &#9432;
          </span>
        </button>
      </div>
    </div>
  );
}