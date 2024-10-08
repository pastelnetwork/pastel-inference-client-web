declare module '/libpastel_wasm.js' {
    const Module: {
      Pastel: new () => import('../app/lib/wasmLoader').PastelInstance;
    };
    export default Module;
  }