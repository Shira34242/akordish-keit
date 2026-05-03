import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { LanguageService } from '../../../services/language.service';

@Component({
    selector: 'app-song-card',
    standalone: true,
    imports: [CommonModule, RouterModule, TranslatePipe],
    templateUrl: './song-card.component.html',
    styleUrls: ['./song-card.component.css']
})
export class SongCardComponent {
    @Input() song: any;
    @Input() layout: 'overlay' | 'card' = 'overlay';

    private readonly langService = inject(LanguageService);

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
