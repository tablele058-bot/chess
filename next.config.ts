import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.6", "localhost:3000"],
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
