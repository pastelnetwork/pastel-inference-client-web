// src/app/components/ExistingPromotionalPacks.tsx

'use client'

import { Button, Select } from "antd";

export default function ExistingPromotionalPacks() {
  const handleExistingPacksChange = () => {

  }
  const downloadExistingPack = () => {

  }
  const downloadAllPromoPacks = () => {

  }
  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-700">Existing Promotional Packs</h2>
      <Select
        onChange={handleExistingPacksChange}
        options={[
          {
            value: '',
            label: '--',
          },
        ]}
        className="w-full mb-4 min-h-10"
      />
      <div className="flex justify-between">
        <Button onClick={downloadExistingPack}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition duration-300 h-auto">Download Selected Pack</Button>
        <Button onClick={downloadAllPromoPacks}
            className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition duration-300 h-auto">Download All Packs (ZIP)</Button>
      </div>
    </div>
  );
}