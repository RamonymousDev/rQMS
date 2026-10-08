# Design System Master File — rQMS

> **LOGIC:** When building a specific page, first check `design-system/rqms/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** rQMS — Quality Management System (manufaktur, inspection & monitoring)
**Generated:** 2026-10-07
**Stack:** SvelteKit (Svelte 5 runes) · Tailwind CSS v4 · shadcn-svelte (style `sera`) · bits-ui · `@lucide/svelte` · LayerChart
**Design Dials:** Variance 3/10 (Centered / Minimal) · Motion 2/10 (Subtle) · Density 9/10 (Dense / Dashboard)

---

## 0. Product Context (drives every rule below)

rQMS is an **internal operations tool**, not a marketing product. Three realities shape it:

| Context                                                                        | Consequence for design                                                        |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Operators use it on a tablet/phone at a production line, sometimes with gloves | Touch targets ≥ 44 CSS px, generous hit area, no hover-only affordances       |
| Status is binary and consequential: `OK` / `NG`                                | Status color is reserved, never decorative. Always paired with an icon + text |
| The public `/board/[code]` page is displayed on a line TV from metres away     | Board typography scales up, status must read at a glance, works in dark mode  |

**Rejected baseline output:** the generated default pattern was "Hero + Features + CTA" with GSAP scroll
reveals. Both are wrong here — no marketing hero, no scroll choreography, and GSAP is not a project
dependency. Motion here is 150–200 ms state transitions only.

---

## 1. Color Palette

Aksen tunggal: **indigo elektrik**. Hijau/merah/kuning hanya untuk status hasil
inspeksi, tidak pernah untuk dekorasi.

### Surface — 3 level, wajib berbeda jelas

Tabel di bawah adalah nilai yang BENAR-BENAR dipakai di `src/routes/layout.css`.
Dihitung dari OKLCH, bukan dikira-kira.

| Token          | Light                    | Dark                     | Peran    |
| -------------- | ------------------------ | ------------------------ | -------- |
| `--background` | `oklch(0.985 0.002 265)` | `oklch(0.145 0.008 265)` | halaman  |
| `--card`       | `oklch(1 0 0)`           | `oklch(0.185 0.01 265)`  | panel    |
| `--popover`    | `oklch(1 0 0)`           | `oklch(0.25 0.012 265)`  | elevated |

Di dark, ketiga level harus berbeda. Sebelumnya `--popover` bernilai SAMA dengan
`--card`, sehingga tidak ada permukaan "terangkat" sama sekali.

### Aksen & fill

| Token                  | Light                    | Dark                     |
| ---------------------- | ------------------------ | ------------------------ |
| `--primary`            | `oklch(0.50 0.21 272)`   | `oklch(0.55 0.20 272)`   |
| `--primary-foreground` | putih                    | putih                    |
| `--ring`               | = `--primary`            | = `--primary`            |
| `--border`             | `oklch(0.9 0.006 265)`   | `oklch(1 0 0 / 9%)`      |
| `--muted`              | `oklch(0.965 0.004 265)` | `oklch(0.23 0.01 265)`   |
| `--accent`             | `oklch(0.945 0.006 265)` | `oklch(0.275 0.014 265)` |
| `--radius`             | `0.5rem`                 | `0.5rem`                 |

`--ring` sengaja disamakan dengan `--primary`: dua warna aksen (biru + teal)
sebelumnya membuat fokus dan aksi terlihat seperti dua sistem berbeda.
`--muted` dan `--accent` juga dipisah — sebelumnya berbagi satu nilai.

### Kontras — sudah dihitung, jangan diturunkan tanpa hitung ulang

Rasio dihitung dari OKLCH (WCAG 2.1), tema dark:

| Pasangan                                             | Rasio                  |
| ---------------------------------------------------- | ---------------------- |
| teks body `0.97` di atas background / card / popover | 18.15 / 17.09 / 15.68  |
| `--muted-foreground` `0.62` di atas `--card`         | **5.12** (AA, min 4.5) |
| `--primary` `0.55` + teks putih                      | **5.14** (AA)          |
| pill OK / NG / warning (teks di atas tint)           | 8.97 / 6.56 / 9.41     |

Dua jebakan yang sudah pernah gagal dan jangan diulang:

- `--primary` `L=0.62` + teks putih hanya **3.72:1** — GAGAL AA, harus `L<=0.55`.
- `--muted-foreground` `L=0.58` di atas card hanya **4.35:1** — di bawah AA.

### Status tokens (reserved — tidak pernah dekoratif)

| Status          | Light                  | Dark                    | Selalu disertai             |
| --------------- | ---------------------- | ----------------------- | --------------------------- |
| `--status-ok`   | `oklch(0.48 0.13 152)` | `oklch(0.82 0.15 152)`  | ikon centang + label "OK"   |
| `--status-ng`   | `oklch(0.5 0.19 25)`   | `oklch(0.78 0.16 25)`   | ikon segitiga + label "NG"  |
| `--status-warn` | `oklch(0.5 0.13 75)`   | `oklch(0.86 0.14 80)`   | ikon kunci + label "Repair" |
| `--status-idle` | `oklch(0.5 0.012 265)` | `oklch(0.62 0.015 265)` | "Belum ada data"            |

Semua status punya pasangan `-fill` (versi transparan) untuk background pill.
Pill memakai **tint + teks + dot**, bukan blok warna solid — solid menutupi teks
dan tidak terbaca dari monitor yang jauh.

Pakai komponennya, jangan tulis ulang:

```svelte
<script lang="ts">
	import StatusBadge from '$lib/components/status-badge.svelte';
</script>

<StatusBadge status={inspection.overallStatus} />
<!-- OK / NG -->
<StatusBadge status={stage.status} size="sm" />
<!-- pill padat untuk tabel -->
<StatusBadge status={null} />
<!-- "Belum ada data" -->
```

Jangan pernah menulis `text-green-*` / `bg-red-*` langsung: itu melewati token
dan akibatnya kontras dark mode berbeda antar layar.

### Utility

`card-edge` — highlight tipis di tepi atas card, memberi kedalaman tanpa shadow:

```svelte
<Card.Root class="card-edge">...</Card.Root>
```

`header-glow` — glow radial tunggal di belakang header, opacity maks 10%.
Jangan TResultkan glow di tempat lain; itu yang bikin UI terasa neonslop.

### Tailwind source exclusions (jangan dihapus)

`src/routes/layout.css` memuat:

```css
@source not '../../design-system';
@source not '../../.agents';
```

Tailwind v4 memindai seluruh project (kecuali yang di-ignore git) termasuk
`.md` dan `.json`. Tanpa dua baris ini, snippet class di `design-system/**/*.md`
dan `.agents/skills/**/*.json` ikut ter-generate jadi CSS produksi — utility
yang tak terpakai tetap terkirim ke user. Tetap pertahankan saat menambah folder doc.

### Dark mode

Dark-first is valid here (line TVs and dim factory floors), but every token pair must be checked
independently — light-mode values do not carry over.

- Body text ≥ 4.5:1 on both backgrounds; 3:1 only for large text or non-text UI.
- Borders/dividers visible in **both** themes (dark uses `oklch(1 0 0 / 10%)`, light uses solid `#E4E7EB`).
- Define pressed/hover/focus/disabled states for both themes, not just one.
- Never hardcode a hex per screen — always go through the semantic token.
- Board follows the user's theme; it does **not** force dark.

---

## 2. Typography

Verified source: `typography.csv` → _Modern Dark Cinema (Inter System)_, matched to the existing
`@fontsource-variable/inter` import. Do **not** swap in the generated Outfit / Work Sans pairing —
Inter is already loaded and tuned, and re-adding a font costs payload on a factory tablet.

- **Family:** `Inter Variable` (single family, already in `layout.css` `--font-sans`)
- **Display 48pt:** weight 700, tracking −1.5
- **H1 32pt:** weight 600, tracking −0.5
- **H2 24pt:** weight 600
- **Body 16pt:** weight 400
- **Labels:** weight 500, uppercase, tracking +1.2

**Numeric data:** always `tabular-nums` on measured values (mm tolerances, counts, percentages) so
columns align and operators can scan for out-of-spec numbers.

**Tabular data pattern:** part numbers (`64300`), hardware numbers, inspection IDs, and mm values are
identifiers being read aloud and typed. Use `font-mono` / tabular figures for these so `1` vs `l` and
`0` vs `O` cannot be confused, and never lowercase or transform identifiers.

---

## 3. Spacing (Density 9/10)

| Token         | Value              | Usage                     |
| ------------- | ------------------ | ------------------------- |
| `--space-xs`  | `2px` / `0.125rem` | Tight gaps                |
| `--space-sm`  | `4px` / `0.25rem`  | Icon gaps, inline spacing |
| `--space-md`  | `8px` / `0.5rem`   | Standard padding          |
| `--space-lg`  | `12px` / `0.75rem` | Section padding           |
| `--space-xl`  | `16px` / `1rem`    | Large gaps                |
| `--space-2xl` | `24px` / `1.5rem`  | Section margins           |
| `--space-3xl` | `32px` / `2rem`    | Hero padding              |

Dense does **not** mean cramped. Two hard minimums override the scale:

- Touch targets ≥ 44 × 44 CSS px (WCAG 2.5.5), with ≥ 8 px (`gap-2`) between adjacent targets.
- Operator form controls (`Button`, `Input`, `Select`, checkboxes) use `size="lg"`, not `sm`.

---

## 4. Motion

Low-motion tier. Transitions only, no choreography.

| Level               | Value        | Usage                    |
| ------------------- | ------------ | ------------------------ |
| `--transition-fast` | `150ms ease` | Hover, focus, badge swap |
| `--transition-base` | `200ms ease` | Dialog, sheet, dropdown  |

- Pressed states change color/opacity/elevation — **never** `transform: translateY()` or `scale()`,
  which shift neighbouring layout and cause jitter on a tablet.
- Respect `prefers-reduced-motion: reduce` and render the final state immediately.
- Board status changes cross-fade over 150 ms so a TV observer notices the delta.

---

## 5. Component Rules (shadcn-svelte, not custom CSS)

Use the existing primitives in `src/lib/components/ui/` — do not hand-roll equivalents.

- Icons: `@lucide/svelte` only. No emoji as structural icons. Decorative icons next to visible text get
  `aria-hidden="true"`; icon-only controls need an accessible name and expose selected/pressed state.
- Icons inherit size from the parent component — do not add `size-*` overrides.
- Inputs: real `<label>` bound to every field; `autocomplete="current-password"` on login and allow paste.
- Forms: show loading → success/error. On multi-error submit, focus a linked error summary; failed
  submissions retain inline field errors.
- Disabled controls use the native `disabled` attribute and read as non-interactive.

### Status badge (OK / NG)

Never color alone. Use the shared component — it renders color + icon + text label together, and
handles the `IDLE` (no data) case that the board shows on empty operational days:

```svelte
<script lang="ts">
	import StatusBadge from '$lib/components/status-badge.svelte';
</script>

<!-- Komponen ini sudah memasangkan ikon + label + warna secara default -->
<StatusBadge status={row.overallStatus} />
```

---

## 6. Anti-Patterns (Do NOT Use)

- ❌ Emoji as icons — use Lucide SVG
- ❌ Layout-shifting hovers — no `scale()` / `translateY()` on press
- ❌ Color-only status — no red/green border alone for OK/NG
- ❌ Low-contrast text — 4.5:1 minimum, verified separately in dark mode
- ❌ Instant state changes — always 150–300 ms
- ❌ Invisible focus states — every interactive element needs a visible ring
- ❌ `cursor-pointer` missing on clickable elements
- ❌ Hover-only affordances on operator forms (tablet has no hover)
- ❌ Hero + Features + CTA sections or GSAP scroll reveals — this is an internal tool
- ❌ Hardcoded hex per screen — always semantic tokens
- ❌ Replacing the Inter variable font without a payload/performance reason

---

## 7. Pre-Delivery Checklist

- [ ] No emojis as icons; all icons Lucide, consistent family
- [ ] Touch targets ≥ 44 px, ≥ 8 px apart
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover transitions 150–300 ms, no layout shift
- [ ] Light mode body text ≥ 4.5:1
- [ ] Dark mode body text ≥ 4.5:1, verified independently
- [ ] Borders and interaction states visible in both themes
- [ ] OK/NG never conveyed by color alone (icon + label present)
- [ ] Visible focus states; focus order matches visual order
- [ ] `prefers-reduced-motion` respected
- [ ] Forms: labels, inline errors retained, submit feedback, error summary focus
- [ ] Login allows password manager + paste
- [ ] Responsive: 375, 768, 1024, 1440 — no horizontal scroll
- [ ] No content hidden behind sticky headers/footers
- [ ] Measured values use `tabular-nums`
