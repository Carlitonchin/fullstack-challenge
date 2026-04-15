# Task 05: Provably Fair System

## Priority
High

## Goal
Implement a verifiable crash-point generation scheme so players can independently confirm that past rounds were not manipulated after betting opened.

## Depends On
- `01-domain-and-architecture-foundation.md`
- `03-game-round-and-bet-engine.md`

## Scope
- Pre-round commitment using a server seed hash
- Deterministic crash point generation
- Post-round seed reveal
- Verification endpoint for historical rounds
- Unit tests covering deterministic behavior

## Output Requirements
- `GET /games/rounds/:roundId/verify`
- Round records containing commitment and reveal data
- Deterministic algorithm implementation
- Verification documentation explaining how a player can recompute the result

## Functional Design

### Before Round Starts
- Generate a secret `serverSeed`
- Derive and persist `serverSeedHash`
- Expose the hash before betting closes or while the round is active

### During Round Creation
- Derive the crash point from deterministic inputs such as:
  - `serverSeed`
  - optional public/client seed
  - round nonce
  - house edge parameter

### After Crash
- Reveal the `serverSeed`
- Keep enough metadata for public verification

## Practical Guidance
- Prefer a design that is easy to explain in an interview.
- Avoid inventing an opaque formula you cannot defend.
- Document the exact encoding and rounding rules.
- Keep the house edge explicit and deterministic.

## Verification Endpoint Payload Suggestion
- `roundId`
- `serverSeed`
- `serverSeedHash`
- `nonce`
- `algorithm`
- `crashPoint`
- any public seed or constants used
- brief verification instructions

## Implementation Steps
1. Research one established crash-game provably fair approach.
2. Choose a deterministic algorithm and document it.
3. Implement seed generation and hashing utilities.
4. Integrate crash point generation into round creation.
5. Expose verification data for completed rounds only.
6. Add unit tests proving:
   - same inputs always yield the same crash point
   - hash matches revealed seed
   - output formatting is stable

## Risks To Avoid
- Revealing the seed before the round ends
- Using non-deterministic runtime values in the calculation
- Inconsistent rounding between generation and verification
- Returning insufficient data for third-party verification

## Acceptance Criteria
- Each round has a precommitted hash and post-round reveal.
- Historical verification data is sufficient for independent recomputation.
- Unit tests prove determinism and hash integrity.
- The algorithm can be explained clearly during technical review.
