import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle: small footprint for the 1 GB droplet, no npm install on the server.
  output: "standalone",
  // The client is its own package; don't let the empty repo-root lockfile become the tracing root.
  outputFileTracingRoot: path.resolve(process.cwd()),
  turbopack: { root: path.resolve(process.cwd()) },
  poweredByHeader: false,
  // Legacy admin URLs → the rebuilt admin sections.
  async redirects() {
    return [
      ["/admin/wallets", "/admin/users"],
      ["/admin/wallets/deposits", "/admin/deposits"],
      ["/admin/wallets/withdrawals", "/admin/withdrawals"],
      ["/admin/wallets/pnl-uploads", "/admin/reports"],
      ["/admin/trade-broker", "/admin/trading"],
      ["/admin/trade-broker/report", "/admin/trading"],
      ["/admin/trade-broker/charges", "/admin/trading/charges"],
      ["/admin/trade-broker/api", "/admin/trading/sources"],
      ["/admin/prof-loss", "/admin/trading/results"],
      ["/admin/notification", "/admin/notices"],
      ["/admin/page-setup", "/admin/support"],
      ["/admin/payment-setup", "/admin/settings"],
      ["/admin/setup", "/admin/settings"],
    ].map(([source, destination]) => ({ source, destination, permanent: false }));
  },
};

export default nextConfig;
