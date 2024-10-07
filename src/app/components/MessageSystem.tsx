'use client'

import React, { useState, useEffect } from 'react';

interface Message {
  from_pastelid: string;
  message_body: string;
  timestamp: string;
}

interface MessageSystemProps {
  pastelId: string | null;
}

export default function MessageSystem({ pastelId }: MessageSystemProps) {
  const [toPastelID, setToPastelID] = useState<string>('jXXiVgtFzLto4eYziePHjjb1hj3c6eXdABej5ndnQ62B8ouv1GYveJaD5QUMfainQM3b4MTieQuzFEmJexw8Cr');
  const [messageBody, setMessageBody] = useState<string>('Hello, this is a brand 🍉 NEW test message from a regular user!');
  const [receivedMessages, setReceivedMessages] = useState<Record<string, Message[]>>({});
  const [isSending, setIsSending] = useState<boolean>(false);

  useEffect(() => {
    if (pastelId) {
      fetchReceivedMessages();
    }
  }, [pastelId]);

  const fetchReceivedMessages = async () => {
    try {
      const response = await fetch('/get-received-messages');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setReceivedMessages(data.messageDict);
    } catch (error) {
      console.error('Error fetching received messages:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pastelId) {
      alert('PastelID is not set. Please set your PastelID first.');
      return;
    }
    setIsSending(true);
    try {
      const response = await fetch('/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toPastelID,
          messageBody,
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      console.log('Message sent:', result);
      setMessageBody('');
      fetchReceivedMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-4 has-border rounded-xl bg-white shadow-md">
      <div>
        <h2 className="text-2xl mb-4 text-bw-800">
          Send and Receive Messages using PastelIDs
        </h2>
        <form id="sendMessageForm" className="grid grid-cols-1 gap-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-bw-700 font-bold mb-2" htmlFor="toPastelID">Recipient Pastel ID</label>
            <input 
              className="input w-full" 
              id="toPastelID" 
              type="text" 
              placeholder="Enter recipient Pastel ID" 
              value={toPastelID}
              onChange={(e) => setToPastelID(e.target.value)}
              required 
            />
          </div>
          <div>
            <label className="block text-bw-700 font-bold mb-2" htmlFor="messageBody">Message Body</label>
            <textarea 
              className="input w-full" 
              id="messageBody" 
              rows={5} 
              placeholder="Enter your message" 
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              required
            ></textarea>
          </div>
          <div className="flex justify-between">
            <button className="btn success outline" type="submit" disabled={isSending}>
              {isSending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </form>
      </div>
      <div>
        <h2 className="text-2xl mb-4">Received Messages</h2>
        <div id="receivedMessages" className="bg-bw-50 p-4 rounded-xl">
          {Object.entries(receivedMessages).map(([fromPastelId, messages]) => (
            messages.map((message, index) => (
              <div key={`${fromPastelId}-${index}`} className="mb-4 border border-gray-300 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-600 mb-2">From: {fromPastelId}</p>
                <p className="text-base text-gray-800 mb-2">{message.message_body}</p>
                <p className="text-xs text-gray-500">{new Date(message.timestamp).toLocaleString()}</p>
              </div>
            ))
          ))}
        </div>
      </div>
    </div>
  );
}