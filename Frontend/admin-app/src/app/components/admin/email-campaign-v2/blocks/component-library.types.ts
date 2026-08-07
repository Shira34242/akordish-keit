import type { CustomBlockDefinition } from '@templatical/types';

export type ComponentCategory =
  | 'headers'
  | 'openers'
  | 'content'
  | 'banners'
  | 'advertisements'
  | 'buttons'
  | 'header'
  | 'footer'
  | 'dividers'
  | 'email-end'
  | 'personal'
  | 'titles'
  | 'recommendations'
  | 'structure';

export const COMPONENT_CATEGORIES: { value: ComponentCategory; label: string }[] = [
  { value: 'titles', label: 'כותרות' },
  { value: 'banners', label: 'באנרים' },
  { value: 'recommendations', label: 'המלצות' },
  { value: 'content', label: 'תוכן' },
  { value: 'advertisements', label: 'פרסומות' },
  { value: 'buttons', label: 'כפתורים' },
  { value: 'header', label: 'Header' },
  { value: 'footer', label: 'Footer' },
  { value: 'dividers', label: 'מפרידים' },
  { value: 'structure', label: 'מבנה' },
  { value: 'email-end', label: 'סיום מייל' },
  { value: 'personal', label: 'רכיבים אישיים' },
];

export type ComponentSource = 'system' | 'user';

export interface ComponentLibraryItem {
  id: string;
  name: string;
  description?: string;
  category: ComponentCategory;
  categoryLabel: string;
  source: ComponentSource;
  definition: CustomBlockDefinition;
  icon?: string;
  previewThumbnail?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SaveComponentData {
  name: string;
  category: ComponentCategory;
  description?: string;
  tags?: string[];
  definition: CustomBlockDefinition;
}

export interface EmailTemplateDef {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail?: string;
  source: ComponentSource;
  blocks: any[];
  createdAt: string;
  updatedAt?: string;
}
