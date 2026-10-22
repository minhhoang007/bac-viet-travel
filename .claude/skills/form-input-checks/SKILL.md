---
name: form-input-checks
description: Checklist of the bad input and form behaviour that commonly break web forms (empty, spaces only, too long, wrong format, impossible dates, double submit, lost text, errors not tied to the field, junk URL parameters) and how this repo tests them. Use when adding or changing a form, a server action that takes user input, or a route that reads URL parameters.
---

# Form and input checks

The browser is not a check: `required`, `type="email"` and `maxLength` vanish for anyone posting to the server action
directly. Every rule below must hold **on the server**; the form only makes the message friendly. Forms post with
`noValidate` so the server's localized message is the one people see.

## 1. Input: what the server must refuse (or clean)

| Case | Examples | Expected |
|---|---|---|
| Empty | `""`, field missing from FormData | field error `required` (not "invalid", not "wrong password") |
| Spaces only | `"   "`, `"\n"` | `.trim()` before `.min(1)` → `required` |
| Spaces around | `" a@b.vn "` | trimmed, accepted |
| Too long | 101 chars in a 100 field, 1 MB note | `too_long`; every string has a `.max()` |
| Email | `x`, `a@`, `a b@c.vn` | `invalid_email`; trim first, compare lower case |
| Phone | `abc`, `--------`, `((((((((`, 7 digits | `invalid`: pattern **and** ≥ 8 digits (`hasPhoneDigits`) |
| Numbers | `""`, `-1`, `1.5`, `0` where 1 is the minimum, above the max | `invalid` (`z.coerce.number().int().min().max()`) |
| Dates | `2027-02-31`, `2027-13-01`, `2027-1-1`, `tomorrow` | `invalid` (`isCalendarDay` / `calendarDay`); never pattern-only, or Postgres refuses it later as a 500 |
| Dates in time | past day, inside the booking cutoff, more than a year ahead | the rule's own code (`past_date`, …) |
| Choices | a value not in the list (`channel=fax`, `locale=fr`) | `.catch(default)` or `invalid`, never stored as is |
| Ids | `abc` where a uuid is expected | `z.uuid()` first → `not_found`; no Postgres "invalid input syntax" |
| Markup | `<script>alert(1)</script>`, `'; drop table` | stored as text, shown escaped (React, `escapeHtml` in emails); never `dangerouslySetInnerHTML` with user text |
| Unicode | `Nguyễn Văn Ánh`, emoji | accepted, length counted as typed |
| Honeypot | `website` filled | treated as a bot (quiet success, nothing sent) |

## 2. Form behaviour

- Error **under the field** with `aria-invalid` + `aria-describedby` (`FormField error=`), whole-form errors in
  `FormError` (`role="alert"`). Focus moves to the first invalid field on long forms (booking form does this).
- **Typed text survives an error.** React 19 resets a form after each action (the contact and inquiry forms lost
  everything until 2026-10): `onSubmit={keepValuesOnSubmit(formAction)}` (`components/forms/keep-values.ts`, with
  `FormPendingContext` for `SubmitButton`), or keep values in state (`value` + `onChange`), or send them back as
  `defaultValue`. Password fields may clear.
- **Double submit:** use `SubmitButton` (disabled while pending). Money flows also need an idempotent server.
- **Turnstile** resets after every server answer (`answer={state}`), or the second try fails with `captcha`.
- Same answer for "unknown account" and "wrong password", for "unknown booking" and "wrong token"; empty fields may
  be named (nothing to hide).
- Every message exists in `vi` and `en` content.
- Rate-limited actions answer `rate_limited` with a message, not a crash.

## 3. URLs and routes

- Junk query parameters (`?date=2027-13-45`, `?guests=-5`, `?date[]=1`, `?page=abc`) are ignored or answer 400,
  **never 5xx**. A 503 is for a real outage only; it also pages whoever watches the logs.
- Unknown slugs and codes → 404 (or a `noindex` "not found" page where the answer must not reveal what exists).

## 4. How this repo tests it

| Layer | Where | What |
|---|---|---|
| Schema / service | `product/**/tests/*.test.ts` | table of bad values per field → exact field error codes |
| Server action without the browser | E2E with `noValidate` forms, or service tests | the server alone refuses |
| Form behaviour | `tests/e2e/form-validation.spec.ts` | empty submit per form, message under the field, `aria-invalid`, text kept |
| Junk URLs | `tests/e2e/form-validation.spec.ts` | public routes answer < 500 |
| Accessibility | `form-validation.spec.ts` and page specs (`@axe-core/playwright`) | no serious/critical violations, also while a form shows its errors |

New form or input route → add its row to `form-validation.spec.ts` and its bad values to the schema test, in the same
PR. Write the failing test first (`tdd-critical-flows`).
