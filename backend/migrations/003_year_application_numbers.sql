-- Migration 003: Year-prefixed application numbers (2026-00001, 2027-00001, ...)
-- Run: psql -d ringo -f backend/migrations/003_year_application_numbers.sql

-- ── Step 1: Per-year counter table ───────────────────────────────────────────
-- Stores the latest sequence value for each calendar year.
-- ON CONFLICT DO UPDATE is atomic in PostgreSQL, so no race conditions.

CREATE TABLE IF NOT EXISTS application_year_seq (
  year INT PRIMARY KEY,
  seq  INT NOT NULL DEFAULT 0
);

-- ── Step 2: Generator function ────────────────────────────────────────────────
-- Atomically increments the counter for the current year and returns
-- a formatted string like "2026-00001".

CREATE OR REPLACE FUNCTION next_application_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  current_year INT := EXTRACT(YEAR FROM NOW())::INT;
  next_seq     INT;
BEGIN
  INSERT INTO application_year_seq (year, seq)
  VALUES (current_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET seq = application_year_seq.seq + 1
  RETURNING seq INTO next_seq;

  RETURN current_year::TEXT || '-' || LPAD(next_seq::TEXT, 5, '0');
END;
$$;

-- ── Step 3: Reformat any existing rows ───────────────────────────────────────
-- Groups rows by their actual creation year, assigns per-year sequential numbers.
-- Safe to run on an empty table (the CTE produces zero rows).

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Rewrite each row using its actual creation year and per-year row number
  WITH numbered AS (
    SELECT id,
           EXTRACT(YEAR FROM created_at)::INT AS yr,
           ROW_NUMBER() OVER (
             PARTITION BY EXTRACT(YEAR FROM created_at)::INT
             ORDER BY created_at
           ) AS rn
    FROM applications
  )
  UPDATE applications
  SET application_number = numbered.yr::TEXT || '-' || LPAD(numbered.rn::TEXT, 5, '0')
  FROM numbered
  WHERE applications.id = numbered.id;

  -- Seed the per-year counter for each year found in existing rows
  FOR r IN
    SELECT EXTRACT(YEAR FROM created_at)::INT AS yr, COUNT(*) AS cnt
    FROM applications
    GROUP BY yr
  LOOP
    INSERT INTO application_year_seq (year, seq)
    VALUES (r.yr, r.cnt)
    ON CONFLICT (year) DO UPDATE SET seq = r.cnt;
  END LOOP;
END;
$$;

-- ── Step 4: Wire the function as the column default ───────────────────────────
ALTER TABLE applications
  ALTER COLUMN application_number SET DEFAULT next_application_number();
