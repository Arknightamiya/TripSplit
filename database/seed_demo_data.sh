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
  v_yosemite_trip_id INTEGER;
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

  INSERT INTO friendships (user_id, friend_id)
  VALUES
    (v_alex_id, v_sam_id),
    (v_sam_id, v_alex_id)
  ON CONFLICT (user_id, friend_id) DO NOTHING;

  SELECT id INTO v_trip_id
  FROM trips
  WHERE name = 'San Diego Weekend'
    AND organizer_id = v_alex_id
  ORDER BY id ASC
  LIMIT 1;

  IF v_trip_id IS NULL THEN
    INSERT INTO trips (name, destination, start_date, end_date, organizer_id, started_at)
    VALUES ('San Diego Weekend', 'San Diego', '2026-06-05', '2026-06-07', v_alex_id, CURRENT_TIMESTAMP)
    RETURNING id INTO v_trip_id;
  ELSE
    UPDATE trips
    SET started_at = COALESCE(started_at, CURRENT_TIMESTAMP)
    WHERE id = v_trip_id;
  END IF;

  INSERT INTO trip_participants (trip_id, user_id, role, join_status)
  VALUES
    (v_trip_id, v_alex_id, 'organizer', 'approved'),
    (v_trip_id, v_sam_id, 'participant', 'approved')
  ON CONFLICT (trip_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        join_status = EXCLUDED.join_status;

  DELETE FROM trip_participants
  WHERE trip_id = v_trip_id
    AND user_id = v_jordan_id;

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
    VALUES (v_trip_id, 'Hotel', 450, 'lodging', 'personal_advance', v_alex_id, v_equal_rule_id)
    RETURNING id INTO v_hotel_expense_id;
  ELSE
    UPDATE expenses
    SET amount = 450,
        category = 'lodging',
        expense_type = 'personal_advance',
        payer_id = v_alex_id,
        split_rule_id = v_equal_rule_id,
        currency_code = 'USD',
        deleted_at = NULL,
        deleted_by = NULL
    WHERE id = v_hotel_expense_id;
  END IF;

  DELETE FROM expense_shares
  WHERE expense_id = v_hotel_expense_id;

  INSERT INTO expense_shares (expense_id, trip_id, participant_id, share_amount)
  VALUES (v_hotel_expense_id, v_trip_id, v_sam_id, 225);

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
    VALUES (v_trip_id, 'Dinner', 90, 'food', 'personal_advance', v_sam_id, v_equal_rule_id)
    RETURNING id INTO v_dinner_expense_id;
  ELSE
    UPDATE expenses
    SET amount = 90,
        category = 'food',
        expense_type = 'personal_advance',
        payer_id = v_sam_id,
        split_rule_id = v_equal_rule_id,
        currency_code = 'USD',
        deleted_at = NULL,
        deleted_by = NULL
    WHERE id = v_dinner_expense_id;
  END IF;

  DELETE FROM expense_shares
  WHERE expense_id = v_dinner_expense_id;

  INSERT INTO expense_shares (expense_id, trip_id, participant_id, share_amount)
  VALUES (v_dinner_expense_id, v_trip_id, v_alex_id, 45);

  SELECT id INTO v_yosemite_trip_id
  FROM trips
  WHERE name = 'Yosemite Weekend'
    AND organizer_id = v_sam_id
  ORDER BY id ASC
  LIMIT 1;

  IF v_yosemite_trip_id IS NULL THEN
    INSERT INTO trips (
      name,
      destination,
      start_date,
      end_date,
      visibility,
      organizer_id
    )
    VALUES (
      'Yosemite Weekend',
      'Yosemite',
      '2026-06-20',
      '2026-06-22',
      'public',
      v_sam_id
    )
    RETURNING id INTO v_yosemite_trip_id;
  ELSE
    UPDATE trips
    SET destination = 'Yosemite',
        start_date = '2026-06-20',
        end_date = '2026-06-22',
        visibility = 'public'
    WHERE id = v_yosemite_trip_id;
  END IF;

  INSERT INTO trip_participants (trip_id, user_id, role, join_status)
  VALUES (v_yosemite_trip_id, v_sam_id, 'organizer', 'approved')
  ON CONFLICT (trip_id, user_id) DO UPDATE
    SET role = 'organizer',
        join_status = 'approved';
END $$;
SQL

echo "Seeded demo users, friendships, trips, budget, expenses, and shares."
