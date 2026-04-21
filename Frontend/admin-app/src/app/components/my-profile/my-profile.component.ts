import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../services/auth.service';
import { LikedContentService } from '../../services/liked-content.service';
import { LikedContent } from '../../models/liked-content.model';
import { SongService } from '../../services/song.service';
import { SongBasicDto } from '../../models/song.model';
import { EventService } from '../../services/event.service';
import { ArticleService } from '../../services/article.service';
import { UserService } from '../../services/user.service';
import { UserWithProfileDto } from '../../models/user.model';
import { ArtistCreateComponent } from '../artist-create/artist-create.component';
import { ServiceProviderCreateComponent } from '../service-provider-create/service-provider-create.component';
import { TeacherCreateComponent } from '../teacher-create/teacher-create.component';
import { SubscriptionService } from '../../services/subscription.service';
import { SubscriptionDto, SubscriptionPlan, SubscriptionStatus } from '../../models/subscription.model';

@Component({
  selector: 'app-my-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ArtistCreateComponent, ServiceProviderCreateComponent, TeacherCreateComponent],
  templateUrl: './my-profile.component.html',
  styleUrls: ['./my-profile.component.css']
})
export class MyProfileComponent implements OnInit {
  @ViewChild('avatarInput') avatarInput!: ElementRef<HTMLInputElement>;

  user: User | null = null;
  uploadingAvatar = false;
  myPageInfo: UserWithProfileDto | null = null;
  myPages: UserWithProfileDto[] = [];

  mySongs: SongBasicDto[] = [];
  myArticles: any[] = [];
  myEvents: any[] = [];
  likedSongs: any[] = [];

  // מודל השלמת פרטים
  showProfileModal = false;
  profileForm = { phone: '', address: '', birthDate: '' };
  profileSaving = false;

  // מודל עריכת דף
  showEditPageModal = false;
  editPageType: 'artist' | 'teacher' | 'provider' | null = null;

  // מנוי
  subscription: SubscriptionDto | null = null;

  // שגיאות טעינה
  pageLoadError = false;

  // מודל שינוי סוג חשבון
  showAccountTypeModal = false;
  revokeConfirmPage: UserWithProfileDto | null = null;
  revoking = false;

  readonly CIRCUMFERENCE = 2 * Math.PI * 52;

  constructor(
    private authService: AuthService,
    private likedContentService: LikedContentService,
    private songService: SongService,
    private eventService: EventService,
    private articleService: ArticleService,
    private userService: UserService,
    private subscriptionService: SubscriptionService,
    private router: Router
  ) {}

  ngOnInit() {
    this.user = this.authService.currentUserValue;
    this.loadMySongs();
    this.loadMyArticles();
    this.loadMyEvents();
    this.loadLikedSongs();
    this.loadMyProfileDetails();
    this.loadMyPageInfo();
    this.loadMyAllPages();
    this.loadSubscription();
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

  triggerAvatarUpload() {
    this.avatarInput.nativeElement.click();
  }

  onAvatarFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadingAvatar = true;
    this.userService.uploadProfileImage(file).subscribe({
      next: (url) => {
        this.userService.updateMyProfile({ profileImageUrl: url }).subscribe({
          next: () => {
            if (this.user) {
              this.user = { ...this.user, profileImageUrl: url };
              this.authService.updateCurrentUser(this.user);
            }
            this.uploadingAvatar = false;
          },
          error: () => { this.uploadingAvatar = false; }
        });
      },
      error: () => { this.uploadingAvatar = false; }
    });
    (event.target as HTMLInputElement).value = '';
  }

  private loadMyProfileDetails() {
    this.userService.getMyProfile().subscribe({
      next: (data) => {
        if (this.user) {
          this.user = { ...this.user, phone: data.phone, address: data.address, birthDate: data.birthDate, contentTag: data.contentTag ?? this.user.contentTag, uploadCount: data.uploadCount ?? this.user.uploadCount };
          this.authService.updateCurrentUser(this.user);
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

  private loadSubscription() {
    if (!this.user?.id) return;
    this.subscriptionService.getUserActiveSubscription(this.user.id).subscribe({
      next: (sub) => { this.subscription = sub; },
      error: () => { this.subscription = null; }
    });
  }

  getSubscriptionBadgeText(): string {
    if (!this.subscription || this.subscription.plan === SubscriptionPlan.Free) return 'FREE';
    return 'PRO';
  }

  getSubscriptionBadgeClass(): string {
    if (!this.subscription || this.subscription.plan === SubscriptionPlan.Free) return 'sub-badge--free';
    return 'sub-badge--pro';
  }

  getSubscriptionStatusDotClass(): string {
    if (!this.subscription) return 'status-dot--inactive';
    switch (this.subscription.status) {
      case SubscriptionStatus.Active:
      case SubscriptionStatus.Trial:
        return 'status-dot--active';
      case SubscriptionStatus.PendingPayment:
      case SubscriptionStatus.Cancelled:
        return 'status-dot--pending';
      default:
        return 'status-dot--inactive';
    }
  }

  getSubscriptionStatusText(): string {
    if (!this.subscription) return 'חינמי';
    switch (this.subscription.status) {
      case SubscriptionStatus.Active: return 'פעיל';
      case SubscriptionStatus.Trial: return 'ניסיון חינם';
      case SubscriptionStatus.PendingPayment: return 'ממתין לתשלום';
      case SubscriptionStatus.Cancelled: return 'בוטל';
      case SubscriptionStatus.Expired: return 'פג תוקף';
      case SubscriptionStatus.Suspended: return 'מושהה';
      default: return 'לא פעיל';
    }
  }

  navigateToUpgrade() {
    const types = this.myPages.map(p => {
      if (p.profileType === 'artist') return 'artist';
      if (p.isTeacher) return 'teacher';
      return 'service-provider';
    });
    if (types.length === 0) {
      this.router.navigate(['/subscription/select']);
      return;
    }
    this.router.navigate(['/subscription/select'], {
      queryParams: { types: types.join(','), primary: types[0] }
    });
  }

  canUpgradeSubscription(): boolean {
    if (!this.subscription) return true;
    return this.subscription.plan !== SubscriptionPlan.Premium;
  }

  private loadMyPageInfo() {
    this.userService.getMyUploaderProfile().subscribe({
      next: (info) => { this.myPageInfo = info; this.pageLoadError = false; },
      error: () => { this.pageLoadError = true; }
    });
  }

  private loadMyAllPages() {
    this.userService.getMyAllPages().subscribe({
      next: (pages) => { this.myPages = pages; },
      error: () => { this.myPages = []; }
    });
  }

  // ── מודאל עריכת דף ──

  openEditPageModal(page: UserWithProfileDto) {
    if (page.profileType === 'artist') {
      this.editPageType = 'artist';
    } else if (page.isTeacher) {
      this.editPageType = 'teacher';
    } else {
      this.editPageType = 'provider';
    }
    this.showEditPageModal = true;
  }

  closeEditPageModal() {
    this.showEditPageModal = false;
    this.editPageType = null;
    this.loadMyAllPages();
  }

  // ── מודאל שינוי סוג חשבון ──

  openAccountTypeModal() {
    this.revokeConfirmPage = null;
    this.showAccountTypeModal = true;
  }

  closeAccountTypeModal() {
    this.showAccountTypeModal = false;
    this.revokeConfirmPage = null;
  }

  askRevokeConfirm(page: UserWithProfileDto) {
    this.revokeConfirmPage = page;
  }

  cancelRevoke() {
    this.revokeConfirmPage = null;
  }

  confirmRevoke() {
    if (!this.revokeConfirmPage || this.revoking) return;
    this.revoking = true;
    const page = this.revokeConfirmPage;
    this.userService.revokePage(page.profileType, page.profileId).subscribe({
      next: (ok) => {
        this.revoking = false;
        if (ok) {
          this.myPages = this.myPages.filter(p => !(p.profileType === page.profileType && p.profileId === page.profileId));
          if (this.myPageInfo?.profileType === page.profileType && this.myPageInfo?.profileId === page.profileId) {
            this.myPageInfo = this.myPages[0] ?? null;
          }
          this.revokeConfirmPage = null;
          if (this.myPages.length === 0) this.closeAccountTypeModal();
        }
      },
      error: () => { this.revoking = false; }
    });
  }

  getPageLabel(page: UserWithProfileDto): string {
    if (page.profileType === 'artist') return 'אמן';
    if (page.isTeacher) return 'מורה למוזיקה';
    if (page.categories?.length > 0) return page.categories[0];
    return 'בעל מקצוע';
  }

  getPageStatusClass(page?: UserWithProfileDto): string {
    const s = (page ?? this.myPageInfo)?.status;
    if (s === 'Active') return 'status-dot--active';
    if (s === 'Pending') return 'status-dot--pending';
    return 'status-dot--inactive';
  }

  getAddPageUrl(type: 'artist' | 'teacher' | 'provider'): string {
    if (type === 'artist') return '/artist/create';
    if (type === 'teacher') return '/teacher/create';
    return '/service-provider/create';
  }

  getPageTypeName(): string {
    return this.myPageInfo ? this.getPageLabel(this.myPageInfo) : 'משתמש רגיל';
  }

  getEditPageUrl(page?: UserWithProfileDto): string {
    const p = page ?? this.myPageInfo;
    if (!p) return '/service-provider/create';
    if (p.profileType === 'artist') return '/artist/create';
    if (p.isTeacher) return '/teacher/create';
    return '/service-provider/create';
  }

  getViewPageUrl(page?: UserWithProfileDto): string {
    return (page ?? this.myPageInfo)?.profileUrl || '/professionals';
  }

  getLevelNumber(): number {
    const tag = this.user?.contentTag ?? 0;
    if (tag >= 3) return 3;
    if (tag >= 2) return 2;
    if (tag >= 1) return 1;
    return 0;
  }

  getLevelName(): string {
    const names: Record<number, string> = { 0: 'משתמש רשום', 1: 'מתחיל', 2: 'תורם', 3: 'תורם מוביל' };
    return names[this.getLevelNumber()];
  }

  getDashOffset(): number {
    const tag = this.user?.contentTag ?? 0;
    // tag 0 = 0%, 1 = 25%, 2 = 50%, 3 = 75%
    const progress = tag / 4;
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
