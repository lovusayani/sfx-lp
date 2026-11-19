import fs from "fs";
import path from "path";

import dotenv from "dotenv";

const cwdEnvPath = path.resolve(process.cwd(), ".env");
const workspaceServerEnvPath = path.resolve(process.cwd(), "server/.env");

dotenv.config({
  path: fs.existsSync(cwdEnvPath) ? cwdEnvPath : workspaceServerEnvPath,
});

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || "",
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  // KYC documents and payment proofs: never served statically, only via /api/files (owner or admin).
  privateUploadDir: process.env.PRIVATE_UPLOAD_DIR || "private_uploads",
  maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024,
  adminEmail: process.env.ADMIN_EMAIL || "",
  adminPassword: process.env.ADMIN_PASSWORD || "",
  adminName: process.env.ADMIN_NAME || "System Admin",
  appEnv: process.env.APP_ENV || process.env.NODE_ENV || "development",
  // Extra allowed browser origins (comma separated), e.g. https://app.sfxlp.com
  clientUrls: (process.env.CLIENT_URLS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  // Demo LP is seeded only outside production and only when explicitly configured.
  demoLpName: process.env.DEMO_LP_NAME || "Demo LP User",
  demoLpEmail: process.env.DEMO_LP_EMAIL || "",
  demoLpPassword: process.env.DEMO_LP_PASSWORD || "",
  // Secure cookies whenever the app is served over HTTPS (override with COOKIE_SECURE=true|false).
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : (process.env.CLIENT_URL || "").startsWith("https://"),
  deployWebhookSecret: process.env.DEPLOY_WEBHOOK_SECRET || "",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "",
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
  firebasePrivateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  // Default trade API source. No production default: must be set per environment.
  tradesApiName: process.env.TRADES_API_NAME || "Default trade source",
  tradesApiBaseUrl: process.env.TRADES_API_BASE_URL || "",
  tradesApiKey: process.env.TRADES_API_KEY || "",
};

export const validateEnv = (): void => {
  const required = ["MONGO_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  if (env.nodeEnv === "production") {
    const weak = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"].filter(
      (key) => (process.env[key] || "").length < 32 || /replace_with/i.test(process.env[key] || "")
    );
    if (weak.length > 0) {
      throw new Error(`Production requires strong secrets (32+ chars): ${weak.join(", ")}`);
    }
  }
};
