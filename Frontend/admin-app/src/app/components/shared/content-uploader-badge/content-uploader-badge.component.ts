import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentUploaderProfile } from '../../../models/article.model';
import { LanguageService } from '../../../services/language.service';
import { CloudflareImagePipe } from '../../../pipes/cloudflare-image.pipe';

@Component({
  selector: 'app-content-uploader-badge',
  standalone: true,
  imports: [CommonModule, RouterModule, CloudflareImagePipe],
  templateUrl: './content-uploader-badge.component.html',
  styleUrls: ['./content-uploader-badge.component.css']
})
export class ContentUploaderBadgeComponent {
  @Input() profile!: ContentUploaderProfile;

  private readonly langService = inject(LanguageService);

  getPrefixText(): string {
    return this.langService.translate('content_badge.uploaded_by_prefix');
  }

  getAvatarClass(): string {
    if (this.profile.type === 'artist') return 'avatar--circle';
    if (this.profile.profileUrl.startsWith('/teacher/')) return 'avatar--circle';
    if (this.profile.profileUrl.startsWith('/service-provider/')) return 'avatar--rounded';
    if (this.profile.profileUrl.startsWith('/professional/')) return 'avatar--rounded';
    if (this.profile.profileUrl.startsWith('/agency/')) return 'avatar--square';
    return 'avatar--circle';
  }

  getProfileRouterLink(): string | null {
    const url = this.profile.profileUrl;
    if (!url) return null;
    if (this.profile.type === 'artist') return '/artist/' + this.profile.profileId;
    if (url.startsWith('/teacher/')) return '/teacher/' + this.profile.profileId;
    if (url.startsWith('/service-provider/')) return '/professional/' + this.profile.profileId;
    if (this.profile.type === 'serviceProvider') return '/professional/' + this.profile.profileId;
    if (url.startsWith('/professional/')) return url;
    if (url.startsWith('/agency/')) return url;
    if (url.startsWith('http')) return null;
    return url;
  }
}
