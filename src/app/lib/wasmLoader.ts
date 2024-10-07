import { useEffect, useState } from 'react';

declare global {
  interface Window {
    Module: any;
  }
}

let wasmModule: any = null;

export async function initWasm() {
  if (typeof window === 'undefined') {
    return null; // Return null on the server side
  }

  if (wasmModule) {
    return wasmModule;
  }

  try {
    await import('/libpastel_wasm.js');
    wasmModule = await window.Module;
    return wasmModule;
  } catch (error) {
    console.error('Failed to load WASM module:', error);
    return null;
  }
}

export function useWasm() {
  const [wasm, setWasm] = useState<any>(null);

  useEffect(() => {
    initWasm().then(setWasm);
  }, []);

  return wasm;
}