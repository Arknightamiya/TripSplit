# TripSplit

TripSplit is a CS130 project web application for shared travel budgeting and fair expense splitting.

It is designed for small groups traveling together, such as friends, roommates, student clubs, or campus organizations. The goal of TripSplit is to help a group create a trip, set a budget, record shared expenses, track spending during the trip, and calculate final balances for each participant.

## Team

Team Name: XZWSD


## Project Motivation

Group travel often creates financial confusion. Before a trip, travelers may agree on a total budget or a per-person budget. During the trip, different people may pay for hotels, food, transportation, tickets, drinks, or emergency purchases.

Without a shared system, groups often rely on spreadsheets, notes, or chat messages. These methods can become hard to maintain and may lead to mistakes when calculating who paid for what and who still owes money.

TripSplit provides one shared place for trip budgeting, expense tracking, and final settlement calculation.

## Core Features

The MVP focuses on four main workflows:

1. Create a trip

   A trip organizer can create a trip with a name, destination, start date, and end date. The organizer can invite or add other participants.

2. Set a budget

   The trip organizer can set either a total trip budget or a per-person budget. The system tracks total spending, remaining budget, and over-budget amount.

3. Record shared expenses

   A trip participant can record an expense by entering the title, amount, category, payer, expense type, and selected participants included in the split.

4. View final balances

   Each participant can view their actual paid amount, fair share amount, and final net balance. A positive balance means the participant paid more than their fair share, while a negative balance means the participant paid less than their fair share.

## Non-Goals

TripSplit does not include the following features in the MVP:

- Integrated payment processing
- Direct money transfer
- Automatic charging
- Long-term household budgeting
- Recurring shared bills outside a trip context
- Social media-style interaction features

Actual payment or money transfer should be completed through external tools such as banking apps, Venmo, Zelle, or credit/debit cards.

## Tech Stack

Planned technology stack:

- Frontend: React
- Backend: Node.js with Express
- Database: PostgreSQL
- Authentication: JWT-based authentication
- API Style: REST API
- Testing:
  - Unit tests for settlement logic
  - Integration tests for core API workflows

## Main Data Model

The main system entities are:

- User
- Trip
- TripParticipant
- Budget
- Expense
- ExpenseShare
- SplitRule
- BalanceSummary

The core settlement formula is:

net balance = actual paid amount - fair share amount

A positive net balance means the participant paid more than their fair share.

A negative net balance means the participant paid less than their fair share.

## Planned REST APIs

The system will use REST APIs between the React frontend and Express backend.

Important planned endpoints include:

- POST /auth/register
- POST /auth/login
- GET /trips
- POST /trips
- POST /trips/{tripId}/participants
- GET /trips/{tripId}
- POST /trips/{tripId}/budget
- POST /trips/{tripId}/expenses
- GET /trips/{tripId}/balances
- DELETE /trips/{tripId}/expenses/{expenseId}

All private trip APIs require authentication. Users who are not approved participants should not be able to access or modify private trip data.


## How to Run the Project

This section will be updated after the frontend and backend are implemented.

Planned local development flow:

git clone https://github.com/Arknightamiya/TripSplit.git

cd TripSplit

Frontend setup will be added later.

Backend setup will be added later.
