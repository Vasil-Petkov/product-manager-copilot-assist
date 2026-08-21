-- Product Validation experiments. This migration is idempotent so artifact
-- restarts safely keep a shared development database up to date.

CREATE TABLE IF NOT EXISTS validation_experiments (
  id serial PRIMARY KEY,
  hypothesis_id integer NOT NULL REFERENCES validation_hypotheses(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(300) NOT NULL,
  method_key varchar(64) NOT NULL,
  setup text,
  target_audience text,
  success_measures text,
  status varchar(32) NOT NULL DEFAULT 'draft',
  planned_start_date date,
  planned_end_date date,
  started_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS validation_experiments_user_idx
  ON validation_experiments (user_id);
CREATE INDEX IF NOT EXISTS validation_experiments_hypothesis_idx
  ON validation_experiments (hypothesis_id);
CREATE INDEX IF NOT EXISTS validation_experiments_status_idx
  ON validation_experiments (status);