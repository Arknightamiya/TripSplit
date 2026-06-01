import { getDatabase } from "../db/pool.js";

export function isFriendRepositoryEnabled() {
  return getDatabase().enabled;
}

export async function listFriendRecords(userId) {
  const result = await getDatabase().query(
    `
      SELECT u.id, u.name, u.display_name, u.email, u.avatar_url
      FROM friendships f
      JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = $1
      ORDER BY LOWER(u.display_name), LOWER(u.name)
    `,
    [userId]
  );

  return result.rows.map(mapUserRow);
}

export async function usersAreFriendsRecord(userId, friendId) {
  const result = await getDatabase().query(
    `
      SELECT 1
      FROM friendships
      WHERE user_id = $1
        AND friend_id = $2
    `,
    [userId, friendId]
  );

  return Boolean(result.rows[0]);
}

export async function searchUserRecords(query, viewerId) {
  const normalizedQuery = `%${String(query || "").trim()}%`;
  const result = await getDatabase().query(
    `
      SELECT u.id, u.name, u.display_name, u.email, u.avatar_url,
        CASE
          WHEN f.friend_id IS NOT NULL THEN 'friend'
          WHEN outgoing.id IS NOT NULL THEN 'outgoing_pending'
          WHEN incoming.id IS NOT NULL THEN 'incoming_pending'
          ELSE 'none'
        END AS relationship
      FROM users u
      LEFT JOIN friendships f
        ON f.user_id = $2
        AND f.friend_id = u.id
      LEFT JOIN friend_requests outgoing
        ON outgoing.requester_id = $2
        AND outgoing.recipient_id = u.id
        AND outgoing.status = 'pending'
      LEFT JOIN friend_requests incoming
        ON incoming.recipient_id = $2
        AND incoming.requester_id = u.id
        AND incoming.status = 'pending'
      WHERE u.id <> $2
        AND (
          u.name ILIKE $1
          OR u.display_name ILIKE $1
          OR u.email ILIKE $1
        )
      ORDER BY
        CASE WHEN LOWER(u.name) = LOWER(TRIM($3)) THEN 0 ELSE 1 END,
        LOWER(u.display_name),
        LOWER(u.name)
      LIMIT 8
    `,
    [normalizedQuery, viewerId, String(query || "").trim()]
  );

  return result.rows.map((row) => ({
    ...mapUserRow(row),
    relationship: row.relationship
  }));
}

export async function createFriendRequestRecord({ requesterId, recipientId }) {
  const result = await getDatabase().query(
    `
      INSERT INTO friend_requests (requester_id, recipient_id, status)
      VALUES ($1, $2, 'pending')
      RETURNING id
    `,
    [requesterId, recipientId]
  );

  return findFriendRequestRecordById(result.rows[0].id);
}

export async function findPendingFriendRequestRecordBetween(userAId, userBId) {
  const result = await getDatabase().query(
    `
      SELECT id, requester_id, recipient_id, status, created_at
      FROM friend_requests
      WHERE status = 'pending'
        AND (
          (requester_id = $1 AND recipient_id = $2)
          OR
          (requester_id = $2 AND recipient_id = $1)
        )
      LIMIT 1
    `,
    [userAId, userBId]
  );

  return result.rows[0] ? mapFriendRequestRow(result.rows[0]) : null;
}

export async function listIncomingFriendRequestRecords(userId) {
  const result = await getDatabase().query(
    `
      SELECT id, requester_id, recipient_id, status, created_at
      FROM friend_requests
      WHERE recipient_id = $1
        AND status = 'pending'
      ORDER BY created_at ASC, id ASC
    `,
    [userId]
  );

  return Promise.all(result.rows.map(mapFriendRequestRow));
}

export async function listOutgoingFriendRequestRecords(userId) {
  const result = await getDatabase().query(
    `
      SELECT id, requester_id, recipient_id, status, created_at
      FROM friend_requests
      WHERE requester_id = $1
        AND status = 'pending'
      ORDER BY created_at ASC, id ASC
    `,
    [userId]
  );

  return Promise.all(result.rows.map(mapFriendRequestRow));
}

export async function respondToFriendRequestRecord(requestId, recipientId, status) {
  return getDatabase().transaction(async (client) => {
    const requestResult = await client.query(
      `
        SELECT id, requester_id, recipient_id, status, created_at
        FROM friend_requests
        WHERE id = $1
          AND recipient_id = $2
          AND status = 'pending'
        FOR UPDATE
      `,
      [requestId, recipientId]
    );
    const request = requestResult.rows[0];

    if (!request) {
      return null;
    }

    await client.query(
      `
        UPDATE friend_requests
        SET status = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [requestId, status]
    );

    if (status === "accepted") {
      await client.query(
        `
          INSERT INTO friendships (user_id, friend_id)
          VALUES ($1, $2), ($2, $1)
          ON CONFLICT (user_id, friend_id) DO NOTHING
        `,
        [request.requester_id, request.recipient_id]
      );
    }

    return mapFriendRequestRow({ ...request, status });
  });
}

export async function removeFriendshipRecord(userId, friendId) {
  const result = await getDatabase().query(
    `
      DELETE FROM friendships
      WHERE (user_id = $1 AND friend_id = $2)
         OR (user_id = $2 AND friend_id = $1)
    `,
    [userId, friendId]
  );

  return result.rowCount > 0;
}

export async function listPublicTripRecordsForFriend(viewerId, friendId) {
  const result = await getDatabase().query(
    `
      SELECT
        t.id,
        t.name,
        t.destination,
        t.start_date,
        t.end_date,
        t.visibility,
        t.organizer_id,
        organizer.name AS organizer_name,
        organizer.display_name AS organizer_display_name,
        organizer.email AS organizer_email,
        organizer.avatar_url AS organizer_avatar_url,
        b.mode,
        b.total_budget,
        b.per_person_budget,
        (
          SELECT COUNT(*)
          FROM trip_participants tp
          WHERE tp.trip_id = t.id
            AND tp.join_status = 'approved'
        ) AS participant_count,
        (
          SELECT COUNT(*)
          FROM expenses e
          WHERE e.trip_id = t.id
        ) AS expense_count,
        COALESCE((
          SELECT SUM(e.amount)
          FROM expenses e
          WHERE e.trip_id = t.id
            AND e.expense_type = 'budget_payment'
        ), 0) AS total_spent,
        tjr.status AS join_request_status,
        pending_invite.join_status AS invitation_status,
        participant.user_id IS NOT NULL AS is_participant
      FROM trips t
      JOIN users organizer ON organizer.id = t.organizer_id
      LEFT JOIN budgets b ON b.trip_id = t.id
      LEFT JOIN trip_join_requests tjr
        ON tjr.trip_id = t.id
        AND tjr.requester_id = $1
        AND tjr.status = 'pending'
      LEFT JOIN trip_participants participant
        ON participant.trip_id = t.id
        AND participant.user_id = $1
        AND participant.join_status = 'approved'
      LEFT JOIN trip_participants pending_invite
        ON pending_invite.trip_id = t.id
        AND pending_invite.user_id = $1
        AND pending_invite.join_status = 'pending'
      WHERE t.organizer_id = $2
        AND t.visibility = 'public'
        AND EXISTS (
          SELECT 1
          FROM friendships owner_friendship
          WHERE owner_friendship.user_id = $2
            AND owner_friendship.friend_id = $1
        )
      ORDER BY t.created_at DESC, t.id DESC
    `,
    [viewerId, friendId]
  );

  return result.rows.map(mapPublicTripRow);
}

export async function listFriendPublicTripRecords(viewerId) {
  const result = await getDatabase().query(
    `
      SELECT
        t.id,
        t.name,
        t.destination,
        t.start_date,
        t.end_date,
        t.visibility,
        t.organizer_id,
        organizer.name AS organizer_name,
        organizer.display_name AS organizer_display_name,
        organizer.email AS organizer_email,
        organizer.avatar_url AS organizer_avatar_url,
        b.mode,
        b.total_budget,
        b.per_person_budget,
        (
          SELECT COUNT(*)
          FROM trip_participants tp
          WHERE tp.trip_id = t.id
            AND tp.join_status = 'approved'
        ) AS participant_count,
        (
          SELECT COUNT(*)
          FROM expenses e
          WHERE e.trip_id = t.id
        ) AS expense_count,
        COALESCE((
          SELECT SUM(e.amount)
          FROM expenses e
          WHERE e.trip_id = t.id
            AND e.expense_type = 'budget_payment'
        ), 0) AS total_spent,
        tjr.status AS join_request_status,
        pending_invite.join_status AS invitation_status,
        participant.user_id IS NOT NULL AS is_participant
      FROM trips t
      JOIN users organizer ON organizer.id = t.organizer_id
      JOIN friendships viewer_friendship
        ON viewer_friendship.user_id = $1
        AND viewer_friendship.friend_id = t.organizer_id
      JOIN friendships owner_friendship
        ON owner_friendship.user_id = t.organizer_id
        AND owner_friendship.friend_id = $1
      LEFT JOIN budgets b ON b.trip_id = t.id
      LEFT JOIN trip_join_requests tjr
        ON tjr.trip_id = t.id
        AND tjr.requester_id = $1
        AND tjr.status = 'pending'
      LEFT JOIN trip_participants participant
        ON participant.trip_id = t.id
        AND participant.user_id = $1
        AND participant.join_status = 'approved'
      LEFT JOIN trip_participants pending_invite
        ON pending_invite.trip_id = t.id
        AND pending_invite.user_id = $1
        AND pending_invite.join_status = 'pending'
      WHERE t.visibility = 'public'
        AND participant.user_id IS NULL
      ORDER BY t.start_date NULLS LAST, t.created_at DESC, t.id DESC
    `,
    [viewerId]
  );

  return result.rows.map(mapPublicTripRow);
}

export async function createTripJoinRequestRecord({ tripId, requesterId }) {
  const result = await getDatabase().query(
    `
      INSERT INTO trip_join_requests (trip_id, requester_id, status)
      VALUES ($1, $2, 'pending')
      RETURNING id
    `,
    [tripId, requesterId]
  );

  return findTripJoinRequestRecordById(result.rows[0].id);
}

export async function findPendingTripJoinRequestRecord(tripId, requesterId) {
  const result = await getDatabase().query(
    `
      SELECT id, trip_id, requester_id, status, created_at
      FROM trip_join_requests
      WHERE trip_id = $1
        AND requester_id = $2
        AND status = 'pending'
      LIMIT 1
    `,
    [tripId, requesterId]
  );

  return result.rows[0] ? mapTripJoinRequestRow(result.rows[0]) : null;
}

export async function listIncomingTripJoinRequestRecords(organizerId) {
  const result = await getDatabase().query(
    `
      SELECT tjr.id, tjr.trip_id, tjr.requester_id, tjr.status, tjr.created_at
      FROM trip_join_requests tjr
      JOIN trips t ON t.id = tjr.trip_id
      WHERE t.organizer_id = $1
        AND tjr.status = 'pending'
      ORDER BY tjr.created_at ASC, tjr.id ASC
    `,
    [organizerId]
  );

  return Promise.all(result.rows.map(mapTripJoinRequestRow));
}

export async function listIncomingTripInvitationRecords(userId) {
  const result = await getDatabase().query(
    `
      SELECT trip_id, user_id, role, join_status, created_at
      FROM trip_participants
      WHERE user_id = $1
        AND join_status = 'pending'
      ORDER BY created_at ASC, trip_id ASC
    `,
    [userId]
  );

  return Promise.all(result.rows.map((row) => mapTripInvitationRow({
    ...row,
    status: "pending"
  })));
}

export async function respondToTripJoinRequestRecord(requestId, organizerId, status) {
  return getDatabase().transaction(async (client) => {
    const requestResult = await client.query(
      `
        SELECT tjr.id, tjr.trip_id, tjr.requester_id, tjr.status, tjr.created_at
        FROM trip_join_requests tjr
        JOIN trips t ON t.id = tjr.trip_id
        WHERE tjr.id = $1
          AND t.organizer_id = $2
          AND tjr.status = 'pending'
        FOR UPDATE
      `,
      [requestId, organizerId]
    );
    const request = requestResult.rows[0];

    if (!request) {
      return null;
    }

    await client.query(
      `
        UPDATE trip_join_requests
        SET status = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [requestId, status]
    );

    if (status === "accepted") {
      await client.query(
        `
          INSERT INTO trip_participants (trip_id, user_id, role, join_status)
          VALUES ($1, $2, 'participant', 'approved')
          ON CONFLICT (trip_id, user_id)
          DO UPDATE SET join_status = 'approved',
                        role = CASE
                          WHEN trip_participants.role = 'organizer' THEN 'organizer'
                          ELSE 'participant'
                        END
        `,
        [request.trip_id, request.requester_id]
      );
    }

    return mapTripJoinRequestRow({ ...request, status });
  });
}

export async function respondToTripInvitationRecord(userId, tripId, status) {
  return getDatabase().transaction(async (client) => {
    const invitationResult = await client.query(
      `
        SELECT trip_id, user_id, role, join_status, created_at
        FROM trip_participants
        WHERE trip_id = $1
          AND user_id = $2
          AND join_status = 'pending'
        FOR UPDATE
      `,
      [tripId, userId]
    );
    const invitation = invitationResult.rows[0];

    if (!invitation) {
      return null;
    }

    if (status === "accepted") {
      await client.query(
        `
          UPDATE trip_participants
          SET join_status = 'approved'
          WHERE trip_id = $1
            AND user_id = $2
        `,
        [tripId, userId]
      );
    } else {
      await client.query(
        `
          DELETE FROM trip_participants
          WHERE trip_id = $1
            AND user_id = $2
            AND join_status = 'pending'
        `,
        [tripId, userId]
      );
    }

    return mapTripInvitationRow({ ...invitation, status });
  });
}

async function findFriendRequestRecordById(requestId) {
  const result = await getDatabase().query(
    `
      SELECT id, requester_id, recipient_id, status, created_at
      FROM friend_requests
      WHERE id = $1
    `,
    [requestId]
  );

  return result.rows[0] ? mapFriendRequestRow(result.rows[0]) : null;
}

async function findTripJoinRequestRecordById(requestId) {
  const result = await getDatabase().query(
    `
      SELECT id, trip_id, requester_id, status, created_at
      FROM trip_join_requests
      WHERE id = $1
    `,
    [requestId]
  );

  return result.rows[0] ? mapTripJoinRequestRow(result.rows[0]) : null;
}

async function mapFriendRequestRow(row) {
  const [requester, recipient] = await Promise.all([
    findUserRecord(row.requester_id),
    findUserRecord(row.recipient_id)
  ]);

  return {
    id: String(row.id),
    status: row.status,
    requester,
    recipient,
    createdAt: row.created_at?.toISOString?.() || row.created_at
  };
}

async function mapTripJoinRequestRow(row) {
  const [trip, requester] = await Promise.all([
    findPublicTripRecord(row.trip_id),
    findUserRecord(row.requester_id)
  ]);

  return {
    id: String(row.id),
    status: row.status,
    trip,
    requester,
    createdAt: row.created_at?.toISOString?.() || row.created_at
  };
}

async function mapTripInvitationRow(row) {
  const [trip, organizer, invitee] = await Promise.all([
    findPublicTripRecord(row.trip_id),
    findTripOrganizerRecord(row.trip_id),
    findUserRecord(row.user_id)
  ]);

  return {
    id: String(row.trip_id),
    tripId: String(row.trip_id),
    status: row.status || row.join_status,
    trip,
    organizer,
    invitee,
    createdAt: row.created_at?.toISOString?.() || row.created_at
  };
}

async function findUserRecord(userId) {
  const result = await getDatabase().query(
    `
      SELECT id, name, display_name, email, avatar_url
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

async function findPublicTripRecord(tripId) {
  const result = await getDatabase().query(
    `
      SELECT
        t.id,
        t.name,
        t.destination,
        t.start_date,
        t.end_date,
        t.visibility,
        t.organizer_id,
        organizer.name AS organizer_name,
        organizer.display_name AS organizer_display_name,
        organizer.email AS organizer_email,
        organizer.avatar_url AS organizer_avatar_url,
        b.mode,
        b.total_budget,
        b.per_person_budget,
        (
          SELECT COUNT(*)
          FROM trip_participants tp
          WHERE tp.trip_id = t.id
            AND tp.join_status = 'approved'
        ) AS participant_count,
        (
          SELECT COUNT(*)
          FROM expenses e
          WHERE e.trip_id = t.id
        ) AS expense_count,
        COALESCE((
          SELECT SUM(e.amount)
          FROM expenses e
          WHERE e.trip_id = t.id
            AND e.expense_type = 'budget_payment'
        ), 0) AS total_spent,
        'none' AS join_request_status,
        'none' AS invitation_status,
        false AS is_participant
      FROM trips t
      JOIN users organizer ON organizer.id = t.organizer_id
      LEFT JOIN budgets b ON b.trip_id = t.id
      WHERE t.id = $1
    `,
    [tripId]
  );

  return result.rows[0] ? mapPublicTripRow(result.rows[0]) : null;
}

async function findTripOrganizerRecord(tripId) {
  const result = await getDatabase().query(
    `
      SELECT u.id, u.name, u.display_name, u.email, u.avatar_url
      FROM trips t
      JOIN users u ON u.id = t.organizer_id
      WHERE t.id = $1
    `,
    [tripId]
  );

  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

function mapUserRow(row) {
  return {
    id: String(row.id),
    userId: row.name,
    name: row.name,
    displayName: row.display_name || row.name,
    email: row.email,
    avatarUrl: row.avatar_url || ""
  };
}

function mapPublicTripRow(row) {
  const participantCount = Number(row.participant_count || 0);
  const totalSpent = toCurrencyNumber(row.total_spent);

  return {
    id: String(row.id),
    name: row.name,
    destination: row.destination || "TBD",
    startDate: formatDate(row.start_date),
    endDate: formatDate(row.end_date),
    visibility: row.visibility || "private",
    organizerId: String(row.organizer_id),
    organizerName: row.organizer_display_name || row.organizer_name || "Organizer",
    organizer: {
      id: String(row.organizer_id),
      userId: row.organizer_name,
      name: row.organizer_name,
      displayName: row.organizer_display_name || row.organizer_name,
      email: row.organizer_email,
      avatarUrl: row.organizer_avatar_url || ""
    },
    participantCount,
    expenseCount: Number(row.expense_count || 0),
    budgetSummary: buildBudgetSummary(row, participantCount, totalSpent),
    joinRequestStatus: row.join_request_status || "none",
    invitationStatus: row.invitation_status || "none",
    isParticipant: Boolean(row.is_participant)
  };
}

function buildBudgetSummary(row, participantCount, totalSpent) {
  if (!row.mode) {
    return null;
  }

  const perPersonBudget = toNullableCurrencyNumber(row.per_person_budget);
  const totalBudget =
    row.mode === "per-person"
      ? roundCurrency(perPersonBudget * participantCount)
      : toCurrencyNumber(row.total_budget);
  const remainingBudget = roundCurrency(Math.max(totalBudget - totalSpent, 0));
  const overBudgetAmount = roundCurrency(Math.max(totalSpent - totalBudget, 0));

  return {
    mode: row.mode,
    totalBudget,
    perPersonBudget,
    participantCount,
    totalSpent,
    remainingBudget,
    overBudgetAmount
  };
}

function formatDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

function toNullableCurrencyNumber(value) {
  return value === null || value === undefined ? null : toCurrencyNumber(value);
}

function toCurrencyNumber(value) {
  return roundCurrency(Number(value || 0));
}

function roundCurrency(value) {
  return Number(value.toFixed(2));
}
