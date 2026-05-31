-- TripSplit PostgreSQL Schema Draft
-- This file is the shared database target for future PostgreSQL migration.
-- The current project still uses the in-memory store in server/store.js.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT,
  email TEXT UNIQUE NOT NULL,
  phone_number TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

UPDATE users
SET display_name = name
WHERE display_name IS NULL OR display_name = '';

WITH existing_suffixes AS (
  SELECT
    LOWER(REGEXP_REPLACE(name, '#[0-9]+$', '')) AS base_name,
    MAX(
      CASE
        WHEN name ~ '#[0-9]+$' THEN SUBSTRING(name FROM '#([0-9]+)$')::INTEGER
        ELSE 0
      END
    ) AS max_suffix
  FROM users
  GROUP BY LOWER(REGEXP_REPLACE(name, '#[0-9]+$', ''))
),
unsuffixed_users AS (
  SELECT
    users.id,
    users.name,
    ROW_NUMBER() OVER (PARTITION BY LOWER(users.name) ORDER BY users.id) AS base_rank,
    COALESCE(existing_suffixes.max_suffix, 0) AS max_suffix
  FROM users
  LEFT JOIN existing_suffixes
    ON existing_suffixes.base_name = LOWER(users.name)
  WHERE users.name !~ '#[0-9]+$'
)
UPDATE users
SET
  name = unsuffixed_users.name || '#' || (unsuffixed_users.max_suffix + unsuffixed_users.base_rank),
  display_name = CASE
    WHEN users.display_name IS NULL
      OR users.display_name = ''
      OR users.display_name = users.name
    THEN unsuffixed_users.name || '#' || (unsuffixed_users.max_suffix + unsuffixed_users.base_rank)
    ELSE users.display_name
  END
FROM unsuffixed_users
WHERE users.id = unsuffixed_users.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_name_unique
  ON users (LOWER(name));

CREATE TABLE IF NOT EXISTS friend_requests (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (requester_id <> recipient_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_pending_pair
  ON friend_requests (
    LEAST(requester_id, recipient_id),
    GREATEST(requester_id, recipient_id)
  )
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS friendships (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);

CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  destination TEXT,
  start_date DATE,
  end_date DATE,
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'public')),
  organizer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS trip_participants (
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'participant'
    CHECK (role IN ('organizer', 'participant')),
  join_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (join_status IN ('pending', 'approved', 'removed')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trip_id, user_id)
);

CREATE TABLE IF NOT EXISTS trip_join_requests (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_join_requests_pending_unique
  ON trip_join_requests (trip_id, requester_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS budgets (
  trip_id INTEGER PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('total', 'per-person')),
  total_budget NUMERIC(12, 2) CHECK (total_budget >= 0),
  per_person_budget NUMERIC(12, 2) CHECK (per_person_budget >= 0),
  currency_code CHAR(3) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (mode = 'total' AND total_budget IS NOT NULL AND per_person_budget IS NULL)
    OR
    (mode = 'per-person' AND total_budget IS NULL AND per_person_budget IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS split_rules (
  id SERIAL PRIMARY KEY,
  type TEXT UNIQUE NOT NULL CHECK (type IN ('equal')),
  description TEXT
);

INSERT INTO split_rules (type, description)
VALUES ('equal', 'Split equally among selected participants')
ON CONFLICT (type) DO NOTHING;

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL CHECK (
    category IN (
      'lodging',
      'food',
      'transportation',
      'tickets',
      'drinks',
      'emergency',
      'other'
    )
  ),
  expense_type TEXT NOT NULL DEFAULT 'personal_advance'
    CHECK (expense_type IN ('budget_payment', 'personal_advance')),
  payer_id INTEGER NOT NULL,
  split_rule_id INTEGER NOT NULL REFERENCES split_rules(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, trip_id),
  FOREIGN KEY (trip_id, payer_id)
    REFERENCES trip_participants(trip_id, user_id)
);

DO $$
BEGIN
  IF to_regclass('expenses') IS NOT NULL THEN
    UPDATE expenses
    SET expense_type = 'personal_advance'
    WHERE expense_type = 'shared';

    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'expenses'::regclass
        AND conname = 'expenses_expense_type_check'
    ) THEN
      ALTER TABLE expenses DROP CONSTRAINT expenses_expense_type_check;
    END IF;

    ALTER TABLE expenses
      ADD CONSTRAINT expenses_expense_type_check
      CHECK (expense_type IN ('budget_payment', 'personal_advance'));

    ALTER TABLE expenses
      ALTER COLUMN expense_type SET DEFAULT 'personal_advance';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS expense_shares (
  expense_id INTEGER NOT NULL,
  trip_id INTEGER NOT NULL,
  participant_id INTEGER NOT NULL,
  share_amount NUMERIC(12, 2) NOT NULL CHECK (share_amount >= 0),
  PRIMARY KEY (expense_id, participant_id),
  FOREIGN KEY (expense_id, trip_id)
    REFERENCES expenses(id, trip_id)
    ON DELETE CASCADE,
  FOREIGN KEY (trip_id, participant_id)
    REFERENCES trip_participants(trip_id, user_id)
    ON DELETE CASCADE
);

-- Balance summaries can be calculated dynamically from expenses and expense_shares.
-- This table is optional for a future cached summary design.
CREATE TABLE IF NOT EXISTS balance_summaries (
  trip_id INTEGER NOT NULL,
  participant_id INTEGER NOT NULL,
  actual_paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  fair_share_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trip_id, participant_id),
  FOREIGN KEY (trip_id, participant_id)
    REFERENCES trip_participants(trip_id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trips_organizer_id ON trips(organizer_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payer_id ON expenses(payer_id);
CREATE INDEX IF NOT EXISTS idx_expense_shares_trip_id ON expense_shares(trip_id);
CREATE INDEX IF NOT EXISTS idx_expense_shares_participant_id ON expense_shares(participant_id);
