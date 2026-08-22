CREATE TABLE IF NOT EXISTS roadmap_initiatives (
  id serial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(240) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS roadmap_initiatives_user_idx ON roadmap_initiatives(user_id);

CREATE TABLE IF NOT EXISTS roadmap_items (
  id serial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  initiative_id integer REFERENCES roadmap_initiatives(id) ON DELETE SET NULL,
  opportunity_id integer NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'planned',
  progress integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roadmap_items_dates_valid CHECK (end_date >= start_date),
  CONSTRAINT roadmap_items_progress_valid CHECK (progress >= 0 AND progress <= 100),
  CONSTRAINT roadmap_items_user_opportunity_unique UNIQUE (user_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS roadmap_items_user_idx ON roadmap_items(user_id);
CREATE INDEX IF NOT EXISTS roadmap_items_initiative_idx ON roadmap_items(initiative_id);

CREATE TABLE IF NOT EXISTS roadmap_milestones (
  id serial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  initiative_id integer REFERENCES roadmap_initiatives(id) ON DELETE SET NULL,
  name varchar(240) NOT NULL,
  date date NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS roadmap_milestones_user_idx ON roadmap_milestones(user_id);
CREATE INDEX IF NOT EXISTS roadmap_milestones_initiative_idx ON roadmap_milestones(initiative_id);