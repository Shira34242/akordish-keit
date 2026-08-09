import type { CustomBlockDefinition } from '@templatical/types';
import { openPodcastsSelector } from '../content-selector-bridge.service';
import { ContentItem } from '../types';

export const PODCASTS_BLOCK: CustomBlockDefinition = {
  type: 'podcasts',
  name: 'פודקאסטים',
  icon: 'headphones',
  description: 'הצגת פרקי פודקאסט נבחרים',
  fields: [
    {
      type: 'repeatable',
      key: 'items',
      label: 'פרקים נבחרים',
      minItems: 0,
      maxItems: 10,
      fields: [
        { type: 'text', key: 'id', label: 'מזהה', readOnly: true },
        { type: 'text', key: 'title', label: 'שם הפרק', readOnly: true },
        { type: 'text', key: 'podcastName', label: 'שם הפודקאסט', readOnly: true },
        { type: 'image', key: 'imageUrl', label: 'תמונה', readOnly: true },
        { type: 'text', key: 'publicUrl', label: 'קישור', readOnly: true },
        { type: 'text', key: 'altText', label: 'טקסט חלופי', readOnly: true },
        { type: 'text', key: 'publishDate', label: 'תאריך', readOnly: true },
      ],
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
    label: 'בחירת פודקאסטים',
    onFetch: async (context) => {
      const existing = (context.fieldValues['items'] as any[]) || [];
      const existingItems: ContentItem[] = existing.map((i: any) => ({
        id: parseInt(String(i.id)) || 0,
        title: i.title || '',
        podcastName: i.podcastName || '',
        imageUrl: i.imageUrl || '',
        publicUrl: i.publicUrl || '',
        altText: i.altText || i.title || '',
        publishDate: i.publishDate || '',
      }));

      const result = await openPodcastsSelector(existingItems);
      if (!result) return null;

      return {
        items: result.items.map((item) => ({
          id: String(item.id),
          title: item.title,
          podcastName: item.podcastName || '',
          imageUrl: item.imageUrl,
          publicUrl: item.publicUrl,
          altText: item.altText,
          publishDate: item.publishDate || '',
        })),
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
    <td width="50%" valign="top" class="akd-podcast-cell" style="padding:{{ gap | divided_by: 2 }}px;direction:rtl;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="background-color:#000000;border-radius:{{ radius }}px;overflow:hidden;">
        <tr><td height="156" style="height:156px;padding:0;line-height:0;background-color:#000000;">
          {% if item.imageUrl and item.imageUrl != '' %}
          <a href="{{ item.publicUrl | escape }}" target="_blank" style="display:block;text-decoration:none;"><img src="{{ item.imageUrl | escape }}" alt="{{ item.altText | escape }}" width="300" height="156" style="display:block;width:100%;height:156px;object-fit:cover;border:0;" /></a>
          {% else %}
          <table width="100%" height="156" cellpadding="0" cellspacing="0" border="0" style="height:156px;background-color:#ddff53;"><tr><td height="156" style="height:156px;padding:0 20px;text-align:center;font-family:Arial,sans-serif;font-size:32px;font-weight:800;color:#000000;">&#9835;</td></tr></table>
          {% endif %}
        </td></tr>
        <tr><td height="72" style="height:72px;padding:12px 14px 6px;background-color:#000000;text-align:right;direction:rtl;vertical-align:top;overflow:hidden;">
          <a href="{{ item.publicUrl | escape }}" target="_blank" style="display:block;height:40px;overflow:hidden;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;font-weight:800;line-height:20px;">{{ item.title | truncate: 60 | escape }}</a>
          {% if item.podcastName and item.podcastName != '' %}<div style="height:16px;overflow:hidden;padding-top:4px;font-family:Arial,sans-serif;font-size:12px;line-height:16px;color:#dddddd;white-space:nowrap;">{{ item.podcastName | truncate: 42 | escape }}</div>{% endif %}
        </td></tr>
        <tr><td height="50" style="height:50px;padding:0 14px 14px;background-color:#000000;text-align:left;"><a href="{{ item.publicUrl | escape }}" target="_blank" style="display:inline-block;width:36px;height:36px;line-height:36px;border-radius:10px;background-color:#ddff53;color:#000000;text-align:center;text-decoration:none;font-family:Arial,sans-serif;font-size:22px;font-weight:800;">&#8249;</a></td></tr>
      </table>
    </td>
    {% assign next_idx = i | plus: 1 %}{% assign next_mod = next_idx | modulo: 2 %}
    {% if next_mod == 0 or i == max_idx %}</tr>{% endif %}
  {% endfor %}
</table>
{% endif %}`,
  stylesheet: `
    @media (max-width: 480px) {
      .akd-podcast-cell {
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
