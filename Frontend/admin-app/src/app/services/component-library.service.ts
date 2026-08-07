import { Injectable, signal, computed } from '@angular/core';
import type { CustomBlockDefinition } from '@templatical/types';
import {
  type ComponentLibraryItem,
  type ComponentCategory,
  type SaveComponentData,
  COMPONENT_CATEGORIES,
} from '../components/admin/email-campaign-v2/blocks/component-library.types';
import { ALL_SYSTEM_BLOCKS } from '../components/admin/email-campaign-v2/blocks/system-blocks';

const USER_BLOCKS_KEY = 'akd_email_v2_user_blocks';

@Injectable({ providedIn: 'root' })
export class ComponentLibraryService {
  readonly searchQuery = signal('');
  readonly selectedCategory = signal<ComponentCategory | null>(null);

  private _userBlocks = signal<ComponentLibraryItem[]>(this._loadUserBlocks());

  readonly systemBlocks = signal<ComponentLibraryItem[]>(ALL_SYSTEM_BLOCKS);
  readonly userBlocks = this._userBlocks.asReadonly();

  readonly filteredSystemBlocks = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const cat = this.selectedCategory();
    let items = this.systemBlocks();
    if (cat) items = items.filter((b) => b.category === cat);
    if (q) items = items.filter((b) => b.name.toLowerCase().includes(q) || b.description?.toLowerCase().includes(q) || b.tags?.some((t) => t.toLowerCase().includes(q)));
    return items;
  });

  readonly filteredUserBlocks = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const cat = this.selectedCategory();
    let items = this._userBlocks();
    if (cat) items = items.filter((b) => b.category === cat);
    if (q) items = items.filter((b) => b.name.toLowerCase().includes(q) || b.description?.toLowerCase().includes(q) || b.tags?.some((t) => t.toLowerCase().includes(q)));
    return items;
  });

  getAllSystemBlockDefinitions(): CustomBlockDefinition[] {
    return this.systemBlocks().map((b) => b.definition);
  }

  getSystemBlockDefsByCategory(cat: ComponentCategory): CustomBlockDefinition[] {
    return this.systemBlocks().filter((b) => b.category === cat).map((b) => b.definition);
  }

  getBlockById(id: string): ComponentLibraryItem | undefined {
    return this.systemBlocks().find((b) => b.id === id) ?? this._userBlocks().find((b) => b.id === id);
  }

  getUserBlockDefinition(type: string): CustomBlockDefinition | undefined {
    return this._userBlocks().find((b) => b.definition.type === type)?.definition;
  }

  getAllUserBlockDefinitions(): CustomBlockDefinition[] {
    return this._userBlocks().map((b) => b.definition);
  }

  saveUserComponent(data: SaveComponentData): ComponentLibraryItem {
    const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: ComponentLibraryItem = {
      id,
      name: data.name,
      description: data.description,
      category: data.category,
      categoryLabel: COMPONENT_CATEGORIES.find((c) => c.value === data.category)?.label ?? 'אישי',
      source: 'user',
      definition: { ...data.definition, type: `user:${data.definition.type}-${id}` },
      icon: data.definition.icon,
      tags: data.tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this._userBlocks.update((blocks) => [...blocks, item]);
    this._persistUserBlocks();
    return item;
  }

  updateUserComponent(id: string, updates: Partial<Pick<ComponentLibraryItem, 'name' | 'description' | 'category' | 'tags' | 'definition'>>): void {
    this._userBlocks.update((blocks) =>
      blocks.map((b) => {
        if (b.id !== id) return b;
        const updated = { ...b, ...updates, updatedAt: new Date().toISOString() };
        if (updates.category) {
          updated.categoryLabel = COMPONENT_CATEGORIES.find((c) => c.value === updates.category)?.label ?? 'אישי';
        }
        return updated;
      })
    );
    this._persistUserBlocks();
  }

  duplicateUserComponent(id: string): ComponentLibraryItem | null {
    const existing = this._userBlocks().find((b) => b.id === id);
    if (!existing) return null;
    const newId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: ComponentLibraryItem = {
      ...existing,
      id: newId,
      name: `[עותק] ${existing.name}`,
      source: 'user',
      definition: { ...existing.definition, type: `user:${existing.definition.type.split(':').pop()}-${newId}` },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this._userBlocks.update((blocks) => [...blocks, item]);
    this._persistUserBlocks();
    return item;
  }

  deleteUserComponent(id: string): void {
    this._userBlocks.update((blocks) => blocks.filter((b) => b.id !== id));
    this._persistUserBlocks();
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedCategory.set(null);
  }

  private _loadUserBlocks(): ComponentLibraryItem[] {
    try {
      const raw = localStorage.getItem(USER_BLOCKS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private _persistUserBlocks(): void {
    try {
      localStorage.setItem(USER_BLOCKS_KEY, JSON.stringify(this._userBlocks()));
    } catch (e) {
      console.error('[ComponentLibrary] Failed to save user blocks:', e);
    }
  }
}
