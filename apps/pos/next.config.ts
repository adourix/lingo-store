import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/pos/catalog/products",
        destination: "/catalog/products",
      },
    ];
  },
};

export default nextConfig;
