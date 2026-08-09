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
    {% if col_idx == 0 %}<tr>{% endif %}
    <td width="50%" valign="top" class="akd-article-cell" style="padding:{{ gap | divided_by: 2 }}px;direction:rtl;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="background-color:#000000;border-radius:{{ radius }}px;overflow:hidden;">
        <tr><td style="padding:0;line-height:0;">
          {% if item.imageUrl and item.imageUrl != '' %}
          <a href="{{ item.publicUrl | escape }}" target="_blank" style="display:block;text-decoration:none;"><img src="{{ item.imageUrl | escape }}" alt="{{ item.altText | escape }}" width="300" style="display:block;width:100%;height:auto;border:0;" /></a>
          {% else %}
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ddff53;"><tr><td style="padding:42px 20px;text-align:center;font-family:Arial,sans-serif;font-size:32px;font-weight:800;color:#000000;">&#9835;</td></tr></table>
          {% endif %}
        </td></tr>
        <tr><td style="padding:14px 14px 8px;background-color:#000000;text-align:right;direction:rtl;">
          <a href="{{ item.publicUrl | escape }}" target="_blank" style="color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;font-weight:800;line-height:1.4;">{{ item.title | escape }}</a>
          {% if showCategory and item.categoryName and item.categoryName != '' %}<div style="padding-top:5px;font-family:Arial,sans-serif;font-size:12px;line-height:1.35;color:#dddddd;">{{ item.categoryName | escape }}</div>{% endif %}
          {% if showDescription and item.shortDescription and item.shortDescription != '' %}<div style="padding-top:5px;font-family:Arial,sans-serif;font-size:12px;line-height:1.4;color:#dddddd;">{{ item.shortDescription | escape }}</div>{% endif %}
        </td></tr>
        <tr><td style="padding:0 14px 14px;background-color:#000000;text-align:left;"><a href="{{ item.publicUrl | escape }}" target="_blank" style="display:inline-block;width:36px;height:36px;line-height:36px;border-radius:10px;background-color:#ddff53;color:#000000;text-align:center;text-decoration:none;font-family:Arial,sans-serif;font-size:22px;font-weight:800;">&#8249;</a></td></tr>
      </table>
    </td>
    {% assign next_idx = i | plus: 1 %}{% assign next_mod = next_idx | modulo: 2 %}
    {% if next_mod == 0 or i == max_idx %}</tr>{% endif %}
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
