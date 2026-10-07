# product/booking — rules for agents

Money, seats and payments live here. Treat every change as critical (R4): plan first, integration tests for the
failure paths, and never merge without the owner.

## Domain rules
- **Statuses:** the lifecycle table in `lifecycle.ts` is the only definition. Check a status with `isSold`,
  `canMove`, `awaitsDeposit`; filter a status update with `inArray(bookings.status, canBecome(to))`. Never write
  status lists such as `["deposit_paid", "confirmed"]` by hand.
- **Seats:** "takes seats" is `takesSeats(at)` (or `takesSeatsB(at)` in a subquery over `bookings b`) from `status.ts`.
  Every seat check runs in a transaction that first locks the departure row (`for("update")`), departure before
  booking, so holds, payments and staff entries never oversell or deadlock.
- **Money:** integers in VND, rounded up to 1 000 (`rules.ts`). Prices and quotes come from `quote()` /
  `privateQuote()`; discounts from `applyDiscount()` (max 90%).
- **Payments:** a payment attempt is settled exactly once, in `settle()` (`deposits.ts`): claim the pending row
  first, then record. Money that arrives is never lost: it becomes `deposit_paid`, `refund_due` or extra owed back.
- **Time:** Vietnam days with `vietnamToday` / `vietnamDayStart` (`rules.ts`); never `new Date().toISOString()` days.
- **Schema changes:** new migration in `db/migrations/product/`, run on production before the code that needs it
  is merged (expand first, contract later).

## Where things go
- Pure rules (client-safe, no Drizzle): `rules.ts`, `lifecycle.ts`.
- Database work: `service.ts` (guest), `deposits.ts` (payments), `admin.ts` / `admin-departures.ts` (staff),
  `discounts.ts`, `feedback.ts`, `reports.ts`.
- Text: `content.ts`, `admin-content.ts`, `discount-content.ts` (vi first, en typed from it).
- Tests: `tests/*.test.ts` (pure), `tests/*.int.test.ts` (Postgres). Run `pnpm test:int` after any change here.
