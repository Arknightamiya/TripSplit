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

Private trip data can only be viewed or changed by approved participants in that trip. Organizer-only actions, such as changing the budget or managing participants, must verify that the token user is the trip organizer or has an approved organizer role.

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
  "name": "Alex Organizer",
  "email": "alex@example.com"
}
```

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
  "name": "Alex Organizer",
  "email": "alex@example.com",
  "password": "demo-password"
}
```

Response:

```json
{
  "user": {
    "id": "user_1",
    "name": "Alex Organizer",
    "email": "alex@example.com"
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
  "email": "alex@example.com",
  "password": "demo-password"
}
```

Response:

```json
{
  "user": {
    "id": "user_1",
    "name": "Alex Organizer",
    "email": "alex@example.com"
  },
  "token": "demo-token-user_1"
}
```

Errors:

- account not found
- invalid password
- missing credentials

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
  "endDate": "2026-06-07"
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

The backend sets `organizerId` from the token user and automatically adds that user as an approved organizer participant.

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

Only an organizer can add participants in the MVP.

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
