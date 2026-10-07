# Design System Override — Admin CRUD & Reports

> Overrides `design-system/rqms/MASTER.md`. Everything not listed here follows MASTER.

**Applies to:** `/admin/permissions`, `/admin/processes`, `/admin/lines`, `/admin/parts`,
`/admin/hardwares`, `/admin/users`, `/admin/configs`, `/admin/inspections`, `/admin/audit`

**Context:** desktop-only admin work. Session-length data entry with reference lookups. Users here have a
mouse and a keyboard, so this is the one place where density beats touch comfort.

## Overrides

| Rule          | MASTER  | Admin                                                 |
| ------------- | ------- | ----------------------------------------------------- |
| Density       | 9/10    | 10/10 — table rows can go tight                       |
| Touch targets | ≥ 44 px | ≥ 32 px (desktop pointer)                             |
| Row padding   | --      | Compact, but line-height ≥ 1.5 so rows stay scannable |

## CrudPage

All master pages go through `src/lib/components/admin/crud-page.svelte`. Do not hand-roll per-entity
tables. Props: `title`, `description?`, `endpoint`, `columns`, `fields`, `searchKeys?`, `toForm?`.

Supported `CrudField.type`: `text`, `password`, `select`, `checkbox`, `switch`, `checkbox-group`.

**`optionLabel` is mandatory** for entities without a `code`/`name` column (parts, hardwares):

```ts
optionLabel: (row) => `${row.partNo} — ${row.partName}`;
```

Without it every `option.value` is `undefined` and Svelte throws `each_key_duplicate`.

## Tables

- Zebra striping off. Use a hairline row border — striping fights the border density at this scale.
- Numeric columns right-aligned with `tabular-nums`.
- Long identifiers (`64300`, line codes) in `font-mono`, never truncated without a tooltip.
- Column header carries the sort affordance; sorted column gets `aria-sort`.
- Filter row above the table, not inside a dropdown — admins re-run the same filters constantly.

## Inspections report

- Status filter chips use the reserved status tokens.
- Row click opens the detail sheet; the row itself must be keyboard-activatable (`Enter` / `Space`) and
  expose the state, not just colour.
- `dateFrom` / `dateTo` are **operational** dates (§15 of `AGENTS.md`). The date picker must not imply
  calendar days — a night shift starting at 20:00 belongs to that date, and a 01:00 inspection belongs to
  the previous one. Label the field accordingly.

## Audit log

Read-only. Never offer edit or delete affordances — the append-only nature is the feature. Timestamp
column shows WIB explicitly, since audit is calendar-day based, not shift based.

## Users page

- Password field uses `type="password"` with a reveal toggle and a strength hint matching the server rule:
  min 8 chars, upper, lower, digit, symbol.
- New password must be `autocomplete="new-password"`; login uses `autocomplete="current-password"`.
- Paste is never blocked.

## Configs page

- The `isActive` switch triggers a toggle-only PATCH (`{ isActive }`) — not a full payload.
- Part/line combination is locked after creation. Show it read-only on edit; the API returns 409 on a
  duplicate attempt and that message should be surfaced, not swallowed.

## Verification

- Keyboard-only pass: tab through filters, table, and dialog. Focus order must match visual order.
- 409/422 errors must render as inline messages with the field still focused, not a bare toast.
