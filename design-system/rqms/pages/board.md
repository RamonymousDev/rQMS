# Design System Override — Public Board (`/board/[code]`)

> Overrides `design-system/rqms/MASTER.md`. Everything not listed here follows MASTER.

**Context:** wall-mounted / stand-mounted display on a production line. Read from 2–5 metres, often at
an angle, often by someone walking past. Not a desktop screen.

## Overrides

| Rule          | MASTER      | Board                                                       |
| ------------- | ----------- | ----------------------------------------------------------- |
| Body text     | 16pt        | ≥ 24pt for part numbers and status                          |
| Status label  | icon + text | icon + text, **plus** color — the badge is the primary read |
| Touch targets | ≥ 44 px     | N/A (read-only display, no interaction except date nav)     |
| Density       | 9/10        | 7/10 — fewer rows, more padding per row                     |
| Theme         | user theme  | User theme, **no forced dark**. Some lines run bright halls |

## Grid

- Minimum column width ~180 px so a `64300` part number never truncates.
- Row height generous enough that status reads without squinting.
- Empty rows stay in place showing `—` (Master: never remove structure to hide missing data). Parts come
  from **active configs**, not from inspections, so an empty badge is normal, not an error state.

## Status badge on the board

This is the single most important element on the page.

- Colour is the fast channel (green / red / grey), icon + text is the accurate channel.
- Both light and dark fills are already specified in MASTER §1 — do not use opacity-only variants.
- Cross-fade 150 ms on SSE update so a glance registers the change.

## Live update

- SSE pushes `init` / `update`. Render the new state directly — no loading spinner between events.
- If the stream errors, keep the last rendered board visible and show a small disconnected indicator.
  Never blank the board: it is a shared reference screen.
- The server sends `date` / `today` in the payload. Never compute the operational date in the browser —
  the browser timezone is not WIB.

## Verification

- Readable at 2 m: screenshot at 1080p, check part numbers and status labels without zooming.
- Check both light and dark against a real-ish background, not against a white page.
