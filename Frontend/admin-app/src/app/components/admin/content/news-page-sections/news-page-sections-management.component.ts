import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, Observable, of } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import { NewsPageSectionService } from '../../../../services/news-page-section.service';
import { SystemTablesService, SystemItem } from '../../../../services/system-tables.service';

import {
  NewsPageSection,
  NewsSectionType,
  UpdateNewsPageSectionDto
} from '../../../../models/news-page-section.model';

interface CategoryOption extends SystemItem {
  section?: number;
}

interface PageCategorySetting {
  contentTypeId: number;
  title: string;
  icon: string;
  categoryIds: number[];
  saving: boolean;
  section?: NewsPageSection;
}

@Component({
  selector: 'app-news-page-sections-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './news-page-sections-management.component.html',
  styleUrls: ['./news-page-sections-management.component.css']
})
export class NewsPageSectionsMangementComponent implements OnInit {
  private readonly service = inject(NewsPageSectionService);
  private readonly systemTablesService = inject(SystemTablesService);

  sections: NewsPageSection[] = [];
  categories: CategoryOption[] = [];
  loading = false;

  readonly pageSettings: PageCategorySetting[] = [
    {
      contentTypeId: 0,
      title: 'חדשות המוזיקה',
      icon: 'music_note',
      categoryIds: [],
      saving: false
    },
    {
      contentTypeId: 1,
      title: 'כתבות',
      icon: 'article',
      categoryIds: [],
      saving: false
    }
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
      error: (err) => console.error('Error loading article categories for page category settings', err)
    });
  }

  loadSections(): void {
    this.loading = true;
    this.service.getAllSections().subscribe({
      next: (sections) => {
        this.sections = sections.sort((a, b) =>
          (a.contentTypeId ?? 0) - (b.contentTypeId ?? 0) || a.displayOrder - b.displayOrder
        );
        this.applySectionsToPages();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  getCategoriesForPage(page: PageCategorySetting): CategoryOption[] {
    return this.categories.filter(category => (category.section ?? 0) === page.contentTypeId);
  }

  togglePageCategory(page: PageCategorySetting, categoryId: number): void {
    if (page.categoryIds.includes(categoryId)) {
      page.categoryIds = page.categoryIds.filter(id => id !== categoryId);
      return;
    }

    page.categoryIds = [...page.categoryIds, categoryId];
  }

  isPageCategorySelected(page: PageCategorySetting, categoryId: number): boolean {
    return page.categoryIds.includes(categoryId);
  }

  getCategoryName(id: number): string {
    return this.categories.find(c => c.id === id)?.name ?? 'קטגוריה שנמחקה';
  }

  getSelectionSummary(page: PageCategorySetting): string {
    if (page.categoryIds.length === 0) {
      return 'לא נבחרו קטגוריות';
    }

    return page.categoryIds
      .map(id => this.getCategoryName(id))
      .join(', ');
  }

  savePageSetting(page: PageCategorySetting): void {
    page.saving = true;

    const pageSections = this.getSectionsForPage(page.contentTypeId);
    const primarySection = page.section ?? pageSections[0];
    const dto = this.buildDto(page, primarySection);
    const saveRequest: Observable<unknown> = primarySection
      ? this.service.updateSection(primarySection.id, dto)
      : page.categoryIds.length > 0
        ? this.service.createSection(dto)
        : of(null);

    saveRequest
      .pipe(
        switchMap(() => this.disableExtraPageSections(page, pageSections, primarySection?.id)),
        finalize(() => { page.saving = false; })
      )
      .subscribe({
        next: () => this.loadSections(),
        error: () => alert('שגיאה בשמירת הקטגוריות')
      });
  }

  private applySectionsToPages(): void {
    this.pageSettings.forEach(page => {
      const pageSections = this.getSectionsForPage(page.contentTypeId);
      const selectedSections = pageSections.filter(section => section.isActive);
      const sourceSections = selectedSections.length > 0 ? selectedSections : pageSections;

      page.section = pageSections[0];
      page.categoryIds = this.uniqueIds(sourceSections.flatMap(section => this.getCategoryIds(section)));
    });
  }

  private getSectionsForPage(contentTypeId: number): NewsPageSection[] {
    return this.sections
      .filter(section => (section.contentTypeId ?? 0) === contentTypeId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  private buildDto(page: PageCategorySetting, existingSection?: NewsPageSection): UpdateNewsPageSectionDto {
    const categoryIds = this.uniqueIds(page.categoryIds);

    return {
      sectionType: NewsSectionType.ByCategory,
      categoryId: categoryIds[0],
      categoryIds,
      contentTypeId: page.contentTypeId,
      displayOrder: existingSection?.displayOrder ?? page.contentTypeId + 1,
      isActive: categoryIds.length > 0
    };
  }

  private disableExtraPageSections(
    page: PageCategorySetting,
    pageSections: NewsPageSection[],
    primarySectionId?: number
  ): Observable<unknown> {
    const extraSections = pageSections.filter(section => section.id !== primarySectionId);

    if (extraSections.length === 0) {
      return of([]);
    }

    return forkJoin(extraSections.map(section => this.service.updateSection(section.id, {
      sectionType: NewsSectionType.ByCategory,
      categoryId: this.getCategoryIds(section)[0],
      categoryIds: this.getCategoryIds(section),
      contentTypeId: page.contentTypeId,
      displayOrder: section.displayOrder,
      isActive: false
    })));
  }

  private getCategoryIds(section: NewsPageSection): number[] {
    return section.categoryIds?.length ? section.categoryIds : section.categoryId ? [section.categoryId] : [];
  }

  private uniqueIds(ids: number[]): number[] {
    return ids.filter((id, index, arr) => id > 0 && arr.indexOf(id) === index);
  }
}
