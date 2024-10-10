// src/app/components/RecoverExistingCreditPacks.tsx

'use client'

import { ChangeEvent, useState } from 'react';
import { Input, Typography, Button } from "antd";

import useStore from '../store/useStore';

export default function RecoverExistingCreditPacks() {
  const { setPromoGeneratorMessage } = useStore()
  const [recoverCreditsPerPack, setRecoverCreditsPerPack] = useState(100)

  const recoverExistingCreditPacks = () => {
    if (!recoverCreditsPerPack) {
      setPromoGeneratorMessage('Please enter a valid number for credits per pack.')
      return
    }
    setPromoGeneratorMessage('')
    console.log('recoverCreditsPerPack', recoverCreditsPerPack)
  }

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Recover Existing Credit Packs</h2>
        <div className="mb-4">
          <Typography.Title className="block text-sm font-medium text-gray-700 mb-1" level={5}>Credits Per Pack:</Typography.Title>
          <Input type="number" id="recoverCreditsPerPack" className="w-full p-2 border rounded-md" min="1" value={recoverCreditsPerPack} onChange={(event: ChangeEvent<HTMLInputElement>) => setRecoverCreditsPerPack(Number(event.target.value))} />
        </div>
        <Button onClick={recoverExistingCreditPacks}
            className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition duration-300 h-auto">Recover Existing Packs</Button>
    </div>
  );
}