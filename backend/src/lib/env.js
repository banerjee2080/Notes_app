// Vercel always sets VERCEL=1 and NODE_ENV=production on a deployment, but it
// never sets MODE. Relying on MODE alone means a missing dashboard variable
// silently puts the deployment on the local-development code path.
export const isServerless = Boolean(process.env.VERCEL);

export const isProduction =
  isServerless ||
  process.env.NODE_ENV === "production" ||
  process.env.MODE === "production";
