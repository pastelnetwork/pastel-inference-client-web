// src/app/components/ConnectWallet.tsx
import React, { useState } from 'react';
import { Button, Typography, Modal, Card, Col, Row, Tooltip, Input } from "antd";
import { InfoCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import jsQR from 'jsqr';

import Loading from '@/app/components/Loading';
import useStore from '@/app/store/useStore';
import * as api from '@/app/lib/api';
import { generateSecurePassword } from "@/app/lib/passwordUtils";

const { Title } = Typography;

const ImportExistingWallet: React.FC = () => {
  const {
    saveWalletToLocalStorage,
    setShowImportExistingWallet,
    setInitialPassword,
    setQRCodeContent,
    importedWalletFile,
    unlockWallet,
    setBackConnectWallet,
    closeImportExistingWallet,
    setShowQRScanner,
    showImportExistingWallet,
    refreshWalletData,
    importedWalletByQRCode,
  } = useStore();

  const [privKey, setPrivKey] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [walletFile, setWalletFile] = useState<File | null>(null);
  const [walletManagementLoading, setWalletManagementLoading] = useState<{
    isImportWalletLoading: boolean;
    isPrivateKeyLoading: boolean;
    isUploadQRLoading: boolean;
  }>({
    isImportWalletLoading: false,
    isPrivateKeyLoading: false,
    isUploadQRLoading: false,
  });

  if (!showImportExistingWallet) {
    return null;
  }
  const getImportPrivateKeyTitle = () => {
    return (
      <div className='ant-card-head-title'>
        Import Private Key <Tooltip title="Import a private key into your wallet."><InfoCircleOutlined /></Tooltip>
      </div>
    )
  }

  const getImportWalletTitle = () => {
    return (
      <div className='ant-card-head-title'>
        Import Wallet File <Tooltip title="You can use the wallet file (*.wallet) from the Pastel Lite to import to the Inference Client"><InfoCircleOutlined /></Tooltip>
      </div>
    )
  }

  const getImportByQRTitle = () => {
    return (
      <div className='ant-card-head-title'>
        Import by QR <Tooltip title="Import QR code into your wallet."><InfoCircleOutlined /></Tooltip>
      </div>
    )
  }

  const importPrivKey = async () => {
    if (!privKey) {
      alert("Please enter private key!");
      return;
    }
    setWalletManagementLoading({
      ...walletManagementLoading,
      isPrivateKeyLoading: true,
    });
    try {
      localStorage.removeItem("walletPassword");
      const password = generateSecurePassword();
      localStorage.setItem("walletPassword", password);
      setInitialPassword(password);
      await api.createNewWallet(password);
      await api.importPrivKey(privKey);
      const existingPastelID = await api.checkForPastelID();
      if (!existingPastelID) {
        await api.makeNewPastelID(false);
      }
      await unlockWallet(password);
      saveWalletToLocalStorage();
      const walletContent = await api.exportWallet();
      setQRCodeContent(btoa(`${walletContent}@$@&@${password}`))
      alert("Private key imported successfully!");
      setPrivKey("");
      setShowImportExistingWallet(false);
      importedWalletFile(password);
    } catch (error) {
      console.error("Error importing private key:", error);
      alert("Failed to import private key. Please try again.");
    } finally {
      setWalletManagementLoading({
        ...walletManagementLoading,
        isPrivateKeyLoading: false,
      });
    }
  }

  const importWallet = async () => {
    if (!walletFile) {
      alert("Please select a Wallet file to import.");
      return;
    }
    if (!password) {
      alert("Please enter password.");
      return;
    }
    setWalletManagementLoading({
      ...walletManagementLoading,
      isImportWalletLoading: true,
    });

    try {
      const arrayBuffer = await walletFile.arrayBuffer();
      const success = await api.importWalletFromDatFile(arrayBuffer, password);
      if (success) {
        const existingPastelID = await api.checkForPastelID();
        if (!existingPastelID) {
          await api.makeNewPastelID(false);
        }
        await unlockWallet(password);
        alert("Wallet imported successfully!");
        setWalletFile(null);
        setPassword('');
        saveWalletToLocalStorage();
        setShowImportExistingWallet(false);
        importedWalletFile(password);
      } else {
        alert('Failed to import wallet.')
      }
    } catch (error) {
      console.error("Error importing wallet:", error);
      alert("Failed to import wallet. Please try again.");
    } finally {
      setWalletManagementLoading({
        ...walletManagementLoading,
        isImportWalletLoading: false,
      });
    }
  }

  const onBack = () => {
    setShowImportExistingWallet(false);
    setBackConnectWallet(true);
    closeImportExistingWallet();
  }

  const handleImportQR = () => {
    setShowImportExistingWallet(false);
    setShowQRScanner(true)
  }

  const handleImportWalletByQR = async (walletData: string) => {
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
          setWalletManagementLoading({
            ...walletManagementLoading,
            isUploadQRLoading: false,
          });
          saveWalletToLocalStorage();
          setShowImportExistingWallet(false);
        } else {
          alert('Import failed')
        }
      } catch (error) {
        console.error("Error importing wallet:", error);
        alert("Import failed");
      } finally {
        setWalletManagementLoading({
          ...walletManagementLoading,
          isUploadQRLoading: false,
        });
      }
    }
  }

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setWalletManagementLoading({
      ...walletManagementLoading,
      isUploadQRLoading: true,
    });
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
        setWalletManagementLoading({
          ...walletManagementLoading,
          isUploadQRLoading: false,
        });
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          handleImportWalletByQR(code?.data);
        } else {
          alert("QR code invalid")
          setWalletManagementLoading({
            ...walletManagementLoading,
            isUploadQRLoading: false,
          });
        }
      };
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Modal
        centered
        open
        width={700}
        maskClosable={false}
        closable={false}
        footer={null}
      >
        <div className="bg-white p-4 rounded-lg text-center">
          <div className='relative'>
            <Tooltip title="Back to Connect Wallet">
              <Button shape="circle" icon={<ArrowLeftOutlined />} className='absolute top-1 -left-2 sm:left-0' onClick={onBack} />
            </Tooltip>
            <Title level={2} className="text-xl sm:text-2xl font-bold">Import Existing Wallet</Title>
          </div>
          <div className='mt-8'>
            <Row gutter={24}>
              <Col span={24}>
                <Card title={getImportPrivateKeyTitle()} className='w-full text-left'>
                  <div>
                    <Title level={5} className='text-bw-700 font-bold'>Enter private key</Title>
                    <Input
                      placeholder="Enter private key"
                      value={privKey}
                      onChange={(e) => setPrivKey(e.target.value)}
                    />
                  </div>
                  <div className='mt-4 flex'>
                    <Button
                      onClick={importPrivKey}
                      className="btn success outline w-full sm:w-44 text-center transition duration-300 text-base font-bold inline-block"
                      disabled={walletManagementLoading.isPrivateKeyLoading}
                    >
                      Import Private Key
                    </Button>
                    <Loading isLoading={walletManagementLoading.isPrivateKeyLoading} text="Importing..." className="ml-3" />
                  </div>
                </Card>
              </Col>
              <Col span={24} className='mt-4'>
                <Card title={getImportWalletTitle()} className='w-full text-left'>
                  <div>
                    <Input
                      type='file'
                      accept=".wallet"
                      onChange={(e) =>
                        setWalletFile(e.target.files ? e.target.files[0] : null)
                      }
                    />
                  </div>
                  <div className='mt-4'>
                    <Title level={5} className='text-bw-700 font-bold'>Enter password</Title>
                    <Input
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type='password'
                    />
                  </div>
                  <div className='mt-4 flex items-center'>
                    <Button
                      onClick={importWallet}
                      className="btn success outline w-full sm:w-44 text-center transition duration-300 text-base font-bold inline-block"
                      disabled={walletManagementLoading.isImportWalletLoading}
                    >
                      Import Wallet File
                    </Button>
                    <Loading isLoading={walletManagementLoading.isImportWalletLoading} text="Importing..." className="ml-3" />
                  </div>
                </Card>
              </Col>
              <Col span={24} className='mt-4 text-left'>
                <Card title={getImportByQRTitle()} className='w-full text-left'>
                  <div className='flex gap-3 sm:items-center sm:flex-row flex-col'>
                    <Button
                      onClick={handleImportQR}
                      className="btn success outline w-full sm:w-44 text-center transition duration-300 text-base font-bold inline-block"
                    >
                      Scan QR
                    </Button>
                    <div className='sm:w-auto w-full text-center'>- Or -</div>
                    <div>
                      <div className='flex items-center'>
                        <label className={`btn success outline w-full sm:w-44 text-center transition duration-300 text-base font-bold inline-block custom-button ${walletManagementLoading.isUploadQRLoading ? 'disabled' : ''}`}>
                          <span>Upload QR</span>
                          <input type="file" accept=".png" onChange={handleImageChange} className='opacity-0 w-0 h-0' />
                        </label>
                        <Loading isLoading={walletManagementLoading.isUploadQRLoading} text="Importing..." className="ml-3" />
                      </div>
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ImportExistingWallet;