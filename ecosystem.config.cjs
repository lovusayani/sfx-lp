// PM2 process file for SfX LP. Paths come from the environment so this file
// never points at another application's server. Example:
//   SFX_ROOT=/var/www/sfx-lp pm2 start ecosystem.config.cjs --env production
const path = require("path");
const root = process.env.SFX_ROOT || __dirname;

module.exports = {
  apps: [
    {
      name: "sfx-lp-api",
      cwd: path.join(root, "server"),
      script: "dist/server.js",
      instances: 1, // daily-charge cron runs in-process; keep a single API instance
      exec_mode: "fork",
      env_production: { NODE_ENV: "production", APP_ENV: "production" },
      env_staging: { NODE_ENV: "production", APP_ENV: "staging" },
    },
    {
      name: "sfx-lp-web",
      cwd: path.join(root, "client"),
      script: "node_modules/next/dist/bin/next",
      args: `start -H 127.0.0.1 -p ${process.env.SFX_WEB_PORT || 3100}`,
      instances: 1,
      exec_mode: "fork",
      env_production: { NODE_ENV: "production" },
      env_staging: { NODE_ENV: "production" },
    },
  ],
};
