import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root,
  },
  async redirects() {
    return [
      { source: "/dashboard", destination: "/", permanent: false },
      { source: "/start", destination: "/campaigns", permanent: false },
      { source: "/drafting-room", destination: "/content", permanent: false },
      { source: "/campaign/new", destination: "/campaigns", permanent: false },
      { source: "/login", destination: "/signin", permanent: false },
      { source: "/gate", destination: "/", permanent: false },
      { source: "/thank-you", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
