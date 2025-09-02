/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['zerox', 'libheif-js'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    // ** Needed to run zerox with TRPC **
    // If libheif-js is only needed in browser builds, stub it on the server.
    config.resolve.alias['libheif-js'] = false;
    // Or force runtime require instead of bundling
    config.externals.push('libheif-js');

    return config;
  },
};

module.exports = nextConfig;