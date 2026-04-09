import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../services/auth.service';
import { LikedContentService } from '../../services/liked-content.service';
import { LikedContent } from '../../models/liked-content.model';
import { SongService } from '../../services/song.service';
import { SongBasicDto } from '../../models/song.model';
import { EventService } from '../../services/event.service';
import { ArticleService } from '../../services/article.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-my-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './my-profile.component.html',
  styleUrls: ['./my-profile.component.css']
})
export class MyProfileComponent implements OnInit {
  user: User | null = null;

  mySongs: SongBasicDto[] = [];
  myArticles: any[] = [];
  myEvents: any[] = [];
  likedSongs: any[] = [];

  // מודל השלמת פרטים
  showProfileModal = false;
  profileForm = { phone: '', address: '', birthDate: '' };
  profileSaving = false;

  readonly CIRCUMFERENCE = 2 * Math.PI * 52;

  constructor(
    private authService: AuthService,
    private likedContentService: LikedContentService,
    private songService: SongService,
    private eventService: EventService,
    private articleService: ArticleService,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.user = this.authService.currentUserValue;
    this.loadMySongs();
    this.loadMyArticles();
    this.loadMyEvents();
    this.loadLikedSongs();
    this.loadMyProfileDetails();
  }

  get profileIncomplete(): boolean {
    return !this.user?.phone || !this.user?.address || !this.user?.birthDate;
  }

  openProfileModal() {
    this.profileForm = {
      phone: this.user?.phone || '',
      address: this.user?.address || '',
      birthDate: this.user?.birthDate ? this.user.birthDate.substring(0, 10) : ''
    };
    this.showProfileModal = true;
  }

  closeProfileModal() {
    this.showProfileModal = false;
  }

  saveProfile() {
    this.profileSaving = true;
    this.userService.updateMyProfile({
      phone: this.profileForm.phone || undefined,
      address: this.profileForm.address || undefined,
      birthDate: this.profileForm.birthDate || undefined
    }).subscribe({
      next: () => {
        if (this.user) {
          this.user = { ...this.user, phone: this.profileForm.phone, address: this.profileForm.address, birthDate: this.profileForm.birthDate };
          this.authService.updateCurrentUser(this.user);
        }
        this.profileSaving = false;
        this.closeProfileModal();
      },
      error: () => { this.profileSaving = false; }
    });
  }

  private loadMyProfileDetails() {
    this.userService.getMyProfile().subscribe({
      next: (data) => {
        if (this.user) {
          this.user = { ...this.user, phone: data.phone, address: data.address, birthDate: data.birthDate };
        }
      },
      error: () => {}
    });
  }

  private loadMySongs() {
    this.songService.getMySongs().subscribe({
      next: (songs) => { this.mySongs = songs; },
      error: () => { this.mySongs = []; }
    });
  }

  private loadMyArticles() {
    this.articleService.getMyArticles().subscribe({
      next: (articles) => { this.myArticles = articles; },
      error: () => { this.myArticles = []; }
    });
  }

  private loadMyEvents() {
    this.eventService.getMyEvents().subscribe({
      next: (events) => {
        this.myEvents = events.map(e => {
          const date = new Date(e.eventDate);
          const months = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
          return {
            id: e.id,
            day: date.getDate(),
            month: months[date.getMonth()],
            title: e.name,
            venue: e.location || e.artistName || ''
          };
        });
      },
      error: () => { this.myEvents = []; }
    });
  }

  private loadLikedSongs() {
    this.likedContentService.getUserLikedContent().subscribe({
      next: (items) => {
        this.likedSongs = items.slice(0, 6);
      },
      error: () => {
        this.likedSongs = [];
      }
    });
  }

  getLevelNumber(): number {
    const level = this.user?.level ?? 1;
    if (level >= 3) return 3;
    if (level >= 2) return 2;
    return 1;
  }

  getLevelName(): string {
    const names: Record<number, string> = { 1: 'מתחיל', 2: 'תורם', 3: 'תורם מוביל' };
    return names[this.getLevelNumber()];
  }

  getDashOffset(): number {
    const progress = this.getLevelNumber() / 3;
    return this.CIRCUMFERENCE * (1 - progress);
  }

  getRelativeTime(dateStr: string | Date): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'הועלה אתמול';
    if (diffDays < 14) return `הועלה לפני ${diffDays} ימים`;
    if (diffDays < 30) return 'הועלה לפני שבועיים';
    if (diffDays < 60) return 'הועלה לפני חודש';
    return `הועלה לפני ${Math.floor(diffDays / 30)} חודשים`;
  }

  getLikedPath(item: LikedContent): string {
    if (item.contentType === 'Article') return `/news/${item.slug}`;
    return `/blog/${item.slug}`;
  }
}
