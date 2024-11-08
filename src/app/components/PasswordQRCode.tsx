// src/app/components/PasswordQRCode.tsx
import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from "html2canvas";

import useStore from '../store/useStore';

const PasswordQRCode: React.FC = () => {
  const { initialPassword, showPasswordQR, qrCodeContent, importedWalletByQRCode } = useStore();
  const qrRef = useRef(null);

  if (!showPasswordQR || !initialPassword) return null;

  const handleDownload = () => {
    const qrElement = qrRef.current;
    if (qrElement) {
      html2canvas(qrElement, { backgroundColor: null }).then((canvas) => {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = "pastel-network-password.png";
        link.click();
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg text-center">
        <h2 className="text-2xl font-bold mb-4">Your Wallet Password</h2>
        <p className="mb-4">Take a picture of this QR code with your smartphone to save your wallet password securely.</p>
        <div className="flex justify-center flex-col items-center qr-code-wrapper">
          <div ref={qrRef} className='qr-code-container'>
            <QRCodeCanvas value={qrCodeContent} size={1918} level="H" bgColor='#fff' />
          </div>
          <a href="#" onClick={handleDownload} className='text-green-600 hover:text-green-800 text-sm mt-1'>Download</a>
        </div>
        <p className="mt-4 mb-8 hidden">Password: <b>{initialPassword}</b> <button
                onClick={() => navigator.clipboard.writeText(initialPassword)}
                className="ml-2 w-2 text-green-600 hover:text-green-800 transition-colors"
                title="Copy"
              >
                📋
              </button></p>
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded mt-4"
          onClick={() => importedWalletByQRCode()}
        >
          I&apos;ve Saved My Password
        </button>
      </div>
    </div>
  );
};

export default PasswordQRCode;