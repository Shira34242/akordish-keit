import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeaturedContentService } from '../../../../services/admin/featured-content.service';
import { ArticleService } from '../../../../services/admin/article.service';
import { FeaturedContent, FeaturedContentItemDto, UpdateFeaturedContentBulkDto } from '../../../../models/featured-content.model';
import { Article } from '../../../../models/article.model';

@Component({
  selector: 'app-featured-content-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './featured-content-management.component.html',
  styleUrls: ['./featured-content-management.component.css']
})
export class FeaturedContentManagementComponent implements OnInit {
  private readonly slotCount = 5;
  private readonly featuredContentService = inject(FeaturedContentService);
  private readonly articleService = inject(ArticleService);

  featuredContent: FeaturedContent[] = [];
  availableArticles: Article[] = [];
  filteredArticles: Article[] = [];
  searchTerm = '';
  selectedArticles: (Article | null)[] = Array.from({ length: this.slotCount }, () => null);

  loading = false;
  loadingArticles = false;
  saving = false;

  ngOnInit(): void {
    this.loadFeaturedContent();
    this.loadAvailableArticles();
  }

  loadFeaturedContent(): void {
    this.loading = true;
    this.featuredContentService.getAllFeaturedContent().subscribe({
      next: (content) => {
        this.featuredContent = content.sort((a, b) => a.displayOrder - b.displayOrder);
        this.selectedArticles = Array.from({ length: this.slotCount }, () => null);

        this.featuredContent.forEach(fc => {
          if (fc.displayOrder >= 1 && fc.displayOrder <= this.slotCount) {
            this.selectedArticles[fc.displayOrder - 1] = fc.article;
          }
        });

        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading featured content:', error);
        this.loading = false;
      }
    });
  }

  loadAvailableArticles(): void {
    this.loadingArticles = true;
    this.articleService.getArticles(
      1,
      100,
      undefined,
      undefined,
      undefined,
      1,
      undefined,
      undefined,
      undefined
    ).subscribe({
      next: (result) => {
        this.availableArticles = result.items;
        this.filteredArticles = [...this.availableArticles];
        this.loadingArticles = false;
      },
      error: (error) => {
        console.error('Error loading articles:', error);
        this.loadingArticles = false;
      }
    });
  }

  onSearchArticles(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredArticles = [...this.availableArticles];
      return;
    }

    this.filteredArticles = this.availableArticles.filter(article =>
      article.title.toLowerCase().includes(term) ||
      article.subtitle?.toLowerCase().includes(term) ||
      article.categoryNames.some(cat => cat.toLowerCase().includes(term))
    );
  }

  selectArticle(article: Article, position: number): void {
    const existingIndex = this.selectedArticles.findIndex(a => a && a.id === article.id);
    if (existingIndex !== -1 && existingIndex !== position) {
      alert('הכתבה הזו כבר נבחרה במיקום אחר');
      return;
    }

    this.selectedArticles[position] = article;
  }

  removeArticle(position: number): void {
    this.selectedArticles[position] = null;
  }

  moveUp(position: number): void {
    if (position === 0) return;
    const temp = this.selectedArticles[position];
    this.selectedArticles[position] = this.selectedArticles[position - 1];
    this.selectedArticles[position - 1] = temp;
  }

  moveDown(position: number): void {
    if (position === this.slotCount - 1) return;
    const temp = this.selectedArticles[position];
    this.selectedArticles[position] = this.selectedArticles[position + 1];
    this.selectedArticles[position + 1] = temp;
  }

  getFirstEmptyPosition(): number {
    return this.selectedArticles.findIndex(a => a === null);
  }

  hasEmptyPosition(): boolean {
    return this.selectedArticles.some(a => a === null);
  }

  isArticleSelected(article: Article): boolean {
    return this.selectedArticles.some(a => a && a.id === article.id);
  }

  saveFeaturedContent(): void {
    const items: FeaturedContentItemDto[] = [];

    this.selectedArticles.forEach((article, index) => {
      if (article) {
        items.push({
          articleId: article.id,
          displayOrder: index + 1
        });
      }
    });

    if (items.length === 0) {
      alert('יש לבחור לפחות כתבה אחת');
      return;
    }

    const dto: UpdateFeaturedContentBulkDto = { items };

    this.saving = true;
    this.featuredContentService.updateFeaturedContentBulk(dto).subscribe({
      next: () => {
        this.saving = false;
        alert('התוכן המרכזי עודכן בהצלחה');
        this.loadFeaturedContent();
      },
      error: (error) => {
        console.error('Error saving featured content:', error);
        this.saving = false;
        alert('שגיאה בשמירת התוכן המרכזי');
      }
    });
  }

  getPositionLabel(position: number): string {
    const labels = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
    return labels[position];
  }
}
