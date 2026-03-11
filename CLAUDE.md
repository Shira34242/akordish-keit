# Project Guidelines

## Stack
- Frontend: Angular (located in `Frontend/admin-app`)
- Backend: ASP.NET Core (located in `Backend/AdminTest`)

---

## Design System

### Typography

Google Fonts import:
```html
<link href="https://fonts.googleapis.com/css2?family=Karantina:wght@700&family=Open+Sans:wght@300;800&display=swap" rel="stylesheet">
```

| Font       | Weight       | CSS                                      | Usage                                                      |
|------------|--------------|------------------------------------------|------------------------------------------------------------|
| Karantina  | Bold 700     | `font-family: 'Karantina'; font-weight: 700` | Brand name "אקורדישקייט" only + a few home page headings. **Do NOT use unless explicitly specified.** |
| Open Sans  | Light 300    | `font-family: 'Open Sans', sans-serif; font-optical-sizing: auto; font-weight: 300; font-variation-settings: "wdth" 100;` | Default for all body text, labels, UI elements             |
| Open Sans  | ExtraBold 800| `font-family: 'Open Sans', sans-serif; font-optical-sizing: auto; font-weight: 800; font-variation-settings: "wdth" 100;` | Headings, titles, emphasis                                 |

**Rule:** When no font is specified → Open Sans Light 300. Karantina is never used by default.

---

### Color Palette

The site is **light-themed**. Only these 5 colors may be used unless explicitly approved otherwise:

| Name        | HEX       | Role                                                                 |
|-------------|-----------|----------------------------------------------------------------------|
| White       | `#ffffff` | Base background, primary surface                                     |
| Black       | `#000000` | Text, icons, borders                                                 |
| Lime Yellow | `#ddff53` | Primary accent — hero sections, CTA blocks, highlighted cards        |
| Light Gray  | `#F2F2F2` | Secondary surface — cards, sections needing subtle visual separation |
| Dark Gray   | `#404040` | Dark background areas (footers, contrast sections)                   |

---

### Visual Style

**Overall aesthetic:** Modern, clean, minimal. Light backgrounds with lime yellow accent blocks.

#### Layout
- **Bento Grid** — modular card-based layout; cards vary in size but follow a consistent grid rhythm
- **Uniform gutters** — consistent spacing between all cards and between cards and page edge
- **RTL** — `direction: rtl`, `text-align: right` everywhere by default

#### Border Radius
- **All corners are rounded** — uniform `border-radius` applied consistently throughout
- When an element's width ≈ height → full pill / circle (`border-radius: 50%`)
- When width ≠ height → extreme pill (`border-radius: 999px` or half the shorter dimension)
- Avoid mixing sharp and rounded corners on the same page

#### Buttons & Tags
- Prefer pill-shaped buttons (`border-radius: 999px`)
- Circular icon buttons when width = height
- No rectangular sharp-corner buttons

#### Motion / Scroll Effects
- Hero / header blocks may shrink/collapse into themselves on scroll (parallax-style contraction)
- No parallax depth or 3D — purely 2D scale/height transitions

#### Flat Design Rules
- **No shadows** (`box-shadow: none`)
- **No gradients** (unless the two stops are both from the approved palette)
- **No 3D transforms**, bevels, emboss, or skeuomorphic elements
- **No borders** as decoration — use background color contrast instead

---

### Spacing Scale

Use multiples of 8px as the base spacing unit:

| Token | Value | Use |
|-------|-------|-----|
| xs    | 8px   | Inner padding of compact elements |
| sm    | 16px  | Standard inner padding |
| md    | 24px  | Card padding, section gaps |
| lg    | 32px  | Section separation |
| xl    | 48px  | Major section gaps |
| 2xl   | 64px+ | Page-level spacing |
