import mongoose from "mongoose";
import { env } from "./env.js";

let memoryServer = null;

export async function connectDB() {
  let uri = env.MONGODB_URI;

  if (!uri) {
    if (env.isProd) {
      throw new Error("MONGODB_URI is required in production.");
    }
    // Rapid-setup fallback: an in-memory MongoDB. Data is lost on restart.
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri("mfa_biometric");
    console.log("⚠️  MONGODB_URI not set: using IN-MEMORY database (data resets on restart).");
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log(`✅ MongoDB connected (${memoryServer ? "in-memory" : "external"})`);
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}