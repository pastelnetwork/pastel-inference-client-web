// src/app/components/PasswordQRCode.tsx
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import useStore from '../store/useStore';

const PasswordQRCode: React.FC = () => {
  const { initialPassword, showPasswordQR, setShowPasswordQR } = useStore();

  if (!showPasswordQR || !initialPassword) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg text-center">
        <h2 className="text-2xl font-bold mb-4">Your Wallet Password</h2>
        <p className="mb-4">Take a picture of this QR code with your smartphone to save your wallet password securely.</p>
        <QRCodeSVG value={initialPassword} size={256} />
        <p className="mt-4 mb-8">Password: {initialPassword}</p>
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded"
          onClick={() => setShowPasswordQR(false)}
        >
          I&apos;ve Saved My Password
        </button>
      </div>
    </div>
  );
};

export default PasswordQRCode;