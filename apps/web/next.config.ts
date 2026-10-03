import type { NextConfig } from "next";

const apiTarget=process.env.API_INTERNAL_URL||"http://127.0.0.1:4000";

const nextConfig:NextConfig={
  reactStrictMode:true,
  output:"standalone",
  async rewrites(){
    return [{source:"/api/:path*",destination:apiTarget+"/api/:path*"}];
  }
};

export default nextConfig;
