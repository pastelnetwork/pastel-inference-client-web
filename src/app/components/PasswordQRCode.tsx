// src/app/components/PasswordQRCode.tsx
import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import useStore from '../store/useStore';

const PasswordQRCode: React.FC = () => {
  const { initialPassword, showPasswordQR, setShowPasswordQR } = useStore();

  if (!showPasswordQR || !initialPassword) return null;

  const handleDownload = () => {
    const canvas = document.querySelector("#qrPassword > canvas") as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas
        .toDataURL("image/png")
        .replace("image/png", "image/octet-stream");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `pastel-network-password.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg text-center">
        <h2 className="text-2xl font-bold mb-4">Your Wallet Password</h2>
        <p className="mb-4">Take a picture of this QR code with your smartphone to save your wallet password securely.</p>
        <div className="flex justify-center flex-col items-center" id="qrPassword">
          <QRCodeCanvas value={initialPassword} size={256} />
          <a href="#" onClick={handleDownload} className='text-green-600 hover:text-green-800 text-sm mt-1'>Download</a>
        </div>
        <p className="mt-4 mb-8">Password: <b>{initialPassword}</b> <button
                onClick={() => navigator.clipboard.writeText(initialPassword)}
                className="ml-2 w-2 text-green-600 hover:text-green-800 transition-colors"
                title="Copy"
              >
                📋
              </button></p>
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