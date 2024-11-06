// src/app/components/ConnectWallet.tsx
import React, { useState } from 'react';
import { Button, Typography, Modal, Card, Col, Row, Tooltip, Input } from "antd";
import { InfoCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';

import useStore from '@/app/store/useStore';
import * as api from '@/app/lib/api';
import { generateSecurePassword } from "@/app/lib/passwordUtils";

const { Title } = Typography;

const ImportExistingWallet: React.FC = () => {
  const {
    saveWalletToLocalStorage,
    setShowPasswordQR,
    setShowImportExistingWallet,
    setInitialPassword,
    setQRCodeContent,
    importedWalletByQRCode,
    unlockWallet,
    setBackConnectWallet,
    closeQRCodeScan,
  } = useStore();

  const [privKey, setPrivKey] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [walletFile, setWalletFile] = useState<File | null>(null);
  const [walletManagementLoading, setWalletManagementLoading] = useState<{
    isImportWalletLoading: boolean;
    isPrivateKeyLoading: boolean;
  }>({
    isImportWalletLoading: false,
    isPrivateKeyLoading: false,
  });

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
        Import Wallet <Tooltip title="Import a wallet file into your wallet."><InfoCircleOutlined /></Tooltip>
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
      importedWalletByQRCode();
      setShowPasswordQR(true);
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
        importedWalletByQRCode();
        setShowPasswordQR(true);
      } else {
        throw new Error("Failed to import wallet");
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
    closeQRCodeScan();
  }

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
              <Button shape="circle" icon={<ArrowLeftOutlined />} className='absolute top-1 left-0' onClick={onBack} />
            </Tooltip>
            <Title level={2} className="text-2xl font-bold">Import Existing Wallet</Title>
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
                  <div className='mt-4'>
                    <Button
                      onClick={importPrivKey}
                      className="btn success outline w-44 text-center transition duration-300 text-base font-bold inline-block"
                      disabled={walletManagementLoading.isPrivateKeyLoading}
                    >
                      Import Private Key
                    </Button>
                    {walletManagementLoading.isPrivateKeyLoading && <div className="btn is-loading">Importing...</div>}
                  </div>
                </Card>
              </Col>
              <Col span={24} className='mt-4'>
                <Card title={getImportWalletTitle()} className='w-full text-left'>
                  <div>
                    <Input
                      type='file'
                      accept=".dat"
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
                  <div className='mt-4'>
                    <Button
                      onClick={importWallet}
                      className="btn success outline w-44 text-center transition duration-300 text-base font-bold inline-block"
                      disabled={walletManagementLoading.isImportWalletLoading}
                    >
                      Import Wallet
                    </Button>
                    {walletManagementLoading.isImportWalletLoading && <div className="btn is-loading">Importing...</div>}
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