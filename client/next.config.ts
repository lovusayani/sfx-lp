import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle: small footprint for the 1 GB droplet, no npm install on the server.
  output: "standalone",
  // The client is its own package; don't let the empty repo-root lockfile become the tracing root.
  outputFileTracingRoot: path.resolve(process.cwd()),
  turbopack: { root: path.resolve(process.cwd()) },
  poweredByHeader: false,
};

export default nextConfig;
