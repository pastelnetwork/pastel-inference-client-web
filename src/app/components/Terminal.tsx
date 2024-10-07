// src/app/components/Terminal.tsx

'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

interface LogMessage {
  timestamp: string;
  level: string;
  message: string;
}

export default function Terminal() {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const formatLogMessage = (logMessage: LogMessage): string => {
    const timestamp = new Date(logMessage.timestamp).toISOString();
    return `[${timestamp}] [${logMessage.level.toUpperCase()}] ${logMessage.message}`;
  };

  const initWebSocket = useCallback(async () => {
    try {
      const response = await fetch('/ws-url');
      const data = await response.json();
      const socket = new WebSocket(data.wsUrl);

      socket.onopen = () => {
        console.log('WebSocket connection established');
      };

      socket.onmessage = (event) => {
        if (event.data && xtermRef.current) {
          const logMessage: LogMessage = JSON.parse(event.data);
          const formattedMessage = formatLogMessage(logMessage);
          xtermRef.current.writeln(formattedMessage);
        }
      };

      socket.onclose = () => {
        console.log('WebSocket connection closed');
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Error fetching WebSocket URL:', error);
    }
  }, []);

  useEffect(() => {
    if (isVisible && !xtermRef.current && terminalRef.current) {
      xtermRef.current = new XTerm({
        cols: 175,
        rows: 24,
        fontSize: 12,
        fontFamily: 'Courier New, monospace',
        theme: {
          background: '#1a1a1a',
          foreground: '#f0f0f0',
        },
      });

      fitAddonRef.current = new FitAddon();
      xtermRef.current.loadAddon(fitAddonRef.current);

      xtermRef.current.open(terminalRef.current);
      fitAddonRef.current.fit();

      initWebSocket();
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isVisible, initWebSocket]);

  const handleResize = () => {
    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  };

  const toggleTerminal = () => {
    setIsVisible(!isVisible);
  };

  const exportTerminalSession = () => {
    if (xtermRef.current) {
      let termText = '';
      for (let i = 0; i < xtermRef.current.buffer.active.length; i++) {
        const line = xtermRef.current.buffer.active.getLine(i);
        if (line) {
          termText += line.translateToString(true) + '\n';
        }
      }
      const blob = new Blob([termText], { type: 'text/plain' });
      const link = document.createElement('a');
      const currentDate = new Date().toISOString();
      const fileName = `Pastel_Inference_Client_Terminal_Session_Log__${currentDate}.txt`;
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="mt-4">
      <button onClick={toggleTerminal} className="btn success outline mt-4">
        Toggle Terminal
      </button>
      {isVisible && (
        <div>
          <h2 className="text-2xl mt-5">Terminal</h2>
          <div id="terminal" ref={terminalRef} className="bg-gray-900 text-white p-4 rounded-xl"></div>
          <div className="flex justify-between items-center mb-4">
            <button id="exportTerminalButton" className="btn success outline" onClick={exportTerminalSession}>
              Export Terminal Session Text
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
