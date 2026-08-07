import type { CustomBlockDefinition } from '@templatical/types';
import type { ComponentLibraryItem } from '../component-library.types';

const SPACER_DEF: CustomBlockDefinition = {
  type: 'akd-spacer',
  name: 'רווח אנכי',
  icon: 'height',
  description: 'הוספת רווח אנכי',
  fields: [
    { key: 'height', label: 'גובה (px)', type: 'number' as const, default: 24, min: 4, max: 80, step: 4 },
  ],
  template: `<mj-section padding="{{ height | default: 24 | plus: 0 }}px 0" direction="rtl"><mj-column></mj-column></mj-section>`,
  stylesheet: '',
  defaultStyles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
};

const DIVIDER_DEF: CustomBlockDefinition = {
  type: 'akd-divider',
  name: 'מפריד אופקי',
  icon: 'horizontal_rule',
  description: 'קו מפריד מעוצב',
  fields: [
    { key: 'dividerStyle', label: 'סגנון', type: 'select' as const, options: [
      { label: 'קו דק', value: 'thin' },
      { label: 'קו עבה', value: 'thick' },
      { label: 'קו מקווקו', value: 'dashed' },
      { label: 'קו עם אייקון', value: 'icon' },
    ], default: 'thin' },
    { key: 'dividerColor', label: 'צבע', type: 'text' as const, default: '#e0e0e0' },
    { key: 'dividerWidth', label: 'רוחב (%)', type: 'number' as const, default: 100, min: 20, max: 100, step: 10 },
    { key: 'thickness', label: 'עובי (px)', type: 'number' as const, default: 1, min: 1, max: 6, step: 1 },
    { key: 'spacing', label: 'ריווח', type: 'number' as const, default: 8, min: 0, max: 40, step: 4 },
  ],
  template: `{% assign style = dividerStyle | default: 'thin' %}
{% assign color = dividerColor | default: '#e0e0e0' %}
{% assign width = dividerWidth | default: 100 | divided_by: 100.0 %}
{% assign thick = thickness | default: 1 | plus: 0 %}
{% assign space = spacing | default: 8 | plus: 0 %}
{% if style == 'dashed' %}
<mj-section padding="{{ space }}px 0" direction="rtl"><mj-column><mj-divider border-color="{{ color }}" border-width="{{ thick }}px" border-style="dashed" width="{{ width | times: 100 | round }}%" padding="0" /></mj-column></mj-section>
{% else %}
<mj-section padding="{{ space }}px 0" direction="rtl"><mj-column><mj-divider border-color="{{ color }}" border-width="{{ thick }}px" border-style="solid" width="{{ width | times: 100 | round }}%" padding="0" /></mj-column></mj-section>
{% endif %}`,
  stylesheet: '',
  defaultStyles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
};

const BRANDED_SECTION_DEF: CustomBlockDefinition = {
  type: 'akd-branded-section',
  name: 'אזור עם רקע',
  icon: 'dashboard',
  description: 'אזור תוכן על רקע צבעוני',
  fields: [
    { key: 'backgroundColor', label: 'צבע רקע', type: 'text' as const, default: '#f3f4f6' },
    { key: 'borderRadius', label: 'רדיוס', type: 'number' as const, default: 12, min: 0, max: 32, step: 2 },
    { key: 'padding', label: 'ריווח פנימי', type: 'number' as const, default: 20, min: 8, max: 48, step: 4 },
    { key: 'spacing', label: 'ריווח חיצוני', type: 'number' as const, default: 8, min: 0, max: 40, step: 4 },
  ],
  template: `{% assign bg = backgroundColor | default: '#f3f4f6' %}
{% assign radius = borderRadius | default: 12 | plus: 0 %}
{% assign pad = padding | default: 20 | plus: 0 %}
{% assign space = spacing | default: 8 | plus: 0 %}
<mj-section padding="0" direction="rtl">
  <mj-column background-color="{{ bg }}" border-radius="{{ radius }}px" padding="{{ pad }}px">
  </mj-column>
</mj-section>
<mj-section padding="{{ space }}px 0" direction="rtl"><mj-column></mj-column></mj-section>`,
  stylesheet: '',
  defaultStyles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
};

const TWO_COLUMNS_DEF: CustomBlockDefinition = {
  type: 'akd-two-columns',
  name: 'שתי עמודות',
  icon: 'view_column',
  description: 'מבנה שתי עמודות',
  fields: [
    { key: 'leftContent', label: 'תוכן עמודה ימנית', type: 'textarea' as const, default: '' },
    { key: 'rightContent', label: 'תוכן עמודה שמאלית', type: 'textarea' as const, default: '' },
    { key: 'ratio', label: 'יחס עמודות', type: 'select' as const, options: [
      { label: '50/50', value: '50-50' },
      { label: '60/40', value: '60-40' },
      { label: '70/30', value: '70-30' },
    ], default: '50-50' },
    { key: 'gap', label: 'ריווח בין עמודות', type: 'number' as const, default: 8, min: 0, max: 24, step: 2 },
    { key: 'spacing', label: 'ריווח חיצוני', type: 'number' as const, default: 8, min: 0, max: 40, step: 4 },
  ],
  template: `{% assign leftW = ratio | default: '50-50' %}
{% assign rightPct = 50 %}
{% if leftW == '60-40' %}{% assign rightPct = 60 %}{% endif %}
{% if leftW == '70-30' %}{% assign rightPct = 70 %}{% endif %}
{% assign leftPct = 100 | minus: rightPct %}
{% assign g = gap | default: 8 | plus: 0 | divided_by: 2 %}
{% assign space = spacing | default: 8 | plus: 0 %}
<mj-section padding="{{ space }}px 0" direction="rtl">
  <mj-column width="{{ rightPct }}%" padding="0 {{ g }}px">
    <mj-text font-size="14px" color="#1a1a1a" align="right" padding="0" font-family="Open Sans, Arial, sans-serif">{{ rightContent }}</mj-text>
  </mj-column>
  <mj-column width="{{ leftPct }}%" padding="0 {{ g }}px">
    <mj-text font-size="14px" color="#1a1a1a" align="right" padding="0" font-family="Open Sans, Arial, sans-serif">{{ leftContent }}</mj-text>
  </mj-column>
</mj-section>`,
  stylesheet: `@media (max-width:480px){.akd-two-col-stack{display:block!important;width:100%!important;}}`,
  defaultStyles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
};

const BRANDED_TEXT_DEF: CustomBlockDefinition = {
  type: 'akd-branded-text',
  name: 'אזור טקסט ממותג',
  icon: 'format_quote',
  description: 'טקסט מעוצב בסגנון המותג',
  fields: [
    { key: 'text', label: 'טקסט', type: 'textarea' as const, default: 'טקסט לדוגמה' },
    { key: 'borderColor', label: 'צבע מסגרת', type: 'text' as const, default: '#ddff53' },
    { key: 'backgroundColor', label: 'צבע רקע', type: 'text' as const, default: '#fafafa' },
    { key: 'borderRadius', label: 'רדיוס', type: 'number' as const, default: 8, min: 0, max: 32, step: 2 },
    { key: 'spacing', label: 'ריווח', type: 'number' as const, default: 8, min: 0, max: 40, step: 4 },
  ],
  template: `{% assign bg = backgroundColor | default: '#fafafa' %}
{% assign border = borderColor | default: '#ddff53' %}
{% assign radius = borderRadius | default: 8 | plus: 0 %}
{% assign space = spacing | default: 8 | plus: 0 %}
<mj-section padding="{{ space }}px 0" direction="rtl">
  <mj-column background-color="{{ bg }}" border-radius="{{ radius }}px" border-right="4px solid {{ border }}">
    <mj-text font-size="16px" font-weight="300" color="#1a1a1a" align="right" padding="16px" font-family="Open Sans, Arial, sans-serif" line-height="1.6">{{ text }}</mj-text>
  </mj-column>
</mj-section>`,
  stylesheet: '',
  defaultStyles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
};

const PERSONAL_OPENING_DEF: CustomBlockDefinition = {
  type: 'akd-personal-opening',
  name: 'פתיח אישי',
  icon: 'waving_hand',
  description: 'פתיח אישי למייל',
  fields: [
    { key: 'greeting', label: 'ברכה', type: 'text' as const, default: 'שלום לכולם,' },
    { key: 'body', label: 'תוכן הפתיח', type: 'textarea' as const, default: 'אנחנו שמחים לשתף אתכם בעדכונים החמים ביותר מעולם המוזיקה.' },
    { key: 'signature', label: 'חתימה', type: 'text' as const, default: 'צוות אקורדישקייט' },
    { key: 'spacing', label: 'ריווח', type: 'number' as const, default: 8, min: 0, max: 40, step: 4 },
  ],
  template: `{% assign space = spacing | default: 8 | plus: 0 %}
<mj-section padding="{{ space }}px 0" direction="rtl">
  <mj-column>
    <mj-text font-size="16px" font-weight="600" color="#1a1a1a" align="right" padding="0 0 8px" font-family="Open Sans, Arial, sans-serif" line-height="1.6">{{ greeting }}</mj-text>
    <mj-text font-size="15px" font-weight="300" color="#4b5563" align="right" padding="0 0 16px" font-family="Open Sans, Arial, sans-serif" line-height="1.6">{{ body }}</mj-text>
    <mj-text font-size="14px" font-weight="600" color="#1a1a1a" align="right" padding="0" font-family="Open Sans, Arial, sans-serif">{{ signature }}</mj-text>
  </mj-column>
</mj-section>`,
  stylesheet: '',
  defaultStyles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
};

const SIGNATURE_DEF: CustomBlockDefinition = {
  type: 'akd-signature',
  name: 'חתימה',
  icon: 'draw',
  description: 'חתימה אישית למייל',
  fields: [
    { key: 'name', label: 'שם', type: 'text' as const, default: 'צוות אקורדישקייט' },
    { key: 'role', label: 'תפקיד', type: 'text' as const, default: '' },
    { key: 'spacing', label: 'ריווח', type: 'number' as const, default: 16, min: 0, max: 40, step: 4 },
  ],
  template: `{% assign space = spacing | default: 16 | plus: 0 %}
<mj-section padding="{{ space }}px 0 0 0" direction="rtl">
  <mj-column>
    <mj-divider border-color="#e0e0e0" border-width="1px" padding="0 0 12px" />
    <mj-text font-size="15px" font-weight="700" color="#1a1a1a" align="right" padding="0" font-family="Open Sans, Arial, sans-serif">{{ name }}</mj-text>
    {% if role and role != '' %}
    <mj-text font-size="13px" font-weight="300" color="#6b7280" align="right" padding="2px 0 0" font-family="Open Sans, Arial, sans-serif">{{ role }}</mj-text>
    {% endif %}
  </mj-column>
</mj-section>`,
  stylesheet: '',
  defaultStyles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
};

const BRANDED_FOOTER_DEF: CustomBlockDefinition = {
  type: 'akd-branded-footer',
  name: 'Footer ממותג',
  icon: 'bottom_panel_close',
  description: 'פוטר ממותג (ללא קישור הסרה - המערכת מוסיפה אוטומטית)',
  fields: [
    { key: 'showSocial', label: 'הצג קישורים חברתיים', type: 'boolean' as const, default: false },
    { key: 'facebookUrl', label: 'פייסבוק', type: 'text' as const, default: '' },
    { key: 'instagramUrl', label: 'אינסטגרם', type: 'text' as const, default: '' },
    { key: 'youtubeUrl', label: 'יוטיוב', type: 'text' as const, default: '' },
    { key: 'extraText', label: 'טקסט נוסף', type: 'textarea' as const, default: '' },
    { key: 'backgroundColor', label: 'צבע רקע', type: 'text' as const, default: '#1a1a1a' },
    { key: 'spacing', label: 'ריווח', type: 'number' as const, default: 0, min: 0, max: 40, step: 4 },
  ],
  template: `{% assign bg = backgroundColor | default: '#1a1a1a' %}
{% assign space = spacing | default: 0 | plus: 0 %}
<mj-section padding="{{ space }}px 0 0 0" direction="rtl" background-color="{{ bg }}">
  <mj-column>
    <mj-text font-size="14px" font-weight="600" color="#ddff53" align="center" padding="24px 0 4px" font-family="Open Sans, Arial, sans-serif">אקורדישקייט</mj-text>
    {% if extraText and extraText != '' %}
    <mj-text font-size="12px" font-weight="300" color="#9ca3af" align="center" padding="4px 24px 8px" font-family="Open Sans, Arial, sans-serif">{{ extraText }}</mj-text>
    {% endif %}
    {% if showSocial %}
    <mj-text font-size="12px" color="#6b7280" align="center" padding="8px 24px 16px" font-family="Open Sans, Arial, sans-serif">
      {% if facebookUrl and facebookUrl != '' %}<a href="{{ facebookUrl }}" style="color:#6b7280;margin:0 6px;">פייסבוק</a>{% endif %}
      {% if instagramUrl and instagramUrl != '' %}<a href="{{ instagramUrl }}" style="color:#6b7280;margin:0 6px;">אינסטגרם</a>{% endif %}
      {% if youtubeUrl and youtubeUrl != '' %}<a href="{{ youtubeUrl }}" style="color:#6b7280;margin:0 6px;">יוטיוב</a>{% endif %}
    </mj-text>
    {% endif %}
  </mj-column>
</mj-section>`,
  stylesheet: '',
  defaultStyles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
};

const UNSUBSCRIBE_DEF: CustomBlockDefinition = {
  type: 'akd-unsubscribe',
  name: 'אזור הסרה',
  icon: 'mail_off',
  description: 'אזור הסרה מרשימת תפוצה (שימוש כאשר רוצים שליטה ידנית מלאה)',
  fields: [
    { key: 'backgroundColor', label: 'צבע רקע', type: 'text' as const, default: '#f3f4f6' },
    { key: 'spacing', label: 'ריווח', type: 'number' as const, default: 0, min: 0, max: 40, step: 4 },
  ],
  template: `{% assign bg = backgroundColor | default: '#f3f4f6' %}
{% assign space = spacing | default: 0 | plus: 0 %}
<mj-section padding="{{ space }}px 0 0 0" direction="rtl" background-color="{{ bg }}">
  <mj-column>
    <mj-text font-size="12px" color="#9ca3af" align="center" padding="12px 24px" font-family="Open Sans, Arial, sans-serif">
      לא רוצה לקבל מאיתנו דיוור שיווקי?
      <a href="{{ params.unsubscribe_url }}" style="color:#1a1a1a;font-weight:700;text-decoration:underline;">להסרה מרשימת התפוצה</a>
    </mj-text>
  </mj-column>
</mj-section>`,
  stylesheet: '',
  defaultStyles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
};

export const SPACER_LIBRARY_ITEM: ComponentLibraryItem = {
  id: 'sys-spacer', name: 'רווח אנכי', description: 'הוספת מרווח בין רכיבים',
  category: 'structure', categoryLabel: 'מבנה', source: 'system', definition: SPACER_DEF, icon: SPACER_DEF.icon, tags: ['רווח', 'מרווח', 'מבנה'],
};

export const DIVIDER_LIBRARY_ITEM: ComponentLibraryItem = {
  id: 'sys-divider', name: 'מפריד אופקי', description: 'קו מפריד בסגנונות שונים',
  category: 'dividers', categoryLabel: 'מפרידים', source: 'system', definition: DIVIDER_DEF, icon: DIVIDER_DEF.icon, tags: ['מפריד', 'קו', 'עיצוב'],
};

export const BRANDED_SECTION_LIBRARY_ITEM: ComponentLibraryItem = {
  id: 'sys-branded-section', name: 'אזור עם רקע', description: 'מסגרת תוכן על רקע מותאם',
  category: 'structure', categoryLabel: 'מבנה', source: 'system', definition: BRANDED_SECTION_DEF, icon: BRANDED_SECTION_DEF.icon, tags: ['אזור', 'רקע', 'מבנה'],
};

export const TWO_COLUMNS_LIBRARY_ITEM: ComponentLibraryItem = {
  id: 'sys-two-columns', name: 'שתי עמודות', description: 'חלוקת תוכן לשתי עמודות',
  category: 'structure', categoryLabel: 'מבנה', source: 'system', definition: TWO_COLUMNS_DEF, icon: TWO_COLUMNS_DEF.icon, tags: ['עמודות', 'מבנה', 'פריסה'],
};

export const BRANDED_TEXT_LIBRARY_ITEM: ComponentLibraryItem = {
  id: 'sys-branded-text', name: 'אזור טקסט ממותג', description: 'בלוק טקסט עם מסגרת צבעונית',
  category: 'content', categoryLabel: 'תוכן', source: 'system', definition: BRANDED_TEXT_DEF, icon: BRANDED_TEXT_DEF.icon, tags: ['טקסט', 'ממותג', 'ציטוט'],
};

export const PERSONAL_OPENING_LIBRARY_ITEM: ComponentLibraryItem = {
  id: 'sys-personal-opening', name: 'פתיח אישי', description: 'בלוק פתיח עם ברכה, תוכן וחתימה',
  category: 'openers', categoryLabel: 'פתיחים', source: 'system', definition: PERSONAL_OPENING_DEF, icon: PERSONAL_OPENING_DEF.icon, tags: ['פתיח', 'אישי', 'ברכה'],
};

export const SIGNATURE_LIBRARY_ITEM: ComponentLibraryItem = {
  id: 'sys-signature', name: 'חתימה', description: 'חתימה אישית עם קו מפריד',
  category: 'email-end', categoryLabel: 'סיום מייל', source: 'system', definition: SIGNATURE_DEF, icon: SIGNATURE_DEF.icon, tags: ['חתימה', 'סיום', 'אישי'],
};

export const BRANDED_FOOTER_LIBRARY_ITEM: ComponentLibraryItem = {
  id: 'sys-branded-footer', name: 'Footer ממותג', description: 'פוטר בסגנון אקורדישקייט',
  category: 'footer', categoryLabel: 'Footer', source: 'system', definition: BRANDED_FOOTER_DEF, icon: BRANDED_FOOTER_DEF.icon, tags: ['פוטר', 'מותג', 'סיום'],
};

export const UNSUBSCRIBE_LIBRARY_ITEM: ComponentLibraryItem = {
  id: 'sys-unsubscribe', name: 'אזור הסרה', description: 'קישור הסרה מרשימת תפוצה',
  category: 'email-end', categoryLabel: 'סיום מייל', source: 'system', definition: UNSUBSCRIBE_DEF, icon: UNSUBSCRIBE_DEF.icon, tags: ['הסרה', 'unsubscribe'],
};
