// src/app/components/OperationLog.tsx

'use client'

export default function OperationLog() {
  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Operation Log</h2>
        <div id="logContent" className="bg-gray-100 p-4 rounded-md h-64 overflow-y-auto font-mono text-sm"></div>
    </div>
  );
}