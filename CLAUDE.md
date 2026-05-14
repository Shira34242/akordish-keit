# Project Guidelines

## Stack
- Frontend: Angular (`Frontend/admin-app`)
- Backend: ASP.NET Core (`Backend/AdminTest`)

---

## Purpose

This file defines **approval rules and task classification**.

For design details, use `DESIGN_RULES.md`.
For user communication preferences, use `CLAUDE.local.md`.

---

## Current Phase

The site is in a **final polish / maintenance phase**.

Default approach:
- Improve existing pages carefully
- Prefer small, accurate fixes
- Preserve the current visual language
- Do not rebuild an existing page unless explicitly requested
- Check desktop and mobile when layout changes

---

## Task Classification

Use one of these labels before starting meaningful work:

### Visual Polish
Small visual improvement on an existing page.

Examples: font, color, spacing, alignment, hover, animation, small display-only classes.

Approval needed: **No**

### Layout Fix
Responsive or structure fix that keeps the existing design.

Examples: mobile/tablet adjustment, no horizontal scroll, overflow, wrapping, content staying inside the screen.

Approval needed: **No**, if frontend-only and display-only.

### Content/UI Behavior
Small frontend-only change in what is shown.

Examples: showing existing content in another existing slot, opening/closing panels, display-only sorting/filtering of already-loaded data.

Approval needed: **Usually no**, if it does not touch backend, API, saved data, or real user flow.

Simple explanation:

```
זה שינוי פרונט קטן שמשפיע רק על התצוגה, לכן אפשר לבצע.
```

### Backend/Data
Any change touching backend, API, database, saved settings, auth, permissions, server behavior, or data model.

Approval needed: **Yes**

---

## Requires Approval

Stop before:
1. Backend changes under `Backend/AdminTest`
2. API contract changes
3. Database or saved-data changes
4. Authentication, permissions, or admin workflow changes
5. Frontend logic that changes real user behavior, saved choices, or data flow
6. Full rebuild of an existing page
7. New visual pattern not based on `DESIGN_RULES.md`

When approval is required, send:

```
⚠️ נדרש שינוי לוגי / בקאנד
------------------------
מה צריך לשנות: [תיאור ברור]
איפה בקוד: [קובץ / פונקציה]
למה זה נדרש: [הסבר קצר]
------------------------
```

---

## Existing Pages

Old `Protected` pages are now treated as **stable existing designs**:
- Artist page
- Song page (chord view)
- Article / News page
- Header

Meaning:
- Keep their identity and hierarchy
- Polish carefully
- Responsive fixes are allowed
- Do not rebuild or visually reinvent without explicit request

---

## Critical Rules

- No horizontal scroll
- Maintain RTL
- Reuse existing UI patterns
- Do not change unrelated files
- Avoid large refactors unless requested

---

## Backend Restart Reminder

If backend files changed, end the response with:

```
🔄 שינית קבצי בקאנד — צריך להריץ מחדש את הבקאנד (dotnet run)
```

---

## Git Commits

End every commit message with:

```
📋 סיכום לשליחה למתכנתת:
[שורה אחת לכל שינוי עיקרי — מה נוסף / שונה / הוסר ובאיזה עמוד]
```
