import { schedule } from "node-cron";
import { logger } from "./lib/logger";

export function startKeepalive(): void {
  const serviceUrl = process.env["RENDER_EXTERNAL_URL"];

  if (!serviceUrl) {
    logger.info("[keepalive] RENDER_EXTERNAL_URL not set — keep-alive disabled (local dev)");
    return;
  }

  const pingUrl = `${serviceUrl}/healthz`;

  // Every 10 minutes, 8 AM – 11 PM Malaysia time (UTC+8)
  // Cron: minute=*/10, hour=8-23 in Asia/Kuala_Lumpur timezone
  schedule(
    "*/10 8-23 * * *",
    async () => {
      try {
        const res = await fetch(pingUrl);
        logger.info({ status: res.status, url: pingUrl }, "[keepalive] ping ok");
      } catch (err) {
        logger.warn({ err, url: pingUrl }, "[keepalive] ping failed");
      }
    },
    { timezone: "Asia/Kuala_Lumpur" },
  );

  logger.info({ pingUrl }, "[keepalive] scheduled — pinging every 10 min between 8 AM–11 PM MYT");
}
