import type { CustomBlockDefinition } from '@templatical/types';
import type { ComponentLibraryItem } from '../component-library.types';

const SECTION_TITLE_FIELDS = [
  { key: 'titleStyle', label: 'סגנון כותרת', type: 'select' as const, options: [
    { label: 'פס ירוק מעוגל', value: 'green-strip' },
    { label: 'קו תחתון נקי', value: 'clean-underline' },
    { label: 'רקע שחור תווית ירוקה', value: 'black-green' },
    { label: 'עם אייקון', value: 'with-icon' },
    { label: 'ממורכזת', value: 'centered' },
    { label: 'מיושר לימין', value: 'right-aligned' },
  ], default: 'green-strip' },
  { key: 'title', label: 'טקסט הכותרת', type: 'text' as const, default: 'כותרת מדור' },
  { key: 'iconName', label: 'שם אייקון (Material)', type: 'text' as const, default: 'star' },
  { key: 'backgroundColor', label: 'צבע רקע', type: 'text' as const, default: '#ddff53' },
  { key: 'textColor', label: 'צבע טקסט', type: 'text' as const, default: '#1a1a1a' },
  { key: 'fontSize', label: 'גודל טקסט', type: 'select' as const, options: [
    { label: 'קטן (18px)', value: '18' },
    { label: 'בינוני (22px)', value: '22' },
    { label: 'גדול (26px)', value: '26' },
    { label: 'ענק (30px)', value: '30' },
  ], default: '22' },
  { key: 'textAlign', label: 'יישור', type: 'select' as const, options: [
    { label: 'ימין', value: 'right' },
    { label: 'מרכז', value: 'center' },
  ], default: 'right' },
  { key: 'borderRadius', label: 'רדיוס', type: 'number' as const, default: 8, min: 0, max: 32, step: 2 },
  { key: 'spacing', label: 'ריווח', type: 'number' as const, default: 12, min: 0, max: 40, step: 4 },
];

const TEMPLATE = `{% assign style = titleStyle | default: 'green-strip' %}
{% assign bg = backgroundColor | default: '#ddff53' %}
{% assign txt = textColor | default: '#1a1a1a' %}
{% assign size = fontSize | default: '22' | plus: 0 %}
{% assign align = textAlign | default: 'right' %}
{% assign radius = borderRadius | default: 8 | plus: 0 %}
{% assign space = spacing | default: 12 | plus: 0 %}
{% assign icon = iconName | default: 'star' %}

{% if style == 'green-strip' %}
<mj-section padding="{{ space }}px 0" direction="rtl">
  <mj-column>
    <mj-text font-size="{{ size }}px" font-weight="800" color="{{ txt }}" align="{{ align }}" padding="8px 16px" font-family="Open Sans, Arial, sans-serif" container-background-color="{{ bg }}" border-radius="{{ radius }}px">
      {{ title }}
    </mj-text>
  </mj-column>
</mj-section>

{% elsif style == 'clean-underline' %}
<mj-section padding="{{ space }}px 0" direction="rtl">
  <mj-column>
    <mj-text font-size="{{ size }}px" font-weight="800" color="{{ txt }}" align="{{ align }}" padding="0 0 6px 0" font-family="Open Sans, Arial, sans-serif" border-bottom="3px solid {{ bg }}">
      {{ title }}
    </mj-text>
  </mj-column>
</mj-section>

{% elsif style == 'black-green' %}
<mj-section padding="{{ space }}px 0" direction="rtl">
  <mj-column>
    <mj-text font-size="{{ size }}px" font-weight="800" color="#ddff53" align="{{ align }}" padding="10px 16px" font-family="Open Sans, Arial, sans-serif" container-background-color="#1a1a1a" border-radius="{{ radius }}px">
      &#9670; {{ title }}
    </mj-text>
  </mj-column>
</mj-section>

{% elsif style == 'with-icon' %}
<mj-section padding="{{ space }}px 0" direction="rtl">
  <mj-column>
    <mj-text font-size="{{ size }}px" font-weight="800" color="{{ txt }}" align="{{ align }}" padding="8px 0" font-family="Open Sans, Arial, sans-serif">
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:{{ bg }};margin-left:8px;"></span>
      {{ title }}
    </mj-text>
  </mj-column>
</mj-section>

{% elsif style == 'centered' %}
<mj-section padding="{{ space }}px 0" direction="rtl" text-align="center">
  <mj-column>
    <mj-divider border-color="{{ bg }}" border-width="2px" width="60px" padding="0 0 8px 0" />
    <mj-text font-size="{{ size }}px" font-weight="800" color="{{ txt }}" align="center" padding="0" font-family="Open Sans, Arial, sans-serif">
      {{ title }}
    </mj-text>
    <mj-divider border-color="{{ bg }}" border-width="2px" width="60px" padding="8px 0 0 0" />
  </mj-column>
</mj-section>

{% elsif style == 'right-aligned' %}
<mj-section padding="{{ space }}px 0" direction="rtl">
  <mj-column>
    <mj-text font-size="{{ size }}px" font-weight="800" color="{{ txt }}" align="right" padding="0 16px" font-family="Open Sans, Arial, sans-serif" border-right="4px solid {{ bg }}">
      {{ title }}
    </mj-text>
  </mj-column>
</mj-section>
{% endif %}`;

export const SECTION_TITLES_BLOCK_DEF: CustomBlockDefinition = {
  type: 'section-title',
  name: 'כותרת מדור',
  icon: 'title',
  description: 'כותרת מעוצבת למדור במייל',
  fields: SECTION_TITLE_FIELDS,
  template: TEMPLATE,
  stylesheet: '',
  defaultStyles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
};

export const SECTION_TITLES_LIBRARY_ITEM: ComponentLibraryItem = {
  id: 'sys-section-title',
  name: 'כותרת מדור',
  description: '6 סגנונות כותרת: פס ירוק, קו תחתון, רקע שחור, אייקון, ממורכזת, מיושר לימין',
  category: 'titles',
  categoryLabel: 'כותרות',
  source: 'system',
  definition: SECTION_TITLES_BLOCK_DEF,
  icon: SECTION_TITLES_BLOCK_DEF.icon,
  tags: ['כותרת', 'מדור', 'עיצוב'],
};
