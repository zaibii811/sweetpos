import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "./migrate";
import { seedIfEmpty } from "./seed";
import { startKeepalive } from "./keepalive";

const port = parseInt(process.env.PORT || "3001", 10);

runMigrations()
  .then(() => seedIfEmpty())
  .then(() => {
    const server = app.listen(port, "0.0.0.0", () => {
      logger.info({ port }, "Server listening");
      startKeepalive();
    });
    server.on("error", (err) => {
      logger.error({ err }, "Server failed to start");
      process.exit(1);
    });
  })
  .catch((err) => {
    logger.error({ err }, "Startup failed — aborting");
    process.exit(1);
  });
