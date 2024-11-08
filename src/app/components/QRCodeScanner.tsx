// src/app/components/QRCodeScanner.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleImportWallet = useCallback(async (walletData: string) => {
    if (walletData) {
      try {
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
      } catch (error) {
        alert('Import failed');
        setLoading(false);
        console.error(error)
      }
    }
  }, [importedWalletByQRCode, refreshWalletData, saveWalletToLocalStorage, unlockWallet]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');

    const enableCamera = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          if (video) {
            video.srcObject = stream;
            video.play();
          }
        } catch (error) {
          console.error("Can't open camera", error);
        }
      }
    };

    const scanQRCode = () => {
      if (canvas && video && context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          setLoading(true);
          handleImportWallet(code.data);
        }
      }
    };

    let interval: NodeJS.Timeout | null = null
    if (!hasPermission) {
      checkCameraPermission();
    } else {
      enableCamera();
      interval = setInterval(scanQRCode, 500);
    }
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    };
  }, [hasPermission, handleImportWallet]);

  if (!showQRScanner) return null;

  const checkCameraPermission = async () => {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
      setHasPermission(permissionStatus.state === 'granted');

      permissionStatus.onchange = () => {
        setHasPermission(permissionStatus.state === 'granted');
      };
    } catch (err) {
      console.error("The browser does not support checking camera permissions.", err);
    }
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
            <div className={`text-center flex justify-center qr-reader-wrapper relative ${hasPermission && showQRScanner ? 'bg-black' : 'permission-wrapper'}`}>
              {hasPermission && showQRScanner ?
                <>
                  <div className='qr-overlay'></div>
                  <video ref={videoRef} autoPlay playsInline className='video-container' width="2000" height="1500"></video>
                  <canvas ref={canvasRef} className='hidden' width="400" height="400"></canvas>
                </> :
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
            {isLoading ? (
              <div className='absolute top-0 left-0 right-0 bottom-0 flex justify-center items-center z-50 w-full h-full bg-opacity-60 bg-slate-50'>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 28 }} spin />} />
                <div className='ml-3'>Loading ...</div>
              </div>
            ) : null }
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default QRCodeScanner;