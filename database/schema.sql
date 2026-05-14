-- TripSplit PostgreSQL Schema Draft
-- This file is a draft for the future PostgreSQL migration.
-- The current project still uses the in-memory store in server/store.js.

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone_number TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trips (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  destination TEXT,
  start_date DATE,
  end_date DATE,
  organizer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trip_participants (
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'participant',
  join_status TEXT NOT NULL DEFAULT 'approved',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trip_id, user_id)
);

CREATE TABLE budgets (
  trip_id INTEGER PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('total', 'per-person')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE split_rules (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  description TEXT
);

CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  expense_type TEXT NOT NULL DEFAULT 'shared',
  payer_id INTEGER NOT NULL REFERENCES users(id),
  split_rule_id INTEGER REFERENCES split_rules(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expense_shares (
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_amount NUMERIC(12, 2) NOT NULL CHECK (share_amount >= 0),
  PRIMARY KEY (expense_id, participant_id)
);

-- Balance summaries can be calculated dynamically from expenses and expense_shares.
-- This table is optional for a future cached summary design.
CREATE TABLE balance_summaries (
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actual_paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  fair_share_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trip_id, participant_id)
);