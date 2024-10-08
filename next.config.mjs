/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config) => {
      config.experiments = { ...config.experiments, asyncWebAssembly: true };
      config.output.webassemblyModuleFilename = 'static/wasm/[modulehash].wasm';
  
      // This will allow Next.js to handle the WASM file
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
  
      return config;
    },
  };
  
  export default nextConfig;