import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TeacherService } from '../../../services/teacher.service';
import { TeacherDto } from '../../../models/teacher.model';
import { CitiesService, City } from '../../../services/cities.service';
import { TeachingLanguage } from '../../../models/teaching-language.enum';
import { TargetAudience } from '../../../models/target-audience.enum';

@Component({
  selector: 'app-teacher-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './teacher-detail.component.html',
  styleUrls: ['./teacher-detail.component.css']
})
export class TeacherDetailComponent implements OnInit {
  teacher: TeacherDto | null = null;
  cities: City[] = [];
  loading = true;
  showContact = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private teacherService: TeacherService,
    private citiesService: CitiesService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      if (id) this.loadTeacher(id);
    });
    this.citiesService.getCities().subscribe({
      next: cities => this.cities = cities,
      error: () => {}
    });
  }

  loadTeacher(id: number): void {
    this.loading = true;
    this.teacherService.getTeacherById(id).subscribe({
      next: teacher => {
        this.teacher = teacher;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.router.navigate(['/teachers']);
      }
    });
  }

  getCityName(cityId?: number | null): string {
    if (!cityId) return '';
    return this.cities.find(c => c.id === cityId)?.name || '';
  }

  getLanguagesDisplay(languages?: TeachingLanguage): string {
    if (!languages) return '';
    const list: string[] = [];
    if (languages & TeachingLanguage.Hebrew) list.push('עברית');
    if (languages & TeachingLanguage.English) list.push('אנגלית');
    if (languages & TeachingLanguage.Russian) list.push('רוסית');
    if (languages & TeachingLanguage.French) list.push('צרפתית');
    if (languages & TeachingLanguage.Spanish) list.push('ספרדית');
    if (languages & TeachingLanguage.Arabic) list.push('ערבית');
    return list.join('، ');
  }

  getTargetAudienceList(audience?: TargetAudience): string[] {
    if (!audience) return [];
    const list: string[] = [];
    if (audience & TargetAudience.Children) list.push('ילדים');
    if (audience & TargetAudience.Teenagers) list.push('נוער');
    if (audience & TargetAudience.Adults) list.push('מבוגרים');
    if (audience & TargetAudience.Seniors) list.push('גיל הזהב');
    if (audience & TargetAudience.Beginners) list.push('מתחילים');
    if (audience & TargetAudience.Intermediate) list.push('בינוניים');
    if (audience & TargetAudience.Advanced) list.push('מתקדמים');
    if (audience & TargetAudience.Professional) list.push('מקצועיים');
    return list;
  }

  getSafeVideoUrl(url: string): SafeResourceUrl {
    const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/)?.[1];
    const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  toggleContact(): void {
    this.showContact = !this.showContact;
  }

  goBack(): void {
    this.router.navigate(['/teachers']);
  }
}
