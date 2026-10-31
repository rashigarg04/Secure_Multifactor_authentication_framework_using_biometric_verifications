import app from "./app.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { AuditLog } from "./models/AuditLog.js";
import { Challenge } from "./models/Challenge.js";
import { User } from "./models/User.js";

async function start() {
  await connectDB();
  // Make sure unique/TTL indexes exist before accepting traffic
  await Promise.all([User.init(), AuditLog.init(), Challenge.init()]);

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 API listening on http://localhost:${env.PORT}`);
    console.log(`🔐 WebAuthn RP_ID=${env.RP_ID}  ORIGIN=${env.ORIGIN}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
