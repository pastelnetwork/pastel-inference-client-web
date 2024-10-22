// src/app/components/UserInfo.tsx

"use client";

import React, { useState, useEffect } from "react";
import browserLogger from "@/app/lib/logger";
import * as api from "@/app/lib/api";
import * as utils from "@/app/lib/utils";
import useStore from "@/app/store/useStore";

export default function UserInfo() {
  const {
    setPastelId,
    walletPassword,
    walletBalance,
    pastelIDs,
    selectedPastelID,
    myPslAddress,
    fetchWalletInfo,
    fetchPastelIDs,
    fetchMyPslAddress,
    setSelectedPastelID,
  } = useStore();
  const [showPassword, setShowPassword] = useState(false);
  const [passphrase, setPassphrase] = useState<string>("");
  const [rememberPassphrase, setRememberPassphrase] = useState<boolean>(false);
  const [showPassphraseInput, setShowPassphraseInput] =
    useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [isCreatingPastelID, setIsCreatingPastelID] = useState<boolean>(false);
  const [newPastelIDPassphrase, setNewPastelIDPassphrase] =
    useState<string>("");
  const [promotionalPackFile, setPromotionalPackFile] = useState<File | null>(
    null
  );
  const [modalContent, setModalContent] = useState<{
    title: string;
    message: string;
  }>({
    title: "",
    message: "",
  });
  const [shoModalMessage, setShowModalMessage] = useState<boolean>(false);

  useEffect(() => {
    fetchWalletInfo();
    fetchPastelIDs();
    fetchMyPslAddress();
  }, [fetchWalletInfo, fetchPastelIDs, fetchMyPslAddress]);
  
  const handlePastelIDChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newPastelID = event.target.value;
    setSelectedPastelID(newPastelID);
    setPastelId(newPastelID);
    setShowPassphraseInput(true);
    setPassphrase("");
  };

  const handlePassphraseSubmit = async () => {
    try {
      await api.setPastelIdAndPassphrase(selectedPastelID, passphrase);
      setMessage("Successfully set PastelID and passphrase!");
      if (rememberPassphrase) {
        localStorage.setItem(selectedPastelID, btoa(passphrase));
      }
      setShowPassphraseInput(false);
    } catch (error) {
      browserLogger.error("Error setting PastelID and passphrase:", error);
      setMessage("Failed to set PastelID and passphrase.");
    }
  };

  const handleCreatePastelID = async () => {
    if (newPastelIDPassphrase.length < 6) {
      setMessage("Passphrase must be at least 6 characters long.");
      return;
    }
    setIsCreatingPastelID(true);
    try {
      const result = await api.createAndRegisterPastelID();
      setMessage(
        `PastelID creation initiated. Your new PastelID is ${result.pastelID}. Please wait while it's being registered on the blockchain...`
      );
      localStorage.setItem(result.pastelID, btoa(newPastelIDPassphrase));
      pollPastelIDStatus(result.pastelID);
    } catch (error) {
      browserLogger.error("Error creating PastelID:", error);
      setMessage("Failed to create PastelID. Please try again.");
    } finally {
      setIsCreatingPastelID(false);
    }
  };

  const pollPastelIDStatus = async (pastelID: string) => {
    const pollInterval = 30000; // 30 seconds
    const maxAttempts = 20; // 10 minutes total
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const isRegistered = await api.isPastelIDRegistered(pastelID);
        const walletInfo = await api.getWalletInfo();
        const walletBalance = walletInfo.balance;

        if (isRegistered && walletBalance > 0) {
          setMessage(
            "Your PastelID has been registered and your wallet has been funded. The page will refresh shortly."
          );
          setTimeout(() => window.location.reload(), 5000);
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            let statusMessage =
              "PastelID registration and wallet funding in progress...";
            if (isRegistered) {
              statusMessage =
                "PastelID registered. Waiting for wallet to be funded...";
            } else if (walletBalance > 0) {
              statusMessage =
                "Wallet funded. Waiting for PastelID registration...";
            }
            setMessage(`${statusMessage} (Attempt ${attempts}/${maxAttempts})`);
            setTimeout(checkStatus, pollInterval);
          } else {
            setMessage(
              "The process is taking longer than expected. Please refresh the page in a few minutes."
            );
          }
        }
      } catch (error) {
        browserLogger.error(
          "Error checking PastelID and wallet status:",
          error
        );
        setMessage(
          "An error occurred while checking your PastelID and wallet status. Please refresh the page in a few minutes."
        );
      }
    };

    checkStatus();
  };

  const handleImportPastelID = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      setMessage("Please select a PastelID file to import.");
      return;
    }
    try {
      const networkInfo = await api.getNetworkInfo();
      const fileContent = await file.text();
      const result = await api.importPastelID(
        fileContent,
        networkInfo.network,
        passphrase
      );
      if (result.success) {
        setMessage("PastelID imported successfully!");
        window.location.reload();
      } else {
        setMessage(result.message || "Failed to import PastelID.");
      }
    } catch (error) {
      browserLogger.error("Error importing PastelID:", error);
      setMessage("Failed to import PastelID. Please try again.");
    }
  };

  const handlePromotionalPackFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    setPromotionalPackFile(file || null);
  };

  const importPromotionalPack = async () => {
    if (!promotionalPackFile) {
      setMessage("Please select a file to import.");
      return;
    }

    setShowModalMessage(true);
    setModalContent({
      title: "Importing Promotional Pack",
      message: "Processing your promotional pack...",
    });
    try {
      const fileContent = await promotionalPackFile.text();
      const result = await utils.importPromotionalPack(fileContent);
      if (result.success) {
        browserLogger.info("Import details:", result.processedPacks);
        setModalContent({
          title: "Import Successful",
          message: result.message,
        });
        if (result.processedPacks && result.processedPacks.length > 0) {
          result.processedPacks.forEach(
            (pack: { pub_key: string; passphrase: string }) => {
              localStorage.setItem(pack.pub_key, btoa(pack.passphrase));
            }
          );

          const newPastelID = result.processedPacks[0].pub_key;
          await setSelectedPastelIDAndPassphrase(newPastelID, "", true);
        }

        setModalContent({
          title: "Import Successful",
          message: "Import completed. Refreshing data...",
        });
      } else {
        throw new Error(
          result.message || "Unknown error occurred during import"
        );
      }
    } catch (error) {
      browserLogger.error("Error importing promotional pack:", error);
      setModalContent({
        title: "Import Failed",
        message: `An error occurred while importing the promotional pack: ${
          (error as Error).message
        }`,
      });
    }
  };

  const setSelectedPastelIDAndPassphrase = async (
    selectedPastelID: string,
    extraMessage: string = "",
    isNewlyImportedPromoPack: boolean = false
  ) => {
    const storedPassphrase = localStorage.getItem(selectedPastelID);

    try {
      const isValid = await api.checkPastelIDValidity(selectedPastelID);

      if (!isValid) {
        browserLogger.info(
          `PastelID ${selectedPastelID} is not valid. Removing from localStorage.`
        );
        localStorage.removeItem(selectedPastelID);
        await fetchPastelIDs();
        return;
      }

      if (extraMessage) {
        browserLogger.info(`Additional information: ${extraMessage}`);
        setModalContent({
          title: "Import Successful",
          message: extraMessage,
        });
      }

      if (!storedPassphrase && !isNewlyImportedPromoPack) {
        setModalContent({
          title: "Import Successful",
          message:
            "Passphrase required. Please implement a user input for the passphrase.",
        });
      } else {
        if (isNewlyImportedPromoPack) {
          browserLogger.info(
            "Using stored passphrase for newly imported promo pack."
          );
          if (!storedPassphrase) {
            browserLogger.error(
              "Expected passphrase not found for newly imported promo pack."
            );
            return;
          }
        }
        await postPassphrase(selectedPastelID, storedPassphrase!);
      }

      setSelectedPastelID(selectedPastelID);
      setPastelId(selectedPastelID);

      await fetchModelMenu();
      await fetchReceivedMessages();
    } catch (error) {
      browserLogger.error("Error in setSelectedPastelIDAndPassphrase:", error);
      if (
        (error as { response?: { status: number } }).response?.status === 401
      ) {
        await setSelectedPastelIDAndPassphrase(
          selectedPastelID,
          "Invalid Passphrase. Please try again."
        );
      } else {
        setModalContent({
          title: "Import Failed",
          message:
            "An error occurred while setting PastelID and passphrase. Please try again.",
        });
      }
    }
  };

  const postPassphrase = async (
    pastelID: string,
    encodedPassphrase: string
  ) => {
    try {
      await api.setPastelIdAndPassphrase(pastelID, atob(encodedPassphrase));
      await fetchModelMenu();
      await fetchReceivedMessages();
    } catch (error) {
      localStorage.setItem(pastelID, "");
      await setSelectedPastelIDAndPassphrase(pastelID, "Invalid Passphrase");
      browserLogger.error("Error setting PastelID and passphrase:", error);
    }
  };

  const fetchModelMenu = async () => {
    try {
      const modelMenu = await api.getInferenceModelMenu();
      browserLogger.info("Model menu fetched:", modelMenu);
    } catch (error) {
      browserLogger.error("Error fetching model menu:", error);
    }
  };

  const fetchReceivedMessages = async () => {
    try {
      const messages = await api.getReceivedMessages();
      browserLogger.info("Received messages:", messages);
    } catch (error) {
      browserLogger.error("Error fetching received messages:", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setMessage("Address copied to clipboard!");
        setTimeout(() => setMessage(""), 3000);
      },
      (err) => {
        browserLogger.error("Could not copy text: ", err);
      }
    );
  };

  return (
    <div className="grid grid-cols-5 gap-4 p-4 has-border rounded-xl bg-white shadow-md">
      <h2 className="text-2xl col-span-full text-bw-800">User Information</h2>

      <div className="mt-4">
        <div className="flex items-center">
          <button
            onClick={() => setShowPassword(!showPassword)}
            className="px-4 py-2 border-2 border-green-600 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-colors"
          >
            {showPassword ? "Hide" : "Show"} Wallet Password
          </button>
        </div>

        {showPassword && walletPassword && (
          <div className="mt-2 p-4 bg-gray-50 border border-gray-300 rounded-lg w-full">
            <p className="text-sm text-gray-700 mb-2">Wallet Password:</p>
            <div className="flex items-center justify-between bg-white border border-gray-200 p-2 rounded">
              <span className="font-medium text-gray-900 break-all">
                {walletPassword}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(walletPassword)}
                className="ml-4 text-green-600 hover:text-green-800 transition-colors"
              >
                📋 Copy
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Please store this password securely. You&apos;ll need it if you
              want to access your wallet on a different device.
            </p>
          </div>
        )}
      </div>

      {/* Promotional Pack Import Section */}
      <div className="col-span-full mt-2">
        <details className="bg-bw-100 p-3 rounded-lg">
          <summary className="text-bw-700 font-semibold cursor-pointer">
            Import Promotional Pack
          </summary>
          <div className="mt-2">
            <p className="text-bw-600 text-sm mb-2">
              Have a promotional pack file? Import it here to set up your
              account quickly.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                id="promotionalPackFile"
                accept=".json"
                className="hidden"
                onChange={handlePromotionalPackFileChange}
              />
              <label
                htmlFor="promotionalPackFile"
                className="btn outline secondary text-sm py-1 px-3 cursor-pointer"
              >
                Choose File
              </label>
              <span
                id="fileLabel"
                className="text-bw-600 text-sm break-all max-w-lg"
              >
                {promotionalPackFile
                  ? promotionalPackFile.name
                  : "No file chosen"}
              </span>
              <button
                onClick={importPromotionalPack}
                className="btn success outline text-sm py-1 px-3 mt-2 sm:mt-0"
              >
                Import Pack
              </button>
            </div>
          </div>
        </details>
      </div>

      {/* PastelID Management Section */}
      <div className="col-span-full">
        {pastelIDs.length === 0 ? (
          <div id="noPastelIDContainer">
            <p className="text-bw-700">
              No PastelID found. Would you like to create a new one for 1,000
              PSL?
            </p>
            <form id="createPastelIDForm" className="mt-4">
              <label
                className="block text-bw-700 font-bold mb-2"
                htmlFor="newPastelIDPassphrase"
              >
                Enter Passphrase (min 6 characters):
              </label>
              <input
                id="newPastelIDPassphrase"
                className="input w-full"
                type="password"
                placeholder="Enter passphrase"
                minLength={6}
                required
                value={newPastelIDPassphrase}
                onChange={(e) => setNewPastelIDPassphrase(e.target.value)}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="btn success outline mt-4"
                  onClick={handleCreatePastelID}
                  disabled={isCreatingPastelID}
                >
                  Create PastelID
                </button>
                {isCreatingPastelID && (
                  <div className="btn is-loading">Creating...</div>
                )}
              </div>
            </form>
            <p className="mt-4">
              Already have an existing PastelID? Import the file here:
            </p>
            <input
              id="importPastelIDFile"
              className="input w-full"
              type="file"
              onChange={handleImportPastelID}
            />
          </div>
        ) : (
          <>
            <button
              id="changePastelIDButton"
              className="btn outline success"
              onClick={() => setShowPassphraseInput(!showPassphraseInput)}
            >
              Switch to a Different PastelID
            </button>
            {showPassphraseInput && (
              <div id="pastelIDDropdownContainer" className="mt-4">
                <label className="block text-bw-700 font-bold mb-2">
                  Select Existing PastelID to Use:
                </label>
                <select
                  id="pastelIDDropdown"
                  className="select w-full"
                  value={selectedPastelID}
                  onChange={handlePastelIDChange}
                >
                  {pastelIDs.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {showPassphraseInput && (
              <div className="mt-4" id="passphraseContainer">
                <label
                  className="block text-bw-700 font-bold mb-2"
                  htmlFor="pastelIDPassphrase"
                >
                  Enter Passphrase:
                </label>
                <input
                  id="pastelIDPassphrase"
                  className="input w-full"
                  type="password"
                  placeholder="Enter passphrase"
                  minLength={6}
                  required
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
                <div className="mt-2">
                  <input
                    type="checkbox"
                    id="rememberPassphrase"
                    checked={rememberPassphrase}
                    onChange={(e) => setRememberPassphrase(e.target.checked)}
                  />
                  <label
                    htmlFor="rememberPassphrase"
                    className="text-bw-700 ml-2"
                  >
                    Remember password?
                  </label>
                </div>
                <button
                  id="submitPassphraseButton"
                  className="btn success outline mt-4"
                  onClick={handlePassphraseSubmit}
                >
                  Submit
                </button>
              </div>
            )}
          </>
        )}
        <div className="mt-4">
          <label className="block text-bw-700 font-bold mb-2">
            Your Currently Selected PastelID:
          </label>
          <span id="userPastelID" className="text-bw-700">
            {selectedPastelID || "No PastelID selected"}
          </span>
        </div>
      </div>

      {/* Wallet Balance Section */}
      <div className="mt-4">
        <span className="block text-bw-700 font-bold mb-2">
          Wallet Balance (PSL):
        </span>
        <span id="walletBalance" className="text-bw-700">
          {walletBalance}
        </span>
      </div>

      {/* PSL Address Section */}
      <div className="mt-4">
        <span className="block text-bw-700 font-bold mb-2 whitespace-nowrap">
          My PSL Address:
        </span>
        <div className="flex">
          <span id="myPslAddress" className="text-bw-700">
            {myPslAddress}
          </span>
          <button
            id="copyAddressButton"
            className="ml-2 tooltip"
            data-tooltip="Copy address to clipboard"
            onClick={() => copyToClipboard(myPslAddress)}
          >
            📋
          </button>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className="col-span-full mt-4 p-2 bg-blue-100 border border-blue-300 rounded text-blue-800">
          {message}
        </div>
      )}

      {shoModalMessage ? (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
          <div
            className="fixed inset-0 bg-transparent z-20 w-full h-full"
            onClick={() => setShowModalMessage(false)}
          ></div>
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white z-50">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
              <h3
                className="text-lg leading-6 font-medium text-gray-900 mt-5"
                id="modalTitle"
              >
                {modalContent.title}
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500" id="modalMessage">
                  {modalContent.message}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
