import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NewsPageSectionService } from '../../../../services/news-page-section.service';
import {
  NewsPageSection,
  NewsSectionType,
  CreateNewsPageSectionDto,
  UpdateNewsPageSectionDto
} from '../../../../models/news-page-section.model';

interface CategoryOption { id: number; name: string; }
interface ContentTypeOption { id: number; name: string; }

@Component({
  selector: 'app-news-page-sections-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './news-page-sections-management.component.html',
  styleUrls: ['./news-page-sections-management.component.css']
})
export class NewsPageSectionsMangementComponent implements OnInit {
  private readonly service = inject(NewsPageSectionService);

  sections: NewsPageSection[] = [];
  loading = false;
  saving = false;

  // טופס הוספה / עריכה
  showForm = false;
  editingSection: NewsPageSection | null = null;
  formTitle = '';
  formSectionType: NewsSectionType = NewsSectionType.ByCategory;
  formCategoryId: number | null = null;
  formContentTypeId: number | null = null;
  formArticleCount = 10;
  formIsActive = true;

  readonly NewsSectionType = NewsSectionType;

  readonly categories: CategoryOption[] = [
    { id: 1,  name: 'כללי' },
    { id: 2,  name: 'חדשות' },
    { id: 3,  name: 'ביקורות' },
    { id: 4,  name: 'ראיונות' },
    { id: 5,  name: 'כתבות מיוחדות' },
    { id: 6,  name: 'כתבות הופעות' },
    { id: 7,  name: 'ביקורות אלבומים' },
    { id: 8,  name: 'טכנולוגיה מוזיקלית' },
    { id: 9,  name: 'לימוד וחינוך' },
    { id: 10, name: 'פופולארי' },
    { id: 11, name: 'קליפים' },
    { id: 12, name: 'בלוג' },
    { id: 13, name: 'דעה' },
    { id: 14, name: 'מצעדים' },
    { id: 15, name: 'מאחורי הקלעים' }
  ];

  readonly contentTypes: ContentTypeOption[] = [
    { id: 0, name: 'חדשות' },
    { id: 1, name: 'בלוג' }
  ];

  ngOnInit(): void {
    this.loadSections();
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
      alert('יש להזין כותרת לפס');
      return;
    }
    if (this.formSectionType === NewsSectionType.ByCategory && !this.formCategoryId) {
      alert('יש לבחור קטגוריה');
      return;
    }
    if (this.formSectionType === NewsSectionType.ByContentType && this.formContentTypeId === null) {
      alert('יש לבחור סוג תוכן');
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
    } else {
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

  deleteSection(section: NewsPageSection): void {
    if (!confirm(`למחוק את הפס "${section.title}"?`)) return;
    this.service.deleteSection(section.id).subscribe({
      next: () => this.loadSections(),
      error: () => alert('שגיאה במחיקה')
    });
  }

  getCategoryName(id: number | undefined): string {
    return this.categories.find(c => c.id === id)?.name ?? '—';
  }

  getContentTypeName(id: number | undefined): string {
    return this.contentTypes.find(c => c.id === id)?.name ?? '—';
  }

  getSectionLabel(section: NewsPageSection): string {
    if (section.sectionType === NewsSectionType.ByCategory) {
      return `קטגוריה: ${this.getCategoryName(section.categoryId)}`;
    }
    return `סוג תוכן: ${this.getContentTypeName(section.contentTypeId)}`;
  }
}
