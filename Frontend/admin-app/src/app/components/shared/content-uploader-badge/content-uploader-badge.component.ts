import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentUploaderProfile } from '../../../models/article.model';
import { LanguageService } from '../../../services/language.service';

@Component({
  selector: 'app-content-uploader-badge',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './content-uploader-badge.component.html',
  styleUrls: ['./content-uploader-badge.component.css']
})
export class ContentUploaderBadgeComponent {
  @Input() profile!: ContentUploaderProfile;

  private readonly langService = inject(LanguageService);

  getDisplayText(): string {
    if (this.profile.type === 'artist') return this.langService.translate('content_badge.artist_prefix') + this.profile.name;
    if (this.profile.profileUrl.startsWith('/teacher/')) return this.langService.translate('content_badge.teacher_prefix') + this.profile.name;
    return this.profile.name;
  }
}
