# Project Guidelines

## Design System

### Color Palette
| Name         | HEX       | Usage                        |
|--------------|-----------|------------------------------|
| Lime Green   | `#ddff53` | Primary accent / CTA buttons |
| Lime Alt     | `#ccff66` | Alternative accent           |
| Black        | `#000000` | Text, backgrounds            |
| Dark Gray    | `#404040` | Secondary backgrounds        |
| Light Gray   | `#F2F2F2` | Subtle backgrounds, cards    |
| White        | `#ffffff` | Backgrounds, text on dark    |

### Typography
Two fonts are used across the project. Import from Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Karantina:wght@300;400;700&family=Heebo:wght@300;400;500;700;800&display=swap" rel="stylesheet">
```

| Role          | Font       | Notes                         |
|---------------|------------|-------------------------------|
| Display/Title | Karantina  | Headings, hero text, branding |
| Body/UI       | Heebo      | Body text, labels, buttons    |

### Design Principles
- The project is **RTL** (Hebrew) - always use `direction: rtl` and `text-align: right` by default
- Use `#ddff53` (lime) as the primary highlight/CTA color against dark backgrounds
- Prefer rounded corners (`border-radius: 12px–20px`) consistent with the palette cards style
- Dark mode feel: dark backgrounds (`#000` or `#404040`) with lime accents is the primary aesthetic

## Stack
- Frontend: Angular (located in `Frontend/admin-app`)
- Backend: ASP.NET Core (located in `Backend/AdminTest`)
