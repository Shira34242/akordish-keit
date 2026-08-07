import {
  Component,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  input,
  output,
  signal,
  viewChild,
  inject,
} from '@angular/core';
import { init, type TemplaticalEditor, type TemplateContent, type MergeTagsConfig, type ThemeOverrides, type CustomBlockDefinition } from '@templatical/editor';
import { createCustomBlock, generateId } from '@templatical/types';
import { MediaService } from '../../../services/admin/media.service';
import { firstValueFrom } from 'rxjs';
import { ARTICLES_BLOCK } from './blocks/akordishkeit-custom-blocks';
import { CHORDS_BLOCK } from './blocks/custom-blocks/chords-block';
import { PODCASTS_BLOCK } from './blocks/custom-blocks/podcasts-block';
import { EVENTS_BLOCK } from './blocks/custom-blocks/events-block';
import { PROFILES_BLOCK } from './blocks/custom-blocks/profiles-block';
import { ADVERTISEMENT_BLOCK } from './blocks/custom-blocks/advertisement-block';
import { ContentSelectorBridgeService } from './blocks/content-selector-bridge.service';
import { ComponentLibraryService } from '../../../services/component-library.service';

@Component({
  selector: 'app-v2-editor',
  standalone: true,
  host: { dir: 'rtl' },
  styles: [`
    :host {
      flex: 1;
      min-height: 0;
      display: block;
      overflow: visible;

      direction: rtl;
      --tpl-user-primary: #ddff53;
      --tpl-user-primary-hover: #c8e649;
      --tpl-user-primary-light: rgba(221, 255, 83, 0.12);
      --tpl-user-bg: #ffffff;
      --tpl-user-bg-elevated: #f8f9fa;
      --tpl-user-bg-hover: #f0f1f3;
      --tpl-user-bg-active: #e8eaed;
      --tpl-user-border: #e0e0e0;
      --tpl-user-border-light: #eeeeee;
      --tpl-user-text: #1a1a1a;
      --tpl-user-text-muted: #6b7280;
      --tpl-user-text-dim: #9ca3af;
      --tpl-user-canvas-bg: #f3f4f6;
      --tpl-user-radius: 8px;
      --tpl-user-radius-sm: 6px;
      --tpl-user-radius-lg: 12px;
      --tpl-user-ring: 0 0 0 2px rgba(221, 255, 83, 0.4);
      --tpl-user-shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
      --tpl-user-shadow: 0 1px 3px rgba(0,0,0,0.08);
      --tpl-user-shadow-md: 0 4px 12px rgba(0,0,0,0.1);
      --tpl-user-overlay: rgba(0,0,0,0.35);
    }
    .editor-host { width: 100%; height: 100%; overflow: visible; }
    .editor-error { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 8px; color: #dc2626; font-size: 15px; padding: 32px; }
    .editor-error .material-symbols-outlined { font-size: 48px; }
    .editor-error button { margin-top: 12px; padding: 8px 24px; border: 1px solid #dc2626; border-radius: 6px; background: #fef2f2; color: #dc2626; cursor: pointer; font-size: 14px; }
    .editor-error-detail { font-size: 12px; color: #9ca3af; font-family: monospace; max-width: 500px; text-align: center; word-break: break-all; direction: ltr; }
  `],
  template: `
    @if (_error()) {
      <div class="editor-error">
        <span class="material-symbols-outlined">error</span>
        <p>עורך המיילים לא הצליח להיטען</p>
        <p class="editor-error-detail">{{ _error() }}</p>
        <button (click)="retry()">נסה שוב</button>
      </div>
    }
    <div #editorContainer class="editor-host"></div>
  `,
})
export class V2EditorComponent implements AfterViewInit, OnDestroy {
  savedDesignJson = input<string | null>(null);
  savedCampaignId = input<number | null>(null);

  contentChange = output<TemplateContent>();
  dirtyChange = output<boolean>();
  mjmlChange = output<string>();
  editorReady = output<void>();

  readonly editorContainer = viewChild<ElementRef<HTMLDivElement>>('editorContainer');

  _editor: TemplaticalEditor | null = null;
  readonly _dirty = signal(false);
  private _mjmlTimer: ReturnType<typeof setTimeout> | null = null;
  readonly _error = signal<string | null>(null);

  private readonly _bridge = inject(ContentSelectorBridgeService);
  private readonly _library = inject(ComponentLibraryService);

  private get _allCustomBlocks(): CustomBlockDefinition[] {
    const systemDefs = this._library.getAllSystemBlockDefinitions();
    const userDefs = this._library.getAllUserBlockDefinitions();
    return [
      ARTICLES_BLOCK, CHORDS_BLOCK, PODCASTS_BLOCK, EVENTS_BLOCK, PROFILES_BLOCK, ADVERTISEMENT_BLOCK,
      ...systemDefs,
      ...userDefs,
    ];
  }

  private get _allPaletteBlocks(): string[] {
    const base = ['section', 'title', 'paragraph', 'image', 'button', 'divider', 'spacer', 'custom:articles', 'custom:chords', 'custom:podcasts', 'custom:events', 'custom:profiles', 'custom:advertisement'];
    const systemTypes = this._library.getAllSystemBlockDefinitions().map((d) => `custom:${d.type}`);
    const userTypes = this._library.getAllUserBlockDefinitions().map((d) => `custom:${d.type}`);
    return [...base, ...systemTypes, ...userTypes];
  }

  constructor(
    private readonly mediaService: MediaService,
  ) { }

  get editor(): TemplaticalEditor | null { return this._editor; }
  getContent(): TemplateContent | null { return this._editor?.getContent() ?? null; }
  get isDirty(): boolean { return this._dirty(); }

  insertCustomBlock(blockDef: CustomBlockDefinition): void {
    if (!this._editor) return;
    try {
      const content = this._editor.getContent();
      const newBlock = createCustomBlock({ type: blockDef.type } as any);
      newBlock.id = generateId();
      content.blocks.push(newBlock as any);
      this._editor.setContent(content);
    } catch (e) {
      console.error('[V2Editor] Failed to insert block:', e);
    }
  }

  refreshCustomBlocks(): void {
    if (!this._editor) return;
    try {
      const content = this._editor.getContent();
      this._editor.unmount();
      this._editor = null;
      const container = this.editorContainer()?.nativeElement;
      if (!container) return;
      this.initEditorWithContent(container, content);
    } catch (e) {
      console.error('[V2Editor] Failed to refresh blocks:', e);
    }
  }

  async ngAfterViewInit(): Promise<void> {
    await this.initEditor();
  }

  ngOnDestroy(): void {
    this.clearMjmlTimer();
    this._editor?.unmount();
    this._editor = null;
  }

  markSaved(): void {
    this._dirty.set(false);
    this.dirtyChange.emit(false);
  }

  async generateMjml(): Promise<string> {
    if (!this._editor) return '';
    return this._editor.toMjml();
  }

  async retry(): Promise<void> {
    this._error.set(null);
    this._editor?.unmount();
    this._editor = null;
    await this.initEditor();
  }

  private async initEditor(): Promise<void> {
    const container = this.editorContainer()?.nativeElement;
    if (!container) return;

    let initialContent: TemplateContent | undefined;
    const savedJson = this.savedDesignJson();
    if (savedJson) {
      try { initialContent = JSON.parse(savedJson) as TemplateContent; }
      catch { console.warn('[V2Editor] Failed to parse saved design JSON'); }
    }

    await this.initEditorWithContent(container, initialContent);
  }

  private async initEditorWithContent(container: HTMLElement, initialContent?: TemplateContent): Promise<void> {

    const mergeTagsConfig: MergeTagsConfig = {
      syntax: 'handlebars',
      tags: [{ label: 'הסרה מרשימת תפוצה', value: '{{ params.unsubscribe_url }}', group: 'מערכת' }],
    };

    const theme: ThemeOverrides = {
      primary: '#ddff53',
      primaryHover: '#c8e649',
      primaryLight: 'rgba(221,255,83,0.12)',
      bg: '#ffffff',
      bgElevated: '#f8f9fa',
      bgHover: '#f0f1f3',
      bgActive: '#e8eaed',
      border: '#e0e0e0',
      borderLight: '#eeeeee',
      text: '#1a1a1a',
      textMuted: '#6b7280',
      textDim: '#9ca3af',
      canvasBg: '#f3f4f6',
    };

    try {
      this._editor = await init({
        container,
        content: initialContent,
        shadowDom: true,
        branding: false,
        locale: 'he',
        uiTheme: 'light',
        theme,
        templateDefaults: {
          backgroundColor: '#ffffff',
          textColor: '#1a1a1a',
          locale: 'he',
        },
        blockDefaults: {
          title: { textAlign: 'right' },
          image: { align: 'right' },
        },
        paletteBlocks: this._allPaletteBlocks,
        customBlocks: this._allCustomBlocks,
        mergeTags: mergeTagsConfig,
        onChange: (content: TemplateContent) => {
          this._dirty.set(true);
          this.contentChange.emit(content);
          this.dirtyChange.emit(true);
          this.scheduleMjmlGeneration();
        },
        onError: (error: Error) => console.error('[V2Editor]', error),
        onRequestMedia: this.handleMediaRequest.bind(this),
      });
      this.editorReady.emit();
    } catch (error) {
      console.error('[V2Editor] Failed to initialize:', error);
      this._error.set((error as Error)?.message || 'Unknown error');
    }
  }

  private scheduleMjmlGeneration(): void {
    this.clearMjmlTimer();
    this._mjmlTimer = setTimeout(async () => {
      if (this._editor) {
        try { this.mjmlChange.emit(await this._editor.toMjml()); }
        catch (error) { console.error('[V2Editor] MJML failed:', error); }
      }
    }, 500);
  }

  private clearMjmlTimer(): void {
    if (this._mjmlTimer !== null) { clearTimeout(this._mjmlTimer); this._mjmlTimer = null; }
  }

  private handleMediaRequest(context?: { files?: File[] }): Promise<{ url: string } | null> {
    if (context?.files?.length) return this.uploadFileToMedia(context.files[0]);
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
      let resolved = false;
      const cleanup = () => { input.removeEventListener('change', handleChange); window.removeEventListener('focus', handleFocus); input.remove(); };
      const handleChange = async () => {
        resolved = true; const file = input.files?.[0]; cleanup();
        resolve(file ? await this.uploadFileToMedia(file) : null);
      };
      const handleFocus = () => setTimeout(() => { if (!resolved) { cleanup(); resolve(null); } }, 300);
      input.addEventListener('change', handleChange);
      window.addEventListener('focus', handleFocus);
      document.body.appendChild(input);
      input.click();
    });
  }

  private async uploadFileToMedia(file: File): Promise<{ url: string } | null> {
    try {
      const result = await firstValueFrom(this.mediaService.uploadMedia(file));
      const url = (result as any)?.url || (result as any);
      return typeof url === 'string' ? { url } : null;
    } catch (err) { console.error('[V2Editor] Upload failed:', err); return null; }
  }
}
