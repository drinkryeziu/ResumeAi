/** Which data store the app runs on, decided once from the environment. */

/** MongoDB (Atlas) when MONGODB_URI is set; otherwise the in-memory store (data resets when the server restarts). */
export const usesMongo = () => Boolean(process.env.MONGODB_URI?.trim());
