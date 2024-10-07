// src/app/components/WalletManagement.tsx

'use client';

import React, { useState } from "react";
import { AddressAmount, WalletInfo } from "@/app/types";
import * as api from '@/app/lib/api';

export default function WalletManagement() {
  const [privKey, setPrivKey] = useState<string>("");
  const [walletFile, setWalletFile] = useState<File | null>(null);
  const [addressAmounts, setAddressAmounts] = useState<AddressAmount | null>(
    null
  );
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const importPrivKey = async () => {
    if (!privKey) {
      alert("Please enter private key!");
      return;
    }
    setIsLoading(true);
    try {
      await api.importPrivKey(privKey);
      alert("Private key imported successfully!");
      setPrivKey("");
    } catch (error) {
      console.error("Error importing private key:", error);
      alert("Failed to import private key. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const importWallet = async () => {
    if (!walletFile) {
      alert("Please select a Wallet file to import.");
      return;
    }
    setIsLoading(true);
    try {
      const fileContent = await walletFile.text();
      await api.importWallet(fileContent);
      alert("Wallet imported successfully!");
      setWalletFile(null);
    } catch (error) {
      console.error("Error importing wallet:", error);
      alert("Failed to import wallet. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const listAddressAmounts = async () => {
    setIsLoading(true);
    try {
      const data = await api.listAddressAmounts();
      setAddressAmounts(data);
    } catch (error) {
      console.error("Error retrieving address amounts:", error);
      alert("Failed to retrieve address amounts. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getWalletInfo = async () => {
    setIsLoading(true);
    try {
      const data = await api.getWalletInfo();
      setWalletInfo(data);
    } catch (error) {
      console.error("Error retrieving wallet info:", error);
      alert("Failed to retrieve wallet info. Please try again.");
    } finally {
      setIsLoading(false);
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
            disabled={isLoading}
          >
            Import Private Key
          </button>
          {isLoading && <div className="btn is-loading">Importing...</div>}
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
            disabled={isLoading}
          >
            Import Wallet
          </button>
          {isLoading && <div className="btn is-loading">Importing...</div>}
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
            disabled={isLoading}
          >
            List Address Amounts
            <span
              className="tooltip"
              data-tooltip="List the amounts associated with each address in your wallet."
            >
              &#9432;
            </span>
          </button>
          {isLoading && <div className="btn is-loading">Loading...</div>}
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
                      <td>{amount}</td>
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
            disabled={isLoading}
          >
            Get Wallet Info
            <span
              className="tooltip"
              data-tooltip="Retrieve information about your wallet."
            >
              &#9432;
            </span>
          </button>
          {isLoading && <div className="btn is-loading">Loading...</div>}
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