/** Which data store the app runs on, decided once from the environment. */

/** MongoDB (Atlas) when MONGODB_URI is set; otherwise the in-memory demo store. */
export const usesMongo = () => Boolean(process.env.MONGODB_URI?.trim());

/**
 * Whether the well-known demo account (demo@resumeai.dev) exists.
 * Always on for the in-memory store; on MongoDB only when MONGODB_SEED_DEMO=true, so production
 * deployments don't ship a public login by default.
 */
export const demoAccountEnabled = () => !usesMongo() || process.env.MONGODB_SEED_DEMO === "true";
