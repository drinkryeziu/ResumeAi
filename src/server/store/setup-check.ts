import "server-only";
import { connectMongo } from "@/server/db/mongo";
import { usesMongo } from "./config";

/** What a deployment still needs, in plain words. Only yes/no answers: never a value, never an error message from the database. */
export interface SetupStatus {
  /** Sessions can't be signed without it; Auth.js answers every sign-in with a "server configuration" error. */
  authSecret: boolean;
  /** MongoDB is configured. False means the temporary in-memory store (fine locally, wrong on a host). */
  mongodbUri: boolean;
  /** "ok" | "failed" when MongoDB is configured, "in-memory" when it is not. */
  database: "ok" | "failed" | "in-memory";
  onVercel: boolean;
  ready: boolean;
  /** One sentence per problem, written for the person setting the site up. */
  problems: string[];
}

export async function setupStatus(opts: { pingTimeoutMs?: number } = {}): Promise<SetupStatus> {
  // Outside production the app fills in a development secret itself (src/server/auth/config.ts); production never does.
  const authSecret = Boolean(process.env.AUTH_SECRET?.trim()) || process.env.NODE_ENV !== "production";
  const mongodbUri = usesMongo();
  const onVercel = Boolean(process.env.VERCEL);
  let database: SetupStatus["database"] = "in-memory";
  if (mongodbUri) {
    try {
      const { db } = await Promise.race([connectMongo(), new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), opts.pingTimeoutMs ?? 6000))]);
      await db.command({ ping: 1 });
      database = "ok";
    } catch {
      database = "failed";
    }
  }
  const problems: string[] = [];
  if (!authSecret) problems.push("AUTH_SECRET is missing. Add it in Vercel (Settings, Environment Variables, tick Production), then Redeploy.");
  if (!mongodbUri && onVercel) problems.push("MONGODB_URI is missing. Add it in Vercel, then Redeploy. Without it accounts and documents would be lost.");
  if (database === "failed")
    problems.push(
      "MONGODB_URI is set but the database could not be reached. Check the user and password in the connection string, and that MongoDB Atlas Network Access allows 0.0.0.0/0.",
    );
  const ready = authSecret && database !== "failed" && (mongodbUri || !onVercel);
  return { authSecret, mongodbUri, database, onVercel, ready, problems };
}
