import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TeacherService } from '../../../services/teacher.service';
import { TeacherDto } from '../../../models/teacher.model';
import { CitiesService, City } from '../../../services/cities.service';
import { TeachingLanguage } from '../../../models/teaching-language.enum';
import { TargetAudience } from '../../../models/target-audience.enum';

@Component({
  selector: 'app-teacher-profile-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './teacher-profile-modal.component.html',
  styleUrls: ['./teacher-profile-modal.component.css']
})
export class TeacherProfileModalComponent implements OnInit {
  @Input() teacherId: number | null = null;
  @Output() close = new EventEmitter<void>();

  teacher: TeacherDto | null = null;
  loading = false;
  error: string | null = null;
  cities: City[] = [];

  constructor(
    private teacherService: TeacherService,
    private citiesService: CitiesService
  ) { }

  ngOnInit(): void {
    if (this.teacherId) {
      this.loadTeacher();
    }
    this.loadCities();
  }

  loadTeacher(): void {
    if (!this.teacherId) return;

    this.loading = true;
    this.error = null;

    this.teacherService.getTeacherById(this.teacherId).subscribe({
      next: (teacher) => {
        this.teacher = teacher;
        this.loading = false;
      },
      error: (err) => {
        console.error('שגיאה בטעינת פרטי מורה:', err);
        this.error = 'שגיאה בטעינת פרטי המורה';
        this.loading = false;
      }
    });
  }

  loadCities(): void {
    this.citiesService.getCities().subscribe({
      next: (cities) => {
        this.cities = cities;
      },
      error: (err) => {
        console.error('שגיאה בטעינת ערים:', err);
      }
    });
  }

  getCityName(cityId: number | null | undefined): string {
    if (!cityId) return '-';
    const city = this.cities.find(c => c.id === cityId);
    return city ? city.name : '-';
  }

  getStatusLabel(status: number): string {
    switch (status) {
      case 0: return 'ממתין לאישור';
      case 1: return 'מאושר';
      case 2: return 'מושעה';
      default: return 'לא ידוע';
    }
  }

  getStatusBadgeClass(status: number): string {
    switch (status) {
      case 0: return 'badge-warning';
      case 1: return 'badge-success';
      case 2: return 'badge-danger';
      default: return 'badge-secondary';
    }
  }

  getLanguagesDisplay(languages?: TeachingLanguage): string {
    if (!languages) return '-';
    const languagesList: string[] = [];

    if (languages & TeachingLanguage.Hebrew) languagesList.push('עברית');
    if (languages & TeachingLanguage.English) languagesList.push('אנגלית');
    if (languages & TeachingLanguage.Russian) languagesList.push('רוסית');
    if (languages & TeachingLanguage.French) languagesList.push('צרפתית');
    if (languages & TeachingLanguage.Spanish) languagesList.push('ספרדית');
    if (languages & TeachingLanguage.Arabic) languagesList.push('ערבית');

    return languagesList.length > 0 ? languagesList.join(', ') : '-';
  }

  getTargetAudienceDisplay(audience?: TargetAudience): string {
    if (!audience) return '-';
    const audienceList: string[] = [];

    if (audience & TargetAudience.Children) audienceList.push('ילדים');
    if (audience & TargetAudience.Teenagers) audienceList.push('נוער');
    if (audience & TargetAudience.Adults) audienceList.push('מבוגרים');
    if (audience & TargetAudience.Seniors) audienceList.push('גיל הזהב');
    if (audience & TargetAudience.Beginners) audienceList.push('מתחילים');
    if (audience & TargetAudience.Intermediate) audienceList.push('בינוניים');
    if (audience & TargetAudience.Advanced) audienceList.push('מתקדמים');
    if (audience & TargetAudience.Professional) audienceList.push('מקצועיים');

    return audienceList.length > 0 ? audienceList.join(', ') : '-';
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
