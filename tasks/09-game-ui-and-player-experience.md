# Task 09: Game UI and Player Experience

## Priority
Medium-High

## Goal
Turn the frontend shell into a complete playable interface with responsive controls, real-time updates, meaningful feedback, and a polished casino-style presentation.

## Depends On
- `08-frontend-foundation-and-auth-flow.md`

## Scope
- Crash chart animation
- Betting and cashout controls
- Current round bet feed
- Round history display
- Wallet and player identity display
- Loading, success, and error feedback

## UI Features To Implement

### Crash Chart
- Animated multiplier starting at `1.00x`
- Clear visual crash state
- Display pre-round seed hash while the round is active

### Betting Controls
- Stake input with min/max validation
- `Bet` button enabled only during betting window
- `Cash Out` button enabled only with an active confirmed bet
- Potential payout preview using current multiplier
- Countdown to betting close or round restart

### Social / Shared Game Data
- Live list of current round bets
- Distinct treatment for cashed-out players
- Recent round history with color coding for low/high crash outcomes

### Player Info
- current wallet balance
- current username
- current bet state and payout result

## Interaction Rules
- Never let the UI imply a successful bet before backend acceptance rules are satisfied.
- Differentiate between:
  - pending debit
  - confirmed bet
  - rejected bet
  - cashed out
  - lost on crash
- Treat WebSocket as the source of round progress and shared public state.

## Implementation Steps
1. Bind round snapshot and event stream to the chart and controls.
2. Implement form validation for money input.
3. Add request mutation states for betting and cashout.
4. Add toasts for insufficient funds, duplicate bet, and network failures.
5. Build responsive layouts for desktop and mobile.
6. Add tasteful animation for crash and cashout confirmation.

## Design Guidance
- Keep the visual direction intentional, not generic dashboard-like.
- Prioritize readability of the multiplier and user decision timing.
- Avoid over-animating critical controls.

## Acceptance Criteria
- A logged-in player can place a bet, observe the round, and cash out from the UI.
- Shared data updates live without page refresh.
- Error states are understandable and non-blocking.
- The page looks like a real product, not a raw admin panel.
