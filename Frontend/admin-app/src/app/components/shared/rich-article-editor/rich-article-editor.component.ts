import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Editor, Extension, Mark, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import BubbleMenu from '@tiptap/extension-bubble-menu';
import FloatingMenu from '@tiptap/extension-floating-menu';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Youtube from '@tiptap/extension-youtube';
import { TextSelection } from '@tiptap/pm/state';
import { FileUploadInputComponent } from '../file-upload-input/file-upload-input.component';

type MediaAlign = 'right' | 'center' | 'left';
type ButtonSize = 'small' | 'regular' | 'large';
type ButtonVariant = 'primary' | 'dark' | 'soft';

const clampPercent = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(100, Math.max(30, Math.round(numeric)));
};

const normalizeAlign = (value: unknown): MediaAlign => {
  return value === 'center' || value === 'left' || value === 'right' ? value : 'right';
};

const ArticleFigure = Node.create({
  name: 'articleFigure',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      caption: { default: '' },
      size: { default: 100 },
      align: { default: 'right' },
      linkHref: { default: '' }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure.article-media',
        getAttrs: element => {
          const figure = element as HTMLElement;
          const img = figure.querySelector('img');
          const caption = figure.querySelector('figcaption');
          const classSize = Array.from(figure.classList)
            .map(className => /^article-media-size-(\d+)$/.exec(className)?.[1])
            .find(Boolean);
          const width = parseInt(classSize || figure.style.width || '', 10);

          return {
            src: img?.getAttribute('src') || '',
            alt: img?.getAttribute('alt') || '',
            caption: caption?.textContent || '',
            size: clampPercent(width, 100),
            align: normalizeAlign(figure.getAttribute('data-align')),
            linkHref: figure.querySelector('a.article-media-link')?.getAttribute('href') || ''
          };
        }
      }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const caption = String(HTMLAttributes['caption'] || '').trim();
    const size = clampPercent(HTMLAttributes['size'], 100);
    const align = normalizeAlign(HTMLAttributes['align']);
    const style = [
      align === 'center' ? 'margin-left: auto' : '',
      align === 'center' ? 'margin-right: auto' : '',
      align === 'left' ? 'margin-right: auto' : '',
      align === 'right' ? 'margin-left: auto' : ''
    ].filter(Boolean).join('; ');
    const linkHref = String(HTMLAttributes['linkHref'] || '').trim();
    const image = ['img', { src: HTMLAttributes['src'], alt: HTMLAttributes['alt'] || '' }];
    const media = linkHref
      ? [
          'a',
          {
            class: 'article-media-link',
            href: linkHref,
            target: '_blank',
            rel: 'noopener noreferrer'
          },
          image
        ]
      : image;
    const children: unknown[] = [media];

    if (caption) {
      children.push(['figcaption', {}, caption]);
    }

    return [
      'figure',
      {
        class: `article-media article-media-size-${size} article-media-align-${align}`,
        style,
        'data-align': align
      },
      ...children
    ];
  }
});

const ArticleButton = Node.create({
  name: 'articleButton',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      href: { default: '' },
      label: { default: 'לקריאה נוספת' },
      variant: { default: 'primary' },
      size: { default: 'regular' },
      align: { default: 'right' }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'p.article-action',
        getAttrs: element => {
          const wrapper = element as HTMLElement;
          const link = wrapper.querySelector('a');
          const variant = link?.classList.contains('article-button-dark')
            ? 'dark'
            : link?.classList.contains('article-button-soft')
              ? 'soft'
              : 'primary';
          const size = link?.classList.contains('article-button-small')
            ? 'small'
            : link?.classList.contains('article-button-large')
              ? 'large'
              : 'regular';

          return {
            href: link?.getAttribute('href') || '',
            label: link?.textContent || 'לקריאה נוספת',
            variant,
            size,
            align: normalizeAlign(wrapper.getAttribute('data-align'))
          };
        }
      }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const variant = HTMLAttributes['variant'] === 'dark'
      ? 'dark'
      : HTMLAttributes['variant'] === 'soft'
        ? 'soft'
        : 'primary';
    const size = HTMLAttributes['size'] === 'small'
      ? 'small'
      : HTMLAttributes['size'] === 'large'
        ? 'large'
        : 'regular';
    const align = normalizeAlign(HTMLAttributes['align']);

    return [
      'p',
      { class: `article-action article-action-${align}`, 'data-align': align },
      [
        'a',
        {
          class: `article-button article-button-${variant} article-button-${size}`,
          href: HTMLAttributes['href'],
          target: '_blank',
          rel: 'noopener noreferrer'
        },
        HTMLAttributes['label'] || 'לקריאה נוספת'
      ]
    ];
  }
});

const ArticleAccent = Mark.create({
  name: 'articleAccent',

  addAttributes() {
    return {
      variant: { default: 'softTitle' }
    };
  },

  parseHTML() {
    return [
      { tag: 'span.article-text-soft-title', attrs: { variant: 'softTitle' } },
      { tag: 'span.article-text-small-title', attrs: { variant: 'smallTitle' } },
      { tag: 'span.article-text-highlight', attrs: { variant: 'highlight' } }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const variant = HTMLAttributes['variant'] === 'smallTitle'
      ? 'small-title'
      : HTMLAttributes['variant'] === 'highlight'
        ? 'highlight'
        : 'soft-title';

    return ['span', { class: `article-text-${variant}` }, 0];
  }
});

@Component({
  selector: 'app-rich-article-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadInputComponent],
  templateUrl: './rich-article-editor.component.html',
  styleUrls: ['./rich-article-editor.component.css']
})
export class RichArticleEditorComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();
  @Output() contentInput = new EventEmitter<void>();

  @ViewChild('editorHost', { static: true }) editorHost!: ElementRef<HTMLElement>;
  @ViewChild('bubbleMenu', { static: true }) bubbleMenu!: ElementRef<HTMLElement>;
  @ViewChild('floatingMenu', { static: true }) floatingMenu!: ElementRef<HTMLElement>;

  editor?: Editor;
  insertMenuOpen = false;
  mediaPanel: 'image' | 'video' | 'button' | null = null;
  imageUrl = '';
  imageCaption = '';
  imageLink = '';
  imageSize = 100;
  imageAlign: MediaAlign = 'right';
  videoUrl = '';
  videoSize = 100;
  buttonLabel = 'לקריאה נוספת';
  buttonUrl = '';
  buttonVariant: ButtonVariant = 'primary';
  buttonSize: ButtonSize = 'regular';
  buttonAlign: MediaAlign = 'right';
  private updatingFromEditor = false;

  ngAfterViewInit(): void {
    this.editor = new Editor({
      element: this.editorHost.nativeElement,
      content: this.value || '<p></p>',
      editorProps: {
        attributes: {
          class: 'rich-editor-surface',
          dir: 'rtl'
        },
        handleClick: (view, pos, event) => {
          const target = event.target as HTMLElement;
          if (target.closest('a')) {
            event.preventDefault();
            event.stopPropagation();
            view.dispatch(
              view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos)))
            );
            this.editor?.chain().focus().extendMarkRange('link').run();
            return true;
          }

          return false;
        }
      },
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
          codeBlock: false,
          bulletList: false,
          orderedList: false,
          blockquote: false,
          horizontalRule: false
        }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          HTMLAttributes: {
            rel: 'noopener noreferrer',
            target: '_blank'
          }
        }),
        Image.configure({
          inline: false,
          allowBase64: false,
          HTMLAttributes: {
            class: 'article-inline-image'
          }
        }),
        Youtube.configure({
          controls: true,
          nocookie: true,
          width: 100,
          height: 360,
          HTMLAttributes: {
            class: 'article-video-frame'
          }
        }),
        Placeholder.configure({
          placeholder: 'כתיבת הכתבה...'
        }),
        TextAlign.configure({
          types: ['heading', 'paragraph']
        }),
        ArticleFigure,
        ArticleButton,
        ArticleAccent,
        BubbleMenu.configure({
          element: this.bubbleMenu.nativeElement,
          updateDelay: 80,
          options: {
            placement: 'top',
            offset: 8,
            flip: { fallbackPlacements: ['bottom'] },
            shift: { padding: 8 },
            size: {
              padding: 8,
              apply: ({ availableWidth, availableHeight, elements }) => {
                Object.assign(elements.floating.style, {
                  maxWidth: `${Math.max(280, availableWidth)}px`,
                  maxHeight: `${Math.max(220, availableHeight)}px`
                });
              }
            }
          },
          shouldShow: ({ editor, from, to }) => editor.isEditable && (
            from !== to ||
            editor.isActive('link') ||
            editor.isActive('articleFigure') ||
            editor.isActive('articleButton') ||
            editor.isActive('youtube')
          )
        }),
        FloatingMenu.configure({
          element: this.floatingMenu.nativeElement,
          updateDelay: 80,
          options: {
            placement: 'top',
            offset: 8,
            flip: { fallbackPlacements: ['bottom'] },
            shift: { padding: 8 },
            size: {
              padding: 8,
              apply: ({ availableWidth, availableHeight, elements }) => {
                Object.assign(elements.floating.style, {
                  maxWidth: `${Math.max(280, availableWidth)}px`,
                  maxHeight: `${Math.max(220, availableHeight)}px`
                });
              }
            }
          },
          shouldShow: ({ editor, state }) => editor.isEditable && state.selection.empty && !(
            editor.isActive('link') ||
            editor.isActive('articleFigure') ||
            editor.isActive('articleButton') ||
            editor.isActive('youtube')
          )
        }),
        Extension.create({
          name: 'articleKeyboardShortcuts',
          addKeyboardShortcuts: () => ({
            'Mod-k': () => {
              this.setLink();
              return true;
            }
          })
        })
      ],
      onUpdate: ({ editor }) => {
        this.updatingFromEditor = true;
        this.valueChange.emit(editor.getHTML());
        this.contentInput.emit();
        this.updatingFromEditor = false;
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.editor || !changes['value'] || this.updatingFromEditor) {
      return;
    }

    const incoming = this.value || '<p></p>';
    if (incoming !== this.editor.getHTML()) {
      this.editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }

  toggleBold(): void {
    this.editor?.chain().focus().toggleBold().run();
  }

  setHeading(level: 2 | 3): void {
    this.editor?.chain().focus().toggleHeading({ level }).run();
  }

  setInlineAccent(variant: 'softTitle' | 'smallTitle' | 'highlight'): void {
    if (this.editor?.isActive('articleAccent', { variant })) {
      this.editor.chain().focus().unsetMark('articleAccent').run();
      return;
    }

    this.editor?.chain().focus().setMark('articleAccent', { variant }).run();
  }

  setTextAlign(align: 'right' | 'center' | 'left'): void {
    if (this.editor?.isActive({ textAlign: align })) {
      this.editor.chain().focus().unsetTextAlign().run();
      return;
    }

    this.editor?.chain().focus().setTextAlign(align).run();
  }

  setLink(): void {
    if (!this.editor) return;

    if (this.editor.isActive('link')) {
      this.editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    const previousUrl = this.editor.getAttributes('link')['href'] as string | undefined;
    const url = window.prompt('קישור', previousUrl || 'https://');
    if (url === null) return;

    if (!url.trim()) {
      this.editor.chain().focus().unsetLink().run();
      return;
    }

    this.editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }

  editLink(): void {
    if (!this.editor) return;

    const previousUrl = this.editor.getAttributes('link')['href'] as string | undefined;
    const url = window.prompt('עריכת קישור', previousUrl || 'https://');
    if (url === null) return;

    if (!url.trim()) {
      this.editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    this.editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }

  openActiveLink(): void {
    const href = this.editor?.getAttributes('link')['href'] as string | undefined;
    if (!href) return;

    window.open(href, '_blank', 'noopener,noreferrer');
  }

  openPanel(panel: 'image' | 'video' | 'button'): void {
    this.mediaPanel = this.mediaPanel === panel ? null : panel;
    this.insertMenuOpen = false;
  }

  hasTextSelection(): boolean {
    const selection = this.editor?.state.selection;
    return !!selection && !selection.empty && !this.editor?.isActive('articleFigure') && !this.editor?.isActive('articleButton') && !this.editor?.isActive('youtube');
  }

  onImageUploaded(url: string): void {
    this.imageUrl = url;
  }

  insertImage(): void {
    const src = this.imageUrl.trim();
    if (!src || !this.editor) return;

    this.editor
      .chain()
      .focus()
      .insertContent({
        type: 'articleFigure',
        attrs: {
          src,
          alt: this.imageCaption.trim(),
          caption: this.imageCaption.trim(),
          linkHref: this.imageLink.trim(),
          size: this.imageSize,
          align: this.imageAlign
        }
      })
      .run();

    this.imageUrl = '';
    this.imageCaption = '';
    this.imageLink = '';
    this.imageSize = 100;
    this.imageAlign = 'right';
    this.mediaPanel = null;
  }

  insertVideo(): void {
    const src = this.videoUrl.trim();
    if (!src || !this.editor) return;

    this.editor.commands.setYoutubeVideo({ src, width: this.videoSize, height: 360 });
    this.videoUrl = '';
    this.videoSize = 100;
    this.mediaPanel = null;
  }

  insertButton(): void {
    const href = this.buttonUrl.trim();
    const label = this.buttonLabel.trim();
    if (!href || !label || !this.editor) return;

    this.editor
      .chain()
      .focus()
      .insertContent({
        type: 'articleButton',
        attrs: {
          href,
          label,
          variant: this.buttonVariant,
          size: this.buttonSize,
          align: this.buttonAlign
        }
      })
      .run();

    this.buttonUrl = '';
    this.buttonLabel = 'לקריאה נוספת';
    this.buttonVariant = 'primary';
    this.buttonSize = 'regular';
    this.buttonAlign = 'right';
    this.mediaPanel = null;
  }

  updateFigure(attrs: Partial<{ size: number; align: MediaAlign; linkHref: string }>): void {
    this.editor?.chain().focus().updateAttributes('articleFigure', attrs).run();
  }

  editFigureLink(): void {
    if (!this.editor) return;

    const previousUrl = this.editor.getAttributes('articleFigure')['linkHref'] as string | undefined;
    const url = window.prompt('קישור לתמונה', previousUrl || 'https://');
    if (url === null) return;

    this.updateFigure({ linkHref: url.trim() });
  }

  openFigureLink(): void {
    const href = this.editor?.getAttributes('articleFigure')['linkHref'] as string | undefined;
    if (!href) return;

    window.open(href, '_blank', 'noopener,noreferrer');
  }

  updateButton(attrs: Partial<{ variant: ButtonVariant; size: ButtonSize; align: MediaAlign }>): void {
    this.editor?.chain().focus().updateAttributes('articleButton', attrs).run();
  }

  toggleFigureAlign(align: MediaAlign): void {
    const current = normalizeAlign(this.editor?.getAttributes('articleFigure')['align']);
    this.updateFigure({ align: current === align ? 'right' : align });
  }

  toggleButtonVariant(variant: ButtonVariant): void {
    this.updateButton({ variant: this.activeButtonVariant() === variant ? 'primary' : variant });
  }

  toggleButtonSize(size: ButtonSize): void {
    this.updateButton({ size: this.activeButtonSize() === size ? 'regular' : size });
  }

  toggleButtonAlign(align: MediaAlign): void {
    const current = normalizeAlign(this.editor?.getAttributes('articleButton')['align']);
    this.updateButton({ align: current === align ? 'right' : align });
  }

  editButton(): void {
    if (!this.editor) return;

    const attrs = this.editor.getAttributes('articleButton');
    const label = window.prompt('טקסט בלחצן', (attrs['label'] as string) || 'לקריאה נוספת');
    if (label === null) return;

    const href = window.prompt('קישור', (attrs['href'] as string) || 'https://');
    if (href === null) return;

    if (!label.trim() || !href.trim()) {
      return;
    }

    this.editor.chain().focus().updateAttributes('articleButton', {
      label: label.trim(),
      href: href.trim()
    }).run();
  }

  removeSelectedNode(): void {
    this.editor?.chain().focus().deleteSelection().run();
  }

  updateVideoWidth(size: 70 | 85 | 100): void {
    const current = Number(this.editor?.getAttributes('youtube')['width'] || 100);
    this.editor?.chain().focus().updateAttributes('youtube', { width: current === size ? 100 : size }).run();
  }

  activeFigureSize(): number {
    return clampPercent(this.editor?.getAttributes('articleFigure')['size'], 100);
  }

  activeButtonAttr<T extends string>(key: string, fallback: T): T {
    return (this.editor?.getAttributes('articleButton')[key] as T) || fallback;
  }

  activeButtonVariant(): ButtonVariant {
    return this.activeButtonAttr<ButtonVariant>('variant', 'primary');
  }

  activeButtonSize(): ButtonSize {
    return this.activeButtonAttr<ButtonSize>('size', 'regular');
  }

  isActive(nameOrAttrs: string | Record<string, unknown>, attrs?: Record<string, unknown>): boolean {
    if (typeof nameOrAttrs === 'string') {
      return !!this.editor?.isActive(nameOrAttrs, attrs);
    }

    return !!this.editor?.isActive(nameOrAttrs);
  }
}
