"use client";

import React, { useState, useEffect, useRef } from "react";

interface CreditPackTicket {
  credit_pack_registration_txid: string;
  requested_initial_credits_in_credit_pack: number;
  credit_pack_current_credit_balance: number;
  credit_usage_tracking_psl_address: string;
  credit_purchase_request_confirmation_pastel_block_height: number;
  [key: string]: any;
}

export default function SelectCreditPackTicket() {
  const [creditPackTickets, setCreditPackTickets] = useState<
    CreditPackTicket[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getMyValidCreditPacks();
    window.addEventListener("refreshCreditPackTickets", getMyValidCreditPacks);
    return () => {
      window.removeEventListener(
        "refreshCreditPackTickets",
        getMyValidCreditPacks
      );
    };
  }, [getMyValidCreditPacks]);

  const getMyValidCreditPacks = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/get-my-valid-credit-packs${forceRefresh ? "?force=true" : ""}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        const validTickets = data.result.filter(
          (ticket: CreditPackTicket) =>
            typeof ticket.credit_pack_current_credit_balance === "number" &&
            ticket.credit_pack_current_credit_balance > 0
        );
        setCreditPackTickets(validTickets);
        if (validTickets.length > 0 && !selectedTicket) {
          setSelectedTicket(validTickets[0].credit_pack_registration_txid);
        }
      } else {
        throw new Error(data.message || "Failed to fetch credit pack tickets");
      }
    } catch (error) {
      console.error("Error retrieving valid credit pack tickets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTicketSelection = (txid: string) => {
    setSelectedTicket(txid);
  };

  const showTooltip = (
    event: React.MouseEvent<HTMLTableRowElement>,
    ticket: CreditPackTicket
  ) => {
    if (tooltipRef.current) {
      const tooltip = tooltipRef.current;
      tooltip.innerHTML = `
        <div class="tooltip-content">
          ${Object.entries(ticket)
            .filter(
              ([key]) =>
                ![
                  "credit_pack_registration_txid",
                  "requested_initial_credits_in_credit_pack",
                  "credit_pack_current_credit_balance",
                  "credit_usage_tracking_psl_address",
                  "credit_purchase_request_confirmation_pastel_block_height",
                ].includes(key)
            )
            .map(
              ([key, value]) => `
              <div class="tooltip-row">
                <span class="tooltip-label">${key.replace(/_/g, " ")}:</span>
                <span class="tooltip-value">${value}</span>
              </div>
            `
            )
            .join("")}
        </div>
      `;
      tooltip.style.display = "block";
      tooltip.style.left = `${event.clientX + 15}px`;
      tooltip.style.top = `${event.clientY + 15}px`;
    }
  };

  const hideTooltip = () => {
    if (tooltipRef.current) {
      tooltipRef.current.style.display = "none";
    }
  };

  const getAddressURL = (address: string) => {
    let baseURL = "https://explorer.pastel.network/address/";
    if (address.startsWith("44")) {
      baseURL = "https://explorer-devnet.pastel.network/address/";
    } else if (address.startsWith("tP")) {
      baseURL = "https://explorer-testnet.pastel.network/address/";
    }
    return `${baseURL}${address}`;
  };

  const getTxidURL = (txid: string, address: string) => {
    let baseURL = "https://explorer.pastel.network/tx/";
    if (address.startsWith("44")) {
      baseURL = "https://explorer-devnet.pastel.network/tx/";
    } else if (address.startsWith("tP")) {
      baseURL = "https://explorer-testnet.pastel.network/tx/";
    }
    return `${baseURL}${txid}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert("Credit pack info copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  return (
    <div className="grid grid-cols-1 gap-4 p-4 has-border rounded-xl shadow-md">
      <h2 className="text-2xl text-bw-800">
        Select Existing Credit Pack Ticket
      </h2>
      <div className="relative text-bw-700 overflow-x-auto">
        <table className="credit-pack-table table bordered bw">
          <thead>
            <tr>
              <th className="select-column">Select</th>
              <th className="initial-credits-column">
                Initial Credits in Pack
              </th>
              <th className="current-credit-balance-column">
                Current Credit Balance
              </th>
              <th className="tracking-address-column">Tracking Address</th>
              <th>Blockheight Registered</th>
              <th>Credit Pack Registration TXID</th>
            </tr>
          </thead>
          <tbody id="creditPackTicketTableBody">
            {creditPackTickets.map((ticket) => (
              <tr
                key={ticket.credit_pack_registration_txid}
                className={`transition-colors duration-200 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 dark:text-gray-200 ${
                  selectedTicket === ticket.credit_pack_registration_txid
                    ? "bg-gray-200 dark:bg-gray-700 selected-row"
                    : ""
                }`}
                onClick={() =>
                  handleTicketSelection(ticket.credit_pack_registration_txid)
                }
                onMouseEnter={(e) => showTooltip(e, ticket)}
                onMouseLeave={hideTooltip}
              >
                <td className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="creditPackTicket"
                    value={ticket.credit_pack_registration_txid}
                    checked={
                      selectedTicket === ticket.credit_pack_registration_txid
                    }
                    onChange={() =>
                      handleTicketSelection(
                        ticket.credit_pack_registration_txid
                      )
                    }
                  />
                  <button
                    className="text-gray-500 hover:text-gray-700 focus:outline-none ml-2"
                    title="Copy Credit Pack Info to Clipboard"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(JSON.stringify(ticket, null, 2));
                    }}
                  >
                    📋
                  </button>
                </td>
                <td className="truncate">
                  {ticket.requested_initial_credits_in_credit_pack.toLocaleString()}
                </td>
                <td className="truncate">
                  {ticket.credit_pack_current_credit_balance.toLocaleString()}
                </td>
                <td className="truncate tracking-address">
                  <a
                    href={getAddressURL(
                      ticket.credit_usage_tracking_psl_address
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {ticket.credit_usage_tracking_psl_address}
                  </a>
                </td>
                <td className="truncate">
                  {ticket.credit_purchase_request_confirmation_pastel_block_height.toLocaleString()}
                </td>
                <td className="truncate">
                  <a
                    href={getTxidURL(
                      ticket.credit_pack_registration_txid,
                      ticket.credit_usage_tracking_psl_address
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {ticket.credit_pack_registration_txid}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div
          ref={tooltipRef}
          id="credit-pack-tooltip"
          className="hidden fixed z-50 p-3 bg-white text-black rounded-lg shadow-lg border border-gray-300 transition-opacity duration-300 opacity-0 max-w-5xl text-xs"
        ></div>
      </div>
      <div className="flex items-center gap-4 mt-4">
        <button
          id="refreshButton"
          className="btn success outline p-4 relative"
          onClick={() => getMyValidCreditPacks(true)}
          disabled={isLoading}
        >
          Manually Refresh Credit Pack Tickets
          {isLoading && (
            <span className="loader absolute inset-0 flex items-center justify-center">
              <div className="btn is-loading"></div>
            </span>
          )}
        </button>
        {isLoading && <div className="btn is-loading">Loading...</div>}
      </div>
    </div>
  );
}
