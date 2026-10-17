import "server-only";
import { MongoClient, type Db } from "mongodb";

/**
 * One MongoClient per server process, kept on globalThis so Next.js hot reloads and warm serverless
 * invocations reuse the same connection pool instead of opening a new one per request.
 */
const g = globalThis as unknown as { __applyaiMongo?: Promise<{ client: MongoClient; db: Db }> };

/** The database name comes from the URI path (…mongodb.net/applyai?…), then MONGODB_DB, then "applyai". */
export function databaseName(uri: string, override = process.env.MONGODB_DB) {
  if (override?.trim()) return override.trim();
  try {
    const path = new URL(uri.replace(/^mongodb(\+srv)?:/, "http:")).pathname.replace(/^\//, "");
    if (path) return decodeURIComponent(path);
  } catch {
    // an unusual connection string: fall through to the default
  }
  return "applyai";
}

export function connectMongo(uri = process.env.MONGODB_URI): Promise<{ client: MongoClient; db: Db }> {
  if (!uri) throw new Error("MONGODB_URI is not set.");
  if (!g.__applyaiMongo) {
    const client = new MongoClient(uri, {
      maxPoolSize: 5, // serverless: many small instances, each with a small pool
      serverSelectionTimeoutMS: 8000,
      appName: "applyai",
    });
    g.__applyaiMongo = client.connect().then(
      () => ({ client, db: client.db(databaseName(uri)) }),
      (err) => {
        g.__applyaiMongo = undefined; // let the next request try again instead of caching the failure
        throw err;
      },
    );
  }
  return g.__applyaiMongo;
}
