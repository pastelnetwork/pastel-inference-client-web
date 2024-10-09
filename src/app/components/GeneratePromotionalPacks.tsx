// src/app/components/GeneratePromotionalPacks.tsx

'use client'

import { Input, Typography, Button } from "antd";

export default function GeneratePromotionalPacks() {
  const generatePromoPacks = () => {

  }
  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Generate Promotional Packs</h2>
        <div className="mb-4">
          <Typography.Title className="block text-sm font-medium text-gray-700 mb-1" level={5}>Number of Packs:</Typography.Title>
          <Input type="number" id="numberOfPacks" className="w-full p-2 border rounded-md" min="1" value="1" />
        </div>
        <div className="mb-4">
          <Typography.Title className="block text-sm font-medium text-gray-700" level={5}>Credits Per
                Pack:</Typography.Title>
          <Input type="number" id="creditsPerPack" className="w-full p-2 border rounded-md" min="1" value="100" />
        </div>
        <Button onClick={generatePromoPacks}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition duration-300 h-auto">Generate Packs</Button>
    </div>
  );
}