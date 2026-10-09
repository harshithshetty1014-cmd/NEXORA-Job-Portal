import mongoose from "mongoose";
import { logger } from "./logger";

export async function connectMongo(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.warn(
      "MONGODB_URI is not configured; NEXORA data routes will return a setup message",
    );
    return;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 7000 });
    logger.info("MongoDB connected");
  } catch (err) {
    logger.error({ err }, "MongoDB connection failed");
  }
}

export function mongoReady(): boolean {
  return mongoose.connection.readyState === 1;
}
