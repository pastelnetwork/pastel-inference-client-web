// src/app/components/QRCodeScanner.tsx

import React, { useState, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { Button, Typography, Modal } from "antd";

const { Title, Paragraph } = Typography;

import Loading from '@/app/components/Loading';
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
        setLoading(false);
        console.error(error)
      }
    }
  }, [importedWalletByQRCode, refreshWalletData, saveWalletToLocalStorage, unlockWallet]);

  useEffect(() => {
    let elStream: MediaStream | null = null;
    if (!hasPermission) {
      checkCameraPermission();
    } else {
      const video = document.createElement("video");
      video.setAttribute("width", "2000");
      video.setAttribute("height", "1500");
      const canvasElement = document.getElementById("canvas") as HTMLCanvasElement;
      if (canvasElement) {
        const canvas = canvasElement.getContext("2d");

        const drawLine = (begin: { x: number; y: number }, end: { x: number; y: number }, color: string) => {
          if (canvas) {
            canvas.beginPath();
            canvas.moveTo(begin.x, begin.y);
            canvas.lineTo(end.x, end.y);
            canvas.lineWidth = 3;
            canvas.strokeStyle = color;
            canvas.stroke();
          }
        }

        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function(stream) {
          elStream = stream;
          video.srcObject = stream;
          video.setAttribute("playsinline", 'true');
          video.play();
          requestAnimationFrame(tick);
        });

        const tick = () => {
          if (video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
            canvasElement.hidden = false;

            canvasElement.height = video.videoHeight;
            canvasElement.width = video.videoWidth;
            canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
            const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });
            if (code) {
              drawLine(code.location.topLeftCorner, code.location.topRightCorner, "#FF3B58");
              drawLine(code.location.topRightCorner, code.location.bottomRightCorner, "#FF3B58");
              drawLine(code.location.bottomRightCorner, code.location.bottomLeftCorner, "#FF3B58");
              drawLine(code.location.bottomLeftCorner, code.location.topLeftCorner, "#FF3B58");
              setLoading(true);
              handleImportWallet(code.data);
            }
          }
          requestAnimationFrame(tick);
        }
      }
    }
    return () => {
      if (elStream) {
        elStream.getTracks().forEach(track => track.stop());
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
        <div className="bg-white sm:p-4 rounded-lg w-full">
          <Title level={2} className="text-xl sm:text-2xl font-bold mb-4">Scan QR Code</Title>
          <div className='w-full relative mt-8'>
            <div className={`text-center flex justify-center qr-reader-wrapper relative ${hasPermission && showQRScanner ? 'bg-black' : 'permission-wrapper'}`}>
              {hasPermission && showQRScanner ?
                <>
                  <div className='qr-overlay'></div>
                  <canvas id="canvas" hidden width="400" height="400"></canvas>
                </> :
                <div className='w-full'>
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
            <Loading isLoading={isLoading} className='absolute top-0 left-0 right-0 bottom-0 z-50 w-full h-full bg-opacity-60 bg-slate-50 text-base' />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default QRCodeScanner;