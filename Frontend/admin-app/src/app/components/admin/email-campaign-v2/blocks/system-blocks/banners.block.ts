import type { CustomBlockDefinition } from '@templatical/types';
import type { ComponentLibraryItem } from '../component-library.types';

const BANNER_FIELDS = [
  { key: 'bannerStyle', label: 'סגנון באנר', type: 'select' as const, options: [
    { label: 'באנר פתיחה רחב', value: 'hero' },
    { label: 'תמונה בלבד', value: 'image-only' },
    { label: 'כותרת וכפתור', value: 'title-button' },
    { label: 'אירוע מיוחד', value: 'event' },
    { label: 'הצטרפות לאתר', value: 'join' },
    { label: 'מעבר לאינדקס', value: 'index' },
    { label: 'מבצע / הודעה', value: 'promo' },
  ], default: 'hero' },
  { key: 'title', label: 'כותרת', type: 'text' as const, default: 'כותרת הבאנר' },
  { key: 'subtitle', label: 'תת-כותרת', type: 'text' as const, default: '' },
  { key: 'imageUrl', label: 'כתובת תמונה', type: 'image' as const },
  { key: 'altText', label: 'טקסט חלופי', type: 'text' as const, default: 'באנר' },
  { key: 'buttonText', label: 'טקסט כפתור', type: 'text' as const, default: 'לפרטים' },
  { key: 'buttonUrl', label: 'קישור כפתור', type: 'text' as const, default: 'https://akordishkayt.com' },
  { key: 'backgroundColor', label: 'צבע רקע', type: 'text' as const, default: '#1a1a1a' },
  { key: 'accentColor', label: 'צבע דגש', type: 'text' as const, default: '#ddff53' },
  { key: 'textColor', label: 'צבע טקסט', type: 'text' as const, default: '#ffffff' },
  { key: 'borderRadius', label: 'רדיוס', type: 'number' as const, default: 16, min: 0, max: 32, step: 2 },
  { key: 'spacing', label: 'ריווח', type: 'number' as const, default: 0, min: 0, max: 40, step: 4 },
];

const TEMPLATE = `{% assign style = bannerStyle | default: 'hero' %}
{% assign bg = backgroundColor | default: '#1a1a1a' %}
{% assign accent = accentColor | default: '#ddff53' %}
{% assign txt = textColor | default: '#ffffff' %}
{% assign radius = borderRadius | default: 16 | plus: 0 %}
{% assign space = spacing | default: 0 | plus: 0 %}

{% if style == 'hero' %}
<mj-section padding="{{ space }}px 0" direction="rtl">
  <mj-column>
    <mj-image src="{{ imageUrl }}" alt="{{ altText }}" width="600px" border-radius="{{ radius }}px"></mj-image>
    <mj-text font-size="24px" font-weight="800" color="{{ txt }}" align="right" padding="16px" font-family="Open Sans, Arial, sans-serif" container-background-color="{{ bg }}" border-radius="{{ radius }}px">
      {{ title }}{% if subtitle and subtitle != '' %}<br/><span style="font-size:16px;font-weight:300;color:#cccccc;">{{ subtitle }}</span>{% endif %}
    </mj-text>
    {% if buttonUrl and buttonUrl != '' and buttonText and buttonText != '' %}
    <mj-button href="{{ buttonUrl }}" background-color="{{ accent }}" color="#1a1a1a" font-weight="800" font-family="Open Sans, Arial, sans-serif" border-radius="999px" font-size="16px" padding="4px 0" align="right">{{ buttonText }}</mj-button>
    {% endif %}
  </mj-column>
</mj-section>

{% elsif style == 'image-only' %}
<mj-section padding="{{ space }}px 0" direction="rtl">
  <mj-column>
    {% if buttonUrl and buttonUrl != '' %}
    <mj-image src="{{ imageUrl }}" alt="{{ altText }}" href="{{ buttonUrl }}" width="600px" border-radius="{{ radius }}px"></mj-image>
    {% else %}
    <mj-image src="{{ imageUrl }}" alt="{{ altText }}" width="600px" border-radius="{{ radius }}px"></mj-image>
    {% endif %}
  </mj-column>
</mj-section>

{% elsif style == 'title-button' %}
<mj-section padding="{{ space }}px 0" direction="rtl" background-color="{{ bg }}" border-radius="{{ radius }}px">
  <mj-column>
    <mj-text font-size="22px" font-weight="800" color="{{ txt }}" align="center" padding="24px 24px 8px" font-family="Open Sans, Arial, sans-serif">{{ title }}</mj-text>
    {% if subtitle and subtitle != '' %}
    <mj-text font-size="14px" font-weight="300" color="#cccccc" align="center" padding="0 24px 16px" font-family="Open Sans, Arial, sans-serif">{{ subtitle }}</mj-text>
    {% endif %}
    {% if buttonUrl and buttonUrl != '' and buttonText and buttonText != '' %}
    <mj-button href="{{ buttonUrl }}" background-color="{{ accent }}" color="#1a1a1a" font-weight="800" font-family="Open Sans, Arial, sans-serif" border-radius="999px" align="center" font-size="15px" padding="0 0 24px">{{ buttonText }}</mj-button>
    {% endif %}
  </mj-column>
</mj-section>

{% elsif style == 'event' %}
<mj-section padding="{{ space }}px 0" direction="rtl" background-color="{{ bg }}" border-radius="{{ radius }}px">
  <mj-column width="40%">
    <mj-image src="{{ imageUrl }}" alt="{{ altText }}" width="240px" padding="0" border-radius="{{ radius }}px 0 0 {{ radius }}px"></mj-image>
  </mj-column>
  <mj-column width="60%">
    <mj-text font-size="12px" font-weight="600" color="{{ accent }}" align="right" padding="16px 16px 4px" font-family="Open Sans, Arial, sans-serif" text-transform="uppercase">הופעה קרובה</mj-text>
    <mj-text font-size="18px" font-weight="800" color="{{ txt }}" align="right" padding="0 16px 8px" font-family="Open Sans, Arial, sans-serif">{{ title }}</mj-text>
  </mj-column>
</mj-section>

{% elsif style == 'join' %}
<mj-section padding="{{ space }}px 0" direction="rtl">
  <mj-column background-color="{{ bg }}" border-radius="{{ radius }}px">
    <mj-text font-size="20px" font-weight="800" color="{{ accent }}" align="center" padding="20px 24px 8px" font-family="Open Sans, Arial, sans-serif">{{ title }}</mj-text>
    <mj-text font-size="14px" font-weight="300" color="{{ txt }}" align="center" padding="0 24px 16px" font-family="Open Sans, Arial, sans-serif">{{ subtitle }}</mj-text>
    {% if buttonUrl and buttonUrl != '' and buttonText and buttonText != '' %}
    <mj-button href="{{ buttonUrl }}" background-color="{{ accent }}" color="#1a1a1a" font-weight="800" font-family="Open Sans, Arial, sans-serif" border-radius="999px" align="center" padding="0 0 24px">{{ buttonText }}</mj-button>
    {% endif %}
  </mj-column>
</mj-section>

{% elsif style == 'index' %}
<mj-section padding="{{ space }}px 0" direction="rtl" background-color="{{ bg }}" border-radius="{{ radius }}px">
  <mj-column>
    <mj-text font-size="18px" font-weight="800" color="{{ accent }}" align="right" padding="16px 20px 4px" font-family="Open Sans, Arial, sans-serif">עולם המוזיקה</mj-text>
    <mj-text font-size="14px" font-weight="300" color="{{ txt }}" align="right" padding="0 20px 12px" font-family="Open Sans, Arial, sans-serif">{{ title }}</mj-text>
    <mj-button href="{{ buttonUrl }}" background-color="{{ accent }}" color="#1a1a1a" font-weight="800" border-radius="999px" font-family="Open Sans, Arial, sans-serif" font-size="14px" align="right" padding="0 0 16px">מעבר לאינדקס &larr;</mj-button>
  </mj-column>
</mj-section>

{% elsif style == 'promo' %}
<mj-section padding="{{ space }}px 0" direction="rtl" background-color="{{ bg }}" border-radius="{{ radius }}px">
  <mj-column>
    <mj-text font-size="14px" font-weight="800" color="{{ accent }}" align="center" padding="12px 24px 4px" font-family="Open Sans, Arial, sans-serif" text-transform="uppercase">{% if subtitle and subtitle != '' %}{{ subtitle }}{% else %}מבצע מיוחד{% endif %}</mj-text>
    <mj-text font-size="20px" font-weight="800" color="{{ txt }}" align="center" padding="0 24px 12px" font-family="Open Sans, Arial, sans-serif">{{ title }}</mj-text>
    {% if buttonUrl and buttonUrl != '' and buttonText and buttonText != '' %}
    <mj-button href="{{ buttonUrl }}" background-color="{{ accent }}" color="#1a1a1a" font-weight="800" font-family="Open Sans, Arial, sans-serif" border-radius="999px" align="center" font-size="15px" padding="0 0 16px">{{ buttonText }}</mj-button>
    {% endif %}
  </mj-column>
</mj-section>
{% endif %}`;

export const BANNERS_BLOCK_DEF: CustomBlockDefinition = {
  type: 'akd-banner',
  name: 'באנר',
  icon: 'photo',
  description: 'באנרים מעוצבים מראש',
  fields: BANNER_FIELDS,
  template: TEMPLATE,
  stylesheet: `@media (max-width:480px){.akd-banner-stack{display:block!important;width:100%!important;}}`,
  defaultStyles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
};

export const BANNERS_LIBRARY_ITEM: ComponentLibraryItem = {
  id: 'sys-banner',
  name: 'באנר',
  description: '7 סוגי באנרים: פתיחה, תמונה, כותרת+כפתור, אירוע, הצטרפות, אינדקס, מבצע',
  category: 'banners',
  categoryLabel: 'באנרים',
  source: 'system',
  definition: BANNERS_BLOCK_DEF,
  icon: BANNERS_BLOCK_DEF.icon,
  tags: ['באנר', 'פתיחה', 'תמונה', 'כפתור'],
};
