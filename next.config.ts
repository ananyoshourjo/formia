import type { NextConfig } from "next";

const isElectronBuild = process.env.FORMIA_ELECTRON_BUILD === "1";

const nextConfig: NextConfig = {
  output: isElectronBuild ? "export" : undefined,
  assetPrefix: isElectronBuild ? "." : undefined,
  trailingSlash: isElectronBuild,
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
};

export default nextConfig;
