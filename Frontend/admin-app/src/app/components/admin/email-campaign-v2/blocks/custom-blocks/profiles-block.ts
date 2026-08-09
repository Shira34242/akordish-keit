import type { CustomBlockDefinition } from '@templatical/types';
import { openProfilesSelector } from '../content-selector-bridge.service';
import { ContentItem } from '../types';

export const PROFILES_BLOCK: CustomBlockDefinition = {
  type: 'profiles',
  name: 'פרופילים',
  icon: 'group',
  description: 'הצגת פרופילים נבחרים מנותני שירות ומורים',
  fields: [
    {
      type: 'repeatable',
      key: 'items',
      label: 'פרופילים נבחרים',
      minItems: 0,
      maxItems: 8,
      fields: [
        { type: 'text', key: 'id', label: 'מזהה', readOnly: true },
        { type: 'text', key: 'title', label: 'שם', readOnly: true },
        { type: 'text', key: 'categoryName', label: 'קטגוריה', readOnly: true },
        { type: 'text', key: 'cityName', label: 'עיר', readOnly: true },
        { type: 'image', key: 'imageUrl', label: 'תמונה', readOnly: true },
        { type: 'text', key: 'publicUrl', label: 'קישור', readOnly: true },
        { type: 'text', key: 'altText', label: 'טקסט חלופי', readOnly: true },
      ],
    },
    {
      key: 'borderRadius',
      label: 'פינות מעוגלות כרטיס (px)',
      type: 'number',
      default: 24,
      min: 0,
      max: 30,
      step: 2,
    },
    {
      key: 'imageRadius',
      label: 'פינות מעוגלות תמונה (px)',
      type: 'number',
      default: 18,
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
    label: 'בחירת פרופילים',
    onFetch: async (context) => {
      const existing = (context.fieldValues['items'] as any[]) || [];
      const existingItems: ContentItem[] = existing.map((i: any) => ({
        id: parseInt(String(i.id)) || 0,
        title: i.title || '',
        categoryName: i.categoryName || '',
        cityName: i.cityName || '',
        imageUrl: i.imageUrl || '',
        publicUrl: i.publicUrl || '',
        altText: i.altText || i.title || '',
      }));

      const result = await openProfilesSelector(existingItems);
      if (!result) return null;

      return {
        items: result.items.map((item) => ({
          id: String(item.id),
          title: item.title,
          categoryName: item.categoryName || '',
          cityName: item.cityName || '',
          imageUrl: item.imageUrl,
          publicUrl: item.publicUrl,
          altText: item.altText,
        })),
      };
    },
  },
  template: `{% assign card_radius = borderRadius | default: 16 | plus: 0 %}
{% assign img_radius = imageRadius | default: 12 | plus: 0 %}
{% assign gap = cardGap | default: 6 | plus: 0 %}
{% assign total = items | size %}

{% if total > 0 %}
<table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="table-layout:fixed;">
  {% assign max_idx = total | minus: 1 %}
  {% for i in (0..max_idx) %}
    {% assign item = items[i] %}
    {% assign col_idx = i | modulo: 4 %}

    {% if col_idx == 0 %}<tr>{% endif %}

    <td width="25%" valign="top" class="akd-profile-cell" style="padding:{{ gap | divided_by: 2 }}px;direction:rtl;">

        <table width="100%" height="134" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="height:134px;border-radius:{{ card_radius }}px;overflow:hidden;background-color:#F2F2F2;">
          <tr>
            <td style="padding:8px;">
              <table width="100%" height="78" cellpadding="0" cellspacing="0" border="0" style="height:78px;border-radius:{{ img_radius }}px;overflow:hidden;background-color:#ffffff;">
                <tr>
                  <td style="vertical-align:middle;text-align:center;padding:0;line-height:0;">
                    {% if item.imageUrl and item.imageUrl != '' %}
                    <a href="{{ item.publicUrl | escape }}" target="_blank" style="display:block;text-decoration:none;"><img src="{{ item.imageUrl | escape }}" alt="{{ item.altText | escape }}" width="120" height="78" style="display:block;width:100%;height:78px;object-fit:cover;border:0;" /></a>
                    {% else %}
                    <span style="font-family:'Open Sans',Arial,sans-serif;font-size:22px;font-weight:800;color:rgba(0,0,0,0.25);">{{ item.title | slice: 0, 1 | escape }}</span>
                    {% endif %}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td height="42" style="height:42px;padding:0 7px 7px;text-align:right;direction:rtl;vertical-align:top;overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl">
                <tr>
                  <td style="padding:0;text-align:right;">
                    <a href="{{ item.publicUrl | escape }}" target="_blank" style="display:block;height:26px;overflow:hidden;font-family:'Open Sans',Arial,sans-serif;font-size:11px;font-weight:700;color:#000000;line-height:13px;text-decoration:none;">{{ item.title | truncate: 34 | escape }}</a>
                  </td>
                </tr>
                {% if item.categoryName and item.categoryName != '' %}
                <tr>
                  <td style="padding:2px 0 0;text-align:right;">
                    <span style="font-family:'Open Sans',Arial,sans-serif;font-size:9px;font-weight:300;color:#404040;line-height:1.2;">{{ item.categoryName | escape }}</span>
                  </td>
                </tr>
                {% endif %}
                {% if item.cityName and item.cityName != '' %}
                <tr>
                  <td style="padding:1px 0 0;text-align:right;">
                    <span style="font-family:'Open Sans',Arial,sans-serif;font-size:9px;font-weight:300;color:#404040;line-height:1.2;">{{ item.cityName | escape }}</span>
                  </td>
                </tr>
                {% endif %}
              </table>
            </td>
          </tr>
        </table>

    </td>

    {% assign next_idx = i | plus: 1 %}
    {% assign next_mod = next_idx | modulo: 4 %}
    {% if next_mod == 0 or i == max_idx %}
    </tr>
    {% endif %}
  {% endfor %}
</table>
{% endif %}`,
  stylesheet: `
    @media (max-width: 480px) {
      .akd-profile-cell {
        display: inline-block !important;
        width: 50% !important;
        padding: 0 3px 6px 0 !important;
      }
    }
  `,
  defaultStyles: {
    padding: { top: 12, right: 0, bottom: 12, left: 0 },
  },
};
