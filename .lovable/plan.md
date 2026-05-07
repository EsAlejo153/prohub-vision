# Rewrite /eri page with 3 tabs

## Files to modify

### 1. `src/hooks/useEri.ts`
- Keep existing `usePlanPyg` and `useEri`.
- Import `supabase` (already imported as `supabase` from `@/lib/external-supabase`).
- Add two new hooks:
  - **`useEriAllMonths({ año, compania, ccKey })`** — queries `v_eri_por_mes` for all months of the year, optionally filtered by CC (skip CC filter when `ccKey === 'TODOS'`). Ordered by `orden, año_mes_num`.
  - **`useEriAllCC({ año, compania, mes })`** — queries `v_eri_por_mes` for one month with all CCs. Ordered by `orden, cc_key`.
- Both return raw rows; aggregation happens in the page.

Note: the existing `useEri` signature is `useEri(filtros: FiltroDashboard)` where `ccKey` is `string | "Todas"`. Tab 1 will pass `ccKey: ccActivo === 'TODOS' ? 'Todas' : ccActivo` so the existing hook's filter logic works unchanged.

### 2. `src/pages/Eri.tsx` — full rewrite
Structure:
- `CENTROS` constant at top (5 entries: TODOS + 4 sedes).
- `Eri` component: `AppLayout` + tab nav (`periodo | mes-a-mes | por-cc`) + active tab content.
- Three sub-components in same file:
  - **`TabPeriodo`** — CC pills, uses existing `useEri`, aggregates all months into single value per `orden`. Table: Concepto | Valor | % Ingresos (% computed from `orden=15` total ingresos).
  - **`TabMesAMes`** — CC pills, uses `useEriAllMonths`. Table: Concepto + month columns + Acumulado.
  - **`TabPorCC`** — month pills (Ene–Dic of selected year, default to first), uses `useEriAllCC`. Table: Concepto + 4 CC columns + Consolidado + %.
- All three tables reuse the existing row-styling logic (Titulo / Total / Subtotal / zebra) and `formatCell` / `mesLabel` helpers.
- Loading / error / empty states via existing `StateMessages` components.

### Technical notes
- `useFiltros()` provides `año, mes, compania, ccKey`. The page-level filter (TopBar) still drives año/compañía. CC selection inside each tab is local state (pills), independent from the global `ccKey`.
- Tab 3 month pills: derived from `filtros.año` (fallback to 2026 if "Todas"), 12 months Ene–Dic.
- Use `externalSupabase` client (already exported as `supabase` in `@/lib/external-supabase`) for new hooks.
- No changes to `useEri.ts` types beyond adding the two hooks; new return types can be inferred.
- Keep Tailwind classes consistent with current Eri page styling.
