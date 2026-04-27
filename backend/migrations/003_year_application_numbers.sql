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

-- ── Step 3: Reformat any existing test rows ───────────────────────────────────
-- Assigns 2026-00001, 2026-00002, ... ordered by created_at.
-- Safe to run on an empty table (the CTE produces zero rows).

DO $$
DECLARE
  row_count INT;
BEGIN
  SELECT COUNT(*) INTO row_count FROM applications;

  IF row_count > 0 THEN
    -- Rewrite existing application_number values with the new format
    WITH numbered AS (
      SELECT id,
             ROW_NUMBER() OVER (ORDER BY created_at) AS rn
      FROM applications
    )
    UPDATE applications
    SET application_number = '2026-' || LPAD(numbered.rn::TEXT, 5, '0')
    FROM numbered
    WHERE applications.id = numbered.id;

    -- Seed the counter so the next INSERT continues from where we left off
    INSERT INTO application_year_seq (year, seq)
    VALUES (2026, row_count)
    ON CONFLICT (year) DO UPDATE SET seq = row_count;
  END IF;
END;
$$;

-- ── Step 4: Wire the function as the column default ───────────────────────────
ALTER TABLE applications
  ALTER COLUMN application_number SET DEFAULT next_application_number();
