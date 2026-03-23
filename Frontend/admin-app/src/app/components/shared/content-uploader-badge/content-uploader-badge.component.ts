import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentUploaderProfile } from '../../../models/article.model';

@Component({
  selector: 'app-content-uploader-badge',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './content-uploader-badge.component.html',
  styleUrls: ['./content-uploader-badge.component.css']
})
export class ContentUploaderBadgeComponent {
  @Input() profile!: ContentUploaderProfile;

  getDisplayText(): string {
    if (this.profile.type === 'artist') return `האמן ${this.profile.name}`;
    if (this.profile.profileUrl.startsWith('/teacher/')) return `המורה ${this.profile.name}`;
    return this.profile.name;
  }
}
