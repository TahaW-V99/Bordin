SELECT COUNT(*) AS total_dead_letter FROM kandakator_sync_jobs WHERE status = 'DEAD_LETTER';

SELECT id, source, dateKey, lastError, createdAt, updatedAt, attemptCount, maxAttempts
FROM kandakator_sync_jobs
WHERE status = 'DEAD_LETTER'
ORDER BY updatedAt DESC
LIMIT 1;

SELECT COUNT(*) AS dead_letter_marked_24h
FROM kandakator_sync_jobs
WHERE status = 'DEAD_LETTER' AND updatedAt >= NOW() - INTERVAL 24 HOUR;

SELECT id, source, dateKey, lastError, createdAt, updatedAt, attemptCount
FROM kandakator_sync_jobs
WHERE status = 'DEAD_LETTER'
ORDER BY createdAt ASC
LIMIT 1;

SELECT lastError AS reason, COUNT(*) AS count
FROM kandakator_sync_jobs
WHERE status = 'DEAD_LETTER'
GROUP BY lastError
ORDER BY count DESC
LIMIT 10;
