# Task 02: Wallet Service Core

## Priority
Critical

## Goal
Implement the wallet bounded context as the balance authority for the system. This service must safely create wallets, expose the authenticated player's balance, and process debit/credit operations coming from async messages.

## Depends On
- `01-domain-and-architecture-foundation.md`

## Scope
- Persist wallets and wallet transactions
- Create wallet for authenticated player
- Return current wallet state for authenticated player
- Consume debit and credit messages
- Enforce idempotent transaction handling
- Protect against negative balances

## Deliverables
- Wallet entities, repositories, and migrations
- REST endpoints:
  - `POST /wallets`
  - `GET /wallets/me`
- Message consumers for bet debit and cashout credit
- Transaction ledger or equivalent audit table
- Unit tests for wallet domain rules

## Data Model

### Tables
- `wallets`
  - `id`
  - `player_id` unique
  - `balance_cents`
  - `currency`
  - `created_at`
  - `updated_at`
  - optional `version` for optimistic locking
- `wallet_transactions`
  - `id`
  - `wallet_id`
  - `type`
  - `amount_cents`
  - `reference_type`
  - `reference_id`
  - `correlation_id`
  - `metadata`
  - `created_at`
  - unique constraint for idempotency keys

## Functional Rules
- A player can have exactly one wallet.
- Wallet creation must be idempotent from the API perspective.
- Debits fail if balance is insufficient.
- Credits and debits must be idempotent under message retries.
- Every mutation must leave an auditable transaction record.

## Message Handling Plan
- Consume a `bet.debit.requested` style message.
- Check idempotency using `correlationId` or `transactionReference`.
- If funds are sufficient:
  - create debit transaction
  - update balance
  - publish `bet.debit.succeeded`
- If not:
  - publish `bet.debit.failed`
- Consume a `bet.cashout.credit.requested` style message.
- If not already processed:
  - create credit transaction
  - update balance
  - publish `bet.cashout.credit.succeeded`

## Implementation Steps
1. Add ORM and migrations for wallet tables.
2. Implement `Money` and transaction reference value objects if not already shared.
3. Build domain methods for `create`, `debit`, and `credit`.
4. Add application handlers for wallet creation and wallet queries.
5. Add broker consumers and publishers with explicit message schemas.
6. Add authentication guard and user extraction from JWT claims.
7. Seed a test player wallet or create it lazily on first use.

## Error Cases To Handle
- Duplicate wallet creation
- Insufficient balance
- Duplicate broker delivery
- Credit request for unknown wallet
- Malformed message payloads

## Testing Plan
- Unit tests:
  - create wallet
  - reject second wallet creation
  - debit success
  - debit insufficient funds
  - duplicate debit message is ignored safely
  - credit is idempotent
- Integration or e2e:
  - `POST /wallets`
  - `GET /wallets/me`
  - broker-driven debit and credit flow

## Acceptance Criteria
- Wallet balances are stored without floating point.
- No sequence of valid operations can create a negative balance.
- Async debit/credit processing is idempotent.
- `GET /wallets/me` reflects the latest committed balance.
- The service is independently testable without the game engine running.
