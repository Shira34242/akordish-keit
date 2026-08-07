import { Injectable, signal, computed } from '@angular/core';
import type { EmailTemplateDef } from '../components/admin/email-campaign-v2/blocks/component-library.types';
import { PREMADE_TEMPLATES } from '../components/admin/email-campaign-v2/templates/premade-templates';

const USER_TEMPLATES_KEY = 'akd_email_v2_user_templates';

@Injectable({ providedIn: 'root' })
export class TemplateLibraryService {
  readonly searchQuery = signal('');

  private _userTemplates = signal<EmailTemplateDef[]>(this._loadUserTemplates());

  readonly premadeTemplates = signal<EmailTemplateDef[]>(PREMADE_TEMPLATES);
  readonly userTemplates = this._userTemplates.asReadonly();

  readonly filteredPremadeTemplates = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.premadeTemplates();
    return this.premadeTemplates().filter((t) =>
      t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  });

  readonly filteredUserTemplates = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this._userTemplates();
    return this._userTemplates().filter((t) =>
      t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  });

  saveUserTemplate(template: Omit<EmailTemplateDef, 'id' | 'createdAt' | 'source'>): EmailTemplateDef {
    const def: EmailTemplateDef = {
      ...template,
      id: `ut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      source: 'user',
      createdAt: new Date().toISOString(),
    };
    this._userTemplates.update((t) => [...t, def]);
    this._persist();
    return def;
  }

  deleteUserTemplate(id: string): void {
    this._userTemplates.update((t) => t.filter((x) => x.id !== id));
    this._persist();
  }

  getPremadeTemplate(id: string): EmailTemplateDef | undefined {
    return this.premadeTemplates().find((t) => t.id === id);
  }

  getUserTemplate(id: string): EmailTemplateDef | undefined {
    return this._userTemplates().find((t) => t.id === id);
  }

  private _loadUserTemplates(): EmailTemplateDef[] {
    try {
      const raw = localStorage.getItem(USER_TEMPLATES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private _persist(): void {
    localStorage.setItem(USER_TEMPLATES_KEY, JSON.stringify(this._userTemplates()));
  }
}
