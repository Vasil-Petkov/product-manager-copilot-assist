-- Product Validation Phase 2: safe upgrade from the Phase 1 hypothesis table.
-- This migration is idempotent and intentionally aborts rather than guessing
-- ownership or hypothesis text for legacy rows that cannot be derived safely.

ALTER TABLE validation_hypotheses
  ADD COLUMN IF NOT EXISTS hypothesis_type varchar(32),
  ADD COLUMN IF NOT EXISTS ai_suggestion text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

UPDATE validation_hypotheses
SET hypothesis_type = 'custom'
WHERE hypothesis_type IS NULL;

UPDATE validation_hypotheses
SET status = CASE status
  WHEN 'active' THEN 'in_validation'
  WHEN 'deferred' THEN 'needs_more_validation'
  ELSE COALESCE(status, 'draft')
END;

UPDATE validation_hypotheses AS hypothesis
SET user_id = opportunity.user_id
FROM opportunities AS opportunity
WHERE hypothesis.opportunity_id = opportunity.id
  AND hypothesis.user_id IS NULL
  AND opportunity.user_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM validation_hypotheses
    WHERE user_id IS NULL OR statement IS NULL OR btrim(statement) = ''
  ) THEN
    RAISE EXCEPTION
      'Validation Phase 2 migration cannot safely infer ownership or statement text for one or more legacy hypotheses. Repair those rows before retrying.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM validation_hypotheses
    WHERE status NOT IN (
      'draft',
      'ready_for_validation',
      'in_validation',
      'validated',
      'invalidated',
      'inconclusive',
      'needs_more_validation'
    )
  ) THEN
    RAISE EXCEPTION
      'Validation Phase 2 migration found an unsupported legacy hypothesis status. Map it explicitly before retrying.';
  END IF;
END
$$;

DO $$
BEGIN
  IF (
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'validation_hypotheses'
      AND column_name = 'created_at'
  ) = 'timestamp without time zone' THEN
    ALTER TABLE validation_hypotheses
      ALTER COLUMN created_at TYPE timestamptz
      USING created_at AT TIME ZONE 'UTC';
  END IF;

  IF (
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'validation_hypotheses'
      AND column_name = 'updated_at'
  ) = 'timestamp without time zone' THEN
    ALTER TABLE validation_hypotheses
      ALTER COLUMN updated_at TYPE timestamptz
      USING updated_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

ALTER TABLE validation_hypotheses
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN hypothesis_type SET DEFAULT 'custom',
  ALTER COLUMN hypothesis_type SET NOT NULL,
  ALTER COLUMN statement SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'validation_hypotheses_user_id_users_id_fk'
      AND conrelid = 'validation_hypotheses'::regclass
  ) THEN
    ALTER TABLE validation_hypotheses
      ADD CONSTRAINT validation_hypotheses_user_id_users_id_fk
      FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS validation_hypotheses_user_idx
  ON validation_hypotheses (user_id);

CREATE INDEX IF NOT EXISTS validation_hypotheses_opportunity_idx
  ON validation_hypotheses (opportunity_id);