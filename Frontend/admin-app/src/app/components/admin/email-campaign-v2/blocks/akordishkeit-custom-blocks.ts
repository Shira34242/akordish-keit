import type { CustomBlockDefinition } from '@templatical/types';
import { openArticleSelector } from './content-selector-bridge.service';

export const ARTICLES_BLOCK: CustomBlockDefinition = {
  type: 'articles',
  name: 'כתבות',
  icon: 'newspaper',
  description: 'הצגת כתבות נבחרות בבאנרים מעוצבים',
  fields: [
    {
      type: 'repeatable',
      key: 'items',
      label: 'כתבות נבחרות',
      minItems: 0,
      maxItems: 8,
      fields: [
        { type: 'text', key: 'title', label: 'כותרת', readOnly: true },
        { type: 'image', key: 'imageUrl', label: 'תמונה', readOnly: true },
        { type: 'text', key: 'publicUrl', label: 'קישור', readOnly: true },
        { type: 'text', key: 'categoryName', label: 'קטגוריה', readOnly: true },
        { type: 'textarea', key: 'shortDescription', label: 'תקציר', readOnly: true },
        { type: 'text', key: 'publishDate', label: 'תאריך', readOnly: true },
        { type: 'text', key: 'altText', label: 'טקסט חלופי', readOnly: true },
      ],
    },
    {
      key: 'columns',
      label: 'מספר עמודות',
      type: 'select',
      options: [
        { label: 'עמודה אחת (רשימה)', value: '1' },
        { label: '2 עמודות', value: '2' },
        { label: '3 עמודות', value: '3' },
      ],
      default: '2',
    },
    {
      key: 'showCategory',
      label: 'הצגת קטגוריה',
      type: 'boolean',
      default: true,
    },
    {
      key: 'showDescription',
      label: 'הצגת תקציר',
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
      key: 'cardGap',
      label: 'ריווח (px)',
      type: 'number',
      default: 12,
      min: 0,
      max: 24,
      step: 2,
    },
  ],
  dataSource: {
    label: 'בחירת כתבות',
    onFetch: async (context) => {
      const existing = (context.fieldValues['items'] as any[]) || [];
      const existingItems = existing.map((i: any) => ({
        id: parseInt(String(i.id)) || 0,
        title: i.title || '',
        imageUrl: i.imageUrl || '',
        publicUrl: i.publicUrl || '',
        categoryName: i.categoryName || '',
        shortDescription: i.shortDescription || '',
        publishDate: i.publishDate || '',
        altText: i.altText || i.title || '',
      }));
      const result = await openArticleSelector(
        existingItems,
        context.fieldValues['showCategory'] as boolean | undefined,
        context.fieldValues['showDescription'] as boolean | undefined
      );
      if (!result) return null;
      return {
        items: result.items.map((item) => ({
          id: String(item.id),
          title: item.title,
          imageUrl: item.imageUrl,
          publicUrl: item.publicUrl,
          categoryName: item.categoryName,
          shortDescription: item.shortDescription,
          publishDate: item.publishDate,
          altText: item.altText,
        })),
        showCategory: result.showCategory,
        showDescription: result.showDescription,
        borderRadius: result.borderRadius,
        cardGap: result.spacing,
      };
    },
  },
  template: `{% assign radius = borderRadius | default: 24 | plus: 0 %}
{% assign gap = cardGap | default: 12 | plus: 0 %}
{% assign total = items | size %}

{% if total > 0 %}
<table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="table-layout:fixed;">
  {% assign max_idx = total | minus: 1 %}
  {% for i in (0..max_idx) %}
    {% assign item = items[i] %}
    {% assign col_idx = i | modulo: 2 %}

    {% if col_idx == 0 %}
      {% if i > 0 %}
      </tr>
      {% endif %}
    <tr>
    {% endif %}

    <td width="50%" valign="top" class="akd-article-cell" style="padding:{{ gap | divided_by: 2 }}px;direction:rtl;">

      <a href="{{ item.publicUrl }}" target="_blank" style="text-decoration:none;display:block;direction:rtl;">

        <table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="border-radius:{{ radius }}px;overflow:hidden;background-color:#000000;">
          <tr>
            <td style="padding:0;line-height:0;">
              <!--[if !mso]><!-->
              <div style="position:relative;max-width:100%;overflow:hidden;border-radius:{{ radius }}px;">
              <!--<![endif]-->
                {% if item.imageUrl and item.imageUrl != '' %}
                <img src="{{ item.imageUrl }}" alt="{{ item.altText }}" width="300" style="display:block;width:100%;height:auto;aspect-ratio:1.35/1;object-fit:cover;border:0;" />
                {% else %}
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="aspect-ratio:1.35/1;background-color:#ddff53;">
                  <tr>
                    <td style="text-align:center;vertical-align:middle;padding:20px;">
                      <span style="font-family:'Open Sans',Arial,sans-serif;font-size:32px;font-weight:800;color:#000000;">&#9835;</span>
                    </td>
                  </tr>
                </table>
                {% endif %}
                <!--[if !mso]><!-->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="position:absolute;bottom:0;right:0;left:0;background:linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.30) 50%, rgba(0,0,0,0.05) 100%);padding:14px;">
                  <tr>
                    <td style="padding:0 0 4px;text-align:right;">
                      <span style="font-family:'Open Sans',Arial,sans-serif;font-size:14px;font-weight:800;color:#ffffff;line-height:1.35;">{{ item.title }}</span>
                    </td>
                    <td width="40" style="vertical-align:bottom;text-align:left;padding:0 0 0 8px;">
                      <table width="36" height="36" cellpadding="0" cellspacing="0" border="0" style="width:36px;height:36px;border-radius:10px;background-color:#ddff53;overflow:hidden;">
                        <tr>
                          <td style="text-align:center;vertical-align:middle;color:#000000;font-family:'Open Sans',Arial,sans-serif;font-size:18px;font-weight:800;line-height:1;">&#8249;</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  {% if showCategory and item.categoryName and item.categoryName != '' %}
                  <tr>
                    <td style="padding:0;text-align:right;">
                      <span style="font-family:'Open Sans',Arial,sans-serif;font-size:12px;font-weight:300;color:rgba(255,255,255,0.85);line-height:1.3;">{{ item.categoryName }}</span>
                    </td>
                  </tr>
                  {% endif %}
                  {% if showDescription and item.shortDescription and item.shortDescription != '' %}
                  <tr>
                    <td style="padding:2px 0 0;text-align:right;">
                      <span style="font-family:'Open Sans',Arial,sans-serif;font-size:11px;font-weight:300;color:rgba(255,255,255,0.75);line-height:1.3;">{{ item.shortDescription }}</span>
                    </td>
                  </tr>
                  {% endif %}
                </table>
              </div>
              <!--<![endif]-->
              <!--[if mso]>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="background-color:#000000;">
                <tr>
                  <td style="padding:14px;background:linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.30) 50%, rgba(0,0,0,0.05) 100%);">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl">
                      <tr>
                        <td style="padding:0 0 4px;text-align:right;font-family:'Open Sans',Arial,sans-serif;font-size:14px;font-weight:800;color:#ffffff;line-height:1.35;">{{ item.title }}</td>
                        <td width="40" style="vertical-align:bottom;text-align:left;padding:0 0 0 8px;">
                          <table width="36" height="36" cellpadding="0" cellspacing="0" border="0" style="width:36px;height:36px;border-radius:10px;background-color:#ddff53;overflow:hidden;">
                            <tr>
                              <td style="text-align:center;vertical-align:middle;color:#000000;font-family:'Open Sans',Arial,sans-serif;font-size:18px;font-weight:800;line-height:1;">&#8249;</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      {% if showCategory and item.categoryName and item.categoryName != '' %}
                      <tr>
                        <td style="padding:0;text-align:right;font-family:'Open Sans',Arial,sans-serif;font-size:12px;font-weight:300;color:rgba(255,255,255,0.85);line-height:1.3;">{{ item.categoryName }}</td>
                      </tr>
                      {% endif %}
                      {% if showDescription and item.shortDescription and item.shortDescription != '' %}
                      <tr>
                        <td style="padding:2px 0 0;text-align:right;font-family:'Open Sans',Arial,sans-serif;font-size:11px;font-weight:300;color:rgba(255,255,255,0.75);line-height:1.3;">{{ item.shortDescription }}</td>
                      </tr>
                      {% endif %}
                    </table>
                  </td>
                </tr>
              </table>
              <![endif]-->
            </td>
          </tr>
        </table>

      </a>

    </td>

    {% assign next_idx = i | plus: 1 %}
    {% assign next_mod = next_idx | modulo: 2 %}
    {% if next_mod == 0 or i == max_idx %}
    </tr>
    {% endif %}
  {% endfor %}
</table>
{% endif %}`,
  stylesheet: `
    @media (max-width: 480px) {
      .akd-article-cell {
        display: block !important;
        width: 100% !important;
        padding: 0 0 14px 0 !important;
      }
    }
  `,
  defaultStyles: {
    padding: { top: 12, right: 0, bottom: 12, left: 0 },
  },
};
