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
    {% assign title_length = item.title | size %}
    {% if title_length > 52 %}{% assign title_font_size = 11 %}{% assign title_line_height = 13 %}{% elsif title_length > 34 %}{% assign title_font_size = 12 %}{% assign title_line_height = 15 %}{% else %}{% assign title_font_size = 14 %}{% assign title_line_height = 16 %}{% endif %}
    {% if col_idx == 0 %}<tr>{% endif %}
    <td width="50%" valign="top" class="akd-article-cell" style="padding:{{ gap | divided_by: 2 }}px;direction:rtl;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="background-color:#000000;border-radius:{{ radius }}px;overflow:hidden;">
        <tr><td height="128" style="height:128px;padding:0;line-height:0;background-color:#000000;">
          {% if item.imageUrl and item.imageUrl != '' %}
          <a href="{{ item.publicUrl | escape }}" target="_blank" style="display:block;text-decoration:none;"><img src="{{ item.imageUrl | escape }}" alt="{{ item.altText | escape }}" width="300" height="128" style="display:block;width:100%;height:128px;object-fit:cover;border:0;" /></a>
          {% else %}
          <table width="100%" height="128" cellpadding="0" cellspacing="0" border="0" style="height:128px;background-color:#ddff53;"><tr><td height="128" style="height:128px;padding:0 20px;text-align:center;font-family:Arial,sans-serif;font-size:28px;font-weight:800;color:#000000;">&#9835;</td></tr></table>
          {% endif %}
        </td></tr>
        <tr><td height="42" style="height:42px;padding:5px 10px;background-color:#000000;text-align:right;direction:rtl;vertical-align:middle;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl"><tr>
            <td valign="middle" style="padding:0 0 0 8px;text-align:right;"><a href="{{ item.publicUrl | escape }}" target="_blank" style="display:block;height:32px;overflow:hidden;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:{{ title_font_size }}px;font-weight:800;line-height:{{ title_line_height }}px;">{{ item.title | truncate: 68 | escape }}</a></td>
            <td width="32" valign="middle" style="width:32px;padding:0;text-align:left;"><a href="{{ item.publicUrl | escape }}" target="_blank" style="display:inline-block;width:32px;height:32px;line-height:32px;border-radius:9px;background-color:#ddff53;color:#000000;text-align:center;text-decoration:none;font-family:Arial,sans-serif;font-size:20px;font-weight:800;">&#8249;</a></td>
          </tr></table>
        </td></tr>
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
