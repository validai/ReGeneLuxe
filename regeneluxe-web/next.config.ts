import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const navNext = path.join(root, "src/nav/next.jsx");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root,
    resolveAlias: {
      "regeneluxe-nav": navNext,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "regeneluxe-nav": navNext,
    };
    return config;
  },
};

export default nextConfig;
