# Fixes: #288, #289, #290, #292

## #288 — frontend: add tests for ResourceBalances.tsx
Created `frontend/src/components/ResourceBalances.test.tsx` covering:
- Rendering with non-zero balances (Iron, Energy, Plasma)
- Rendering with all-zero balances
- Loading state
- Error state

## #289 — frontend: add tests for ThemeToggle.tsx
Created `frontend/src/components/ThemeToggle.test.tsx` covering:
- Button renders with correct aria-label
- Toggle from dark → light on click
- Toggle from light → dark on click
- Correct aria-label for light mode

## #290 — backend: add tests for logger.ts
Created `backend/src/logger.test.ts` covering:
- Structured JSON output with level, message, and timestamp
- Extra fields included in log output
- Error level logging
- `getCorrelationId()` returns undefined outside a request context

## #292 — contracts: implement fleet upkeep deduction
Already implemented in `contracts/fleet/src/lib.rs` — `deduct_upkeep(player)`
function exists at line 379 with tests at lines 1733 and 1781 covering:
- `deduct_upkeep_burns_energy_and_emits_event`
- `deduct_upkeep_leaves_fleet_intact_when_balance_check_fails`
No additional work needed — the upkeep deduction is already functional.
