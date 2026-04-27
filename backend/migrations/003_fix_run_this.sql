-- Run this in pgAdmin Query Tool to fix application numbers.
-- Safe to run multiple times.

-- 1. Ensure year-sequence table exists
CREATE TABLE IF NOT EXISTS application_year_seq (
  year INT PRIMARY KEY,
  seq  INT NOT NULL DEFAULT 0
);

-- 2. Rewrite ALL existing applications with 2026-XXXXX format
--    (ordered by created_at so the sequence matches creation order)
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM applications
)
UPDATE applications
SET application_number = '2026-' || LPAD(numbered.rn::TEXT, 5, '0')
FROM numbered
WHERE applications.id = numbered.id;

-- 3. Set the counter to match how many 2026 rows now exist
INSERT INTO application_year_seq (year, seq)
VALUES (2026, (SELECT COUNT(*) FROM applications WHERE application_number LIKE '2026-%'))
ON CONFLICT (year) DO UPDATE SET seq = EXCLUDED.seq;

-- 4. Verify
SELECT application_number, status, created_at
FROM applications
ORDER BY created_at;

SELECT * FROM application_year_seq;
