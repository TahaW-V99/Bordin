#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const APP = "bordin";

const rows = [
  {
    phone: "9013290280",
    sellableCoins: 1000,
    systemCoins: 8000,
    purchasedCoins: 0,
    points: 45000,
    cupMedals: "تاج",
    tournamentMedals: "ندارد",
    honorMedals: "ندارد",
    inviteCount: 1,
    predictionCount: 93,
    perfectPredictionCount: 11,
  },
  {
    phone: "9104668058",
    sellableCoins: 1000,
    systemCoins: 8000,
    purchasedCoins: 0,
    points: 45000,
    cupMedals: "ندارد",
    tournamentMedals: "ندارد",
    honorMedals: "ندارد",
    inviteCount: 0,
    predictionCount: 63,
    perfectPredictionCount: 6,
  },
];

const jsonLiteral = JSON.stringify(rows);
const shellScript =
  `printf '%s' '${jsonLiteral}' > /tmp/custom-legacy-users.json` +
  ` && node prisma/legacy-user-import.mjs /tmp/custom-legacy-users.json`;
const remoteCommand = `sh -lc ${JSON.stringify(shellScript)}`;

const result =
  process.platform === "win32"
    ? spawnSync(`liara shell --app ${APP} --command "${remoteCommand.replace(/"/g, '\\"')}"`, {
        stdio: "inherit",
        shell: true,
      })
    : spawnSync("liara", ["shell", "--app", APP, "--command", remoteCommand], {
        stdio: "inherit",
      });

process.exit(result.status ?? 1);
