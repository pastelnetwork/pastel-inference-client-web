// src/app/components/GeneratePromotionalPacks.tsx

'use client'

import { ChangeEvent, useState } from 'react';
import { Input, Typography, Button } from "antd";

import useStore from '../store/useStore';

export default function GeneratePromotionalPacks() {
  const { setPromoGeneratorMessage, setGeneratingPromotionalPacks } = useStore()
  const [numberOfPacks, setNumberOfPacks] = useState(1)
  const [creditsPerPack, setCreditsPerPack] = useState(100)

  const generatePromoPacks = () => {
    if (!numberOfPacks || !creditsPerPack || numberOfPacks < 1 || creditsPerPack < 1) {
      setPromoGeneratorMessage('Please enter valid numbers for both the number of packs and credits per pack.')
      return
    }
    setPromoGeneratorMessage('')
    console.log(numberOfPacks, creditsPerPack)
    setGeneratingPromotionalPacks(true)
  }

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Generate Promotional Packs</h2>
        <div className="mb-4">
          <Typography.Title className="block text-sm font-medium text-gray-700 mb-1" level={5}>Number of Packs:</Typography.Title>
          <Input type="number" id="numberOfPacks" className="w-full p-2 border rounded-md" min="1" value={numberOfPacks} onChange={(event: ChangeEvent<HTMLInputElement>) => setNumberOfPacks(Number(event.target.value))} />
        </div>
        <div className="mb-4">
          <Typography.Title className="block text-sm font-medium text-gray-700" level={5}>Credits Per
                Pack:</Typography.Title>
          <Input type="number" id="creditsPerPack" className="w-full p-2 border rounded-md" min="1" value={creditsPerPack} onChange={(event: ChangeEvent<HTMLInputElement>) => setCreditsPerPack(Number(event.target.value))} />
        </div>
        <Button onClick={generatePromoPacks}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition duration-300 h-auto">Generate Packs</Button>
    </div>
  );
}