# Project Guidelines

## Stack
- Frontend: Angular (located in `Frontend/admin-app`)
- Backend: ASP.NET Core (located in `Backend/AdminTest`)

---

## Design

**Source of truth:** [`DESIGN_RULES.md`](DESIGN_RULES.md)

All design decisions — colors, fonts, spacing, border-radius, buttons, cards, layout, hero behavior — are defined in `DESIGN_RULES.md`.
Before making any visual change, consult that file first.

### Core constraints (summary)
- RTL everywhere (`direction: rtl`)
- 5 colors only: `#ffffff`, `#000000`, `#ddff53`, `#F2F2F2`, `#404040`
- No shadows, no gradients, no sharp corners
- Typography via `--font-*` variables only — never raw `px` for text
- Spacing via `--space-*` variables only — never raw `px` for content spacing

---

## Development Rules

### Visual-only changes (no approval needed)
Any frontend change (HTML / CSS / TS) that affects **only appearance** — sizes, colors, layout, animations, dynamic CSS classes.

### Requires developer approval
1. Any backend change (API, server, database)
2. Any frontend logic change that affects **behavior** (not just visuals)

If approval is needed, stop and send this message to the developer:

```
⚠️ נדרש שינוי לוגי / בקאנד
------------------------
מה צריך לשנות: [תיאור ברור]
איפה בקוד: [קובץ / פונקציה]
למה זה נדרש: [הסבר קצר]
------------------------
```

### Protected Design vs Rebuild

Before starting any task, state whether the page is **Protected** or **Rebuild**.

#### 🔒 Protected (do not break desktop)

The following are reference designs — do not alter their desktop appearance:
- Artist page
- Song page (chord view)
- Article / News page
- Header (top navigation)

All patterns derived from them are also protected:
- Hero behavior
- Song cards
- News banner cards
- Gallery (as in artist page)
- Button system
- Layout behavior

**Rules:**
- Do not change their desktop design
- Do not change layout or visual hierarchy
- Do not "improve" visually

**Allowed:**
- Code cleanup
- Alignment with DESIGN_RULES
- Responsive via media queries only

#### 🧱 Rebuild (rest of the site)

All pages not listed above must be rebuilt professionally according to DESIGN_RULES.md.

**Order of work:**
1. Build desktop correctly (layout, hierarchy, spacing)
2. Adapt for tablet
3. Adapt for mobile

**Important:**
- Do not rely on existing design if it is weak
- Do use existing patterns (cards, buttons, etc.)

#### 📱 Responsive — correct approach

Protected: desktop stays exactly as-is; only add responsive overrides for small screens.

Rebuild: build desktop first, then adapt for mobile. Do not create a different design — only adapt.

#### ❗ Critical rules

- No horizontal scroll under any condition
- All content stays within the screen
- No inventing new components
- Use only what is defined in DESIGN_RULES

---

### Component reuse
- Prefer using existing shared components before creating new ones
- Do not duplicate styles or UI patterns that already exist
- If a new component is needed, it must follow DESIGN_RULES.md

---

### Git commits
End every commit message with a plain-language summary for the developer:

```
📋 סיכום לשליחה למתכנתת:
[שורה אחת לכל שינוי עיקרי — מה נוסף / שונה / הוסר ובאיזה עמוד]
```
