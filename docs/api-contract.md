# TripSplit API Contract

This document defines the agreed request and response formats between the frontend and backend.

The current backend scaffold uses Express routes and services with an in-memory store. Feature branches should implement toward this contract so frontend and backend work can integrate without redesigning endpoints later. PostgreSQL should replace the service/store internals without changing these response shapes.

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
- `POST /api/auth/login`

All trip, participant, budget, expense, and balance endpoints are private and must include:

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
  "participantCount": 3,
  "totalSpent": 540,
  "remainingBudget": 360,
  "overBudgetAmount": 0
}
```

`totalBudget` is the computed group budget used by the UI. `remainingBudget` should be `0` once the group is over budget. `overBudgetAmount` should be `0` until spending exceeds `totalBudget`.

### Expense

```json
{
  "id": "expense_5",
  "tripId": "trip_4",
  "title": "Hotel",
  "amount": 450,
  "category": "lodging",
  "expenseType": "shared",
  "payerId": "user_1",
  "splitRule": "equal",
  "includedParticipantIds": ["user_1", "user_2", "user_3"],
  "expenseShares": [
    {
      "participantId": "user_1",
      "shareAmount": 150
    },
    {
      "participantId": "user_2",
      "shareAmount": 150
    },
    {
      "participantId": "user_3",
      "shareAmount": 150
    }
  ],
  "createdAt": "2026-05-13T00:00:00.000Z"
}
```

MVP split rule:

```text
equal
```

For equal split, the backend creates one `expenseShare` per included participant and rounds each share to 2 decimal places. The backend must ensure the payer and all included participants are approved participants in the trip.

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
  "password": "demo-password"
}
```

The requested `name` is the base User ID. The backend stores and returns the final immutable User ID with an automatic discriminator, such as `alex-organizer#1`.

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

Errors:

- duplicate account
- invalid input
- missing fields

### POST `/api/auth/login`

Request:

```json
{
  "identifier": "alex-organizer#1",
  "password": "demo-password"
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

### POST `/api/friends/requests`

Request:

```json
{
  "identifier": "miya#1"
}
```

Creates a pending friend request. The backend rejects self-requests, duplicate pending requests, and users who are already friends.

### POST `/api/friends/requests/:requestId/accept`

Accepts an incoming friend request and creates the friendship for both users.

### POST `/api/friends/requests/:requestId/decline`

Declines an incoming friend request without creating a friendship.

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
      "isParticipant": false
    }
  ]
}
```

### DELETE `/api/friends/:friendId`

Deletes `friendId` from the current user's friend list only. The other user can still keep the current user in their own friend list, but public trips are only visible when the friendship is mutual. This means a deleted friend cannot see the current user's public trips or request to join them.

### POST `/api/friends/trips/:tripId/join-requests`

Creates a pending request to join a friend's public trip. The backend rejects private trips, non-friends, duplicate pending requests, and users who are already approved participants.

### POST `/api/friends/trip-join-requests/:requestId/accept`

Organizer-only. Accepts a pending trip join request and adds the requester as an approved participant.

### POST `/api/friends/trip-join-requests/:requestId/decline`

Organizer-only. Declines a pending trip join request.

### POST `/api/friends/trip-invitations/:tripId/accept`

Accepts a pending trip invitation. The invitee becomes an approved participant, and the trip starts appearing in that user's trip list.

### POST `/api/friends/trip-invitations/:tripId/decline`

Declines a pending trip invitation. The pending participant row is removed, so the invitee disappears from the organizer's pending participant list.

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
      "participantCount": 3,
      "expenseCount": 2,
      "budgetSummary": {
        "mode": "total",
        "totalBudget": 900,
        "perPersonBudget": null,
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
  "visibility": "private"
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
    "participantIds": ["user_1"],
    "participants": [
      {
        "id": "user_1",
        "name": "Alex Organizer",
        "email": "alex@example.com",
        "role": "organizer",
        "joinStatus": "approved"
      }
    ],
    "budgetSummary": null,
    "expenses": []
  }
}
```

The backend sets `organizerId` from the token user and automatically adds that user as an approved organizer participant. `startDate` and `endDate` are optional, but when present they must be valid `YYYY-MM-DD` calendar dates with a four-digit year between `0001` and `9999`; `endDate` must be on or after `startDate`.

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
      "participantCount": 3,
      "totalSpent": 540,
      "remainingBudget": 360,
      "overBudgetAmount": 0
    },
    "expenses": []
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
    "expenses": []
  }
}
```

Only the trip organizer can update trip destination, dates, or public/private visibility. The frontend should refresh the trip list and detail view after this request so the summary cards stay synchronized.

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

Only the trip organizer can delete a trip. Deleting a trip also removes the related participants, budget, expenses, expense shares, and balance data.

Errors:

- trip not found
- unauthorized request
- authenticated user is not the trip organizer

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

Rules:

- The organizer cannot remove themselves through this endpoint.
- Pending invitations can be removed before the invitee accepts.
- Approved members can be removed if they have not paid expenses in the trip.
- Removing a pending invitation removes it from the invitee's Requests view.

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
  "totalBudget": 900
}
```

Request for per-person budget:

```json
{
  "mode": "per-person",
  "perPersonBudget": 300
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
    "participantCount": 3,
    "totalSpent": 540,
    "remainingBudget": 360,
    "overBudgetAmount": 0
  }
}
```

Only an organizer can set or update the budget in the MVP.

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
  "expenseType": "shared",
  "payerId": "user_1",
  "splitRule": "equal",
  "includedParticipantIds": ["user_1", "user_2", "user_3"]
}
```

Response:

```json
{
  "expense": {
    "id": "expense_5",
    "tripId": "trip_4",
    "title": "Hotel",
    "amount": 450,
    "category": "lodging",
    "expenseType": "shared",
    "payerId": "user_1",
    "splitRule": "equal",
    "includedParticipantIds": ["user_1", "user_2", "user_3"],
    "expenseShares": [
      {
        "participantId": "user_1",
        "shareAmount": 150
      },
      {
        "participantId": "user_2",
        "shareAmount": 150
      },
      {
        "participantId": "user_3",
        "shareAmount": 150
      }
    ],
    "createdAt": "2026-05-13T00:00:00.000Z"
  },
  "budgetSummary": {
    "mode": "total",
    "totalBudget": 900,
    "perPersonBudget": null,
    "participantCount": 3,
    "totalSpent": 540,
    "remainingBudget": 360,
    "overBudgetAmount": 0
  },
  "balances": [
    {
      "participantId": "user_1",
      "actualPaid": 450,
      "fairShare": 180,
      "netBalance": 270
    }
  ]
}
```

Any approved trip participant can record an expense. The backend must reject requests where the payer or any included split participant is not an approved participant in the trip.

### DELETE `/api/trips/:tripId/expenses/:expenseId`

Headers:

```http
Authorization: Bearer <token>
```

Response:

```json
{
  "deletedExpenseId": "expense_5",
  "budgetSummary": {
    "mode": "total",
    "totalBudget": 900,
    "perPersonBudget": null,
    "participantCount": 3,
    "totalSpent": 90,
    "remainingBudget": 810,
    "overBudgetAmount": 0
  },
  "balances": []
}
```

The requester must be the expense payer or the trip organizer in the MVP.

Errors:

- trip not found
- expense not found
- requester is not allowed to delete this expense

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
      "actualPaid": 450,
      "fairShare": 180,
      "netBalance": 270,
      "participant": {
        "id": "user_1",
        "name": "Alex Organizer",
        "email": "alex@example.com"
      }
    }
  ]
}
```

Balances are calculated from expenses and expense shares. Positive `netBalance` means the participant paid more than their fair share. Negative `netBalance` means the participant paid less than their fair share.

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
shared
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
