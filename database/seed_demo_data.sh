#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$1"
CONTAINER_NAME="$2"
POSTGRES_USER="$3"
POSTGRES_DB="$4"

PASSWORD_HASH="$(
  cd "${ROOT_DIR}"
  node --input-type=module -e 'import { hashPassword } from "./server/services/auth.js"; console.log(hashPassword("demo-password"));'
)"

docker exec -i "${CONTAINER_NAME}" psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
  -v password_hash="${PASSWORD_HASH}" <<'SQL'
SELECT set_config('tripsplit.demo_password_hash', :'password_hash', false);

DO $$
DECLARE
  v_alex_id INTEGER;
  v_sam_id INTEGER;
  v_jordan_id INTEGER;
  v_trip_id INTEGER;
  v_equal_rule_id INTEGER;
  v_hotel_expense_id INTEGER;
  v_dinner_expense_id INTEGER;
  v_password_hash TEXT := current_setting('tripsplit.demo_password_hash');
BEGIN
  INSERT INTO users (name, email, password_hash)
  VALUES
    ('Alex Organizer', 'alex@example.com', v_password_hash),
    ('Sam Traveler', 'sam@example.com', v_password_hash),
    ('Jordan Budgeter', 'jordan@example.com', v_password_hash)
  ON CONFLICT (email) DO UPDATE
    SET name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash;

  SELECT id INTO v_alex_id FROM users WHERE email = 'alex@example.com';
  SELECT id INTO v_sam_id FROM users WHERE email = 'sam@example.com';
  SELECT id INTO v_jordan_id FROM users WHERE email = 'jordan@example.com';
  SELECT id INTO v_equal_rule_id FROM split_rules WHERE type = 'equal';

  SELECT id INTO v_trip_id
  FROM trips
  WHERE name = 'San Diego Weekend'
    AND organizer_id = v_alex_id
  ORDER BY id ASC
  LIMIT 1;

  IF v_trip_id IS NULL THEN
    INSERT INTO trips (name, destination, start_date, end_date, organizer_id)
    VALUES ('San Diego Weekend', 'San Diego', '2026-06-05', '2026-06-07', v_alex_id)
    RETURNING id INTO v_trip_id;
  END IF;

  INSERT INTO trip_participants (trip_id, user_id, role, join_status)
  VALUES
    (v_trip_id, v_alex_id, 'organizer', 'approved'),
    (v_trip_id, v_sam_id, 'participant', 'approved'),
    (v_trip_id, v_jordan_id, 'participant', 'approved')
  ON CONFLICT (trip_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        join_status = EXCLUDED.join_status;

  INSERT INTO budgets (trip_id, mode, total_budget, per_person_budget)
  VALUES (v_trip_id, 'total', 900, NULL)
  ON CONFLICT (trip_id) DO UPDATE
    SET mode = EXCLUDED.mode,
        total_budget = EXCLUDED.total_budget,
        per_person_budget = EXCLUDED.per_person_budget,
        updated_at = CURRENT_TIMESTAMP;

  SELECT id INTO v_hotel_expense_id
  FROM expenses
  WHERE trip_id = v_trip_id
    AND title = 'Hotel'
  ORDER BY id ASC
  LIMIT 1;

  IF v_hotel_expense_id IS NULL THEN
    INSERT INTO expenses (
      trip_id,
      title,
      amount,
      category,
      expense_type,
      payer_id,
      split_rule_id
    )
    VALUES (v_trip_id, 'Hotel', 450, 'lodging', 'shared', v_alex_id, v_equal_rule_id)
    RETURNING id INTO v_hotel_expense_id;

    INSERT INTO expense_shares (expense_id, trip_id, participant_id, share_amount)
    VALUES
      (v_hotel_expense_id, v_trip_id, v_alex_id, 150),
      (v_hotel_expense_id, v_trip_id, v_sam_id, 150),
      (v_hotel_expense_id, v_trip_id, v_jordan_id, 150);
  END IF;

  SELECT id INTO v_dinner_expense_id
  FROM expenses
  WHERE trip_id = v_trip_id
    AND title = 'Dinner'
  ORDER BY id ASC
  LIMIT 1;

  IF v_dinner_expense_id IS NULL THEN
    INSERT INTO expenses (
      trip_id,
      title,
      amount,
      category,
      expense_type,
      payer_id,
      split_rule_id
    )
    VALUES (v_trip_id, 'Dinner', 90, 'food', 'shared', v_sam_id, v_equal_rule_id)
    RETURNING id INTO v_dinner_expense_id;

    INSERT INTO expense_shares (expense_id, trip_id, participant_id, share_amount)
    VALUES
      (v_dinner_expense_id, v_trip_id, v_alex_id, 30),
      (v_dinner_expense_id, v_trip_id, v_sam_id, 30),
      (v_dinner_expense_id, v_trip_id, v_jordan_id, 30);
  END IF;
END $$;
SQL

echo "Seeded demo users, trip, budget, expenses, and shares."
