// src/app/components/CreateCreditPackTicket.tsx

'use client';

import React, { useState, useEffect, useCallback } from "react";

import * as api from '@/app/lib/api';
import { CreditPackCreationResult } from '@/app/types';
import useStore from "@/app/store/useStore";

interface CreditPackTicketDetails {
  pastel_api_credit_pack_ticket_registration_txid: string;
  sha3_256_hash_of_credit_pack_purchase_request_fields: string;
  responding_supernode_pastelid: string;
  credit_pack_confirmation_outcome_string: string;
}

export default function CreateCreditPackTicket() {
  const { balance } = useStore();
  const [numCredits, setNumCredits] = useState<string>("1500");
  const [maxTotalPrice, setMaxTotalPrice] = useState<string>("150000");
  const [maxPerCreditPrice, setMaxPerCreditPrice] = useState<string>("100.0");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("");
  const [newTicketDetails, setNewTicketDetails] =
    useState<CreditPackTicketDetails | null>(null);

  const updateMaxTotalPrice = useCallback(() => {
    const credits = parseFloat(numCredits.replace(/,/g, ""));
    const perCreditPrice = parseFloat(maxPerCreditPrice.replace(/,/g, ""));
    if (!isNaN(credits) && !isNaN(perCreditPrice)) {
      const total = credits * perCreditPrice;
      setMaxTotalPrice(
        total.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
      );
    }
  }, [numCredits, maxPerCreditPrice]);

  useEffect(() => {
    updateMaxTotalPrice();
  }, [numCredits, maxPerCreditPrice, updateMaxTotalPrice]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    const numericValue = value.replace(/,/g, "");
    switch (id) {
      case "numCredits":
        setNumCredits(numericValue);
        break;
      case "maxPerCreditPrice":
        setMaxPerCreditPrice(numericValue);
        break;
      case "maxTotalPrice":
        setMaxTotalPrice(numericValue);
        break;
    }
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    const numericValue = parseFloat(value.replace(/,/g, ""));
    if (!isNaN(numericValue)) {
      const formattedValue = numericValue.toLocaleString(undefined, {
        minimumFractionDigits: id === "maxPerCreditPrice" ? 1 : 0,
        maximumFractionDigits: id === "maxPerCreditPrice" ? 1 : 0,
      });
      switch (id) {
        case "numCredits":
          setNumCredits(formattedValue);
          break;
        case "maxPerCreditPrice":
          setMaxPerCreditPrice(formattedValue);
          break;
        case "maxTotalPrice":
          setMaxTotalPrice(formattedValue);
          break;
      }
    }
  };

  const createNewCreditPackTicket = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus("Initializing ticket creation...");
    setNewTicketDetails(null);

    try {
      const creditPriceCushionPercentage = 0.15;
      const amountOfPSLForTrackingTransactions = 10.0;
      const estimatedTotalCostInPSLForCreditPack = await api.estimateCreditPackCost(parseInt(numCredits.replace(/,/g, "")), creditPriceCushionPercentage);

      const amountToFundCreditTrackingAddress = Math.round(
        amountOfPSLForTrackingTransactions +
        estimatedTotalCostInPSLForCreditPack
      );
      if (amountToFundCreditTrackingAddress > balance) {
        const insufficientFundsMessage = `The purchase of this credit pack would require ${amountToFundCreditTrackingAddress.toLocaleString()} PSL, but you only have ${balance.toLocaleString()} PSL in your wallet. Please send at least ${(
          amountToFundCreditTrackingAddress - balance
        ).toLocaleString()} more PSL to your wallet and try again. Alternatively, you can reduce the number of credits in the credit pack you are trying to purchase to ${Math.floor(
          balance /
          (estimatedTotalCostInPSLForCreditPack / parseInt(numCredits.replace(/,/g, "")))
        ).toLocaleString()} credits instead of ${numCredits.toLocaleString()} credits.`;

        setStatus(insufficientFundsMessage);
        return;
      }

      const { newCreditTrackingAddress } = await api.createAndFundNewAddress(amountToFundCreditTrackingAddress);
      if (newCreditTrackingAddress) {
        const result: CreditPackCreationResult = await api.createCreditPackTicket(
          parseInt(numCredits.replace(/,/g, "")),
          newCreditTrackingAddress,
          parseFloat(maxTotalPrice.replace(/,/g, "")),
          parseFloat(maxPerCreditPrice.replace(/,/g, ""))
        );

        if (result) {
          setStatus("Credit pack ticket created successfully.");
          const confirmation = result.creditPackPurchaseRequestConfirmation;
          const ticketDetails: CreditPackTicketDetails = {
            pastel_api_credit_pack_ticket_registration_txid: confirmation.pastel_api_credit_pack_ticket_registration_txid as string,
            sha3_256_hash_of_credit_pack_purchase_request_fields: confirmation.sha3_256_hash_of_credit_pack_purchase_request_fields,
            responding_supernode_pastelid: result.creditPackPurchaseRequestConfirmationResponse?.responding_supernode_pastelid || '',
            credit_pack_confirmation_outcome_string: result.creditPackPurchaseRequestConfirmationResponse?.credit_pack_confirmation_outcome_string || '',
          };
          setNewTicketDetails(ticketDetails);
          pollCreditPackStatus(
            confirmation.pastel_api_credit_pack_ticket_registration_txid as string
          );
        } else {
          throw new Error("Failed to create new credit pack ticket");
        }
      }
    } catch (error) {
      console.error("Error creating credit pack ticket:", error);
      setStatus(
        `Failed to create credit pack ticket: ${(error as Error).message}`
      );
    } finally {
      setIsLoading(false);
    }
  };
  

  const pollCreditPackStatus = async (txid: string) => {
    const pollInterval = 30000; // 30 seconds
    const maxAttempts = 20; // 10 minutes total
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const isConfirmed = await api.isCreditPackConfirmed(txid);

        if (isConfirmed) {
          setStatus(
            "Credit pack ticket has been confirmed. Refreshing the table..."
          );
          window.dispatchEvent(new CustomEvent("refreshCreditPackTickets"));
          setStatus("Credit pack ticket is now available for use.");
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            setStatus(
              `Waiting for credit pack ticket confirmation... (Attempt ${attempts}/${maxAttempts})`
            );
            setTimeout(checkStatus, pollInterval);
          } else {
            setStatus(
              "Credit pack ticket confirmation is taking longer than expected. It should appear soon. You can manually refresh the table to check."
            );
          }
        }
      } catch (error) {
        console.error("Error checking credit pack status:", error);
        setStatus(
          "An error occurred while checking the credit pack status. Please try refreshing the table manually."
        );
      }
    };

    checkStatus();
  };

  return (
    <div className="grid grid-cols-1 gap-4 p-4 has-border rounded-xl bg-white shadow-md mt-3">
      <h2 className="text-2xl text-bw-800">Create New Credit Pack Ticket</h2>
      <form
        id="createTicketForm"
        className="grid grid-cols-2 gap-4"
        onSubmit={createNewCreditPackTicket}
      >
        <div>
          <label
            className="block text-bw-700 font-bold mb-2"
            htmlFor="numCredits"
          >
            Number of Credits
          </label>
          <input
            className="input w-full"
            id="numCredits"
            type="text"
            placeholder="Enter number of credits"
            value={numCredits}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            required
          />
        </div>
        <div>
          <label
            className="block text-bw-700 font-bold mb-2"
            htmlFor="maxTotalPrice"
          >
            Maximum Total Price (PSL)
          </label>
          <input
            className="input w-full"
            id="maxTotalPrice"
            type="text"
            placeholder="Enter maximum total price"
            value={maxTotalPrice}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            required
          />
        </div>
        <div>
          <label
            className="block text-bw-700 font-bold mb-2"
            htmlFor="maxPerCreditPrice"
          >
            Maximum Per Credit Price (PSL)
          </label>
          <input
            className="input w-full"
            id="maxPerCreditPrice"
            type="text"
            placeholder="Enter maximum per credit price"
            value={maxPerCreditPrice}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            required
          />
        </div>

        <div className="col-span-full flex justify-between">
          <div className="flex gap-4 items-center" style={{ width: "100%" }}>
            <button
              className="btn success outline"
              type="submit"
              id="createCreditPackButton"
              disabled={isLoading}
            >
              Create Credit Pack
            </button>
            {isLoading && <div className="btn is-loading">Loading...</div>}
            <div className="prompt success xs" id="createTicketStatusContainer">
              <label
                className="text-bw-800 font-bold mb-4"
                htmlFor="createTicketStatus"
              >
                Current Status:
              </label>
              <div className="content p-2" id="createTicketStatus">
                {status}
              </div>
            </div>
          </div>
        </div>
      </form>

      {newTicketDetails && (
        <div
          className="credit-pack-details-container"
          id="newCreditPackTicketDetailsContainer"
        >
          <h3 className="text-xl text-bw-800">
            New Credit Pack Ticket Details
          </h3>
          <div className="table-responsive">
            <table className="table bordered bw new-ticket-table">
              <thead>
                <tr>
                  <th>Registration TXID</th>
                  <th>SHA3-256 Hash of Credit Pack Purchase Request Fields</th>
                  <th>Responding Supernode PastelID</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody id="newCreditPackTicketDetails">
                <tr>
                  <td>
                    {
                      newTicketDetails.pastel_api_credit_pack_ticket_registration_txid
                    }
                  </td>
                  <td>
                    {
                      newTicketDetails.sha3_256_hash_of_credit_pack_purchase_request_fields
                    }
                  </td>
                  <td>{newTicketDetails.responding_supernode_pastelid}</td>
                  <td>
                    {newTicketDetails.credit_pack_confirmation_outcome_string}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
