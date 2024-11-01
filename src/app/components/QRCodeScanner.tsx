// src/app/components/QRCodeScanner.tsx
import React, { useState, useEffect } from 'react';
import { QrReader } from 'react-qr-reader';
import jsQR from 'jsqr';
import { Button, Typography, Modal } from "antd";

const { Title, Paragraph } = Typography;

import useStore from '@/app/store/useStore';
import * as api from '@/app/lib/api';

const QRCodeScanner: React.FC = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const { showQRScanner, closeQRCodeScan } = useStore();

  useEffect(() => {
    if (!hasPermission) {
      checkCameraPermission();
    }
  }, [hasPermission]);

  if (!showQRScanner) return null;

  const handleImportWallet = async (walletData: string) => {
    if (walletData) {
      const data = JSON.parse(atob(walletData))
      const success = await api.importWalletFromDatFile(data.walletContent, data.initialPassword);
      if (success) {
        // TODO:
      }
    }
  }

  const checkCameraPermission = async () => {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
      setHasPermission(permissionStatus.state === 'granted');

      permissionStatus.onchange = () => {
        setHasPermission(permissionStatus.state === 'granted');
      };
    } catch (err) {
      console.error("Trình duyệt không hỗ trợ kiểm tra quyền camera:", err);
    }
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.src = reader.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          handleImportWallet(code?.data);
        }
      };
    };
    reader.readAsDataURL(file);
  };

  const handleOpenPermission = () => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(() => {
        setHasPermission(true);
      })
      .catch((error) => {
        // TODO:
        console.error(error);
      });
  }

  const handleQrReaderResult = async (data: string) => {
    // TODO:
    console.log(data)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Modal
        centered
        open
        width={580}
        maskClosable={false}
        closable={false}
        footer={null}
      >
        <div className="bg-white p-4 rounded-lg w-full">
          <Title level={2} className="text-2xl font-bold mb-4">Scan QR code to import your wallet</Title>
          <div className='text-center flex justify-center'>
            {hasPermission ?
              <QrReader
                onResult={(result) => {
                  if (result) {
                    handleQrReaderResult(result.getText())
                  }
                }}
                constraints={{ facingMode: 'user' }}
                containerStyle={{ width: '400px', height: '400px', maxHeight: '400px' }}
                videoContainerStyle={{ maxHeight: '400px', height: '400px' }}
              /> :
              <div>
                <div className='camera-permission-wrapper bg-gray-200'>
                  <Paragraph className="text-base text-center">Make sure to allow camera access!</Paragraph>
                </div>
                <Button
                  className="mt-3 btn text-base font-bold w-full"
                  onClick={handleOpenPermission}
                >
                  Open Camera
                </Button>
              </div>
            }
          </div>
          <div className='mt-4 hidden'>
            <Paragraph className="mb-1 text-base">Please import an existing wallet or create a new wallet.</Paragraph>
            <label className='w-full'>
              <input type="file" onChange={handleImageChange} />
            </label>
          </div>
          <div>
            <Button
              className="mt-8 bg-red-500 btn text-white text-base font-bold w-40"
              onClick={closeQRCodeScan}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default QRCodeScanner;