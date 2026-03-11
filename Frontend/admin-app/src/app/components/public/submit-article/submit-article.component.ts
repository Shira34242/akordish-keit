import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ArticleService } from '../../../services/admin/article.service';
import { SystemTablesService, SystemItem } from '../../../services/system-tables.service';
import { ArtistService } from '../../../services/artist.service';
import { ArtistListDto } from '../../../models/artist.model';
import {
  CreateArticleDto,
  ArticleContentType,
  ArticleStatus
} from '../../../models/article.model';

@Component({
  selector: 'app-submit-article',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './submit-article.component.html',
  styleUrls: ['./submit-article.component.css']
})
export class SubmitArticleComponent implements OnInit {
  private readonly articleService = inject(ArticleService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly systemTablesService = inject(SystemTablesService);
  private readonly artistService = inject(ArtistService);

  // State
  categories: SystemItem[] = [];
  artists: ArtistListDto[] = [];
  saving = false;
  submitted = false;
  fetchingYouTube = false;
  youtubeMessage = '';

  // Collapse state
  categoriesExpanded = false;
  artistsExpanded = false;

  // Gallery state
  newGalleryImage = { imageUrl: '', caption: '' };

  // Enum refs for template
  ArticleContentType = ArticleContentType;

  // Form model — status is always Draft (pending admin approval)
  article: CreateArticleDto = {
    title: '',
    subtitle: '',
    content: '',
    featuredImageUrl: '',
    authorName: '',
    categoryIds: [],
    contentType: ArticleContentType.News,
    slug: '',
    canonicalUrl: '',
    videoEmbedUrl: '',
    audioEmbedUrl: '',
    imageCredit: '',
    shortDescription: '',
    isFeatured: false,
    displayOrder: 0,
    status: ArticleStatus.Draft,
    isPremium: false,
    metaTitle: '',
    metaDescription: '',
    openGraphImageUrl: '',
    readTimeMinutes: undefined,
    tagIds: [],
    galleryImages: [],
    artistIds: []
  };

  ngOnInit(): void {
    this.loadCategories();
    this.loadArtists();

    this.route.queryParams.subscribe(params => {
      if (params['type'] === 'content') {
        this.article.contentType = ArticleContentType.Blog;
      }
    });
  }

  loadCategories(): void {
    this.systemTablesService.getItems('article-categories', 1, 100).subscribe({
      next: (result) => { this.categories = result.items; },
      error: (err) => console.error('Error loading categories', err)
    });
  }

  loadArtists(): void {
    this.artistService.getArtists(undefined, undefined, 1, 100, 'name').subscribe({
      next: (result) => { this.artists = result.items; },
      error: (err) => console.error('Error loading artists', err)
    });
  }

  onTitleChange(): void {
    this.article.slug = this.generateSlug(this.article.title);
    if (!this.article.metaTitle) {
      this.article.metaTitle = this.article.title;
    }
  }

  generateSlug(text: string): string {
    const cleaned = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    return cleaned || `article-${Date.now()}`;
  }

  calculateReadTime(): void {
    if (this.article.content) {
      const wordCount = this.article.content.split(/\s+/).length;
      this.article.readTimeMinutes = Math.ceil(wordCount / 200);
    }
  }

  onSubmit(): void {
    if (!this.validateForm()) return;
    this.saving = true;
    // Always submit as Draft — admin must approve before publishing
    this.article.status = ArticleStatus.Draft;
    this.articleService.submitArticle(this.article).subscribe({
      next: () => {
        this.saving = false;
        this.submitted = true;
      },
      error: (error) => {
        console.error('Error submitting article:', error);
        alert('שגיאה בשליחת הכתבה: ' + (error.error?.message || error.message));
        this.saving = false;
      }
    });
  }

  validateForm(): boolean {
    if (!this.article.title?.trim()) {
      alert('נא להזין כותרת');
      return false;
    }
    if (!this.article.content?.trim()) {
      alert('נא להזין תוכן הכתבה');
      return false;
    }
    return true;
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  // Category helpers
  isCategorySelected(id: number): boolean {
    return this.article.categoryIds.includes(id);
  }

  toggleCategory(id: number): void {
    const idx = this.article.categoryIds.indexOf(id);
    if (idx > -1) {
      this.article.categoryIds.splice(idx, 1);
    } else {
      this.article.categoryIds.push(id);
    }
  }

  toggleCategoriesExpanded(): void {
    this.categoriesExpanded = !this.categoriesExpanded;
  }

  getVisibleCategories(): SystemItem[] {
    return this.categoriesExpanded ? this.categories : this.categories.slice(0, 6);
  }

  get hasMoreCategories(): boolean {
    return this.categories.length > 6;
  }

  // Artist helpers
  isArtistSelected(id: number): boolean {
    return this.article.artistIds?.includes(id) || false;
  }

  toggleArtist(id: number): void {
    if (!this.article.artistIds) this.article.artistIds = [];
    const idx = this.article.artistIds.indexOf(id);
    if (idx > -1) {
      this.article.artistIds.splice(idx, 1);
    } else {
      this.article.artistIds.push(id);
    }
  }

  toggleArtistsExpanded(): void {
    this.artistsExpanded = !this.artistsExpanded;
  }

  getVisibleArtists(): ArtistListDto[] {
    return this.artistsExpanded ? this.artists : this.artists.slice(0, 6);
  }

  get hasMoreArtists(): boolean {
    return this.artists.length > 6;
  }

  // YouTube thumbnail
  onVideoUrlChange(): void {
    if (this.article.videoEmbedUrl && !this.article.featuredImageUrl) {
      this.fetchYouTubeThumbnail();
    }
  }

  fetchYouTubeThumbnail(): void {
    if (!this.article.videoEmbedUrl) return;
    this.fetchingYouTube = true;
    this.youtubeMessage = 'שולף תמונה מיוטיוב...';
    this.articleService.getYouTubeMetadata(this.article.videoEmbedUrl).subscribe({
      next: (metadata) => {
        if (metadata.success && metadata.thumbnailUrl) {
          this.article.featuredImageUrl = metadata.thumbnailUrl;
          this.youtubeMessage = '✓ תמונה נשלפה בהצלחה';
          setTimeout(() => this.youtubeMessage = '', 3000);
        } else {
          this.youtubeMessage = '⚠️ לא ניתן לשלוף תמונה';
        }
        this.fetchingYouTube = false;
      },
      error: () => {
        this.youtubeMessage = '⚠️ שגיאה בשליפת התמונה';
        this.fetchingYouTube = false;
      }
    });
  }

  // Gallery helpers
  addGalleryImage(): void {
    if (!this.newGalleryImage.imageUrl.trim()) {
      alert('נא להזין URL לתמונה');
      return;
    }
    if (!this.article.galleryImages) this.article.galleryImages = [];
    this.article.galleryImages.push({
      imageUrl: this.newGalleryImage.imageUrl,
      caption: this.newGalleryImage.caption || '',
      displayOrder: this.article.galleryImages.length
    });
    this.newGalleryImage = { imageUrl: '', caption: '' };
  }

  removeGalleryImage(index: number): void {
    if (confirm('האם למחוק תמונה זו מהגלריה?')) {
      this.article.galleryImages?.splice(index, 1);
      this.article.galleryImages?.forEach((img, idx) => { img.displayOrder = idx; });
    }
  }

  moveGalleryImageUp(index: number): void {
    if (index === 0 || !this.article.galleryImages) return;
    [this.article.galleryImages[index], this.article.galleryImages[index - 1]] =
      [this.article.galleryImages[index - 1], this.article.galleryImages[index]];
    this.article.galleryImages.forEach((img, idx) => { img.displayOrder = idx; });
  }

  moveGalleryImageDown(index: number): void {
    if (!this.article.galleryImages || index === this.article.galleryImages.length - 1) return;
    [this.article.galleryImages[index], this.article.galleryImages[index + 1]] =
      [this.article.galleryImages[index + 1], this.article.galleryImages[index]];
    this.article.galleryImages.forEach((img, idx) => { img.displayOrder = idx; });
  }
}
