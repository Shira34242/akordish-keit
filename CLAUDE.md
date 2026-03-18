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

#### Hero / Full-Screen Box — מרווחי שוליים תקניים

**כלל קבוע:** כל תיבה גדולה שממלאת את רוחב הדף (hero, header section, featured card) חייבת להיות עם שוליים מהמסך:

```css
position: fixed; /* או relative/absolute לפי ההקשר */
top: 8px;
left: 8px;
right: 8px;
border-radius: 28px;
```

- שוליים: **8px מכל צד** — top, left, right (ו-bottom במידת הצורך)
- פינות: **`border-radius: 28px`** לתיבות גדולות
- מסך קטן (≤768px): `left: 4px; right: 4px; border-radius: 20px`
- **אסור** להצמיד תיבה גדולה לשוליים הדף ללא מרווח זה

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

### Typography Scale — סקאלת טיפוגרפיה

כל גדלי הטקסט מוגדרים כ-CSS variables ב-`styles.css`. **תמיד להשתמש בהם — לא לכתוב font-size ישירות.**

| Variable | ערך | שימוש |
|----------|-----|--------|
| `--font-xs` | 0.75rem / 12px | תגיות, מטא-מידע, כיתובי תמונה |
| `--font-sm` | 0.875rem / 14px | טקסט משני, ניווט, כפתורים |
| `--font-base` | 1rem / 16px | גוף טקסט, תיאורים, ביוגרפיות — **ברירת מחדל לטקסט** |
| `--font-lg` | 1.125rem / 18px | כותרות כרטיסים, כותרות קטע, הדגשות |
| `--font-xl` | 1.375rem / 22px | **שמור לתאריכים ומספרים בולטים בלבד** — לא לגוף טקסט |
| `--font-2xl` | 1.75rem / 28px | כותרות עמוד משניות (H3) |
| `--font-3xl` | 2.25rem / 36px | כותרות עמוד ראשיות (H2) |
| `--font-4xl` | 2.75rem / 44px | כותרת H1 קבועה |
| `--font-hero` | clamp(1.8rem, 2.5vw, 2.5rem) | כותרת hero בלבד — גמישה לפי מסך |

**כלל:** לפני שכותבים font-size — לבדוק אם יש variable מתאים. `--font-hero` מותר רק לכותרות hero / H1 ראשי. `clamp()` לא מותר במקומות אחרים.

---

### Unit Rules — כללי יחידות

#### ✅ מה משתמשים ומתי

| יחידה | שימוש |
|-------|--------|
| `rem` (דרך variables) | כל הטקסטים, כל הריווחים (margin, padding, gap) |
| `%` | רוחבים גמישים, max-width לקונטיינרים ותוכן |
| `vh` / `dvh` | גבהי hero ותיבות שמגיבות לגובה המסך |
| `px` | border, קווי הפרדה, גדלי navbar וכפתורי ממשק (height קבוע), גדלי אייקון |
| `aspect-ratio` | יחסי גובה-רוחב של כרטיסים, תמונות, מדיה |

#### ❌ מה לא משתמשים

- **אל תכתוב font-size בפיקסלים** — תמיד דרך CSS variables
- **אל תכתוב ריווחים (padding/gap/margin) בפיקסלים** לתוכן — רק דרך `--space-*` variables
- **אל תכתוב רוחבים קשיחים בפיקסלים** לקונטיינרים ותוכן — השתמש ב-`%` או `max-width`
- **אל תשתמש ב-`clamp()`** אלא לכותרת hero בלבד (`--font-hero`)
- **אל תשתמש ב-`vw`** לגדלי טקסט רגיל
- **אל תיצור ערכי ריווח או גופן חדשים** — לבדוק קודם שאין variable מתאים

#### ✅ מתי px מותר (רשימה סגורה)

- `border: 1px solid ...`
- `border-radius` — לרכיבי ממשק קטנים ומדויקים
- גדלי אייקון מ-Material Icons (כגון `font-size: 20px`)
- `width`/`height` של כפתורי navbar, FAB, אייקוני ממשק קבועים (כגון `40px`, `44px`, `56px`)
- `height` של navbar עצמה

---

### Standard Component Sizes — גדלים תקניים לרכיבי ממשק

כל רכיבי הממשק החוזרים חייבים לכבד את הגדלים הבאים. **אסור לסטות מהם ללא סיבה מוצדקת.**

#### כפתורים

| סוג | גובה | padding | font-size |
|-----|------|---------|-----------|
| כפתור ראשי (pill) | `34px` | `0 16px` | `--font-sm` |
| כפתור משני / קטן | `26px` | `0 12px` | `--font-sm` |
| כפתור icon עגול | `34×34px` | — | אייקון 18px |
| FAB | `48×48px` | — | אייקון 24px |

#### אייקונים

| שימוש | גודל |
|--------|------|
| ניווט ו-UI רגיל | `20px` |
| כפתורי FAB | `24px` |
| אייקונים קטנים / chevron | `18px` |
| אייקונים גדולים / hero | `28px` |

#### תמונות פרופיל / אווטאר

| הקשר | גודל |
|--------|------|
| hero דף אמן | `160×160px` |
| רשימה / כרטיס | `48–56px` |
| כותרת עליונה | `26×26px` |

---

### Spacing Scale — סקאלת ריווח

הריווחים מוגדרים כ-CSS variables ב-`styles.css`. **תמיד להשתמש בהם לתוכן — לא לכתוב px ישירות.**

| Variable | ערך | שימוש |
|----------|-----|--------|
| `--space-xs` | 0.25rem / 4px | icon-to-text gap, מיקרו בין אלמנטים קטנים |
| `--space-sm` | 0.375rem / 6px | צמוד, תגיות, טקסט משני |
| `--space-md` | 0.625rem / 10px | padding פנימי קטן, בין כפתורים סמוכים |
| `--space-base` | 0.875rem / 14px | **ברירת מחדל** — padding כרטיסים, רווח בין אלמנטים |
| `--space-lg` | 1.25rem / 20px | בין קבוצות תוכן בתוך רכיב |
| `--space-xl` | 1.75rem / 28px | בין אזורים בתוך רכיב גדול |
| `--space-2xl` | 2.5rem / 40px | בין מקטעים בעמוד |
| `--space-3xl` | 3.5rem / 56px | בין אזורי תוכן גדולים |
| `--space-4xl` | 4.5rem / 72px | ריווח חיצוני גדול בין מקטעי עמוד ראשיים |

**קווים מנחים:**
- padding פנימי של כרטיס → `--space-base` עד `--space-lg`
- gap בין כרטיסים בגריד → `--space-base` עד `--space-lg`
- gap בין פריטים סמוכים בתוך רכיב → `--space-sm` עד `--space-md`
- gap בין icon לטקסט → `--space-sm`
- בין פסקאות → `--space-base`
- בין מקטעים אנכיים בעמוד → `--space-2xl` עד `--space-4xl`
- אין ליצור "אוויר מיותר" — לעדיף דחוס על פני מרווח

---

### News Banner — באנר כתבה / חדשות מוזיקה

קומפוננטה משותפת: `app-news-banner` (נמצאת ב-`shared/news-banner/`).
שימוש: `<app-news-banner [article]="article">` בכל מקום שמציגים כתבה או חדשות מוזיקה.

#### מבנה ויזואלי
- **מלבן מעוגל** — `border-radius: 24px` (מובייל: `16px`)
- **יחס גובה-רוחב** — `aspect-ratio: 4 / 2.7` (מובייל: `4 / 3`)
- **תמונת רקע** — כיסוי מלא (`background-size: cover`), זום עדין בהובר (`scale(1.03)`)

#### שכבת כהייה (overlay)
- מכסה את **כל** הכרטיס
- כהה בתחתית, מתמוסס לשקוף כלפי מעלה:
```css
background: linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.30) 50%, rgba(0,0,0,0.05) 100%);
```

#### טקסט — פינה ימנית תחתונה
- **כותרת ראשית** — Open Sans ExtraBold 800, `var(--font-sm)`, לבן, מוצגת ראשונה
- **כותרת משנה** — Open Sans Light 300, `var(--font-xs)`, לבן 85% שקיפות, מתחת לכותרת

#### כפתור חץ — פינה שמאלית תחתונה
- **צורה:** מלבן מעוגל `border-radius: 10px`, גודל `36×36px`
- **צבע רגיל:** רקע `#ddff53` (צהוב-ירקרק), אייקון שחור
- **צבע הובר:** רקע `#ffffff` (לבן)
- **חץ:** מצביע שמאלה (RTL — כיוון קדימה)

#### גריד תצוגה
- מספר כרטיסים: `grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))`, `gap: 10px`
- מובייל: עמודה אחת

---

### Song Card — כרטיס אקורדים

קומפוננטה משותפת: `app-song-card` (נמצאת ב-`shared/song-card/`).
שימוש: `<app-song-card [song]="song">` בכל מקום שמציגים שיר / אקורדים.

#### מבנה ויזואלי
- **מלבן לרוחב** — `aspect-ratio: 4 / 2`, `border-radius: 16px`, רקע `#F2F2F2`
- **ללא צל, ללא border** — עיצוב שטוח לחלוטין
- **hover:** רקע מתכהה ל-`#e8e8e8`

#### פריסה פנימית (flex row, RTL)
| מיקום | אלמנט | תיאור |
|--------|--------|--------|
| ימין | תמונה | ריבוע מעוגל `border-radius: 12px`, `aspect-ratio: 1/1`, גובה 100% |
| שמאל | טקסט | flex column, `gap: 0`, `text-align: right` |

#### תמונה
- `<img>` עם `object-fit: cover`, `position: absolute; inset: 0`
- fallback (ללא תמונה): רקע `#ddff53`

#### טקסט (מלמעלה למטה)
- **"אקורדים לשיר"** — Open Sans Light 300, `var(--font-xs)`, `rgba(0,0,0,0.4)`
- **שם השיר** — Open Sans ExtraBold 800, `var(--font-base)`, שחור, `line-height: 1.1`, חיתוך ב-2 שורות
- **שם האמן** — Open Sans Light 300, `var(--font-sm)`, `rgba(0,0,0,0.45)`
- **חץ SVG** — `‹` כלפי שמאל, `18×18px`, `rgba(0,0,0,0.3)`, `margin-top: 6px`
- **padding פנימי:** `10px`

#### גריד תצוגה
- דף אמן: `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`, `gap: 8px`
- דף אקורדים: `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`, `gap: 8px`

#### קרוסלה (דף הבית)
- `:host { min-width: 220px; flex-shrink: 0 }` — הכרטיס לא מתכווץ בתוך הקרוסלה

---

### Scroll Hero Box — תיבה נגללת

כל תיבת hero שמתכווצת בגלילה מתנהגת לפי העקרונות הבאים (ראה דף אמן כדוגמה):

#### מיקום ושוליים
- `position: fixed`, `top: 2vh`, `left: 16px`, `right: 16px`
- על מסך קטן (≤600px): `left: 8px`, `right: 8px`

#### גודל

| גודל תיבה | גובה מלא | גובה מינימלי (פס לאחר גלילה) |
|-----------|----------|-------------------------------|
| מסך מלא   | `98vh - 16px` (JS: `innerHeight - 2vh - 16`) | `2vh + 55px` |
| חצי מסך   | `48vh`   | `2vh + 55px` |
| גודל מותאם | לפי הבקשה | `2vh + 55px` |

#### עיגול פינות
- `border-radius: 40px` (מסך גדול)
- `border-radius: 20px` (מסך קטן ≤600px)

#### אנימציית גלילה
- קצב התכווצות: `newHeight = max(minHeight, fullHeight - scrollY)` — יחס 1:1 (פיקסל לפיקסל)
- תוכן פנימי (טקסט, כפתורים): נעלם ב-160px הראשונים של הגלילה (`opacity: 0..1`)
- overlay אפור כהה (`#404040`): מתגבר בהדרגה ככל שהתיבה מתכווצת — מגיע ל-100% כשהתיבה בגודל הפס המינימלי

#### CSS נדרש
```css
/* overlay אפור כהה */
.hero-collapse-overlay {
  position: absolute;
  inset: 0;
  background: #404040;
  opacity: 0;
  pointer-events: none;
  z-index: 1;
}
```

#### HTML נדרש (בתוך תיבת ה-hero)
```html
<div class="hero-collapse-overlay"></div>
```

#### TS נדרש (בתוך `shrinkHero()`)
```ts
const minHeight = Math.round(window.innerHeight * 0.02 + 60);
const newHeight = Math.max(minHeight, this.fullHeroHeight - window.scrollY);
bg.style.height = newHeight + 'px';

// fade תוכן ב-160px ראשונים
const progress = Math.min(1, window.scrollY / 160);
// ...set opacity on inner elements...

// overlay אפור
const collapseOverlay = bg.querySelector('.hero-collapse-overlay') as HTMLElement | null;
if (collapseOverlay) {
  const collapseRange = this.fullHeroHeight - minHeight;
  const collapseProgress = collapseRange > 0
    ? Math.min(1, (this.fullHeroHeight - newHeight) / collapseRange)
    : 0;
  collapseOverlay.style.opacity = String(collapseProgress);
}
```
