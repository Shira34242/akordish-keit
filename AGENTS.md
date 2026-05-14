# Project Agent Rules

This file is the short entry point for agents.

## Read Only What Is Needed

Before making changes:
- Always read this file
- Read `DESIGN_RULES.md` for visual/design/layout work
- Read `CLAUDE.md` when approval rules or task classification are unclear
- Read `CLAUDE.local.md` only for communication/user-preference context

Do not read every rules file automatically for tiny changes.

---

## Current Phase

The project is in a final polish / maintenance phase.

Default working style:
- Improve existing pages carefully
- Prefer small, precise fixes
- Preserve the current visual language
- Do not rebuild existing pages unless explicitly requested
- Do not change unrelated files

---

## Task Classification

Classify work as:
- **Visual Polish** — small visual frontend change
- **Layout Fix** — responsive, spacing, overflow, wrapping, or RTL fix
- **Content/UI Behavior** — small frontend-only display behavior change
- **Backend/Data** — backend, API, database, saved settings, or data-flow change

`Protected` is not a blocking label anymore. It means: stable existing design, polish carefully, do not rebuild.

---

## Approval

Allowed without approval:
- Visual frontend changes
- Display-only TS changes
- Responsive, RTL, overflow, and wrapping fixes
- Small frontend-only display behavior using existing data

Requires approval:
- Backend, API, database, saved-data, auth, or permissions changes
- Significant behavior changes affecting real user flow
- Full rebuild of an existing page
- New design patterns not based on `DESIGN_RULES.md`

When approval is required, stop and send:

```
⚠️ נדרש שינוי לוגי / בקאנד
------------------------
מה צריך לשנות: [תיאור ברור]
איפה בקוד: [קובץ / פונקציה]
למה זה נדרש: [הסבר קצר]
------------------------
```

---

## Communication

- Use Hebrew
- Explain in simple design terms
- Mention files only by name and visual effect when possible
- Avoid technical explanation unless requested

---

## Working Context

- Main frontend app: `C:\Projects\akordish-keit\Frontend\admin-app`
- Treat frontend paths as relative to that folder when the user references the active app
- Codex is the primary builder/reviewer
- DeepSeek V4 Pro is secondary for review, debugging, and small improvements
