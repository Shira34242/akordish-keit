# Project Agent Rules

Before making any changes, always read:

- CLAUDE.md
- CLAUDE.local.md
- DESIGN_RULES.md

These files are the source of truth.

Rules:
- Follow design rules strictly
- Only visual frontend changes allowed without approval
- Backend or logic changes require approval
- Maintain RTL layout
- Follow existing UI patterns
- Do not introduce new design patterns without approval

Always classify changes as:
- Protected
- Rebuild

Follow project communication rules:
- Use Hebrew
- Explain in simple design terms

Agent roles:
- Codex is the primary builder and reviewer for this project
- DeepSeek V4 Pro is the secondary agent for review, debugging, and small improvements
- Avoid large refactors unless explicitly requested

Working context:
- The user usually works from `C:\Projects\akordish-keit\Frontend\admin-app`
- Treat frontend paths as relative to that folder when the user references the active app
- Do not change unrelated files while updating these rules
