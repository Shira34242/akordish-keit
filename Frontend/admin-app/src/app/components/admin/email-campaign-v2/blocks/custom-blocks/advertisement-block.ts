import type { CustomBlockDefinition } from '@templatical/types';
import { openMarketingLinkSelector } from '../marketing-link-selector-bridge.service';

export const ADVERTISEMENT_BLOCK: CustomBlockDefinition = {
  type: 'advertisement',
  name: 'פרסום',
  icon: 'campaign',
  description: 'הוספת באנר או כרטיס פרסום',
  fields: [
    {
      key: 'adType',
      label: 'סוג פרסום',
      type: 'select',
      options: [
        { label: 'באנר תמונה', value: 'banner' },
        { label: 'כרטיס פרסום', value: 'card' },
      ],
      default: 'banner',
    },
    {
      key: 'imageUrl',
      label: 'כתובת תמונה (URL)',
      type: 'image',
    },
    {
      key: 'altText',
      label: 'טקסט חלופי לתמונה (חובה)',
      type: 'text',
      default: 'פרסום',
    },
    {
      key: 'destinationUrl',
      label: 'קישור יעד (URL)',
      type: 'text',
    },
    {
      key: 'trackingLinkName',
      label: 'קישור המעקב שנבחר',
      type: 'text',
      readOnly: true,
    },
    {
      key: 'title',
      label: 'כותרת (לכרטיס בלבד)',
      type: 'text',
    },
    {
      key: 'description',
      label: 'טקסט (לכרטיס בלבד)',
      type: 'textarea',
    },
    {
      key: 'buttonText',
      label: 'טקסט כפתור (לכרטיס בלבד)',
      type: 'text',
      default: 'לפרטים',
    },
    {
      key: 'showAdLabel',
      label: 'הצג תווית "פרסום"',
      type: 'boolean',
      default: false,
    },
    {
      key: 'borderRadius',
      label: 'פינות מעוגלות (px)',
      type: 'number',
      default: 24,
      min: 0,
      max: 30,
      step: 2,
    },
    {
      key: 'backgroundColor',
      label: 'צבע רקע (hex)',
      type: 'text',
      default: '#F2F2F2',
    },
    {
      key: 'textColor',
      label: 'צבע טקסט (hex)',
      type: 'text',
      default: '#000000',
    },
    {
      key: 'buttonColor',
      label: 'צבע כפתור (hex)',
      type: 'text',
      default: '#000000',
    },
    {
      key: 'spacing',
      label: 'ריווח פנימי (px)',
      type: 'number',
      default: 0,
      min: 0,
      max: 40,
      step: 4,
    },
  ],
  dataSource: {
    label: 'בחירת קישור מעקב',
    onFetch: async (context) => {
      const selected = await openMarketingLinkSelector();
      if (!selected) return null;
      return {
        ...context.fieldValues,
        destinationUrl: selected.trackingUrl,
        trackingLinkName: selected.name,
      };
    },
  },
  template: `{% assign type = adType | default: 'banner' %}
{% assign radius = borderRadius | default: 24 | plus: 0 %}
{% assign bg = backgroundColor | default: '#F2F2F2' %}
{% assign txt = textColor | default: '#000000' %}
{% assign btn = buttonColor | default: '#000000' %}
{% assign space = spacing | default: 0 | plus: 0 %}
{% assign show_label = showAdLabel | default: false %}

{% if type == 'banner' and imageUrl and imageUrl != '' %}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="border-radius:{{ radius }}px;overflow:hidden;{% if space > 0 %}margin:{{ space }}px 0;{% endif %}">
    <tr>
      <td style="line-height:0;padding:0;">
        {% if destinationUrl and destinationUrl != '' %}<a href="{{ destinationUrl | escape }}" target="_blank" style="display:block;text-decoration:none;">{% endif %}<img src="{{ imageUrl | escape }}" alt="{{ altText | escape }}" width="600" style="display:block;width:100%;height:auto;border:0;border-radius:{{ radius }}px;" />{% if destinationUrl and destinationUrl != '' %}</a>{% endif %}
      </td>
    </tr>
    {% if show_label %}
    <tr>
      <td style="padding:4px 0 0;text-align:right;direction:rtl;">
        <span style="font-family:'Open Sans',Arial,sans-serif;font-size:10px;font-weight:300;color:#9ca3af;">פרסום</span>
      </td>
    </tr>
    {% endif %}
  </table>

{% elsif type == 'card' %}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="border-radius:{{ radius }}px;overflow:hidden;background-color:{{ bg }};{% if space > 0 %}margin:{{ space }}px 0;{% endif %}">
    {% if imageUrl and imageUrl != '' %}
    <tr>
      <td style="line-height:0;padding:0;">
        {% if destinationUrl and destinationUrl != '' %}<a href="{{ destinationUrl | escape }}" target="_blank" style="display:block;text-decoration:none;">{% endif %}<img src="{{ imageUrl | escape }}" alt="{{ altText | escape }}" width="600" style="display:block;width:100%;height:auto;border:0;" />{% if destinationUrl and destinationUrl != '' %}</a>{% endif %}
      </td>
    </tr>
    {% endif %}
    <tr>
      <td style="padding:16px;text-align:right;direction:rtl;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl">
          {% if title and title != '' %}
          <tr>
            <td style="padding:0 0 8px;text-align:right;">
              <span style="font-family:'Open Sans',Arial,sans-serif;font-size:16px;font-weight:800;color:{{ txt }};line-height:1.3;">{{ title | escape }}</span>
            </td>
          </tr>
          {% endif %}
          {% if description and description != '' %}
          <tr>
            <td style="padding:0 0 12px;text-align:right;">
              <span style="font-family:'Open Sans',Arial,sans-serif;font-size:14px;font-weight:300;color:{{ txt }};line-height:1.5;">{{ description | escape }}</span>
            </td>
          </tr>
          {% endif %}
          {% if buttonText and buttonText != '' and destinationUrl and destinationUrl != '' %}
          <tr>
            <td style="padding:0;text-align:right;">
              <table cellpadding="0" cellspacing="0" border="0" dir="rtl" style="display:inline-table;border-radius:999px;overflow:hidden;background-color:{{ btn }};">
                <tr>
                  <td style="padding:8px 20px;font-family:'Open Sans',Arial,sans-serif;font-size:14px;font-weight:800;line-height:1.2;"><a href="{{ destinationUrl | escape }}" target="_blank" style="color:{% if btn == '#000000' %}#ddff53{% else %}#ffffff{% endif %};text-decoration:none;">{{ buttonText | escape }}</a></td>
                </tr>
              </table>
            </td>
          </tr>
          {% endif %}
        </table>
      </td>
    </tr>
    {% if show_label %}
    <tr>
      <td style="padding:0 16px 8px;text-align:right;direction:rtl;">
        <span style="font-family:'Open Sans',Arial,sans-serif;font-size:10px;font-weight:300;color:#9ca3af;">פרסום</span>
      </td>
    </tr>
    {% endif %}
  </table>
{% endif %}`,
  stylesheet: '',
  defaultStyles: {
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
  },
};
