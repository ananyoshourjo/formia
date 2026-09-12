import type { NextConfig } from "next";

const isElectronBuild = process.env.FORMIA_ELECTRON_BUILD === "1";

const nextConfig: NextConfig = {
  output: isElectronBuild ? "export" : undefined,
  assetPrefix: isElectronBuild ? "." : undefined,
  trailingSlash: isElectronBuild,
  ...(isElectronBuild ? {} : {
    async rewrites() {
      return [
        { source: "/demos/shadcn-admin", destination: "/demos/shadcn-admin/index.html" },
        { source: "/demos/shadcn-admin/", destination: "/demos/shadcn-admin/index.html" },
      ];
    },
  }),
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
};

export default nextConfig;
