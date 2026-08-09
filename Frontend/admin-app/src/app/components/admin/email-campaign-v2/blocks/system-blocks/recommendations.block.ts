import type { CustomBlockDefinition } from '@templatical/types';
import type { ComponentLibraryItem } from '../component-library.types';

const RECOMMENDATION_FIELDS = [
  { key: 'recType', label: 'סוג המלצה', type: 'select' as const, options: [
    { label: 'בחירת העורך', value: 'editor-pick' },
    { label: 'שיר השבוע', value: 'song-of-week' },
    { label: 'אקורד השבוע', value: 'chord-of-week' },
    { label: 'הכתבה שאסור לפספס', value: 'must-read' },
    { label: 'אמן השבוע', value: 'artist-of-week' },
    { label: 'פרופיל מומלץ', value: 'profile' },
  ], default: 'editor-pick' },
  { key: 'label', label: 'תווית', type: 'text' as const, default: 'בחירת העורך' },
  { key: 'imageUrl', label: 'כתובת תמונה', type: 'image' as const },
  { key: 'altText', label: 'טקסט חלופי', type: 'text' as const, default: 'תמונה' },
  { key: 'title', label: 'כותרת', type: 'text' as const, default: 'כותרת ההמלצה' },
  { key: 'description', label: 'טקסט', type: 'textarea' as const, default: '' },
  { key: 'buttonText', label: 'טקסט כפתור', type: 'text' as const, default: 'לפרטים' },
  { key: 'buttonUrl', label: 'קישור', type: 'text' as const, default: 'https://akordishkayt.com' },
  { key: 'backgroundColor', label: 'צבע רקע', type: 'text' as const, default: '#f8f9fa' },
  { key: 'accentColor', label: 'צבע דגש', type: 'text' as const, default: '#ddff53' },
  { key: 'borderRadius', label: 'רדיוס', type: 'number' as const, default: 16, min: 0, max: 32, step: 2 },
  { key: 'spacing', label: 'ריווח', type: 'number' as const, default: 0, min: 0, max: 40, step: 4 },
];

const TEMPLATE = `{% assign type = recType | default: 'editor-pick' %}
{% assign bg = backgroundColor | default: '#f8f9fa' %}
{% assign accent = accentColor | default: '#ddff53' %}
{% assign radius = borderRadius | default: 16 | plus: 0 %}
{% assign space = spacing | default: 0 | plus: 0 %}
{% assign labelText = label | default: 'מומלץ' %}

<mj-section padding="{{ space }}px 0" direction="rtl">
  <mj-column background-color="{{ bg }}" border-radius="{{ radius }}px">
    <mj-text font-size="11px" font-weight="800" color="#1a1a1a" align="right" padding="12px 16px 4px" font-family="Open Sans, Arial, sans-serif" container-background-color="{{ accent }}" border-radius="999px" width="auto">
      &nbsp;{{ labelText | escape }}&nbsp;
    </mj-text>
    {% if imageUrl and imageUrl != '' %}
    {% if buttonUrl and buttonUrl != '' %}
    <mj-image src="{{ imageUrl | escape }}" alt="{{ altText | escape }}" href="{{ buttonUrl | escape }}" width="568px" padding="12px 16px 0" border-radius="12px"></mj-image>
    {% else %}
    <mj-image src="{{ imageUrl | escape }}" alt="{{ altText | escape }}" width="568px" padding="12px 16px 0" border-radius="12px"></mj-image>
    {% endif %}
    {% endif %}
    {% if buttonUrl and buttonUrl != '' %}
    <mj-text font-size="16px" font-weight="800" color="#1a1a1a" align="right" padding="12px 16px 4px" font-family="Open Sans, Arial, sans-serif">
      <a href="{{ buttonUrl | escape }}" style="color:#1a1a1a;text-decoration:none;direction:rtl;">{{ title | escape }}</a>
    </mj-text>
    {% else %}
    <mj-text font-size="16px" font-weight="800" color="#1a1a1a" align="right" padding="12px 16px 4px" font-family="Open Sans, Arial, sans-serif">{{ title | escape }}</mj-text>
    {% endif %}
    {% if description and description != '' %}
    <mj-text font-size="14px" font-weight="300" color="#4b5563" align="right" padding="4px 16px 12px" font-family="Open Sans, Arial, sans-serif" line-height="1.5">{{ description | escape }}</mj-text>
    {% endif %}
    {% if buttonUrl and buttonUrl != '' and buttonText and buttonText != '' %}
    <mj-button href="{{ buttonUrl | escape }}" background-color="#1a1a1a" color="{{ accent }}" font-weight="800" font-family="Open Sans, Arial, sans-serif" border-radius="999px" font-size="14px" align="right" padding="0 0 16px">{{ buttonText | escape }} &larr;</mj-button>
    {% endif %}
  </mj-column>
</mj-section>`;

export const RECOMMENDATION_BLOCK_DEF: CustomBlockDefinition = {
  type: 'akd-recommendation',
  name: 'המלצה',
  icon: 'recommend',
  description: 'המלצות תוכן מוכנות מראש',
  fields: RECOMMENDATION_FIELDS,
  template: TEMPLATE,
  stylesheet: '',
  defaultStyles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
};

export const RECOMMENDATION_LIBRARY_ITEM: ComponentLibraryItem = {
  id: 'sys-recommendation',
  name: 'המלצת תוכן',
  description: 'בחירת עורך, שיר/אקורד/אמן השבוע, כתבה מומלצת, פרופיל',
  category: 'recommendations',
  categoryLabel: 'המלצות',
  source: 'system',
  definition: RECOMMENDATION_BLOCK_DEF,
  icon: RECOMMENDATION_BLOCK_DEF.icon,
  tags: ['המלצה', 'עורך', 'שיר', 'אקורד', 'אמן', 'פרופיל'],
};
