# TripSplit API Contract

This document defines the expected request and response formats between frontend and backend.

## API Base

Current API base:

```text
/api
```

The shared frontend/backend constant is defined in `shared/contracts.js`.

---

## Health Check

### GET `/api/health`

**Response:**

```json
{
  "ok": true,
  "service": "TripSplit API"
}
```

---

## Auth APIs

### POST `/api/auth/register`

**Request:**

```json
{
  "name": "Alex Organizer",
  "email": "alex@example.com",
  "password": "demo-password"
}
```

**Response:**

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

**Possible errors:**

```json
{
  "error": "Invalid input"
}
```

---

### POST `/api/auth/login`

**Request:**

```json
{
  "email": "alex@example.com",
  "password": "demo-password"
}
```

**Response:**

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

**Possible errors:**

```json
{
  "error": "Invalid credentials"
}
```

---

## Trip APIs

### GET `/api/trips`

**Response:**

```json
{
  "trips": [
    {
      "id": "trip_4",
      "name": "San Diego Weekend",
      "destination": "San Diego",
      "startDate": "2026-06-05",
      "endDate": "2026-06-07",
      "participantCount": 3,
      "expenseCount": 2,
      "budget": {
        "mode": "total",
        "amount": 900
      }
    }
  ]
}
```

---

### POST `/api/trips`

**Request:**

```json
{
  "name": "San Diego Weekend",
  "destination": "San Diego",
  "startDate": "2026-06-05",
  "endDate": "2026-06-07",
  "organizerId": "user_1"
}
```

**Response:**

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
    "budget": null,
    "expenses": []
  }
}
```

---

### GET `/api/trips/:tripId`

**Response:**

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
        "email": "alex@example.com"
      }
    ],
    "budget": {
      "mode": "total",
      "amount": 900
    },
    "expenses": []
  }
}
```

---

## Participant APIs

### POST `/api/trips/:tripId/participants`

**Request option 1:**

```json
{
  "userId": "user_2"
}
```

**Request option 2:**

```json
{
  "name": "Sam Traveler",
  "email": "sam@example.com"
}
```

**Response:**

```json
{
  "trip": {
    "id": "trip_4",
    "participantIds": ["user_1", "user_2"]
  }
}
```

---

## Budget APIs

### POST `/api/trips/:tripId/budget`

**Request:**

```json
{
  "mode": "total",
  "amount": 900
}
```

**Or:**

```json
{
  "mode": "per-person",
  "amount": 300
}
```

**Response:**

```json
{
  "trip": {
    "id": "trip_4",
    "budget": {
      "mode": "total",
      "amount": 900
    }
  }
}
```

**Future expected budget summary:**

```json
{
  "mode": "total",
  "amount": 900,
  "totalBudget": 900,
  "totalSpent": 540,
  "remainingBudget": 360,
  "overBudgetAmount": 0
}
```

---

## Expense APIs

### POST `/api/trips/:tripId/expenses`

**Request:**

```json
{
  "title": "Hotel",
  "amount": 450,
  "category": "lodging",
  "type": "shared",
  "payerId": "user_1",
  "includedParticipantIds": ["user_1", "user_2", "user_3"]
}
```

**Response:**

```json
{
  "trip": {
    "id": "trip_4",
    "expenses": [
      {
        "id": "expense_5",
        "title": "Hotel",
        "amount": 450,
        "category": "lodging",
        "type": "shared",
        "payerId": "user_1",
        "includedParticipantIds": ["user_1", "user_2", "user_3"],
        "createdAt": "2026-05-13T00:00:00.000Z"
      }
    ]
  }
}
```

---

### DELETE `/api/trips/:tripId/expenses/:expenseId`

**Response:**

```json
{
  "trip": {
    "id": "trip_4",
    "expenses": []
  }
}
```

**Possible errors:**

```json
{
  "error": "Expense not found"
}
```

---

## Balance APIs

### GET `/api/trips/:tripId/balances`

**Response:**

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

---

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

Budget modes should use values from `shared/contracts.js`:

```text
total
per-person
```