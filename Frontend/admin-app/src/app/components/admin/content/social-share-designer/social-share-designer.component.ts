import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Article } from '../../../../models/article.model';
import { SongDto } from '../../../../models/song.model';
import { ArticleService } from '../../../../services/admin/article.service';
import { SongService } from '../../../../services/song.service';
import { EventService as AdminEventService } from '../../../../services/admin/event.service';
import { PodcastService } from '../../../../services/podcast.service';
import { MusicServiceProviderService } from '../../../../services/music-service-provider.service';
import { ArtistService } from '../../../../services/artist.service';
import { getArticlePath } from '../../../../utils/article-route.utils';
import { artistPath, songSlug } from '../../../../utils/slug';

type ContentKind = 'song' | 'article' | 'event' | 'podcast' | 'professional' | 'artist';
type PointName = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';

interface Point { x: number; y: number; }

interface ShareContentItem {
  id: number;
  title: string;
  meta: string;
  imageUrl: string;
  path: string;
}

interface DesignerSettings {
  points: Record<PointName, Point>;
  contentOffsetX: number;
  contentOffsetY: number;
  contentZoom: number;
  headingX: number;
  headingY: number;
  headingSize: number;
  headingWidth: number;
}

const STAGE_WIDTH = 900;
const STAGE_HEIGHT = 1600;
const SETTINGS_KEY = 'admin-social-share-designer-settings-v2';

const DEFAULT_SETTINGS: DesignerSettings = {
  points: {
    topLeft: { x: 159, y: 481 },
    topRight: { x: 720, y: 343 },
    bottomRight: { x: 1039, y: 1563 },
    bottomLeft: { x: 467, y: 1697 }
  },
  contentOffsetX: 0,
  contentOffsetY: 0,
  contentZoom: 1,
  headingX: 450,
  headingY: 72,
  headingSize: 67,
  headingWidth: 760
};

@Component({
  selector: 'app-social-share-designer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './social-share-designer.component.html',
  styleUrls: ['./social-share-designer.component.css']
})
export class SocialShareDesignerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('previewCanvas') previewCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mobileFrame') mobileFrame?: ElementRef<HTMLIFrameElement>;

  readonly pointNames: PointName[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
  readonly pointLabels: Record<PointName, string> = {
    topLeft: 'שמאל עליון',
    topRight: 'ימין עליון',
    bottomRight: 'ימין תחתון',
    bottomLeft: 'שמאל תחתון'
  };

  kind: ContentKind = 'song';
  sortMode: 'newest' | 'views' = 'newest';
  currentStep: 1 | 2 | 3 = 1;
  searchTerm = '';
  searchResults: ShareContentItem[] = [];
  selectedContent?: ShareContentItem;
  selectedSong?: SongDto;
  selectedArticle?: Article;
  loadingResults = false;
  selectionLoading = false;
  exportLoading = false;
  statusMessage = '';

  heading = 'האקורדים ללהיט החדש כבר מחכים לכם באתר!';
  customTitle = 'כותרת התוכן';
  customMeta = 'תוכן חדש באקורדישקייט';
  customBody = 'כתבו כאן טקסט קצר שיופיע בתוך מסך הטלפון.';
  customImageUrl = '';
  mobilePagePath = '';
  captureLoading = false;
  captureError = '';

  settings: DesignerSettings = this.loadSettings();
  activePoint: PointName | null = null;

  private backgroundImage?: HTMLImageElement;
  private overlayImage?: HTMLImageElement;
  private contentImage?: HTMLImageElement;
  private capturedPageCanvas?: HTMLCanvasElement;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private frameCaptureTimer?: ReturnType<typeof setTimeout>;
  private pointerCaptureTarget?: Element;
  private renderQueued = false;

  constructor(
    private readonly songService: SongService,
    private readonly articleService: ArticleService,
    private readonly eventService: AdminEventService,
    private readonly podcastService: PodcastService,
    private readonly providerService: MusicServiceProviderService,
    private readonly artistService: ArtistService
  ) {}

  ngOnInit(): void {
    void this.loadTemplateImages();
    this.loadResults();
  }

  ngAfterViewInit(): void {
    this.queueRender();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (this.frameCaptureTimer) clearTimeout(this.frameCaptureTimer);
  }

  setKind(kind: ContentKind): void {
    this.kind = kind;
    this.searchTerm = '';
    this.sortMode = 'newest';
    this.searchResults = [];
    this.statusMessage = '';
    const headings: Record<ContentKind, string> = {
      song: 'האקורדים ללהיט החדש כבר מחכים לכם באתר!',
      article: 'הכתבה החדשה שכדאי לכם לקרוא כבר באתר!',
      event: 'ההופעה שאסור לכם לפספס מחכה לכם באתר!',
      podcast: 'הפודקאסט שכדאי לכם לשמוע מחכה באתר!',
      professional: 'הכירו את אנשי המקצוע של עולם המוזיקה!',
      artist: 'כל מה שרציתם לדעת על האמן מחכה באתר!'
    };
    this.heading = headings[kind];
    this.selectedContent = undefined;
    this.loadResults();
    this.capturedPageCanvas = undefined;
    this.mobilePagePath = '';
    this.captureError = '';
    this.queueRender();
  }

  onSearchChange(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadResults(), 280);
  }

  loadResults(): void {
    this.loadingResults = true;
    const query = this.searchTerm.trim() || undefined;

    if (this.kind === 'song') {
      this.songService.getSongsForAdmin(query, 1, 12, undefined, undefined, undefined, this.sortMode === 'views' ? 'views' : 'date').subscribe({
        next: result => {
          const songs: SongDto[] = result?.songs || result?.items || result?.data || [];
          this.searchResults = songs.map(song => {
            const slug = songSlug(song);
            return {
              id: song.id,
              title: song.title,
              meta: song.artists?.map(artist => artist.name).join(', ') || 'אקורדים',
              imageUrl: song.imageUrl || 'assets/default-artist.png',
              path: slug ? `/song/${song.id}/${slug}` : `/song/${song.id}`
            };
          });
          this.loadingResults = false;
        },
        error: () => {
          this.searchResults = [];
          this.loadingResults = false;
          this.statusMessage = 'לא הצלחנו לטעון את רשימת האקורדים.';
        }
      });
      return;
    }

    if (this.kind === 'article') {
      this.articleService.getArticles(1, 12, query, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, this.sortMode === 'views' ? 'views' : 'publish').subscribe({
        next: result => {
          this.searchResults = result.items.map(article => ({
            id: article.id,
            title: article.title,
            meta: article.categoryNames?.join(' · ') || article.authorName || 'כתבה',
            imageUrl: article.featuredImageUrl || 'assets/default-article.png',
            path: getArticlePath(article)
          }));
          this.loadingResults = false;
        },
        error: () => this.handleResultsError('לא הצלחנו לטעון את רשימת הכתבות.')
      });
      return;
    }

    if (this.kind === 'event') {
      this.eventService.getEvents(1, 12, query, true, undefined, undefined, undefined, undefined, undefined, undefined, 'created').subscribe({
        next: result => {
          this.searchResults = result.items.map(event => ({
            id: event.id,
            title: event.name,
            meta: [event.artistName, event.location].filter(Boolean).join(' · ') || 'הופעה',
            imageUrl: event.imageUrl || 'assets/default-article.png',
            path: `/events?event=${event.id}`
          }));
          this.loadingResults = false;
        },
        error: () => this.handleResultsError('לא הצלחנו לטעון את רשימת ההופעות.')
      });
      return;
    }

    if (this.kind === 'podcast') {
      this.podcastService.getEpisodes(1, this.sortMode === 'views' ? 12 : 500, undefined, query, true, undefined, undefined, this.sortMode === 'views' ? 'views' : 'date').subscribe({
        next: result => {
          const episodes = this.sortMode === 'newest'
            ? [...result.items].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, 12)
            : result.items;
          this.searchResults = episodes.map(episode => ({
            id: episode.id,
            title: episode.title,
            meta: [episode.podcastName, episode.episodeNumber ? `פרק ${episode.episodeNumber}` : ''].filter(Boolean).join(' · '),
            imageUrl: episode.thumbnailUrl || 'assets/default-article.png',
            path: `/podcasts?series=${encodeURIComponent(episode.podcastSlug)}&episode=${encodeURIComponent(episode.slug)}`
          }));
          this.loadingResults = false;
        },
        error: () => this.handleResultsError('לא הצלחנו לטעון את רשימת הפודקאסטים.')
      });
      return;
    }

    if (this.kind === 'professional') {
      this.providerService.getServiceProviders(query, undefined, undefined, undefined, undefined, false, 1, 12, undefined, 'created_desc').subscribe({
        next: result => {
          this.searchResults = result.items.map(provider => ({
            id: provider.id,
            title: provider.displayName,
            meta: [provider.categoryName, provider.cityName].filter(Boolean).join(' · ') || 'נותן שירות',
            imageUrl: provider.profileImageUrl || 'assets/default-artist.png',
            path: `/professional/${provider.id}`
          }));
          this.loadingResults = false;
        },
        error: () => this.handleResultsError('לא הצלחנו לטעון את רשימת נותני השירות.')
      });
      return;
    }

    this.artistService.getArtists(undefined, undefined, 1, 12, 'created_desc', query, false).subscribe({
      next: result => {
        this.searchResults = result.items.map(artist => ({
          id: artist.id,
          title: artist.name,
          meta: artist.shortBio || 'אמן',
          imageUrl: artist.imageUrl || 'assets/default-artist.png',
          path: artistPath(artist)
        }));
        this.loadingResults = false;
      },
      error: () => this.handleResultsError('לא הצלחנו לטעון את רשימת האמנים.')
    });
  }

  selectResult(item: ShareContentItem): void {
    this.selectedContent = item;
    this.statusMessage = '';
    this.openMobilePage(item.path);
    this.queueRender();
  }

  getResultTitle(item: ShareContentItem): string {
    return item.title;
  }

  getResultMeta(item: ShareContentItem): string {
    return item.meta;
  }

  getResultImage(item: ShareContentItem): string {
    return item.imageUrl;
  }

  isSelected(item: ShareContentItem): boolean {
    return this.selectedContent?.id === item.id;
  }

  onDesignChange(): void {
    this.persistSettings();
    this.queueRender();
  }

  onSortChange(): void {
    this.loadResults();
  }

  get supportsViewsSort(): boolean {
    return this.kind === 'song' || this.kind === 'article' || this.kind === 'podcast';
  }

  goToStep(step: 1 | 2 | 3): void {
    if (step > 1 && !this.selectedContent) return;
    this.currentStep = step;
    this.queueRender();
  }

  get publicContentUrl(): string {
    return this.selectedContent ? new URL(this.selectedContent.path, window.location.origin).href : '';
  }

  get kindLabel(): string {
    const labels: Record<ContentKind, string> = {
      song: 'אקורדים',
      article: 'כתבה',
      event: 'הופעה',
      podcast: 'פודקאסט',
      professional: 'נותן שירות',
      artist: 'אמן'
    };
    return labels[this.kind];
  }

  async copyContentLink(): Promise<void> {
    if (!this.publicContentUrl) return;
    try {
      await navigator.clipboard.writeText(this.publicContentUrl);
    } catch {
      const input = document.createElement('textarea');
      input.value = this.publicContentUrl;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    this.statusMessage = 'הקישור לתוכן הועתק.';
  }

  private handleResultsError(message: string): void {
    this.searchResults = [];
    this.loadingResults = false;
    this.statusMessage = message;
  }

  refreshPageCapture(): void {
    if (this.mobilePagePath) this.openMobilePage(this.mobilePagePath, true);
  }

  onFrameLoad(): void {
    if (!this.captureLoading || !this.mobilePagePath) return;
    if (this.frameCaptureTimer) clearTimeout(this.frameCaptureTimer);
    this.frameCaptureTimer = setTimeout(() => void this.captureMobilePage(), 1800);
  }

  resetDesign(): void {
    this.settings = structuredClone(DEFAULT_SETTINGS);
    this.persistSettings();
    this.queueRender();
  }

  onPointerDown(event: PointerEvent): void {
    const point = this.eventPoint(event);
    let nearest: PointName | null = null;
    let nearestDistance = 42;
    for (const name of this.pointNames) {
      const candidate = this.settings.points[name];
      const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
      if (distance < nearestDistance) {
        nearest = name;
        nearestDistance = distance;
      }
    }
    if (!nearest) return;
    this.activePoint = nearest;
    this.pointerCaptureTarget = event.currentTarget as Element;
    this.pointerCaptureTarget.setPointerCapture(event.pointerId);
    this.moveActivePoint(point);
  }

  onPointPointerDown(name: PointName, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.activePoint = name;
    this.pointerCaptureTarget = event.currentTarget as Element;
    this.pointerCaptureTarget.setPointerCapture(event.pointerId);
    this.moveActivePoint(this.eventPoint(event));
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.activePoint) return;
    this.moveActivePoint(this.eventPoint(event));
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.activePoint) return;
    if (this.pointerCaptureTarget?.hasPointerCapture(event.pointerId)) {
      this.pointerCaptureTarget.releasePointerCapture(event.pointerId);
    }
    this.pointerCaptureTarget = undefined;
    this.activePoint = null;
    this.persistSettings();
  }

  get polygonPoints(): string {
    return this.pointNames.map(name => `${this.settings.points[name].x},${this.settings.points[name].y}`).join(' ');
  }

  async downloadImage(): Promise<void> {
    if (!this.backgroundImage || !this.overlayImage) return;
    this.exportLoading = true;
    this.statusMessage = '';
    try {
      await document.fonts.ready;
      const canvas = this.renderCanvas(5);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('PNG export failed');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `akordishkeit-story-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      URL.revokeObjectURL(url);
      this.statusMessage = 'התמונה ירדה בהצלחה בגודל 4500×8000.';
    } catch (error) {
      console.error('Social share export failed', error);
      this.statusMessage = 'לא הצלחנו לייצא את התמונה. כדאי לבדוק שהתמונה שנבחרה מאפשרת הורדה.';
    } finally {
      this.exportLoading = false;
    }
  }

  private async loadTemplateImages(): Promise<void> {
    try {
      [this.backgroundImage, this.overlayImage] = await Promise.all([
        this.loadImage('assets/social-share/story-background.png'),
        this.loadImage('assets/social-share/phone-overlay.png')
      ]);
      this.queueRender();
    } catch (error) {
      console.error('Could not load social share template', error);
      this.statusMessage = 'לא הצלחנו לטעון את שכבות העיצוב.';
    }
  }

  private openMobilePage(path: string, forceReload = false): void {
    this.mobilePagePath = path;
    this.captureLoading = true;
    this.captureError = '';
    this.capturedPageCanvas = undefined;
    this.queueRender();
    setTimeout(() => {
      const frame = this.mobileFrame?.nativeElement;
      if (!frame) return;
      const url = new URL(path, window.location.origin);
      if (forceReload) url.searchParams.set('_captureRefresh', Date.now().toString());
      frame.src = url.href;
    });
  }

  private async captureMobilePage(): Promise<void> {
    const frame = this.mobileFrame?.nativeElement;
    const frameWindow = frame?.contentWindow;
    const documentRef = frame?.contentDocument;
    if (!frame || !frameWindow || !documentRef?.body) return;
    try {
      frameWindow.scrollTo(0, 0);
      await this.waitForMobilePage(documentRef);
      await documentRef.fonts?.ready;
      this.installCaptureStyles(documentRef);
      await new Promise(resolve => setTimeout(resolve, 250));
      const html2canvas = (await import('html2canvas')).default;
      this.capturedPageCanvas = await html2canvas(documentRef.body, {
        width: 390,
        height: 844,
        windowWidth: 390,
        windowHeight: 844,
        scrollX: 0,
        scrollY: 0,
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false
      });
      this.captureLoading = false;
      this.captureError = '';
      this.queueRender();
    } catch (error) {
      console.error('Mobile page capture failed', error);
      this.captureLoading = false;
      this.captureError = 'צילום העמוד נכשל. אפשר לנסות שוב לאחר שהעמוד סיים להיטען.';
      this.queueRender();
    }
  }

  private installCaptureStyles(documentRef: Document): void {
    if (documentRef.getElementById('social-capture-overrides')) return;
    const style = documentRef.createElement('style');
    style.id = 'social-capture-overrides';
    style.textContent = `
      .fab-add-song,
      [class*="admin-edit"],
      [class*="quick-add"],
      [class*="cookie-banner"] { display: none !important; }
      html { scrollbar-width: none !important; }
      body { width: 390px !important; min-width: 390px !important; overflow-x: hidden !important; }
      * { animation: none !important; transition: none !important; caret-color: transparent !important; }
    `;
    documentRef.head.appendChild(style);
  }

  private async waitForMobilePage(documentRef: Document): Promise<void> {
    const expectedSelector = this.mobilePagePath.startsWith('/song/')
      ? '.song-page-container'
      : this.mobilePagePath.startsWith('/news/')
        ? '.article-view-container'
        : this.mobilePagePath.startsWith('/blog/')
          ? '.blog-post-container'
          : null;
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const contentReady = expectedSelector
        ? !!documentRef.querySelector(expectedSelector)
        : (documentRef.body?.innerText?.trim().length || 0) > 40;
      if (contentReady) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    const pendingImages = Array.from(documentRef.images).filter(image => !image.complete).slice(0, 20);
    if (!pendingImages.length) return;
    await Promise.race([
      Promise.all(pendingImages.map(image => new Promise<void>(resolve => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener('error', () => resolve(), { once: true });
      }))),
      new Promise(resolve => setTimeout(resolve, 1800))
    ]);
  }

  private loadSelectedContentImage(): void {
    const url = this.kind === 'song'
      ? this.selectedSong?.imageUrl
      : this.kind === 'article'
        ? this.selectedArticle?.featuredImageUrl
        : this.customImageUrl;
    this.contentImage = undefined;
    if (!url) {
      this.queueRender();
      return;
    }
    this.loadImage(url, true).then(image => {
      this.contentImage = image;
      this.queueRender();
    }).catch(() => this.queueRender());
  }

  private loadImage(src: string, crossOrigin = false): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      if (crossOrigin) image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  private queueRender(): void {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      const target = this.previewCanvas?.nativeElement;
      if (!target || !this.backgroundImage || !this.overlayImage) return;
      const rendered = this.renderCanvas(1);
      const context = target.getContext('2d');
      target.width = STAGE_WIDTH;
      target.height = STAGE_HEIGHT;
      context?.drawImage(rendered, 0, 0);
    });
  }

  private renderCanvas(scale: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = STAGE_WIDTH * scale;
    canvas.height = STAGE_HEIGHT * scale;
    const context = canvas.getContext('2d')!;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(this.backgroundImage!, 0, 0, canvas.width, canvas.height);

    context.save();
    context.scale(scale, scale);
    this.drawHeading(context);
    context.restore();

    const phoneCanvas = this.createPhoneContent(scale);
    const points = this.pointNames.map(name => ({
      x: this.settings.points[name].x * scale,
      y: this.settings.points[name].y * scale
    }));
    this.drawWarpedImage(context, phoneCanvas, points, 10, 16);
    context.drawImage(this.overlayImage!, 0, 0, canvas.width, canvas.height);

    return canvas;
  }

  private drawHeading(context: CanvasRenderingContext2D): void {
    context.save();
    context.direction = 'rtl';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = '#303030';
    context.font = `800 ${this.settings.headingSize}px "Open Sans", Arial, sans-serif`;
    this.drawWrappedText(
      context,
      this.heading || ' ',
      this.settings.headingX,
      this.settings.headingY,
      this.settings.headingWidth,
      this.settings.headingSize * 0.92,
      3
    );
    context.restore();
  }

  private createPhoneContent(scale: number): HTMLCanvasElement {
    const width = 390;
    const height = 844;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext('2d')!;
    context.scale(scale, scale);
    context.save();
    this.roundRect(context, 0, 0, width, height, 38);
    context.clip();
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.translate(width / 2 + this.settings.contentOffsetX, height / 2 + this.settings.contentOffsetY);
    context.scale(this.settings.contentZoom, this.settings.contentZoom);
    context.translate(-width / 2, -height / 2);
    if (this.capturedPageCanvas) {
      context.drawImage(this.capturedPageCanvas, 0, 0, width, height);
    } else {
      context.direction = 'rtl';
      context.textAlign = 'center';
      context.fillStyle = '#F2F2F2';
      context.fillRect(0, 0, width, height);
      context.fillStyle = '#000000';
      context.font = '800 22px "Open Sans", Arial, sans-serif';
      context.fillText(this.captureLoading ? 'מצלם את הדף…' : 'בחרו תוכן לצילום', width / 2, 360);
    }
    context.restore();
    return canvas;
  }

  private drawPhonePage(context: CanvasRenderingContext2D, width: number, height: number): void {
    context.direction = 'rtl';
    context.textAlign = 'right';
    context.textBaseline = 'top';

    this.roundRect(context, 12, 8, width - 24, 540, 34);
    context.fillStyle = '#ddff53';
    context.fill();

    context.fillStyle = '#ffffff';
    context.beginPath(); context.arc(width - 62, 58, 28, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.arc(62, 58, 28, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#000000';
    context.font = '800 22px "Open Sans", Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText('☰', width - 62, 42);
    context.fillText('⌄', 62, 40);

    const imageX = 130;
    const imageY = 115;
    const imageW = width - 260;
    const imageH = 265;
    this.roundRect(context, imageX, imageY, imageW, imageH, 24);
    context.save();
    context.clip();
    if (this.contentImage) {
      this.drawCoverImage(context, this.contentImage, imageX, imageY, imageW, imageH);
    } else {
      context.fillStyle = '#404040';
      context.fillRect(imageX, imageY, imageW, imageH);
      context.fillStyle = '#ddff53';
      context.font = '800 42px "Open Sans", Arial, sans-serif';
      context.textAlign = 'center';
      context.fillText('AKORDISHKEIT', width / 2, imageY + 105);
    }
    context.restore();

    const title = this.kind === 'song' ? (this.selectedSong?.title || 'בחרו שיר להצגה')
      : this.kind === 'article' ? (this.selectedArticle?.title || 'בחרו כתבה להצגה')
        : this.customTitle;
    const meta = this.kind === 'song'
      ? (this.selectedSong?.artists?.map(artist => artist.name).join(', ') || 'אקורדים לשיר')
      : this.kind === 'article'
        ? (this.selectedArticle?.categoryNames?.join(' · ') || this.selectedArticle?.authorName || 'כתבה חדשה')
        : this.customMeta;

    context.textAlign = 'center';
    context.fillStyle = 'rgba(0,0,0,.48)';
    context.font = '300 23px "Open Sans", Arial, sans-serif';
    context.fillText(this.kind === 'song' ? 'אקורדים לשיר' : this.kind === 'article' ? 'חדשות המוזיקה' : 'תוכן חדש', width / 2, 405);
    context.fillStyle = '#000000';
    context.font = '800 34px "Open Sans", Arial, sans-serif';
    this.drawWrappedText(context, title, width / 2, 442, width - 120, 40, 2);
    context.fillStyle = 'rgba(0,0,0,.55)';
    context.font = '300 22px "Open Sans", Arial, sans-serif';
    context.fillText(meta, width / 2, 515);

    context.fillStyle = '#ffffff';
    context.fillRect(0, 570, width, height - 570);
    context.textAlign = 'right';
    context.fillStyle = '#000000';
    context.font = '800 25px "Open Sans", Arial, sans-serif';
    context.fillText(this.kind === 'song' ? 'מילים ואקורדים' : 'מתוך התוכן', width - 54, 615);
    context.fillStyle = 'rgba(0,0,0,.12)';
    context.fillRect(54, 660, width - 108, 2);

    if (this.kind === 'song') this.drawSongBody(context, width);
    else this.drawArticleBody(context, width);
  }

  private drawSongBody(context: CanvasRenderingContext2D, width: number): void {
    const raw = this.selectedSong?.lyricsWithChords || '[Am] זה המקום שבו יופיעו האקורדים\n[C] והמילים של השיר שבחרתם\n[F] בתצוגה נקייה שדומה לדף באתר\n[G] ומוכנה לשיתוף ברשתות';
    const lines = raw.replace(/<[^>]*>/g, '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 16);
    let y = 700;
    for (const line of lines) {
      const chordLine = /^([\[({]?[A-G][#b]?(?:m|maj|min|sus|dim|aug)?\d*[\])}]?\s*)+$/.test(line) || /\[[A-G][#b]?/.test(line);
      context.font = `${chordLine ? 800 : 300} ${chordLine ? 24 : 25}px "Open Sans", Arial, sans-serif`;
      context.fillStyle = chordLine ? '#000000' : '#303030';
      if (chordLine) {
        const widthValue = Math.min(context.measureText(line).width + 18, 570);
        this.roundRect(context, width - 56 - widthValue, y - 5, widthValue, 36, 8);
        context.fillStyle = '#ddff53';
        context.fill();
        context.fillStyle = '#000000';
      }
      context.fillText(line, width - 62, y);
      y += chordLine ? 42 : 45;
      if (y > 1280) break;
    }
  }

  private drawArticleBody(context: CanvasRenderingContext2D, width: number): void {
    const source = this.selectedArticle?.shortDescription || this.selectedArticle?.subtitle || this.selectedArticle?.content || 'כאן יוצג תקציר הכתבה שבחרתם.';
    const clean = source.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();
    context.font = '300 27px "Open Sans", Arial, sans-serif';
    context.fillStyle = '#303030';
    context.textAlign = 'right';
    this.drawWrappedText(context, clean, width - 58, 705, width - 116, 48, 11);
  }

  private drawHandles(context: CanvasRenderingContext2D): void {
    context.lineWidth = 3;
    context.strokeStyle = '#000000';
    context.setLineDash([10, 8]);
    context.beginPath();
    this.pointNames.forEach((name, index) => {
      const point = this.settings.points[name];
      if (index === 0) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y);
    });
    const first = this.settings.points.topLeft;
    context.lineTo(first.x, first.y);
    context.stroke();
    context.setLineDash([]);
    for (const name of this.pointNames) {
      const point = this.settings.points[name];
      context.beginPath();
      context.arc(point.x, point.y, this.activePoint === name ? 15 : 11, 0, Math.PI * 2);
      context.fillStyle = '#ddff53';
      context.fill();
      context.lineWidth = 3;
      context.strokeStyle = '#000000';
      context.stroke();
    }
  }

  private drawWarpedImage(context: CanvasRenderingContext2D, image: HTMLCanvasElement, quad: Point[], columns: number, rows: number): void {
    const pointAt = (u: number, v: number): Point => ({
      x: (1 - u) * (1 - v) * quad[0].x + u * (1 - v) * quad[1].x + u * v * quad[2].x + (1 - u) * v * quad[3].x,
      y: (1 - u) * (1 - v) * quad[0].y + u * (1 - v) * quad[1].y + u * v * quad[2].y + (1 - u) * v * quad[3].y
    });
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const u0 = column / columns;
        const u1 = (column + 1) / columns;
        const v0 = row / rows;
        const v1 = (row + 1) / rows;
        const sx0 = u0 * image.width;
        const sx1 = u1 * image.width;
        const sy0 = v0 * image.height;
        const sy1 = v1 * image.height;
        const p00 = pointAt(u0, v0);
        const p10 = pointAt(u1, v0);
        const p11 = pointAt(u1, v1);
        const p01 = pointAt(u0, v1);
        this.drawImageTriangle(context, image, [sx0, sy0, sx1, sy0, sx1, sy1], [p00, p10, p11]);
        this.drawImageTriangle(context, image, [sx0, sy0, sx1, sy1, sx0, sy1], [p00, p11, p01]);
      }
    }
  }

  private drawImageTriangle(context: CanvasRenderingContext2D, image: HTMLCanvasElement, source: number[], destination: Point[]): void {
    const [sx0, sy0, sx1, sy1, sx2, sy2] = source;
    const denominator = sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1);
    if (!denominator) return;
    const a = (destination[0].x * (sy1 - sy2) + destination[1].x * (sy2 - sy0) + destination[2].x * (sy0 - sy1)) / denominator;
    const c = (destination[0].x * (sx2 - sx1) + destination[1].x * (sx0 - sx2) + destination[2].x * (sx1 - sx0)) / denominator;
    const e = (destination[0].x * (sx1 * sy2 - sx2 * sy1) + destination[1].x * (sx2 * sy0 - sx0 * sy2) + destination[2].x * (sx0 * sy1 - sx1 * sy0)) / denominator;
    const b = (destination[0].y * (sy1 - sy2) + destination[1].y * (sy2 - sy0) + destination[2].y * (sy0 - sy1)) / denominator;
    const d = (destination[0].y * (sx2 - sx1) + destination[1].y * (sx0 - sx2) + destination[2].y * (sx1 - sx0)) / denominator;
    const f = (destination[0].y * (sx1 * sy2 - sx2 * sy1) + destination[1].y * (sx2 * sy0 - sx0 * sy2) + destination[2].y * (sx0 * sy1 - sx1 * sy0)) / denominator;
    context.save();
    context.beginPath();
    context.moveTo(destination[0].x, destination[0].y);
    context.lineTo(destination[1].x, destination[1].y);
    context.lineTo(destination[2].x, destination[2].y);
    context.closePath();
    context.clip();
    context.setTransform(a, b, c, d, e, f);
    context.drawImage(image, 0, 0);
    context.restore();
  }

  private drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): number {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (context.measureText(next).width <= maxWidth || !current) current = next;
      else { lines.push(current); current = word; }
    }
    if (current) lines.push(current);
    const visible = lines.slice(0, maxLines);
    if (lines.length > maxLines && visible.length) visible[visible.length - 1] = `${visible[visible.length - 1]}…`;
    visible.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
    return visible.length * lineHeight;
  }

  private drawCoverImage(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number): void {
    const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const targetWidth = image.naturalWidth * ratio;
    const targetHeight = image.naturalHeight * ratio;
    context.drawImage(image, x + (width - targetWidth) / 2, y + (height - targetHeight) / 2, targetWidth, targetHeight);
  }

  private roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
  }

  private eventPoint(event: PointerEvent): Point {
    const canvas = this.previewCanvas!.nativeElement;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * STAGE_WIDTH / rect.width,
      y: (event.clientY - rect.top) * STAGE_HEIGHT / rect.height
    };
  }

  private moveActivePoint(point: Point): void {
    if (!this.activePoint) return;
    this.settings.points[this.activePoint] = {
      x: Math.round(Math.max(-250, Math.min(STAGE_WIDTH + 250, point.x))),
      y: Math.round(Math.max(-250, Math.min(STAGE_HEIGHT + 250, point.y)))
    };
    this.queueRender();
  }

  private persistSettings(): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
  }

  private loadSettings(): DesignerSettings {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (!stored) return structuredClone(DEFAULT_SETTINGS);
      const parsed = JSON.parse(stored) as DesignerSettings;
      return { ...structuredClone(DEFAULT_SETTINGS), ...parsed, points: { ...structuredClone(DEFAULT_SETTINGS.points), ...parsed.points } };
    } catch {
      return structuredClone(DEFAULT_SETTINGS);
    }
  }
}
