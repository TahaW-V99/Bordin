import mariadb from "mariadb";

const u = new URL(process.env.DATABASE_URL);
const c = await mariadb.createConnection({
  host: u.hostname,
  port: u.port ? Number(u.port) : 3306,
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.replace(/^\//, ""),
});

try {
  const [newest] = await c.query(
    "SELECT id, source, dateKey, lastError, createdAt, attemptCount FROM kandakator_sync_jobs WHERE status='DEAD_LETTER' ORDER BY updatedAt DESC LIMIT 1",
  );
  const [created24h] = await c.query(
    "SELECT COUNT(*) AS count FROM kandakator_sync_jobs WHERE status='DEAD_LETTER' AND createdAt >= (NOW() - INTERVAL 1 DAY)",
  );
  const [oldest] = await c.query(
    "SELECT MIN(createdAt) AS createdAt FROM kandakator_sync_jobs WHERE status='DEAD_LETTER'",
  );
  const top10 = await c.query(
    "SELECT lastError, COUNT(*) AS count FROM kandakator_sync_jobs WHERE status='DEAD_LETTER' GROUP BY lastError ORDER BY count DESC LIMIT 10",
  );
  const [total] = await c.query(
    "SELECT COUNT(*) AS count FROM kandakator_sync_jobs WHERE status='DEAD_LETTER'",
  );

  console.log(
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        database: "production (Liara internal DATABASE_URL)",
        totalDeadLetter: Number(total.count),
        newestDeadLetterJob: newest
          ? {
              id: newest.id,
              source: newest.source,
              dateKey: newest.dateKey,
              lastError: newest.lastError,
              createdAt: new Date(newest.createdAt).toISOString(),
              attemptCount: newest.attemptCount,
            }
          : null,
        deadLetterCreatedLast24h: Number(created24h.count),
        top10DeadLetterReasons: top10.map((row) => ({
          lastError: row.lastError,
          count: Number(row.count),
        })),
        oldestDeadLetterCreatedAt: oldest.createdAt
          ? new Date(oldest.createdAt).toISOString()
          : null,
      },
      null,
      2,
    ),
  );
} finally {
  await c.end();
}
