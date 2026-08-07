import type { CustomBlockDefinition } from '@templatical/types';
import { openChordsSelector } from '../content-selector-bridge.service';
import { ContentItem } from '../types';

export const CHORDS_BLOCK: CustomBlockDefinition = {
  type: 'chords',
  name: 'אקורדים מאקורדישקייט',
  icon: 'music_note',
  description: 'הצגת אקורדים נבחרים בכרטיסים',
  fields: [
    {
      type: 'repeatable',
      key: 'items',
      label: 'אקורדים נבחרים',
      minItems: 0,
      maxItems: 12,
      fields: [
        { type: 'text', key: 'id', label: 'מזהה', readOnly: true },
        { type: 'text', key: 'title', label: 'שם השיר', readOnly: true },
        { type: 'text', key: 'artistNames', label: 'אמן', readOnly: true },
        { type: 'image', key: 'imageUrl', label: 'תמונה', readOnly: true },
        { type: 'text', key: 'publicUrl', label: 'קישור', readOnly: true },
        { type: 'text', key: 'altText', label: 'טקסט חלופי', readOnly: true },
        { type: 'text', key: 'createdAt', label: 'תאריך', readOnly: true },
        { type: 'text', key: 'viewCount', label: 'צפיות', readOnly: true },
      ],
    },
    {
      key: 'columns',
      label: 'עמודות',
      type: 'select',
      options: [
        { label: '2 עמודות (גריד)', value: '2' },
        { label: 'עמודה אחת (רשימה)', value: '1' },
      ],
      default: '2',
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
    label: 'בחירת אקורדים',
    onFetch: async (context) => {
      const existing = (context.fieldValues['items'] as any[]) || [];
      const existingItems: ContentItem[] = existing.map((i: any) => ({
        id: parseInt(String(i.id)) || 0,
        title: i.title || '',
        imageUrl: i.imageUrl || '',
        publicUrl: i.publicUrl || '',
        altText: i.altText || i.title || '',
        artistNames: i.artistNames || '',
        createdAt: i.createdAt || '',
        viewCount: i.viewCount,
      }));

      const result = await openChordsSelector(existingItems);
      if (!result) return null;

      return {
        items: result.items.map((item) => ({
          id: String(item.id),
          title: item.title,
          artistNames: item.artistNames || '',
          imageUrl: item.imageUrl,
          publicUrl: item.publicUrl,
          altText: item.altText,
          createdAt: item.createdAt || '',
          viewCount: item.viewCount,
        })),
      };
    },
  },
  template: `{% assign cols_int = columns | default: 2 | plus: 0 %}
{% assign total = items | size %}
{% assign gap = cardGap | default: 10 | plus: 0 %}
{% assign radius = borderRadius | default: 16 | plus: 0 %}

{% if total > 0 %}
  {% assign max_idx = total | minus: 1 %}
  {% for i in (0..max_idx) %}
    {% assign item = items[i] %}
    {% assign col_idx = i | modulo: cols_int %}

    {% if col_idx == 0 %}
      {% if i > 0 %}
</table>
      {% endif %}
<table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="margin-bottom:{{ gap }}px;">
  <tr>
    {% endif %}

    {% assign col_width = 100 | divided_by: cols_int %}
    <td width="{{ col_width }}%" valign="top" class="akd-chord-cell" style="padding:0 {{ gap | divided_by: 2 }}px;direction:rtl;">

      <a href="{{ item.publicUrl }}" target="_blank" style="text-decoration:none;display:block;direction:rtl;">

        <table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="background-color:#F2F2F2;border-radius:{{ radius }}px;overflow:hidden;">
          <tr>
            <td style="width:45%;padding:8px;vertical-align:middle;" valign="middle">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl">
                <tr>
                  <td style="padding:0;line-height:0;">
                    {% if item.imageUrl and item.imageUrl != '' %}
                    <img src="{{ item.imageUrl }}" alt="{{ item.altText }}" width="140" height="140" style="display:block;width:100%;height:auto;aspect-ratio:1/1;object-fit:cover;border-radius:12px;border:0;background-color:#ddff53;" />
                    {% else %}
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;aspect-ratio:1/1;border-radius:12px;background-color:#ddff53;">
                      <tr>
                        <td style="text-align:center;vertical-align:middle;padding:20px;">
                          <span style="font-family:'Open Sans',Arial,sans-serif;font-size:14px;font-weight:700;color:#000000;">&#9835;</span>
                        </td>
                      </tr>
                    </table>
                    {% endif %}
                  </td>
                </tr>
              </table>
            </td>
            <td style="width:55%;padding:8px 4px 8px 8px;text-align:right;direction:rtl;vertical-align:middle;" valign="middle">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl">
                <tr>
                  <td style="padding:0 0 2px;text-align:right;">
                    <span style="font-family:'Open Sans',Arial,sans-serif;font-size:12px;font-weight:300;color:#404040;line-height:1.4;">שיר / אקורדים</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 2px;text-align:right;">
                    <span style="font-family:'Open Sans',Arial,sans-serif;font-size:14px;font-weight:800;color:#000000;line-height:1.2;">{{ item.title }}</span>
                  </td>
                </tr>
                {% if item.artistNames and item.artistNames != '' %}
                <tr>
                  <td style="padding:0 0 4px;text-align:right;">
                    <span style="font-family:'Open Sans',Arial,sans-serif;font-size:12px;font-weight:300;color:#404040;line-height:1.3;">{{ item.artistNames }}</span>
                  </td>
                </tr>
                {% endif %}
                <tr>
                  <td style="padding:0;text-align:right;">
                    <span style="font-family:'Open Sans',Arial,sans-serif;font-size:16px;color:rgba(0,0,0,0.3);line-height:1;">&#8249;</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

      </a>

    </td>

    {% assign next_idx = i | plus: 1 %}
    {% assign next_mod = next_idx | modulo: cols_int %}
    {% if next_mod == 0 or i == max_idx %}
  </tr>
</table>
    {% endif %}
  {% endfor %}
{% endif %}`,
  stylesheet: `
    @media (max-width: 480px) {
      .akd-chord-cell {
        display: block !important;
        width: 100% !important;
        padding: 0 0 12px 0 !important;
      }
    }
  `,
  defaultStyles: {
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
  },
};
