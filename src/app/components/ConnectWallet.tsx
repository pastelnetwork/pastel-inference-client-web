// src/app/components/ConnectWallet.tsx
import React from 'react';
import { Button, Typography, Modal } from "antd";

import useStore from '@/app/store/useStore';

const { Title, Paragraph } = Typography;

const ConnectWallet: React.FC = () => {
  const { setShowConnectWallet, createNewWallet, setShowImportExistingWallet, showConnectWallet } = useStore();
  if (!showConnectWallet) {
    return null;
  }

  const handleImportExistingWallet = () => {
    setShowConnectWallet(false)
    setShowImportExistingWallet(true);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Modal
        centered
        open
        width={500}
        maskClosable={false}
        closable={false}
        footer={null}
      >
        <div className="bg-white sm:p-4 rounded-lg text-center">
          <Title level={2} className="text-2xl font-bold mb-4">Connect Wallet</Title>
          <Paragraph className="mb-4 text-base">Please import an existing wallet or create a new wallet.</Paragraph>
          <div className='mb-4'>
            <Button
              onClick={createNewWallet}
              className="btn success outline w-full sm:w-80 transition duration-300 text-base font-bold"
            >
              Create New Wallet
            </Button>
          </div>
          <div className='mb-4'>
            <Button
              onClick={handleImportExistingWallet}
              className="btn success outline w-full sm:w-80 transition duration-300 text-base font-bold"
            >
              Import Existing Wallet
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ConnectWallet;