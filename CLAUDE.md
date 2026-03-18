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
