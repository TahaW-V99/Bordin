/**
 * Recover kandakator data for recent Tehran dates.
 *
 * Staging: .env.staging + .env.staging.local (public DATABASE_URL).
 * Production: npm run recover:kandakator:production (Liara shell or .env.production.local).
 */
import { runRecoverKandakator } from "@/server/scripts/recover-kandakator-runner";

const target = process.argv.includes("--production") ? "production" : "staging";
const onServer = process.argv.includes("--on-server");
const daysArg = process.argv.find((arg) => arg.startsWith("--days="))?.split("=")[1];
const days = daysArg ? Number(daysArg) : undefined;
const baseUrl = process.argv.find((arg) => arg.startsWith("--url="))?.split("=")[1];

runRecoverKandakator({
  target,
  onServer,
  days,
  baseUrl,
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
