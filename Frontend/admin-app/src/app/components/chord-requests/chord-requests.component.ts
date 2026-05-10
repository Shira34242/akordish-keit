import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AddSongModalComponent, InitialSongRequest } from '../add-song-modal/add-song-modal.component';
import { ChordRequest } from '../../models/report.model';
import { ReportService } from '../../services/report.service';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-chord-requests',
  standalone: true,
  imports: [CommonModule, RouterModule, AddSongModalComponent],
  templateUrl: './chord-requests.component.html',
  styleUrls: ['./chord-requests.component.css']
})
export class ChordRequestsComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('heroBox') heroBox!: ElementRef<HTMLDivElement>;
  @ViewChild('heroContent') heroContent!: ElementRef<HTMLDivElement>;

  requests: ChordRequest[] = [];
  selectedRequest: InitialSongRequest | null = null;
  loading = false;
  accessDenied = false;
  errorMessage = '';
  totalCount = 0;
  pageNumber = 1;
  readonly pageSize = 24;
  private fullHeroHeight = 0;
  private heroLayoutDone = false;
  private rafPending = false;

  private readonly langService = inject(LanguageService);

  constructor(
    private reportService: ReportService,
    private authService: AuthService,
    private ngZone: NgZone
  ) {}

  get isAdminUser(): boolean {
    return this.authService.isAdminOrManager();
  }

  ngOnInit(): void {
    this.loadRequests();
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    });
  }

  ngAfterViewChecked(): void {
    if (!this.heroLayoutDone && this.heroContent?.nativeElement && this.heroBox?.nativeElement) {
      this.updateHeroLayout();
      this.heroLayoutDone = true;
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
  }

  loadRequests(): void {
    this.loading = true;
    this.accessDenied = false;
    this.errorMessage = '';

    this.reportService.getChordRequests(this.pageNumber, this.pageSize).subscribe({
      next: result => {
        this.requests = result.items;
        this.totalCount = result.totalCount;
        this.loading = false;
        this.heroLayoutDone = false;
      },
      error: error => {
        this.loading = false;
        this.requests = [];
        this.totalCount = 0;
        this.heroLayoutDone = false;

        if (error.status === 403) {
          this.accessDenied = true;
          return;
        }

        this.errorMessage = this.langService.translate('chord_req.error_load');
      }
    });
  }

  openAddSong(request: ChordRequest): void {
    this.selectedRequest = {
      songName: request.songName,
      artistName: request.artistName
    };
  }

  closeRequest(request: ChordRequest, event: MouseEvent): void {
    event.stopPropagation();
    this.updateRequestGroup(request, 'Close');
  }

  moveToAdminOnly(request: ChordRequest, event: MouseEvent): void {
    event.stopPropagation();
    this.updateRequestGroup(request, 'AdminOnly');
  }

  restoreToPublic(request: ChordRequest, event: MouseEvent): void {
    event.stopPropagation();
    this.updateRequestGroup(request, 'Public');
  }

  closeAddSong(): void {
    this.selectedRequest = null;
  }

  onSongAdded(): void {
    this.selectedRequest = null;
    this.loadRequests();
  }

  nextPage(): void {
    if (this.pageNumber * this.pageSize >= this.totalCount) {
      return;
    }

    this.pageNumber++;
    this.loadRequests();
  }

  previousPage(): void {
    if (this.pageNumber === 1) {
      return;
    }

    this.pageNumber--;
    this.loadRequests();
  }

  formatDate(value: Date | string): string {
    return new Intl.DateTimeFormat('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(value));
  }

  private updateRequestGroup(request: ChordRequest, action: 'Close' | 'AdminOnly' | 'Public'): void {
    this.reportService.updateChordRequestGroup({
      reportIds: request.reportIds,
      action
    }).subscribe({
      next: () => this.loadRequests(),
      error: () => {
        this.errorMessage = this.langService.translate('chord_req.error_update');
      }
    });
  }

  private onScroll = () => {
    if (!this.rafPending) {
      this.rafPending = true;
      requestAnimationFrame(() => {
        this.shrinkHero();
        this.rafPending = false;
      });
    }
  };

  private updateHeroLayout(): void {
    const box = this.heroBox?.nativeElement;
    const content = this.heroContent?.nativeElement;
    if (!box || !content) {
      return;
    }

    const contentRect = content.getBoundingClientRect();
    const boxTop = 8;
    const height = Math.round(contentRect.bottom - boxTop + window.scrollY);
    this.fullHeroHeight = height;
    box.style.height = `${height}px`;
    this.shrinkHero();
  }

  private shrinkHero(): void {
    const box = this.heroBox?.nativeElement;
    if (!box || this.fullHeroHeight === 0) {
      return;
    }

    const minHeight = window.innerWidth <= 600 ? 44 : 56;
    const nextHeight = Math.max(minHeight, this.fullHeroHeight - window.scrollY);
    box.style.height = `${nextHeight}px`;

    const content = this.heroContent?.nativeElement;
    if (content) {
      const fade = Math.min(1, window.scrollY / 140);
      content.style.opacity = String(1 - fade);
    }
  }
}
