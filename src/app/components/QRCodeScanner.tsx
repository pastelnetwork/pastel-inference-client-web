// src/app/components/QRCodeScanner.tsx

import React, { useState, useEffect } from 'react';
import { QrScan } from 'pastel-qr-scan';
import jsQR from 'jsqr';
import { Button, Typography, Modal, Spin } from "antd";
import { LoadingOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

import useStore from '@/app/store/useStore';
import * as api from '@/app/lib/api';

const QRCodeScanner: React.FC = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setLoading] = useState(false);
  const {
    showQRScanner,
    closeQRCodeScan,
    refreshWalletData,
    importedWalletByQRCode,
    saveWalletToLocalStorage,
    unlockWallet,
  } = useStore();

  useEffect(() => {
    if (!hasPermission) {
      checkCameraPermission();
    }
  }, [hasPermission]);

  if (!showQRScanner) return null;

  const handleImportWallet = async (walletData: string) => {
    if (walletData) {
      const data = atob(walletData);
      const parseData = data.split('@$@&@');
      const walletContent = parseData[0];
      const initialPassword = parseData[1];
      const success = await api.importWalletFromDatFile(walletContent, initialPassword);
      if (success) {
        await unlockWallet(initialPassword);
        await refreshWalletData();
        importedWalletByQRCode();
        saveWalletToLocalStorage();
        setLoading(false);
        window.location.reload();
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
      console.error("The browser does not support checking camera permissions. ", err);
    }
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
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
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => {
          setHasPermission(true);
        })
        .catch((error) => {
          console.error(error);
        });
    }
  }

  const handleQrReaderResult = async (data: string) => {
    if (data) {
      await handleImportWallet(data)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Modal
        centered
        open={showQRScanner}
        width={700}
        footer={null}
        onCancel={closeQRCodeScan}
      >
        <div className="bg-white p-4 rounded-lg w-full">
          <Title level={2} className="text-2xl font-bold mb-4">Scan QR Code</Title>
          <div className='w-full relative mt-8'>
            <div className='text-center flex justify-center qr-reader-wrapper'>
              {hasPermission && showQRScanner ?
                <QrScan
                  onResult={(result) => {
                    if (result?.text) {
                      handleQrReaderResult(result.text)
                    }
                  }}
                  videoHeight='500px'
                  videoWidth='620px'
                  className="w-full"
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
            {isLoading ? (
              <div className='absolute top-0 left-0 right-0 bottom-0 flex justify-center items-center z-50 w-full h-full bg-opacity-60 bg-slate-50'>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
                <div>Loading ...</div>
              </div>
            ) : null }
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default QRCodeScanner;