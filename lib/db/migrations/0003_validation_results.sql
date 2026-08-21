ALTER TABLE validation_experiments
  ADD COLUMN IF NOT EXISTS actual_result text,
  ADD COLUMN IF NOT EXISTS outcome varchar(32),
  ADD COLUMN IF NOT EXISTS pm_decision varchar(32),
  ADD COLUMN IF NOT EXISTS pm_notes text,
  ADD COLUMN IF NOT EXISTS result_entered_at timestamptz;