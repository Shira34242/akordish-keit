import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MusicServiceProviderService } from '../../../services/music-service-provider.service';
import { MusicServiceProviderDto } from '../../../models/music-service-provider.model';
import { CitiesService, City } from '../../../services/cities.service';

@Component({
  selector: 'app-professional-profile-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './professional-profile-modal.component.html',
  styleUrls: ['./professional-profile-modal.component.css']
})
export class ProfessionalProfileModalComponent implements OnInit {
  @Input() professionalId: number | null = null;
  @Output() close = new EventEmitter<void>();

  professional: MusicServiceProviderDto | null = null;
  loading = false;
  error: string | null = null;
  cities: City[] = [];

  constructor(
    private professionalService: MusicServiceProviderService,
    private citiesService: CitiesService
  ) { }

  ngOnInit(): void {
    if (this.professionalId) {
      this.loadProfessional();
    }
    this.loadCities();
  }

  loadProfessional(): void {
    if (!this.professionalId) return;

    this.loading = true;
    this.error = null;

    this.professionalService.getServiceProviderById(this.professionalId).subscribe({
      next: (professional) => {
        this.professional = professional;
        this.loading = false;
      },
      error: (err) => {
        console.error('שגיאה בטעינת פרטי בעל מקצוע:', err);
        this.error = 'שגיאה בטעינת פרטי בעל המקצוע';
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

  getCategoriesDisplay(): string {
    if (!this.professional?.categories || this.professional.categories.length === 0) {
      return '-';
    }
    return this.professional.categories.map(c => c.categoryName).join(', ');
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  openWhatsApp(): void {
    if (this.professional?.whatsAppNumber) {
      const phoneNumber = this.professional.whatsAppNumber.replace(/\D/g, '');
      window.open(`https://wa.me/${phoneNumber}`, '_blank');
    }
  }

  callPhone(): void {
    if (this.professional?.phoneNumber) {
      window.location.href = `tel:${this.professional.phoneNumber}`;
    }
  }

  sendEmail(): void {
    if (this.professional?.email) {
      window.location.href = `mailto:${this.professional.email}`;
    }
  }

  visitWebsite(): void {
    if (this.professional?.websiteUrl) {
      window.open(this.professional.websiteUrl, '_blank');
    }
  }
}
