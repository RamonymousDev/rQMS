# Design System Override — Dashboard (`/dashboard`)

> Overrides `design-system/rqms/MASTER.md`. Everything not listed here follows MASTER.

**Context:** admin-facing. Opened at the start of a shift to see where things stand, and glanced at
between tasks. Read on a desktop monitor, sometimes on a tablet.

## Overrides

| Rule              | MASTER  | Dashboard                                        |
| ----------------- | ------- | ------------------------------------------------ |
| Density           | 9/10    | 9/10 — stat rows and tables stay dense           |
| Metric type scale | 32pt H1 | 24–30pt for the big numbers, `tabular-nums`      |
| Chart count       | —       | 2 maximum: OK/NG donut + 7-day operational trend |

## Layout order

1. Line summary cards — one per line the user can access
2. Stat row — total, today's count, 7-day trend
3. OK / NG donut
4. 7-day operational trend bar chart
5. Recent inspections list

Metric → trend → detail. Never put the chart above the numbers the operator came for.

## Charts

LayerChart via `$lib/components/ui/chart/index.js`:

```ts
import * as Chart from '$lib/components/ui/chart/index.js';
import { BarChart, PieChart } from 'layerchart';
```

- Every chart sits in `<Chart.Container config={...}>` — the config supplies label + `theme: { light, dark }`
  and `ChartStyle` injects the scoped `--color-<key>` variable. Tooltip via `<Chart.Tooltip />`
  (or `hideLabel` for the donut).
- PieChart: `cDomain` + `cRange` override per-slice colour, `innerRadius` for the donut.
- BarChart: `seriesLayout="group"` with `series` as `[{ key, label, color }]`; each bar's value follows the
  column named `key` (`x1`/`y1` fall back to `s.value ?? s.key`).
- Donut slices use the reserved status tokens — green `OK`, red `NG`. Do not substitute the brand accent.
- The 7-day trend is **operational days**, not calendar days. The chart must reflect what the server sent
  (`getDashboardStats`), never a client-side week calculation.

## Zero and empty states

- `total === 0` or `today === 0`: show the value with a muted label, not an illustration or an error.
  An empty dashboard on a fresh install is a normal state.
- The 7-day trend legitimately has gaps on days with no production. Let the bars be absent; do not
  interpolate zeros across them.

## Auto-refresh

Polling every 30 s against `/api/dashboard`. SSR load is the initial data, so the first paint must not
show a skeleton. When refresh lands, swap values without a flash — a 150 ms fade on the number, no
layout shift, no re-render of the whole page.

## Verification

- Check the donut and bar chart in both themes; the `--color-<key>` injection is per-container, so verify
  the chart reads correctly on a dark sidebar background.
- Confirm no layout shift when the 30 s poll returns new counts.
