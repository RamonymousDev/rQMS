# Design System Override — Login (`/login`)

> Overrides `design-system/rqms/MASTER.md`. Everything not listed here follows MASTER.

**Context:** one page, used at shift change. NIK + password. Often in a hurry, often on a shared
tablet. Also the most attacked page in the app.

## Overrides

| Rule    | MASTER          | Login                                              |
| ------- | --------------- | -------------------------------------------------- |
| Density | 9/10            | 5/10 — a single centred card, breathing room       |
| Motion  | 150–200 ms      | 200 ms on the card only; nothing animates on mount |
| Layout  | dense dashboard | Single card, max-width ~400 px, vertically centred |

## Rules

- `NIK` → `autocomplete="username"`, inputmode numeric. `password` → `autocomplete="current-password"`.
- **Never block paste.** Password managers must work (WCAG 2.2 AA, accessible authentication).
- Both fields ≥ 48 px tall.
- Submit shows loading → success/error. A failed attempt must clear the password field and keep the NIK
  populated — re-typing both is pointless.
- No "remember me", no "show password" requirement, no CAPTCHA unless rate limiting is bypassed.

## Error handling

Only failed attempts are rate limited (5/account/15 min, 50/IP/15 min). The failure message is
**identical** for wrong password, unknown NIK, and inactive account — a different message tells an
attacker which NIKs exist. Style the error as a form-level `Alert` bound to the fieldset, focusable, and
keep it in the DOM after the failed submit so a screen reader announces it on the next error.

Do not display the attempt counter or the lockout state; it leaks how close a credential is to valid.

## Branding

Centre the rQMS mark above the card. Product identity only — no marketing hero, no feature list, no
footer navigation. Nothing that distracts from two input fields.

## Verification

- Paste a password from a manager and from the clipboard — both must work.
- Test with a screen reader: the error must be announced, not just coloured.
- Test at 375 px: the card must not clip and the keyboard must not cover the submit button.
