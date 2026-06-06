# TripSplit API Contract

This document defines the agreed request and response formats between the frontend and backend.

The current backend uses Express routes and services with two data paths:
an in-memory store for fast local development and automated tests when
`DATABASE_URL` is not set, and PostgreSQL repositories when `DATABASE_URL` is
configured. These paths should keep the same API response shapes.

## API Base

```text
/api
```

The shared frontend/backend constant is defined in `shared/contracts.js`.

API `id` values should be treated as opaque identifiers by the frontend. The current scaffold uses string IDs such as `user_1`; a future PostgreSQL implementation may use numeric IDs internally.

## Authentication And Access

Public endpoints:

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/register/verify`
- `POST /api/auth/register/resend-code`
- `POST /api/auth/login`
- `GET /api/currencies`

All profile, friend, trip, participant, budget, expense, and balance endpoints
are private and must include:

```http
Authorization: Bearer <token>
```

The backend must identify the current user from the token. The frontend must not send `organizerId` or any other field pretending to identify the logged-in user.

Private trip data can only be viewed or changed by approved participants in that trip. Organizer-only actions, such as changing the budget, managing participants, or deleting a trip, must verify that the token user is the trip organizer or has an approved organizer role.

Standard error response:

```json
{
  "error": "Human-readable error message"
}
```

Recommended status codes:

- `400` invalid or missing input
- `401` missing or invalid token
- `403` authenticated but not allowed for this trip/action
- `404` trip, user, or expense not found
- `409` duplicate account or duplicate participant

## Shared Shapes

### User

```json
{
  "id": "user_1",
  "userId": "alex-organizer#1",
  "name": "alex-organizer#1",
  "displayName": "Alex Organizer",
  "email": "alex@example.com",
  "avatarUrl": ""
}
```

`name` remains the immutable login user ID for backward compatibility with the starter code. New frontend work should display `displayName` and treat `userId`/`name` as the fixed account identifier. During registration, the backend assigns a Discord-style discriminator, so the first user who requests `miya` becomes `miya#1`, the next becomes `miya#2`, and so on. `displayName` and `avatarUrl` can be changed from the profile UI; `userId`, `name`, and `email` are not edited from profile.

### Budget Summary

```json
{
  "mode": "total",
  "totalBudget": 900,
  "perPersonBudget": null,
  "currencyCode": "USD",
  "participantCount": 3,
  "totalSpent": 540,
  "remainingBudget": 360,
  "overBudgetAmount": 0
}
```

For per-person budgets:

```json
{
  "mode": "per-person",
  "totalBudget": 900,
  "perPersonBudget": 300,
  "currencyCode": "USD",
  "participantCount": 3,
  "totalSpent": 540,
  "remainingBudget": 360,
  "overBudgetAmount": 0
}
```

`totalBudget` is the computed group budget used by the UI. `currencyCode`
defaults to `USD` when omitted. `remainingBudget` should be `0` once the group
is over budget. `overBudgetAmount` should be `0` until spending exceeds
`totalBudget`.

### Expense

```json
{
  "id": "expense_5",
  "tripId": "trip_4",
  "title": "Hotel",
  "amount": 450,
  "category": "lodging",
  "expenseType": "personal_advance",
  "currencyCode": "USD",
  "payerId": "user_1",
  "splitRule": "equal",
  "includedParticipantIds": ["user_2", "user_3"],
  "expenseShares": [
    {
      "participantId": "user_2",
      "shareAmount": 150
    },
    {
      "participantId": "user_3",
      "shareAmount": 150
    }
  ],
  "createdAt": "2026-05-13T00:00:00.000Z",
  "deletedAt": null,
  "deletedBy": null
}
```

MVP split rule:

```text
equal
```

For equal split, the backend creates one `expenseShare` per included participant and rounds each share to 2 decimal places. The backend must ensure the payer and all included participants are approved participants in the trip.

### Audit Log

```json
{
  "id": "audit_1",
  "tripId": "trip_4",
  "actorId": "user_1",
  "action": "expense.deleted",
  "targetType": "expense",
  "targetId": "expense_5",
  "createdAt": "2026-05-13T00:00:00.000Z"
}
```

Expense create, delete, and restore operations append audit logs. Trip detail
responses include `auditLogs`; expense delete and restore responses return the
updated audit log list.

## Health Check

### GET `/api/health`

Response:

```json
{
  "ok": true,
  "service": "TripSplit API"
}
```

## Auth APIs

### POST `/api/auth/register`

Request:

```json
{
  "name": "alex-organizer",
  "email": "alex@example.com",
  "password": "Demo-password1!"
}
```

Starts registration and emails a 6-digit verification code. The requested `name` is the base User ID; the final immutable User ID is assigned only after email verification.

Response:

```json
{
  "email": "alex@example.com",
  "expiresAt": "2026-05-31T20:05:00.000Z",
  "resendAvailableAt": "2026-05-31T20:01:00.000Z",
  "message": "Verification code sent"
}
```

Errors:

- duplicate account
- invalid input
- missing fields

### POST `/api/auth/register/verify`

Request:

```json
{
  "email": "alex@example.com",
  "code": "123456"
}
```

Verifies the pending registration, creates the user, and returns the normal auth session.

Response:

```json
{
  "user": {
    "id": "user_1",
    "userId": "alex-organizer#1",
    "name": "alex-organizer#1",
    "displayName": "alex-organizer#1",
    "email": "alex@example.com",
    "avatarUrl": ""
  },
  "token": "demo-token-user_1"
}
```

### POST `/api/auth/register/resend-code`

Request:

```json
{
  "email": "alex@example.com"
}
```

Refreshes the pending registration code. Resends are limited to once per 60 seconds.

### POST `/api/auth/login`

Request:

```json
{
  "identifier": "alex-organizer#1",
  "password": "Demo-password1!"
}
```

`identifier` can be either the user's full User ID, including its discriminator, or email address. The backend still accepts `email` for backward compatibility.

Response:

```json
{
  "user": {
    "id": "user_1",
    "userId": "alex-organizer#1",
    "name": "alex-organizer#1",
    "displayName": "Alex Organizer",
    "email": "alex@example.com",
    "avatarUrl": "data:image/png;base64,..."
  },
  "token": "demo-token-user_1"
}
```

Errors:

- account not found
- invalid password
- missing credentials

## Profile APIs

### GET `/api/me`

Headers:

```http
Authorization: Bearer <token>
```

Response:

```json
{
  "user": {
    "id": "user_1",
    "userId": "alex-organizer#1",
    "name": "alex-organizer#1",
    "displayName": "Alex Organizer",
    "email": "alex@example.com",
    "avatarUrl": "data:image/png;base64,..."
  }
}
```

### PATCH `/api/me`

Headers:

```http
Authorization: Bearer <token>
```

Request:

```json
{
  "displayName": "Miya Traveler",
  "avatarUrl": "data:image/png;base64,..."
}
```

Response:

```json
{
  "user": {
    "id": "user_1",
    "userId": "alex-organizer#1",
    "name": "alex-organizer#1",
    "displayName": "Miya Traveler",
    "email": "alex@example.com",
    "avatarUrl": "data:image/png;base64,..."
  }
}
```

`displayName` is required. `avatarUrl` can be an empty string to remove the profile photo. The current frontend stores uploaded profile photos as image data URLs so they can be saved through the same API and persisted in PostgreSQL.

## Friend APIs

All friend APIs require:

```http
Authorization: Bearer <token>
```

### GET `/api/friends`

Returns the current user's friends, pending incoming/outgoing friend requests, trip invitations sent to the current user, and trip join requests for trips the current user organizes.

```json
{
  "friends": [
    {
      "id": "user_2",
      "userId": "miya#1",
      "name": "miya#1",
      "displayName": "Miya",
      "email": "miya@example.com",
      "avatarUrl": "data:image/jpeg;base64,..."
    }
  ],
  "incomingRequests": [],
  "outgoingRequests": [],
  "tripInvitations": [],
  "tripJoinRequests": []
}
```

### GET `/api/friends/search?query=miya%231`

Searches users by full User ID, nickname, or email. The frontend uses this from the Add friend dialog.

Response:

```json
{
  "users": [
    {
      "id": "user_2",
      "userId": "miya#1",
      "name": "miya#1",
      "displayName": "Miya",
      "email": "miya@example.com",
      "avatarUrl": "",
      "relationship": "none"
    }
  ]
}
```

### GET `/api/friends/public-trips`

Returns all public trips owned by the current user's mutual friends. This powers the Trip Lobby view. Private trips are excluded, and public trips are hidden if either side has removed the friendship.

```json
{
  "publicTrips": [
    {
      "id": "trip_4",
      "name": "Yosemite Weekend",
      "destination": "Yosemite Weekend",
      "startDate": "2026-06-01",
      "endDate": "2026-06-03",
      "visibility": "public",
      "organizerId": "user_2",
      "organizerName": "Miya",
      "organizer": {
        "id": "user_2",
        "userId": "miya#1",
        "displayName": "Miya",
        "email": "miya@example.com",
        "avatarUrl": ""
      },
      "participantCount": 2,
      "expenseCount": 0,
      "budgetSummary": null,
      "joinRequestStatus": "none",
      "invitationStatus": "none",
      "isParticipant": false
    }
  ]
}
```

### POST `/api/friends/requests`

Request:

```json
{
  "identifier": "miya#1"
}
```

Creates a pending friend request. The backend rejects self-requests, duplicate pending requests, and users who are already friends.

Response:

```json
{
  "request": {
    "id": "friend_request_1",
    "status": "pending",
    "requester": {
      "id": "user_1",
      "displayName": "Alex Organizer",
      "email": "alex@example.com"
    },
    "recipient": {
      "id": "user_2",
      "displayName": "Miya",
      "email": "miya@example.com"
    },
    "createdAt": "2026-05-13T00:00:00.000Z"
  }
}
```

### POST `/api/friends/requests/:requestId/accept`

Accepts an incoming friend request and creates the friendship for both users.

Response:

```json
{
  "request": {
    "id": "friend_request_1",
    "status": "accepted",
    "requester": {
      "id": "user_1",
      "displayName": "Alex Organizer",
      "email": "alex@example.com"
    },
    "recipient": {
      "id": "user_2",
      "displayName": "Miya",
      "email": "miya@example.com"
    },
    "createdAt": "2026-05-13T00:00:00.000Z"
  }
}
```

### POST `/api/friends/requests/:requestId/decline`

Declines an incoming friend request without creating a friendship.

Response:

```json
{
  "request": {
    "id": "friend_request_1",
    "status": "declined",
    "requester": {
      "id": "user_1",
      "displayName": "Alex Organizer",
      "email": "alex@example.com"
    },
    "recipient": {
      "id": "user_2",
      "displayName": "Miya",
      "email": "miya@example.com"
    },
    "createdAt": "2026-05-13T00:00:00.000Z"
  }
}
```

### GET `/api/friends/:friendId`

Returns a friend profile and that friend's public trips. The requester must already be friends with `friendId`.

```json
{
  "friend": {
    "id": "user_2",
    "userId": "miya#1",
    "displayName": "Miya",
    "email": "miya@example.com",
    "avatarUrl": ""
  },
  "publicTrips": [
    {
      "id": "trip_4",
      "name": "Yosemite Weekend",
      "visibility": "public",
      "joinRequestStatus": "none",
      "invitationStatus": "none",
      "isParticipant": false
    }
  ]
}
```

### DELETE `/api/friends/:friendId`

Deletes the friendship in both directions. After removal, neither user appears
in the other's friend list, public trips are hidden from both sides, and the
removed friend can no longer request to join the current user's public trips.

Response:

```json
{
  "removed": true
}
```

### POST `/api/friends/trips/:tripId/join-requests`

Creates a pending request to join a friend's public trip. The backend rejects private trips, non-friends, duplicate pending requests, and users who are already approved participants.

Response:

```json
{
  "request": {
    "id": "trip_join_request_1",
    "status": "pending",
    "requester": {
      "id": "user_2",
      "displayName": "Miya",
      "email": "miya@example.com"
    },
    "trip": {
      "id": "trip_4",
      "name": "Yosemite Weekend"
    },
    "createdAt": "2026-05-13T00:00:00.000Z"
  }
}
```

### POST `/api/friends/trip-join-requests/:requestId/accept`

Organizer-only. Accepts a pending trip join request and adds the requester as an approved participant.

Response:

```json
{
  "request": {
    "id": "trip_join_request_1",
    "status": "accepted",
    "trip": {
      "id": "trip_4",
      "name": "Yosemite Weekend"
    },
    "requester": {
      "id": "user_2",
      "displayName": "Miya",
      "email": "miya@example.com"
    },
    "createdAt": "2026-05-13T00:00:00.000Z"
  }
}
```

### POST `/api/friends/trip-join-requests/:requestId/decline`

Organizer-only. Declines a pending trip join request.

Response:

```json
{
  "request": {
    "id": "trip_join_request_1",
    "status": "declined",
    "trip": {
      "id": "trip_4",
      "name": "Yosemite Weekend"
    },
    "requester": {
      "id": "user_2",
      "displayName": "Miya",
      "email": "miya@example.com"
    },
    "createdAt": "2026-05-13T00:00:00.000Z"
  }
}
```

### POST `/api/friends/trip-invitations/:tripId/accept`

Accepts a pending trip invitation. The invitee becomes an approved participant, and the trip starts appearing in that user's trip list.

Response:

```json
{
  "request": {
    "id": "trip_4",
    "tripId": "trip_4",
    "status": "accepted",
    "trip": {
      "id": "trip_4",
      "name": "Yosemite Weekend"
    },
    "organizer": {
      "id": "user_1",
      "displayName": "Alex Organizer",
      "email": "alex@example.com"
    },
    "invitee": {
      "id": "user_2",
      "displayName": "Miya",
      "email": "miya@example.com"
    },
    "createdAt": "2026-05-13T00:00:00.000Z"
  }
}
```

### POST `/api/friends/trip-invitations/:tripId/decline`

Declines a pending trip invitation. The pending participant row is removed, so the invitee disappears from the organizer's pending participant list.

Response:

```json
{
  "request": {
    "id": "trip_4",
    "tripId": "trip_4",
    "status": "declined",
    "trip": {
      "id": "trip_4",
      "name": "Yosemite Weekend"
    },
    "organizer": {
      "id": "user_1",
      "displayName": "Alex Organizer",
      "email": "alex@example.com"
    },
    "invitee": {
      "id": "user_2",
      "displayName": "Miya",
      "email": "miya@example.com"
    },
    "createdAt": "2026-05-13T00:00:00.000Z"
  }
}
```

## Trip APIs

### GET `/api/trips`

Headers:

```http
Authorization: Bearer <token>
```

Response:

```json
{
  "trips": [
    {
      "id": "trip_4",
      "name": "San Diego Weekend",
      "destination": "San Diego",
      "startDate": "2026-06-05",
      "endDate": "2026-06-07",
      "visibility": "private",
      "organizerId": "user_1",
      "organizerName": "Alex Organizer",
      "startedAt": "2026-06-05T12:00:00.000Z",
      "endedAt": null,
      "participantCount": 3,
      "expenseCount": 2,
      "budgetSummary": {
        "mode": "total",
        "totalBudget": 900,
        "perPersonBudget": null,
        "currencyCode": "USD",
        "participantCount": 3,
        "totalSpent": 540,
        "remainingBudget": 360,
        "overBudgetAmount": 0
      }
    }
  ]
}
```

Only trips where the token user is an approved participant should be returned.

### POST `/api/trips`

Headers:

```http
Authorization: Bearer <token>
```

Request:

```json
{
  "name": "San Diego Weekend",
  "destination": "San Diego",
  "startDate": "2026-06-05",
  "endDate": "2026-06-07",
  "visibility": "private",
  "inviteeUserIds": ["user_2"]
}
```

Response:

```json
{
  "trip": {
    "id": "trip_4",
    "name": "San Diego Weekend",
    "destination": "San Diego",
    "startDate": "2026-06-05",
    "endDate": "2026-06-07",
    "visibility": "private",
    "organizerId": "user_1",
    "startedAt": null,
    "endedAt": null,
    "participantIds": ["user_1"],
    "participants": [
      {
        "id": "user_1",
        "name": "Alex Organizer",
        "email": "alex@example.com",
        "role": "organizer",
        "joinStatus": "approved"
      },
      {
        "id": "user_2",
        "name": "Riley Friend",
        "email": "riley@example.com",
        "role": "participant",
        "joinStatus": "pending"
      }
    ],
    "budgetSummary": null,
    "expenses": [],
    "deletedExpenses": [],
    "auditLogs": []
  }
}
```

The backend sets `organizerId` from the token user and automatically adds that user as an approved organizer participant. `inviteeUserIds` is optional; each listed user is added as a pending participant invitation and does not count toward approved participant totals until accepted. `startDate` and `endDate` are optional, but when present they must be valid `YYYY-MM-DD` calendar dates with a four-digit year between `0001` and `9999`; `endDate` must be on or after `startDate`.

### GET `/api/trips/:tripId`

Headers:

```http
Authorization: Bearer <token>
```

Response:

```json
{
  "trip": {
    "id": "trip_4",
    "name": "San Diego Weekend",
    "destination": "San Diego",
    "startDate": "2026-06-05",
    "endDate": "2026-06-07",
    "visibility": "private",
    "organizerId": "user_1",
    "startedAt": "2026-06-05T12:00:00.000Z",
    "endedAt": null,
    "participantIds": ["user_1", "user_2", "user_3"],
    "participants": [
      {
        "id": "user_1",
        "name": "Alex Organizer",
        "email": "alex@example.com",
        "role": "organizer",
        "joinStatus": "approved"
      }
    ],
    "budgetSummary": {
      "mode": "total",
      "totalBudget": 900,
      "perPersonBudget": null,
      "currencyCode": "USD",
      "participantCount": 3,
      "totalSpent": 540,
      "remainingBudget": 360,
      "overBudgetAmount": 0
    },
    "expenses": [],
    "deletedExpenses": [],
    "auditLogs": []
  }
}
```

Errors:

- trip not found
- unauthorized request
- authenticated user is not an approved participant

### PATCH `/api/trips/:tripId`

Headers:

```http
Authorization: Bearer <token>
```

Request:

```json
{
  "name": "Big Bear Weekend",
  "destination": "Big Bear Weekend",
  "startDate": "2026-05-27",
  "endDate": "2026-06-27",
  "visibility": "private"
}
```

Response:

```json
{
  "trip": {
    "id": "trip_4",
    "name": "Big Bear Weekend",
    "destination": "Big Bear Weekend",
    "startDate": "2026-05-27",
    "endDate": "2026-06-27",
    "visibility": "private",
    "organizerId": "user_1",
    "startedAt": null,
    "endedAt": null,
    "participantIds": ["user_1"],
    "participants": [
      {
        "id": "user_1",
        "name": "alex-organizer#1",
        "displayName": "Alex Organizer",
        "email": "alex@example.com",
        "role": "organizer",
        "joinStatus": "approved"
      }
    ],
    "budgetSummary": null,
    "expenses": [],
    "deletedExpenses": [],
    "auditLogs": []
  }
}
```

Only the trip organizer can update trip destination, dates, or public/private
visibility. Trip metadata is locked after the trip starts. The frontend should
refresh the trip list and detail view after this request so the summary cards
stay synchronized.

Errors:

- trip not found
- invalid date format or date range
- unauthorized request
- authenticated user is not the trip organizer

### DELETE `/api/trips/:tripId`

Headers:

```http
Authorization: Bearer <token>
```

Response:

```json
{
  "deletedTripId": "trip_4"
}
```

Only the trip organizer can delete a trip. Deleting a trip also removes the related participants, budget, expenses, expense shares, and balance data. Trips cannot be deleted after they have started.

Errors:

- trip not found
- unauthorized request
- authenticated user is not the trip organizer
- trip has already started

### POST `/api/trips/:tripId/start`

Headers:

```http
Authorization: Bearer <token>
```

Response:

```json
{
  "trip": {
    "id": "trip_4",
    "name": "San Diego Weekend",
    "destination": "San Diego",
    "startDate": "2026-06-05",
    "endDate": "2026-06-07",
    "visibility": "private",
    "organizerId": "user_1",
    "startedAt": "2026-06-05T12:00:00.000Z",
    "endedAt": null,
    "participantIds": ["user_1", "user_2", "user_3"],
    "participants": [
      {
        "id": "user_1",
        "displayName": "Alex Organizer",
        "role": "organizer",
        "joinStatus": "approved"
      }
    ],
    "budgetSummary": null,
    "expenses": [],
    "deletedExpenses": [],
    "auditLogs": []
  }
}
```

Only the trip organizer can start a trip. Starting a trip enables expense
recording and locks trip metadata, participant invitations, participant removal,
and trip deletion.

### POST `/api/trips/:tripId/end`

Headers:

```http
Authorization: Bearer <token>
```

Response:

```json
{
  "trip": {
    "id": "trip_4",
    "name": "San Diego Weekend",
    "destination": "San Diego",
    "startDate": "2026-06-05",
    "endDate": "2026-06-07",
    "visibility": "private",
    "organizerId": "user_1",
    "startedAt": "2026-06-05T12:00:00.000Z",
    "endedAt": "2026-06-07T20:00:00.000Z",
    "participantIds": ["user_1", "user_2", "user_3"],
    "participants": [
      {
        "id": "user_1",
        "displayName": "Alex Organizer",
        "role": "organizer",
        "joinStatus": "approved"
      }
    ],
    "budgetSummary": null,
    "expenses": [],
    "deletedExpenses": [],
    "auditLogs": []
  }
}
```

Only the trip organizer can end a trip. A trip must be started before it can be
ended. Ending a trip locks budget changes, expense creation, expense deletion,
and expense restore; the frontend uses the final balances for the final bill.

## Participant APIs

### POST `/api/trips/:tripId/participants`

Headers:

```http
Authorization: Bearer <token>
```

Request option 1:

```json
{
  "userId": "user_2",
  "role": "participant"
}
```

Request option 2:

```json
{
  "name": "Sam Traveler",
  "email": "sam@example.com",
  "role": "participant"
}
```

Response:

```json
{
  "trip": {
    "id": "trip_4",
    "participantIds": ["user_1", "user_2"],
    "participants": [
      {
        "id": "user_2",
        "name": "Sam Traveler",
        "email": "sam@example.com",
        "role": "participant",
        "joinStatus": "approved"
      }
    ]
  }
}
```

Only an organizer can add approved participants directly.

### POST `/api/trips/:tripId/invitations`

Headers:

```http
Authorization: Bearer <token>
```

Request:

```json
{
  "userId": "user_2",
  "role": "participant"
}
```

Response:

```json
{
  "trip": {
    "id": "trip_4",
    "participantIds": ["user_1"],
    "participants": [
      {
        "id": "user_2",
        "displayName": "Sam Traveler",
        "role": "participant",
        "joinStatus": "pending"
      }
    ]
  }
}
```

Only an organizer can send invitations. Pending invitations do not count toward `participantCount`, `participantIds`, budgets, balances, or expense split eligibility until the invitee accepts.

### DELETE `/api/trips/:tripId/participants/:participantId`

Organizer-only. Removes a non-organizer participant or pending invitation from a trip.

Response:

```json
{
  "removedParticipantId": "user_2",
  "trip": {
    "id": "trip_4",
    "name": "San Diego Weekend",
    "participantIds": ["user_1"],
    "participants": [
      {
        "id": "user_1",
        "displayName": "Alex Organizer",
        "role": "organizer",
        "joinStatus": "approved"
      }
    ],
    "budgetSummary": null,
    "expenses": [],
    "deletedExpenses": [],
    "auditLogs": []
  }
}
```

Rules:

- The organizer cannot remove themselves through this endpoint.
- Pending invitations can be removed before the invitee accepts.
- Approved members can be removed if they have no expense history as payer or
  split participant.
- Removing a pending invitation removes it from the invitee's Requests view.
- After the trip has started, participants and pending invitations cannot be
  removed.

## Budget APIs

### POST `/api/trips/:tripId/budget`

Headers:

```http
Authorization: Bearer <token>
```

Request for total budget:

```json
{
  "mode": "total",
  "totalBudget": 900,
  "currencyCode": "USD"
}
```

Request for per-person budget:

```json
{
  "mode": "per-person",
  "perPersonBudget": 300,
  "currencyCode": "USD"
}
```

Response:

```json
{
  "tripId": "trip_4",
  "budgetSummary": {
    "mode": "per-person",
    "totalBudget": 900,
    "perPersonBudget": 300,
    "currencyCode": "USD",
    "participantCount": 3,
    "totalSpent": 540,
    "remainingBudget": 360,
    "overBudgetAmount": 0
  }
}
```

Only an organizer can set or update the budget in the MVP. `currencyCode`
defaults to `USD` when omitted. Before the trip starts, the organizer can modify
the budget mode, amount, and currency. After the trip starts, the organizer can
only increase the existing budget amount using the same budget mode. After the
trip ends, budget changes are locked.

## Expense APIs

### POST `/api/trips/:tripId/expenses`

Headers:

```http
Authorization: Bearer <token>
```

Request:

```json
{
  "title": "Hotel",
  "amount": 450,
  "category": "lodging",
  "expenseType": "personal_advance",
  "currencyCode": "USD",
  "payerId": "user_1",
  "splitRule": "equal",
  "includedParticipantIds": ["user_2", "user_3"]
}
```

Expenses can only be recorded after the organizer starts the trip. Before start, the backend returns `400` with `Start the trip before recording expenses`.

Response:

```json
{
  "expense": {
    "id": "expense_5",
    "tripId": "trip_4",
    "title": "Hotel",
    "amount": 450,
    "category": "lodging",
    "expenseType": "personal_advance",
    "currencyCode": "USD",
    "payerId": "user_1",
    "splitRule": "equal",
    "includedParticipantIds": ["user_2", "user_3"],
    "expenseShares": [
      {
        "participantId": "user_2",
        "shareAmount": 150
      },
      {
        "participantId": "user_3",
        "shareAmount": 150
      }
    ],
    "createdAt": "2026-05-13T00:00:00.000Z",
    "deletedAt": null,
    "deletedBy": null
  },
  "budgetSummary": {
    "mode": "total",
    "totalBudget": 900,
    "perPersonBudget": null,
    "currencyCode": "USD",
    "participantCount": 3,
    "totalSpent": 0,
    "remainingBudget": 900,
    "overBudgetAmount": 0
  },
  "balances": [
    {
      "participantId": "user_1",
      "budgetSpent": 0,
      "actualPaid": 450,
      "fairShare": 150,
      "netBalance": 300
    },
    {
      "participantId": "user_2",
      "budgetSpent": 0,
      "actualPaid": 0,
      "fairShare": 150,
      "netBalance": -150
    },
    {
      "participantId": "user_3",
      "budgetSpent": 0,
      "actualPaid": 0,
      "fairShare": 150,
      "netBalance": -150
    }
  ]
}
```

`expenseType` has two supported meanings:

- `budget_payment`: paid from the shared trip budget. Only the organizer can create this type. It increases `budgetSummary.totalSpent` and each selected participant's `budgetSpent`, but it does not create personal reimbursement balances.
- `personal_advance`: paid out of pocket by a participant for selected trip participants. It does not increase `budgetSummary.totalSpent`; it updates `actualPaid`, `fairShare`, and `netBalance`.

For `budget_payment`, the payer is the organizer/current authenticated user and `includedParticipantIds` means everyone who used the shared budget expense. For `personal_advance`, `includedParticipantIds` means the people who should reimburse the payer; the payer is excluded from the stored split shares. Any approved trip participant can record a `personal_advance`. `currencyCode` defaults to `USD` when omitted. The backend must reject requests where the payer or any included split participant is not an approved participant in the trip.

### DELETE `/api/trips/:tripId/expenses/:expenseId`

Headers:

```http
Authorization: Bearer <token>
```

Response:

```json
{
  "deletedExpenseId": "expense_5",
  "deletedExpense": {
    "id": "expense_5",
    "tripId": "trip_4",
    "title": "Hotel",
    "amount": 450,
    "category": "lodging",
    "expenseType": "personal_advance",
    "currencyCode": "USD",
    "payerId": "user_1",
    "splitRule": "equal",
    "includedParticipantIds": ["user_2", "user_3"],
    "expenseShares": [
      {
        "participantId": "user_2",
        "shareAmount": 150
      },
      {
        "participantId": "user_3",
        "shareAmount": 150
      }
    ],
    "createdAt": "2026-05-13T00:00:00.000Z",
    "deletedAt": "2026-05-13T01:00:00.000Z",
    "deletedBy": "user_1"
  },
  "auditLogs": [
    {
      "id": "audit_2",
      "tripId": "trip_4",
      "actorId": "user_1",
      "action": "expense.deleted",
      "targetType": "expense",
      "targetId": "expense_5",
      "createdAt": "2026-05-13T01:00:00.000Z"
    }
  ],
  "budgetSummary": {
    "mode": "total",
    "totalBudget": 900,
    "perPersonBudget": null,
    "currencyCode": "USD",
    "participantCount": 3,
    "totalSpent": 0,
    "remainingBudget": 900,
    "overBudgetAmount": 0
  },
  "balances": []
}
```

Deleting an expense is a soft delete. The requester must be the expense payer
or the trip organizer in the MVP. Expense deletion is locked after the trip ends.

Errors:

- trip not found
- expense not found
- requester is not allowed to delete this expense
- trip has ended

### POST `/api/trips/:tripId/expenses/:expenseId/restore`

Headers:

```http
Authorization: Bearer <token>
```

Response:

```json
{
  "restoredExpenseId": "expense_5",
  "restoredExpense": {
    "id": "expense_5",
    "tripId": "trip_4",
    "title": "Hotel",
    "amount": 450,
    "category": "lodging",
    "expenseType": "personal_advance",
    "currencyCode": "USD",
    "payerId": "user_1",
    "splitRule": "equal",
    "includedParticipantIds": ["user_2", "user_3"],
    "expenseShares": [
      {
        "participantId": "user_2",
        "shareAmount": 150
      },
      {
        "participantId": "user_3",
        "shareAmount": 150
      }
    ],
    "createdAt": "2026-05-13T00:00:00.000Z",
    "deletedAt": null,
    "deletedBy": null
  },
  "auditLogs": [
    {
      "id": "audit_3",
      "tripId": "trip_4",
      "actorId": "user_1",
      "action": "expense.restored",
      "targetType": "expense",
      "targetId": "expense_5",
      "createdAt": "2026-05-13T01:15:00.000Z"
    }
  ],
  "budgetSummary": {
    "mode": "total",
    "totalBudget": 900,
    "perPersonBudget": null,
    "currencyCode": "USD",
    "participantCount": 3,
    "totalSpent": 0,
    "remainingBudget": 900,
    "overBudgetAmount": 0
  },
  "balances": []
}
```

Only the trip organizer can restore a soft-deleted expense. Expense restore is
locked after the trip ends.

## Balance APIs

### GET `/api/trips/:tripId/balances`

Headers:

```http
Authorization: Bearer <token>
```

Response:

```json
{
  "tripId": "trip_4",
  "balances": [
    {
      "participantId": "user_1",
      "budgetSpent": 0,
      "actualPaid": 450,
      "fairShare": 150,
      "netBalance": 300,
      "participant": {
        "id": "user_1",
        "name": "Alex Organizer",
        "displayName": "Alex Organizer",
        "email": "alex@example.com"
      }
    }
  ]
}
```

Balances are calculated from expenses and expense shares. `budgetSpent` records how much of the shared trip budget was used for that participant. Positive `netBalance` means the participant paid out of pocket more than their personal fair share and should be reimbursed. Negative `netBalance` means the participant owes reimbursement to others.

## Currency APIs

### GET `/api/currencies`

This endpoint is public. It returns supported currencies and exchange-rate
metadata used by the frontend currency selectors and mixed-currency displays.
Without PostgreSQL, the response uses fallback exchange rates. With PostgreSQL,
the response combines supported currency records with the latest stored exchange
rates.

Response:

```json
{
  "baseCurrencyCode": "USD",
  "fetchedAt": "2026-06-06T00:02:32.000Z",
  "rates": {
    "USD": 1,
    "EUR": 0.92,
    "JPY": 156.12
  },
  "currencies": [
    {
      "code": "USD",
      "name": "US Dollar",
      "symbol": "$",
      "decimalPlaces": 2,
      "rate": 1,
      "provider": "fallback",
      "fetchedAt": null
    }
  ]
}
```

`fetchedAt`, `provider`, and each currency `fetchedAt` can be `null` when the
response is based on fallback rates or no database refresh has been run yet.

## Shared Constants

Expense categories should use values from `shared/contracts.js`:

```text
lodging
food
transportation
tickets
drinks
emergency
other
```

Expense types:

```text
budget_payment
personal_advance
```

Split rules:

```text
equal
```

Budget modes:

```text
total
per-person
```
