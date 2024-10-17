// src/app/components/QRCodeScanner.tsx
import React from 'react';
import { QrReader } from 'react-qr-reader';
import useStore from '../store/useStore';

const QRCodeScanner: React.FC = () => {
  const { showQRScanner, setShowQRScanner, unlockWallet } = useStore();

  if (!showQRScanner) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-4">Scan QR Code</h2>
        <QrReader
          onResult={(result) => {
            if (result) {
              unlockWallet(result.getText());
              setShowQRScanner(false);
            }
          }}
          constraints={{ facingMode: 'environment' }}
          containerStyle={{ width: '100%' }}
        />
        <button
          className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
          onClick={() => setShowQRScanner(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default QRCodeScanner;