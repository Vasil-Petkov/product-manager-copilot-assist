CREATE TABLE IF NOT EXISTS documents (
  id serial PRIMARY KEY,
  product_idea_id integer NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type varchar(64) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  content text NOT NULL,
  generation_metadata jsonb,
  human_edited boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1,
  accepted_at timestamptz,
  accepted_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documents_status_valid CHECK (status IN ('draft', 'ai_generated', 'in_review', 'accepted')),
  CONSTRAINT documents_type_valid CHECK (document_type IN (
    'mrd', 'brd', 'business_case', 'use_case', 'prd', 'initiative', 'epic',
    'user_story', 'acceptance_criteria', 'definition_of_ready', 'definition_of_done',
    'functional_requirements', 'nonfunctional_requirements', 'technical_requirements',
    'release_notes', 'stakeholder_updates'
  ))
);

CREATE INDEX IF NOT EXISTS documents_user_idx ON documents(user_id);
CREATE INDEX IF NOT EXISTS documents_product_idea_idx ON documents(product_idea_id);
CREATE INDEX IF NOT EXISTS documents_user_product_type_idx ON documents(user_id, product_idea_id, document_type);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM documents
    WHERE status = 'accepted'
    GROUP BY product_idea_id, document_type
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce one accepted document per Product Idea and type because existing conflicts were found';
  END IF;
END $$;
DROP INDEX IF EXISTS documents_one_accepted_idx;
CREATE UNIQUE INDEX IF NOT EXISTS documents_one_accepted_idx
  ON documents(product_idea_id, document_type)
  WHERE status = 'accepted';

-- This migration may already have created the table in a development database.
-- Keep the upgrade path idempotent for those databases.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS revision integer;
UPDATE documents SET revision = 1 WHERE revision IS NULL;
ALTER TABLE documents ALTER COLUMN revision SET DEFAULT 1;
ALTER TABLE documents ALTER COLUMN revision SET NOT NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS accepted_by text REFERENCES users(id) ON DELETE SET NULL;