import { runRecoverKandakator } from "@/server/scripts/recover-kandakator-runner";

runRecoverKandakator({
  target: "production",
  onServer: true,
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
