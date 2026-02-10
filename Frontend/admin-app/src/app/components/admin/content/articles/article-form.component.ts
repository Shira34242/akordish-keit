import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ArticleService } from '../../../../services/admin/article.service';
import { SystemTablesService, SystemItem } from '../../../../services/system-tables.service';
import { ArtistService } from '../../../../services/artist.service';
import { ArtistListDto } from '../../../../models/artist.model';
import {
  Article,
  CreateArticleDto,
  ArticleCategory,
  ArticleContentType,
  ArticleStatus
} from '../../../../models/article.model';

@Component({
  selector: 'app-article-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './article-form.component.html',
  styleUrls: ['./article-form.component.css']
})
export class ArticleFormComponent implements OnInit {
  private readonly articleService = inject(ArticleService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly systemTablesService = inject(SystemTablesService);
  private readonly artistService = inject(ArtistService);

  // State
  categories: SystemItem[] = [];
  artists: ArtistListDto[] = [];
  isEditMode = false;
  articleId?: number;
  loading = false;
  saving = false;
  fetchingYouTube = false;
  youtubeMessage = '';

  // Gallery state
  newGalleryImage = { imageUrl: '', caption: '' };

  // Categories collapse state
  categoriesExpanded = false;

  // Artists collapse state
  artistsExpanded = false;

  // Enums for template
  ArticleCategory = ArticleCategory;
  ArticleStatus = ArticleStatus;
  ArticleContentType = ArticleContentType;

  // Form model
  article: CreateArticleDto = {
    title: '',
    subtitle: '',
    content: '',
    featuredImageUrl: '',
    authorName: '',
    categoryIds: [], // Default to empty array
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
    scheduledDate: undefined,
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

    // Check if we're in edit mode
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.articleId = +params['id'];
        this.loadArticle();
      }
    });

    // Check query params for content type (when creating new)
    this.route.queryParams.subscribe(params => {
      if (params['type'] === 'blog') {
        this.article.contentType = ArticleContentType.Blog;
      }
    });
  }

  loadCategories(): void {
    this.systemTablesService.getItems('article-categories', 1, 100).subscribe({
      next: (result) => {
        this.categories = result.items;
      },
      error: (err) => console.error('Error loading categories', err)
    });
  }

  loadArtists(): void {
    this.artistService.getArtists(undefined, undefined, 1, 100, 'name').subscribe({
      next: (result) => {
        this.artists = result.items;
      },
      error: (err) => console.error('Error loading artists', err)
    });
  }

  loadArticle(): void {
    if (!this.articleId) return;

    this.loading = true;
    this.articleService.getArticle(this.articleId).subscribe({
      next: (data: Article) => {
        this.article = {
          title: data.title,
          subtitle: data.subtitle || '',
          content: data.content,
          featuredImageUrl: data.featuredImageUrl || '',
          authorName: data.authorName || '',
          categoryIds: data.categoryIds || [],
          contentType: data.contentType,
          slug: data.slug,
          canonicalUrl: data.canonicalUrl || '',
          videoEmbedUrl: data.videoEmbedUrl || '',
          audioEmbedUrl: data.audioEmbedUrl || '',
          imageCredit: data.imageCredit || '',
          shortDescription: data.shortDescription || '',
          isFeatured: data.isFeatured,
          displayOrder: data.displayOrder,
          status: data.status,
          scheduledDate: data.scheduledDate,
          isPremium: data.isPremium,
          metaTitle: data.metaTitle || '',
          metaDescription: data.metaDescription || '',
          openGraphImageUrl: data.openGraphImageUrl || '',
          readTimeMinutes: data.readTimeMinutes,
          tagIds: [],
          galleryImages: data.galleryImages.map(img => ({
            imageUrl: img.imageUrl,
            caption: img.caption || '',
            displayOrder: img.displayOrder
          })),
          artistIds: data.taggedArtists?.map(a => a.artistId) || []
        };
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading article:', error);
        alert('שגיאה בטעינת הכתבה');
        this.goBack();
      }
    });
  }

  onTitleChange(): void {
    // Auto-generate slug from title if it's a new article
    if (!this.isEditMode && this.article.title) {
      this.article.slug = this.generateSlug(this.article.title);
    }

    // Auto-generate meta title if empty
    if (!this.article.metaTitle) {
      this.article.metaTitle = this.article.title;
    }
  }

  generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .trim();
  }

  calculateReadTime(): void {
    if (this.article.content) {
      const wordsPerMinute = 200;
      const wordCount = this.article.content.split(/\s+/).length;
      this.article.readTimeMinutes = Math.ceil(wordCount / wordsPerMinute);
    }
  }

  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

    this.saving = true;

    if (this.isEditMode && this.articleId) {
      // Update existing article
      this.articleService.updateArticle(this.articleId, this.article).subscribe({
        next: () => {
          this.goBack();
        },
        error: (error) => {
          console.error('Error updating article:', error);
          alert('שגיאה בעדכון הכתבה: ' + (error.error?.message || error.message));
          this.saving = false;
        }
      });
    } else {
      // Create new article
      this.articleService.createArticle(this.article).subscribe({
        next: () => {
          this.goBack();
        },
        error: (error) => {
          console.error('Error creating article:', error);
          alert('שגיאה ביצירת הכתבה: ' + (error.error?.message || error.message));
          this.saving = false;
        }
      });
    }
  }

  validateForm(): boolean {
    if (!this.article.title?.trim()) {
      alert('נא להזין כותרת');
      return false;
    }

    if (!this.article.content?.trim()) {
      alert('נא להזין תוכן');
      return false;
    }

    if (!this.article.slug?.trim()) {
      alert('נא להזין Slug');
      return false;
    }

    return true;
  }

  goBack(): void {
    this.router.navigate(['/admin/content/articles']);
  }

  // Category selection methods
  isCategorySelected(categoryId: number): boolean {
    return this.article.categoryIds.includes(categoryId);
  }

  toggleCategory(categoryId: number): void {
    const index = this.article.categoryIds.indexOf(categoryId);
    if (index > -1) {
      this.article.categoryIds.splice(index, 1);
    } else {
      this.article.categoryIds.push(categoryId);
    }
  }

  toggleCategoriesExpanded(): void {
    this.categoriesExpanded = !this.categoriesExpanded;
  }

  getVisibleCategories(): SystemItem[] {
    if (this.categoriesExpanded) {
      return this.categories;
    }
    // Show only first 3 categories when collapsed
    return this.categories.slice(0, 3);
  }

  get hasMoreCategories(): boolean {
    return this.categories.length > 3;
  }

  // Artist selection methods
  isArtistSelected(artistId: number): boolean {
    return this.article.artistIds?.includes(artistId) || false;
  }

  toggleArtist(artistId: number): void {
    if (!this.article.artistIds) {
      this.article.artistIds = [];
    }

    const index = this.article.artistIds.indexOf(artistId);
    if (index > -1) {
      this.article.artistIds.splice(index, 1);
    } else {
      this.article.artistIds.push(artistId);
    }
  }

  toggleArtistsExpanded(): void {
    this.artistsExpanded = !this.artistsExpanded;
  }

  getVisibleArtists(): ArtistListDto[] {
    if (this.artistsExpanded) {
      return this.artists;
    }
    // Show only first 5 artists when collapsed
    return this.artists.slice(0, 5);
  }

  get hasMoreArtists(): boolean {
    return this.artists.length > 5;
  }

  getStatusName(status: ArticleStatus): string {
    const names: Record<ArticleStatus, string> = {
      [ArticleStatus.Draft]: 'טיוטה',
      [ArticleStatus.Published]: 'פורסם',
      [ArticleStatus.Scheduled]: 'מתוזמן',
      [ArticleStatus.Archived]: 'ארכיון'
    };
    return names[status];
  }

  onVideoUrlChange(): void {
    // Auto-fetch thumbnail when user finishes typing
    if (this.article.videoEmbedUrl && !this.article.featuredImageUrl) {
      this.fetchYouTubeThumbnail();
    }
  }

  fetchYouTubeThumbnail(): void {
    if (!this.article.videoEmbedUrl) {
      return;
    }

    this.fetchingYouTube = true;
    this.youtubeMessage = 'שולף תמונה מיוטיוב...';

    this.articleService.getYouTubeMetadata(this.article.videoEmbedUrl).subscribe({
      next: (metadata) => {
        if (metadata.success && metadata.thumbnailUrl) {
          this.article.featuredImageUrl = metadata.thumbnailUrl;
          this.youtubeMessage = '✓ תמונה נשלפה בהצלחה';
          setTimeout(() => this.youtubeMessage = '', 3000);
        } else {
          this.youtubeMessage = '⚠️ לא ניתן לשלוף תמונה: ' + (metadata.errorMessage || 'שגיאה לא ידועה');
        }
        this.fetchingYouTube = false;
      },
      error: (error) => {
        console.error('Error fetching YouTube metadata:', error);
        this.youtubeMessage = '⚠️ שגיאה בשליפת התמונה';
        this.fetchingYouTube = false;
      }
    });
  }

  // Gallery methods
  addGalleryImage(): void {
    if (!this.newGalleryImage.imageUrl.trim()) {
      alert('נא להזין URL לתמונה');
      return;
    }

    const displayOrder = this.article.galleryImages ? this.article.galleryImages.length : 0;

    if (!this.article.galleryImages) {
      this.article.galleryImages = [];
    }

    this.article.galleryImages.push({
      imageUrl: this.newGalleryImage.imageUrl,
      caption: this.newGalleryImage.caption || '',
      displayOrder
    });

    this.newGalleryImage = { imageUrl: '', caption: '' };
  }

  removeGalleryImage(index: number): void {
    if (confirm('האם למחוק תמונה זו מהגלריה?')) {
      this.article.galleryImages?.splice(index, 1);
      // Update display orders
      this.article.galleryImages?.forEach((img, idx) => {
        img.displayOrder = idx;
      });
    }
  }

  moveGalleryImageUp(index: number): void {
    if (index === 0 || !this.article.galleryImages) return;

    const temp = this.article.galleryImages[index];
    this.article.galleryImages[index] = this.article.galleryImages[index - 1];
    this.article.galleryImages[index - 1] = temp;

    // Update display orders
    this.article.galleryImages.forEach((img, idx) => {
      img.displayOrder = idx;
    });
  }

  moveGalleryImageDown(index: number): void {
    if (!this.article.galleryImages || index === this.article.galleryImages.length - 1) return;

    const temp = this.article.galleryImages[index];
    this.article.galleryImages[index] = this.article.galleryImages[index + 1];
    this.article.galleryImages[index + 1] = temp;

    // Update display orders
    this.article.galleryImages.forEach((img, idx) => {
      img.displayOrder = idx;
    });
  }
}
