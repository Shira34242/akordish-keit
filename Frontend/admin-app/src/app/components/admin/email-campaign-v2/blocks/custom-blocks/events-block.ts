import type { CustomBlockDefinition } from '@templatical/types';
import { openEventsSelector } from '../content-selector-bridge.service';
import { ContentItem } from '../types';

export const EVENTS_BLOCK: CustomBlockDefinition = {
  type: 'events',
  name: 'הופעות',
  icon: 'calendar_month',
  description: 'הצגת הופעות נבחרות',
  fields: [
    {
      type: 'repeatable',
      key: 'items',
      label: 'הופעות נבחרות',
      minItems: 0,
      maxItems: 10,
      fields: [
        { type: 'text', key: 'id', label: 'מזהה', readOnly: true },
        { type: 'text', key: 'title', label: 'שם המופע', readOnly: true },
        { type: 'text', key: 'artistNames', label: 'אמן', readOnly: true },
        { type: 'text', key: 'eventDate', label: 'תאריך', readOnly: true },
        { type: 'text', key: 'location', label: 'מיקום', readOnly: true },
        { type: 'image', key: 'imageUrl', label: 'תמונה', readOnly: true },
        { type: 'text', key: 'publicUrl', label: 'קישור', readOnly: true },
        { type: 'text', key: 'altText', label: 'טקסט חלופי', readOnly: true },
      ],
    },
    {
      key: 'borderRadius',
      label: 'פינות מעוגלות (px)',
      type: 'number',
      default: 16,
      min: 0,
      max: 30,
      step: 2,
    },
    {
      key: 'cardGap',
      label: 'ריווח (px)',
      type: 'number',
      default: 10,
      min: 0,
      max: 24,
      step: 2,
    },
  ],
  dataSource: {
    label: 'בחירת הופעות',
    onFetch: async (context) => {
      const existing = (context.fieldValues['items'] as any[]) || [];
      const existingItems: ContentItem[] = existing.map((i: any) => ({
        id: parseInt(String(i.id)) || 0,
        title: i.title || '',
        artistNames: i.artistNames || '',
        imageUrl: i.imageUrl || '',
        publicUrl: i.publicUrl || '',
        altText: i.altText || i.title || '',
        eventDate: i.eventDate || '',
        location: i.location || '',
      }));

      const result = await openEventsSelector(existingItems);
      if (!result) return null;

      return {
        items: result.items.map((item) => ({
          id: String(item.id),
          title: item.title,
          artistNames: item.artistNames || '',
          imageUrl: item.imageUrl,
          publicUrl: item.publicUrl,
          altText: item.altText,
          eventDate: item.eventDate || '',
          location: item.location || '',
        })),
      };
    },
  },
  template: `{% assign radius = borderRadius | default: 12 | plus: 0 %}
{% assign gap = cardGap | default: 6 | plus: 0 %}
{% assign total = items | size %}

{% if total > 0 %}
<table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="table-layout:fixed;">
  {% assign max_idx = total | minus: 1 %}
  {% for i in (0..max_idx) %}
    {% assign item = items[i] %}
    {% assign col_idx = i | modulo: 5 %}

    {% if col_idx == 0 %}<tr>{% endif %}

    <td width="20%" valign="top" class="akd-event-cell" style="padding:{{ gap | divided_by: 2 }}px;direction:rtl;">

        <table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="border-radius:{{ radius }}px;overflow:hidden;background-color:#F2F2F2;">
          <tr>
            <td height="110" style="height:110px;line-height:0;padding:0;background-color:#F2F2F2;">
              {% if item.imageUrl and item.imageUrl != '' %}
              <a href="{{ item.publicUrl | escape }}" target="_blank" style="display:block;text-decoration:none;"><img src="{{ item.imageUrl | escape }}" alt="{{ item.altText | escape }}" width="120" height="110" style="display:block;width:100%;height:110px;object-fit:cover;border:0;" /></a>
              {% else %}
              <table width="100%" height="110" cellpadding="0" cellspacing="0" border="0" style="height:110px;background-color:#ddff53;">
                <tr>
                  <td height="110" style="height:110px;text-align:center;vertical-align:middle;padding:0 10px;">
                    <span style="font-family:'Open Sans',Arial,sans-serif;font-size:20px;font-weight:800;color:#000000;">&#9835;</span>
                  </td>
                </tr>
              </table>
              {% endif %}
              {% if item.eventDate and item.eventDate != '' %}
              <table cellpadding="0" cellspacing="0" border="0" style="background-color:#ddff53;border-radius:999px;overflow:hidden;">
                <tr>
                  <td style="padding:1px 6px;font-family:'Open Sans',Arial,sans-serif;font-size:9px;font-weight:800;color:#000000;line-height:1.3;">{{ item.eventDate | escape }}</td>
                </tr>
              </table>
              {% endif %}
            </td>
          </tr>
          <tr>
            <td height="42" style="height:42px;padding:5px 7px 7px;text-align:right;direction:rtl;vertical-align:top;overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl">
                <tr>
                  <td style="padding:0;text-align:right;">
                    <a href="{{ item.publicUrl | escape }}" target="_blank" style="display:block;height:28px;overflow:hidden;font-family:'Open Sans',Arial,sans-serif;font-size:11px;font-weight:700;color:#000000;line-height:14px;text-decoration:none;">{{ item.title | truncate: 38 | escape }}</a>
                  </td>
                </tr>
                {% if item.artistNames and item.artistNames != '' %}
                <tr>
                  <td style="padding:2px 0 0;text-align:right;">
                    <span style="font-family:'Open Sans',Arial,sans-serif;font-size:9px;font-weight:300;color:#404040;line-height:1.2;">{{ item.artistNames | escape }}</span>
                  </td>
                </tr>
                {% endif %}
              </table>
            </td>
          </tr>
        </table>

    </td>

    {% assign next_idx = i | plus: 1 %}
    {% assign next_mod = next_idx | modulo: 5 %}
    {% if next_mod == 0 or i == max_idx %}
    </tr>
    {% endif %}
  {% endfor %}
</table>
{% endif %}`,
  stylesheet: `
    @media (max-width: 480px) {
      .akd-event-cell {
        display: inline-block !important;
        width: 33.33% !important;
        padding: 0 3px 6px 0 !important;
      }
    }
  `,
  defaultStyles: {
    padding: { top: 12, right: 0, bottom: 12, left: 0 },
  },
};
