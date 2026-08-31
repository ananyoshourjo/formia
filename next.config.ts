import type { NextConfig } from "next";

const isElectronBuild = process.env.FORMIA_ELECTRON_BUILD === "1";

const nextConfig: NextConfig = {
  output: isElectronBuild ? "export" : undefined,
  assetPrefix: isElectronBuild ? "." : undefined,
  trailingSlash: isElectronBuild,
};

export default nextConfig;
