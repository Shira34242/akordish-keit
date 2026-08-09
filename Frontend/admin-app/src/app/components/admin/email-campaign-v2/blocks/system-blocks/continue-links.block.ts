import type { CustomBlockDefinition } from '@templatical/types';
import type { ComponentLibraryItem } from '../component-library.types';

const LINK_FIELDS = [
  { key: 'linkStyle', label: 'סוג קישור', type: 'select' as const, options: [
    { label: 'כל הכתבות', value: 'articles' },
    { label: 'כל האקורדים', value: 'chords' },
    { label: 'כל הפודקאסטים', value: 'podcasts' },
    { label: 'כל ההופעות', value: 'events' },
    { label: 'כל האמנים', value: 'artists' },
    { label: 'אינדקס עולם המוזיקה', value: 'index' },
    { label: 'מעבר לאתר', value: 'website' },
  ], default: 'articles' },
  { key: 'label', label: 'תווית (אופציונלי)', type: 'text' as const, default: '' },
  { key: 'buttonText', label: 'טקסט כפתור', type: 'text' as const, default: 'לכל הכתבות' },
  { key: 'buttonUrl', label: 'קישור', type: 'text' as const, default: 'https://akordishkayt.com/articles' },
  { key: 'backgroundColor', label: 'צבע רקע', type: 'text' as const, default: '#1a1a1a' },
  { key: 'accentColor', label: 'צבע דגש', type: 'text' as const, default: '#ddff53' },
  { key: 'borderRadius', label: 'רדיוס', type: 'number' as const, default: 8, min: 0, max: 32, step: 2 },
  { key: 'spacing', label: 'ריווח', type: 'number' as const, default: 8, min: 0, max: 40, step: 4 },
];

const TEMPLATE = `{% assign style = linkStyle | default: 'articles' %}
{% assign bg = backgroundColor | default: '#1a1a1a' %}
{% assign accent = accentColor | default: '#ddff53' %}
{% assign radius = borderRadius | default: 8 | plus: 0 %}
{% assign space = spacing | default: 8 | plus: 0 %}

<mj-section padding="{{ space }}px 0" direction="rtl">
  <mj-column>
    {% if label and label != '' %}
    <mj-text font-size="11px" font-weight="600" color="#6b7280" align="right" padding="0 0 4px" font-family="Open Sans, Arial, sans-serif">{{ label | escape }}</mj-text>
    {% endif %}
    {% if buttonUrl and buttonUrl != '' and buttonText and buttonText != '' %}
    <mj-button href="{{ buttonUrl | escape }}" background-color="{{ bg }}" color="{{ accent }}" font-weight="800" font-family="Open Sans, Arial, sans-serif" border-radius="{{ radius }}px" font-size="14px" align="right" padding="0">{{ buttonText | escape }} &larr;</mj-button>
    {% endif %}
  </mj-column>
</mj-section>`;

export const CONTINUE_LINKS_BLOCK_DEF: CustomBlockDefinition = {
  type: 'akd-continue-link',
  name: 'קישור המשך',
  icon: 'link',
  description: 'כפתור מעבר לקטגוריית תוכן או לאתר',
  fields: LINK_FIELDS,
  template: TEMPLATE,
  stylesheet: '',
  defaultStyles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
};

export const CONTINUE_LINKS_LIBRARY_ITEM: ComponentLibraryItem = {
  id: 'sys-continue-link',
  name: 'קישור המשך',
  description: 'כפתורי מעבר: כתבות, אקורדים, פודקאסטים, הופעות, אמנים, אינדקס, אתר',
  category: 'buttons',
  categoryLabel: 'כפתורים',
  source: 'system',
  definition: CONTINUE_LINKS_BLOCK_DEF,
  icon: CONTINUE_LINKS_BLOCK_DEF.icon,
  tags: ['קישור', 'כפתור', 'המשך', 'מעבר'],
};
