# Design System Override — Inspect Wizard (`/inspect`)

> Overrides `design-system/rqms/MASTER.md`. Everything not listed here follows MASTER.

**Context:** the highest-stakes screen in the product. An operator fills this while holding a part,
possibly wearing gloves, possibly on a phone clipped to a line. An incorrect value becomes a quality
record that gets snapshotted and audited.

## Overrides

| Rule          | MASTER      | Inspect                                                   |
| ------------- | ----------- | --------------------------------------------------------- |
| Control size  | `size="lg"` | `size="lg"` **mandatory**, not a default                  |
| Touch targets | ≥ 44 px     | ≥ 48 px — gloves, and the operator is not looking closely |
| Density       | 9/10        | 6/10 inside form steps — one decision per screen          |
| Motion        | 150–200 ms  | 150 ms; no transitions during typing                      |

## Step structure

Three steps, one decision each:

1. **Line** — only lines the user has permission for (`/api/inspect/lines`)
2. **Part + Stage** — manual entry or QR scan, then `START` / `MIDDLE` / `END`
3. **Dynamic form** — rendered from the config: spot / point / hardware / length / visual

Do not merge steps. Do not add cross-step shortcuts that bypass `prepare`.

## Numeric entry

- Hardware and length inputs: `inputmode="decimal"` / `inputmode="numeric"`.
- Satu hardware dapat memiliki beberapa titik pengecekan (`qty`); setiap titik punya input Actual + badge
  sendiri dengan label `hwNo (hwName) Tipe #nomor`, tetapi memakai Standard/Unit yang sama.
- Values render with `tabular-nums` so the operator can compare actual vs standard at a glance.
- Standard value is read-only and always shown next to the input. The operator never types a standard —
  standards come from the config and are evaluated server-side.

## NG state

The most important visual moment in the app:

- NG is filled red + triangle icon + "NG" label. Never a red border alone.
- Remarks become **required** the moment an item is marked NG, and the requirement must be stated
  inline, not only after submit fails.
- One NG anywhere sets the overall result to NG. Show that clearly at the sticky footer before submit.

## Dirty state & draft

- `isDirty` gates navigation: `beforeNavigate` must call `cancel()` first, before any state change.
- The draft persists to `localStorage`; restore only after server data has loaded.
- The submit footer is sticky. Scroll content must have bottom padding equal to the footer height so the
  last row is never trapped underneath it.

## Submit feedback

Loading → success toast / error toast, every time. The re-check dialog (409 path) must reopen cleanly
if a race condition occurs after submit.

## Verification

- Complete a full inspection with one hand / with gloves — controls must still be hittable.
- Force an NG on a hardware item and confirm the remarks requirement is obvious before submitting.
- Confirm the sticky footer never covers the final input on a 375 px viewport.
