import { Component, ElementRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NewsPageSectionService } from '../../../../services/news-page-section.service';
import { SiteAlertService } from '../../../../services/site-alert.service';
import { RequiredFieldFeedbackService } from '../../../../services/required-field-feedback.service';
import { SystemTablesService, SystemItem } from '../../../../services/system-tables.service';

import {
  NewsPageSection,
  NewsSectionType,
  CreateNewsPageSectionDto,
  UpdateNewsPageSectionDto
} from '../../../../models/news-page-section.model';

interface CategoryOption extends SystemItem {
  section?: number;
}

interface ContentTypeOption { id: number; name: string; }

@Component({
  selector: 'app-news-page-sections-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './news-page-sections-management.component.html',
  styleUrls: ['./news-page-sections-management.component.css']
})
export class NewsPageSectionsMangementComponent implements OnInit {
  private readonly siteAlerts = inject(SiteAlertService);
  private readonly service = inject(NewsPageSectionService);
  private readonly systemTablesService = inject(SystemTablesService);
  private readonly requiredFieldFeedback = inject(RequiredFieldFeedbackService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  sections: NewsPageSection[] = [];
  categories: CategoryOption[] = [];
  loading = false;
  saving = false;

  showForm = false;
  editingSection: NewsPageSection | null = null;
  formTitle = '';
  formSectionType: NewsSectionType = NewsSectionType.ByCategory;
  formCategoryId: number | null = null;
  formContentTypeId: number | null = null;
  formArticleCount = 10;
  formIsActive = true;

  readonly NewsSectionType = NewsSectionType;

  readonly contentTypes: ContentTypeOption[] = [
    { id: 0, name: 'חדשות' },
    { id: 1, name: 'בלוג' }
  ];

  ngOnInit(): void {
    this.loadCategories();
    this.loadSections();
  }

  loadCategories(): void {
    this.systemTablesService.getItems('article-categories', 1, 200).subscribe({
      next: (result) => {
        this.categories = (result.items as CategoryOption[])
          .sort((a, b) => (a.section ?? 0) - (b.section ?? 0) || a.name.localeCompare(b.name, 'he'));
      },
      error: (err) => console.error('Error loading article categories for news sections', err)
    });
  }

  loadSections(): void {
    this.loading = true;
    this.service.getAllSections().subscribe({
      next: (sections) => {
        this.sections = sections.sort((a, b) => a.displayOrder - b.displayOrder);
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  openAddForm(): void {
    this.editingSection = null;
    this.formTitle = '';
    this.formSectionType = NewsSectionType.ByCategory;
    this.formCategoryId = null;
    this.formContentTypeId = null;
    this.formArticleCount = 10;
    this.formIsActive = true;
    this.showForm = true;
  }

  openEditForm(section: NewsPageSection): void {
    this.editingSection = section;
    this.formTitle = section.title;
    this.formSectionType = section.sectionType;
    this.formCategoryId = section.categoryId ?? null;
    this.formContentTypeId = section.contentTypeId ?? null;
    this.formArticleCount = section.articleCount;
    this.formIsActive = section.isActive;
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingSection = null;
  }

  saveForm(): void {
    if (!this.formTitle.trim()) {
      this.requiredFieldFeedback.showRequiredBySelector(this.host.nativeElement, '[name="sectionTitle"]');
      return;
    }
    if (this.formSectionType === NewsSectionType.ByCategory && !this.formCategoryId) {
      this.requiredFieldFeedback.showRequiredBySelector(this.host.nativeElement, '[name="sectionCategory"]');
      return;
    }
    if (this.formSectionType === NewsSectionType.ByContentType && this.formContentTypeId === null) {
      this.requiredFieldFeedback.showRequiredBySelector(this.host.nativeElement, '[name="sectionContentType"]');
      return;
    }

    this.saving = true;

    if (this.editingSection) {
      const dto: UpdateNewsPageSectionDto = {
        title: this.formTitle.trim(),
        sectionType: this.formSectionType,
        categoryId: this.formSectionType === NewsSectionType.ByCategory ? this.formCategoryId! : undefined,
        contentTypeId: this.formSectionType === NewsSectionType.ByContentType ? this.formContentTypeId! : undefined,
        displayOrder: this.editingSection.displayOrder,
        isActive: this.formIsActive,
        articleCount: this.formArticleCount
      };
      this.service.updateSection(this.editingSection.id, dto).subscribe({
        next: () => { this.saving = false; this.closeForm(); this.loadSections(); },
        error: () => { this.saving = false; alert('שגיאה בשמירה'); }
      });
      return;
    }

    const dto: CreateNewsPageSectionDto = {
      title: this.formTitle.trim(),
      sectionType: this.formSectionType,
      categoryId: this.formSectionType === NewsSectionType.ByCategory ? this.formCategoryId! : undefined,
      contentTypeId: this.formSectionType === NewsSectionType.ByContentType ? this.formContentTypeId! : undefined,
      displayOrder: this.sections.length + 1,
      isActive: this.formIsActive,
      articleCount: this.formArticleCount
    };
    this.service.createSection(dto).subscribe({
      next: () => { this.saving = false; this.closeForm(); this.loadSections(); },
      error: () => { this.saving = false; alert('שגיאה ביצירה'); }
    });
  }

  toggleActive(section: NewsPageSection): void {
    const dto: UpdateNewsPageSectionDto = {
      title: section.title,
      sectionType: section.sectionType,
      categoryId: section.categoryId,
      contentTypeId: section.contentTypeId,
      displayOrder: section.displayOrder,
      isActive: !section.isActive,
      articleCount: section.articleCount
    };
    this.service.updateSection(section.id, dto).subscribe({
      next: () => this.loadSections(),
      error: () => alert('שגיאה בעדכון')
    });
  }

  moveUp(index: number): void {
    if (index === 0) return;
    this.swapOrder(this.sections[index], this.sections[index - 1]);
  }

  moveDown(index: number): void {
    if (index === this.sections.length - 1) return;
    this.swapOrder(this.sections[index], this.sections[index + 1]);
  }

  private swapOrder(a: NewsPageSection, b: NewsPageSection): void {
    const dtoA: UpdateNewsPageSectionDto = { ...a, displayOrder: b.displayOrder };
    const dtoB: UpdateNewsPageSectionDto = { ...b, displayOrder: a.displayOrder };

    this.service.updateSection(a.id, dtoA).subscribe(() =>
      this.service.updateSection(b.id, dtoB).subscribe(() => this.loadSections())
    );
  }

  async deleteSection(section: NewsPageSection): Promise<void> {
    if (!(await this.siteAlerts.confirm(`למחוק את הפס "${section.title}"?`))) return;
    this.service.deleteSection(section.id).subscribe({
      next: () => this.loadSections(),
      error: () => alert('שגיאה במחיקה')
    });
  }

  getCategoryName(id: number | undefined): string {
    if (!id) return 'ללא קטגוריה';
    return this.categories.find(c => c.id === id)?.name ?? 'קטגוריה שנמחקה';
  }

  getContentTypeName(id: number | undefined): string {
    return this.contentTypes.find(c => c.id === id)?.name ?? '-';
  }

  getSectionLabel(section: NewsPageSection): string {
    if (section.sectionType === NewsSectionType.ByCategory) {
      return `קטגוריה: ${this.getCategoryName(section.categoryId)}`;
    }
    return `סוג תוכן: ${this.getContentTypeName(section.contentTypeId)}`;
  }
}
