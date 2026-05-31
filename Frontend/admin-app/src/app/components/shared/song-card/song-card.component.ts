import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { LanguageService } from '../../../services/language.service';
import { songSlug } from '../../../utils/slug';
import { CloudflareImagePipe } from '../../../pipes/cloudflare-image.pipe';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';

@Component({
    selector: 'app-song-card',
    standalone: true,
    imports: [CommonModule, RouterModule, TranslatePipe, CloudflareImagePipe, ImgFallbackDirective],
    templateUrl: './song-card.component.html',
    styleUrls: ['./song-card.component.css']
})
export class SongCardComponent {
    @Input() song: any;
    @Input() layout: 'overlay' | 'card' = 'overlay';

    private readonly langService = inject(LanguageService);

    get songLink(): (string | number)[] {
        const slug = this.song?.slug || songSlug(this.song);
        return slug ? ['/song', this.song.id, slug] : ['/song', this.song.id];
    }

    get chordMatchText(): string {
        const t = (k: string) => this.langService.translate(k);
        if (this.song?.knowsAllChords) {
            return t('song_card.all_known');
        }
        const missing = this.song?.missingChordCount;
        if (missing === undefined || missing === null) return '';
        return missing === 1
            ? t('song_card.missing_one')
            : `${t('song_card.missing_prefix')} ${missing} ${t('song_card.missing_suffix')}`;
    }

    get chordMatchInfoText(): string {
        const t = (k: string) => this.langService.translate(k);
        const missing = this.song?.missingChordCount;
        if (this.song?.knowsAllChords) {
            return t('song_card.info_all');
        }
        if (missing === undefined || missing === null) return '';
        return `${t('song_card.info_missing_prefix')} ${missing} ${t('song_card.info_missing_suffix')}`;
    }
}
