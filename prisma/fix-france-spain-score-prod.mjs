/**
 * One-off: France 0-2 Spain (2026-07-14 kandakator) — VictoryAPI quota blocked sync.
 */
import mariadb from "mariadb";

function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamMatches(name, aliases) {
  const hay = normalize(name);
  return aliases.some((alias) => hay.includes(normalize(alias)));
}

function isFranceSpain(row) {
  const home = row.homeTeamName ?? "";
  const away = row.awayTeamName ?? "";
  const france = ["فرانسه", "france"];
  const spain = ["اسپانیا", "spain"];
  return (
    (teamMatches(home, france) && teamMatches(away, spain)) ||
    (teamMatches(home, spain) && teamMatches(away, france))
  );
}

const u = new URL(process.env.DATABASE_URL);
const conn = await mariadb.createConnection({
  host: u.hostname,
  port: u.port ? Number(u.port) : 3306,
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.replace(/^\//, ""),
  connectTimeout: 30000,
});

const rows = await conn.query(`
  SELECT fm.id, fm.homeTeamName, fm.awayTeamName, fm.status, fm.homeScore, fm.awayScore
  FROM football_matches fm
  INNER JOIN kandakator_matches km ON km.matchId = fm.id
  INNER JOIN daily_kandakators dk ON dk.id = km.kandakatorId
  WHERE fm.kickoffAt >= '2026-07-14' AND fm.kickoffAt < '2026-07-15'
    AND dk.isPublished = 1
`);

const match = rows.find(isFranceSpain);
if (!match) {
  console.error(JSON.stringify({ event: "not_found", rowCount: rows.length }));
  await conn.end();
  process.exit(1);
}

const franceHome = teamMatches(match.homeTeamName ?? "", ["فرانسه", "france"]);
const homeScore = franceHome ? 0 : 2;
const awayScore = franceHome ? 2 : 0;

const before = { ...match };

if (
  match.status === "FINISHED" &&
  match.homeScore === homeScore &&
  match.awayScore === awayScore
) {
  console.log(JSON.stringify({ event: "already_correct", before }, null, 2));
  await conn.end();
  process.exit(0);
}

await conn.query(
  `UPDATE football_matches
   SET homeScore = ?, awayScore = ?, status = 'FINISHED', scoresUpdatedAt = UTC_TIMESTAMP(3)
   WHERE id = ?`,
  [homeScore, awayScore, match.id],
);

console.log(
  JSON.stringify(
    {
      event: "score_updated",
      franceHome,
      before,
      after: { homeScore, awayScore, status: "FINISHED" },
    },
    null,
    2,
  ),
);

await conn.end();
