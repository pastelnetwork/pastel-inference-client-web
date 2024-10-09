// src/app/components/GenerationResult.tsx

'use client'

import { Button } from "antd";

export default function GenerationResult() {
  const downloadZip = () => {

  }
  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6 hidden">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Generation Result</h2>
        <pre id="resultContent" className="bg-gray-100 p-4 rounded-md overflow-x-auto"></pre>

        <Button onClick={downloadZip}
            className="mt-4 bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition duration-300">Download ZIP</Button>
    </div>
  );
}