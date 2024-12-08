/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    config.output.webassemblyModuleFilename = isServer
      ? './../static/wasm/[modulehash].wasm'
      : 'static/wasm/[modulehash].wasm';

    return config;
  },
  // This configuration allows server actions from any origin/host
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',  // Optional: adjust as needed
      allowedOrigins: ['*'],
      allowedForwardedHosts: ['*']
    }
  }
};

export default nextConfig;