import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';
import { pendingArtistDraftGuard } from './guards/pending-artist-draft.guard';
import { pendingArticleDraftGuard } from './guards/pending-article-draft.guard';

export const routes: Routes = [
    {
        path: 'unsubscribe',
        loadComponent: () => import('./components/public/unsubscribe/unsubscribe.component').then(m => m.UnsubscribeComponent),
        title: 'הסרה מרשימת התפוצה - אקורדישקייט'
    },
    {
        path: 'join-index/agency/:slug',
        loadComponent: () => import('./components/public/join-index/join-index.component').then(m => m.JoinIndexComponent),
        title: 'הצטרפות לאינדקס'
    },
    {
        path: 'join-index',
        loadComponent: () => import('./components/public/join-index/join-index.component').then(m => m.JoinIndexComponent),
        title: 'הצטרפות לאינדקס - אקורדישקייט'
    },
    {
        path: 'join-chords',
        loadComponent: () => import('./components/public/join-chords/join-chords.component').then(m => m.JoinChordsComponent),
        title: 'שליחת אקורדים - אקורדישקייט'
    },
    {
        path: '',
        loadComponent: () => import('./components/layout/layout.component').then(m => m.LayoutComponent),
        children: [
            {
                path: '',
                loadComponent: () => import('./components/home-page/home-page.component').then(m => m.HomePageComponent),
                title: 'אקורדישקייט'
            },
            {
                path: 'song/:id/:slug',
                loadComponent: () => import('./components/song-page/song-page.component').then(m => m.SongPageComponent),
                title: 'אקורדישקייט'
            },
            {
                path: 'song/:id',
                loadComponent: () => import('./components/song-page/song-page.component').then(m => m.SongPageComponent),
                title: 'אקורדישקייט'
            },
            {
                path: 'chords',
                loadComponent: () => import('./components/chords-page/chords-page.component').then(m => m.ChordsPageComponent),
                title: 'מאגר האקורדים - אקורדישקייט'
            },
            {
                path: 'chords/dictionary',
                loadComponent: () => import('./components/chord-dictionary/chord-dictionary.component').then(m => m.ChordDictionaryComponent),
                title: 'מילון האקורדים - אקורדישקייט'
            },
            {
                path: 'tuner',
                loadComponent: () => import('./components/tuner/tuner.component').then(m => m.TunerComponent),
                title: 'כיוון גיטרה אונליין – טיונר גיטרה חינמי | אקורדישקייט'
            },
            {
                path: 'music-news',
                loadComponent: () => import('./components/public/music-news/music-news.component').then(m => m.MusicNewsComponent),
                title: 'חדשות המוזיקה - אקורדישקייט'
            },
            {
                path: 'articles',
                loadComponent: () => import('./components/public/articles-list/articles-list.component').then(m => m.ArticlesListComponent),
                title: 'כתבות - אקורדישקייט'
            },
            {
                path: 'news/id/:id',
                loadComponent: () => import('./components/news/article-view/article-view.component').then(m => m.ArticleViewComponent),
                title: 'אקורדישקייט - חדשות המוזיקה'
            },
            {
                path: 'news/:id/:slug',
                loadComponent: () => import('./components/news/article-view/article-view.component').then(m => m.ArticleViewComponent),
                title: 'אקורדישקייט - חדשות המוזיקה'
            },
            {
                path: 'news/:slug',
                loadComponent: () => import('./components/news/article-view/article-view.component').then(m => m.ArticleViewComponent),
                title: 'אקורדישקייט - חדשות המוזיקה'
            },
            {
                path: 'blog',
                loadComponent: () => import('./components/public/blog-list/blog-list.component').then(m => m.BlogListComponent),
                title: 'בלוג - אקורדישקייט'
            },
            {
                path: 'blog/id/:id',
                loadComponent: () => import('./components/news/blog-post-view/blog-post-view.component').then(m => m.BlogPostViewComponent),
                title: 'אקורדישקייט - כתבות'
            },
            {
                path: 'blog/:id/:slug',
                loadComponent: () => import('./components/news/blog-post-view/blog-post-view.component').then(m => m.BlogPostViewComponent),
                title: 'אקורדישקייט - כתבות'
            },
            {
                path: 'blog/:slug',
                loadComponent: () => import('./components/news/blog-post-view/blog-post-view.component').then(m => m.BlogPostViewComponent),
                title: 'אקורדישקייט - כתבות'
            },
            {
                path: 'teachers',
                redirectTo: 'professionals',
                pathMatch: 'full'
            },
            {
                path: 'professionals',
                loadComponent: () => import('./components/public/music-service-provider-page/professionals-page.component').then(m => m.ProfessionalsPageComponent),
                title: 'בעלי מקצוע - מוזיקה חרדית - אקורדישקייט'
            },
            {
                path: 'agency/:slug',
                loadComponent: () => import('./components/public/agency-page/agency-page.component').then(m => m.AgencyPageComponent),
                title: 'סוכנות מוזיקה - אקורדישקייט'
            },
            {
                path: 'my-playlists',
                loadComponent: () => import('./components/playlists-page/playlists-page.component').then(m => m.PlaylistsPageComponent),
                canActivate: [authGuard],
                title: 'הרשימות שלי - אקורדישקייט'
            },
            {
                path: 'chord-requests',
                loadComponent: () => import('./components/chord-requests/chord-requests.component').then(m => m.ChordRequestsComponent),
                canActivate: [authGuard],
                title: 'בקשות לאקורדים - אקורדישקייט'
            },
            {
                path: 'community-playlists',
                loadComponent: () => import('./components/community-playlists/community-playlists').then(m => m.CommunityPlaylistsComponent),
                title: 'מאגר רשימות קהילתי - אקורדישקייט'
            },
            {
                path: 'playlist/:id',
                loadComponent: () => import('./components/playlist-detail/playlist-detail.component').then(m => m.PlaylistDetailComponent),
                title: 'רשימת השמעה - אקורדישקייט'
            },
            {
                path: 'artists',
                loadComponent: () => import('./components/artists-list/artists-list.component').then(m => m.ArtistsListComponent),
                canActivate: [authGuard],
                title: 'אומנים - אקורדישקייט'
            },
            // ===== יצירת פרופילים מקצועיים =====
            // חשוב! הנתיבים עם /create חייבים להיות לפני הנתיבים עם /:id
            {
                path: 'artist/create',
                loadComponent: () => import('./components/artist-create/artist-create.component').then(m => m.ArtistCreateComponent),
                canActivate: [authGuard],
                canDeactivate: [pendingArtistDraftGuard],
                title: 'צור פרופיל אומן - אקורדישקייט'
            },
            {
                path: 'teacher/create',
                loadComponent: () => import('./components/teacher-create/teacher-create.component').then(m => m.TeacherCreateComponent),
                canActivate: [authGuard],
                title: 'צור פרופיל מורה - אקורדישקייט'
            },
            {
                path: 'service-provider/create',
                loadComponent: () => import('./components/service-provider-create/service-provider-create.component').then(m => m.ServiceProviderCreateComponent),
                canActivate: [authGuard],
                title: 'צור פרופיל בעל מקצוע - אקורדישקייט'
            },
            {
                path: 'artist/:id/:slug',
                loadComponent: () => import('./components/artist-detail/artist-detail.component').then(m => m.ArtistDetailComponent),
                canActivate: [authGuard],
                title: 'אקורדישקייט'
            },
            {
                path: 'artist/:id',
                loadComponent: () => import('./components/artist-detail/artist-detail.component').then(m => m.ArtistDetailComponent),
                canActivate: [authGuard],
                title: 'אקורדישקייט'
            },
            {
                path: 'teacher/:id',
                loadComponent: () => import('./components/public/teacher-detail/teacher-detail.component').then(m => m.TeacherDetailComponent),
                title: 'מורה - אקורדישקייט'
            },
            {
                path: 'professional/:id',
                loadComponent: () => import('./components/public/music-service-provider-page/professional-profile-modal.component').then(m => m.ProfessionalProfileModalComponent),
                title: 'בעל מקצוע - אקורדישקייט'
            },
            // ===== פרופיל משתמש =====
            {
                path: 'my-profile',
                loadComponent: () => import('./components/my-profile/my-profile.component').then(m => m.MyProfileComponent),
                canActivate: [authGuard],
                title: 'הפרופיל שלי - אקורדישקייט'
            },
            {
                path: 'notifications',
                loadComponent: () => import('./components/notifications-page/notifications-page.component').then(m => m.NotificationsPageComponent),
                canActivate: [authGuard],
                title: 'התראות - אקורדישקייט'
            },
            // ===== מנויים ותשלומים =====
            {
                path: 'subscription/select',
                loadComponent: () => import('./components/subscription-selection/subscription-selection').then(m => m.SubscriptionSelectionComponent),
                canActivate: [authGuard],
                title: 'בחר תוכנית מנוי - אקורדישקייט'
            },
            {
                path: 'subscription/status',
                loadComponent: () => import('./components/subscription-status/subscription-status').then(m => m.SubscriptionStatusComponent),
                canActivate: [authGuard],
                title: 'המנוי שלי - אקורדישקייט'
            },
            {
                path: 'subscription/success',
                loadComponent: () => import('./components/subscription-success/subscription-success').then(m => m.SubscriptionSuccessComponent),
                canActivate: [authGuard],
                title: 'תשלום התקבל - אקורדישקייט'
            },
            {
                path: 'subscription/cancel',
                loadComponent: () => import('./components/subscription-cancel/subscription-cancel').then(m => m.SubscriptionCancelComponent),
                title: 'תשלום בוטל - אקורדישקייט'
            },
            {
                path: 'submit/article',
                loadComponent: () => import('./components/public/submit-article/submit-article.component').then(m => m.SubmitArticleComponent),
                canActivate: [authGuard],
                title: 'הגשת כתבה - אקורדישקייט'
            },
            {
                path: 'events',
                loadComponent: () => import('./components/public/events-page/events-page.component').then(m => m.EventsPageComponent),
                title: 'הופעות - אקורדישקייט'
            },
            {
                path: 'podcasts',
                loadComponent: () => import('./components/public/podcasts-page/podcasts-page.component').then(m => m.PodcastsPageComponent),
                title: 'פודקאסטים - אקורדישקייט'
            },
            {
                path: 'podcasts/:podcastSlug/:episodeSlug',
                loadComponent: () => import('./components/public/podcast-episode-page/podcast-episode-page.component').then(m => m.PodcastEpisodePageComponent),
                title: 'פרק פודקאסט - אקורדישקייט'
            },
            {
                path: 'podcasts/:slug',
                loadComponent: () => import('./components/public/podcast-detail-page/podcast-detail-page.component').then(m => m.PodcastDetailPageComponent),
                title: 'פודקאסטים - אקורדישקייט'
            },
            {
                path: 'about',
                loadComponent: () => import('./components/public/legal-page/legal-page.component').then(m => m.LegalPageComponent),
                title: 'אודות - אקורדישקייט',
                data: { page: 'about' }
            },
            {
                path: 'contact',
                loadComponent: () => import('./components/public/legal-page/legal-page.component').then(m => m.LegalPageComponent),
                title: 'צור קשר - אקורדישקייט',
                data: { page: 'contact' }
            },
            {
                path: 'privacy',
                loadComponent: () => import('./components/public/legal-page/legal-page.component').then(m => m.LegalPageComponent),
                title: 'מדיניות פרטיות - אקורדישקייט',
                data: { page: 'privacy' }
            },
            {
                path: 'delete-account',
                loadComponent: () => import('./components/public/legal-page/legal-page.component').then(m => m.LegalPageComponent),
                title: 'מחיקת חשבון - אקורדישקייט',
                data: { page: 'delete-account' }
            },
            {
                path: 'terms',
                loadComponent: () => import('./components/public/legal-page/legal-page.component').then(m => m.LegalPageComponent),
                title: 'תנאי שימוש - אקורדישקייט',
                data: { page: 'terms' }
            },
            {
                path: 'copyright',
                loadComponent: () => import('./components/public/legal-page/legal-page.component').then(m => m.LegalPageComponent),
                title: 'זכויות יוצרים - אקורדישקייט',
                data: { page: 'copyright' }
            },
            {
                path: 'accessibility',
                loadComponent: () => import('./components/public/legal-page/legal-page.component').then(m => m.LegalPageComponent),
                title: 'הצהרת נגישות - אקורדישקייט',
                data: { page: 'accessibility' }
            },
            {
                path: 'submit/event',
                loadComponent: () => import('./components/public/submit-event/submit-event.component').then(m => m.SubmitEventComponent),
                canActivate: [authGuard],
                title: 'הגשת הופעה - אקורדישקייט'
            }
        ]
    },
    {
        path: 'admin',
        loadComponent: () => import('./components/admin/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
        canActivate: [adminGuard], // 🔒 הגנה! רק Admin יכול להגיע לכאן
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            {
                path: 'dashboard',
                loadComponent: () => import('./components/admin/dashboard-placeholder/dashboard-placeholder.component').then(m => m.AdminDashboardPlaceholderComponent),
                title: 'מרכז בקרה - אקורדישקייט'
            },
            {
                path: 'users',
                loadComponent: () => import('./components/admin/users/users-layout/users-layout.component').then(m => m.AdminUsersLayoutComponent),
                children: [
                    { path: '', redirectTo: 'clients', pathMatch: 'full' },
                    {
                        path: 'clients',
                        loadComponent: () => import('./components/admin/users/users-list.component').then(m => m.UsersListComponent),
                        title: 'ניהול לקוחות - אקורדישקייט'
                    },
                    {
                        path: 'teachers',
                        loadComponent: () => import('./components/admin/teachers/teachers-list.component').then(m => m.TeachersListComponent),
                        title: 'ניהול מורים - אקורדישקייט'
                    },
                    {
                        path: 'teachers/new',
                        loadComponent: () => import('./components/admin/teachers/teacher-form.component').then(m => m.TeacherFormComponent),
                        title: 'מורה חדש - אקורדישקייט'
                    },
                    {
                        path: 'teachers/edit/:id',
                        loadComponent: () => import('./components/admin/teachers/teacher-form.component').then(m => m.TeacherFormComponent),
                        title: 'עריכת מורה - אקורדישקייט'
                    },
                    {
                        path: 'service-providers',
                        loadComponent: () => import('./components/admin/service-providers/service-providers-list.component').then(m => m.ServiceProvidersListComponent),
                        title: 'ניהול בעלי מקצוע - אקורדישקייט'
                    },
                    {
                        path: 'service-providers/new',
                        loadComponent: () => import('./components/admin/service-providers/service-provider-form.component').then(m => m.ServiceProviderFormComponent),
                        title: 'בעל מקצוע חדש - אקורדישקייט'
                    },
                    {
                        path: 'service-providers/edit/:id',
                        loadComponent: () => import('./components/admin/service-providers/service-provider-form.component').then(m => m.ServiceProviderFormComponent),
                        title: 'עריכת בעל מקצוע - אקורדישקייט'
                    },
                    {
                        path: 'artists',
                        loadComponent: () => import('./components/admin/artists/artists-admin-list.component').then(m => m.ArtistsAdminListComponent),
                        title: 'ניהול אומנים - אקורדישקייט'
                    },
                    {
                        path: 'agencies',
                        loadComponent: () => import('./components/admin/agencies/agencies-list.component').then(m => m.AgenciesListComponent),
                        title: 'ניהול סוכנויות - אקורדישקייט'
                    },
                    {
                        path: 'agencies/new',
                        loadComponent: () => import('./components/admin/agencies/agency-form.component').then(m => m.AgencyFormComponent),
                        title: 'סוכנות חדשה - אקורדישקייט'
                    },
                    {
                        path: 'agencies/edit/:id',
                        loadComponent: () => import('./components/admin/agencies/agency-form.component').then(m => m.AgencyFormComponent),
                        title: 'עריכת סוכנות - אקורדישקייט'
                    }
                ]
            },
            {
                path: 'content',
                loadComponent: () => import('./components/admin/content/content-layout/content-layout.component').then(m => m.AdminContentLayoutComponent),
                children: [
                    { path: '', redirectTo: 'songs', pathMatch: 'full' },
                    {
                        path: 'smart-add',
                        redirectTo: '/admin/system/smart-add',
                        pathMatch: 'full'
                    },
                    {
                        path: 'songs',
                        loadComponent: () => import('./components/admin/content/songs/songs-list.component').then(m => m.SongsListComponent),
                        title: 'ניהול שירים - אקורדישקייט'
                    },
                    {
                        path: 'articles',
                        loadComponent: () => import('./components/admin/content/articles/articles-list.component').then(m => m.ArticlesListComponent),
                        title: 'ניהול תוכן - כתבות - אקורדישקייט'
                    },
                    {
                        path: 'articles/new',
                        loadComponent: () => import('./components/admin/content/articles/article-form.component').then(m => m.ArticleFormComponent),
                        canDeactivate: [pendingArticleDraftGuard],
                        title: 'כתבה חדשה - אקורדישקייט'
                    },
                    {
                        path: 'articles/edit/:id',
                        loadComponent: () => import('./components/admin/content/articles/article-form.component').then(m => m.ArticleFormComponent),
                        canDeactivate: [pendingArticleDraftGuard],
                        title: 'עריכת כתבה - אקורדישקייט'
                    },
                    {
                        path: 'social-design',
                        loadComponent: () => import('./components/admin/content/social-share-designer/social-share-designer.component').then(m => m.SocialShareDesignerComponent),
                        title: 'עיצוב תמונה לרשתות - אקורדישקייט'
                    },
                    {
                        path: 'featured',
                        loadComponent: () => import('./components/admin/content/featured-content/featured-content-management.component').then(m => m.FeaturedContentManagementComponent),
                        title: 'ניהול תוכן מרכזי - אקורדישקייט'
                    },
                    {
                        path: 'news-sections',
                        redirectTo: '/admin/system/news-sections',
                        pathMatch: 'full'
                    },
                    {
                        path: 'events',
                        loadComponent: () => import('./components/admin/content/events/events-list.component').then(m => m.EventsListComponent),
                        title: 'ניהול הופעות - אקורדישקייט'
                    },
                    {
                        path: 'podcasts',
                        loadComponent: () => import('./components/admin/content/podcasts/podcasts-list.component').then(m => m.PodcastsListComponent),
                        title: 'ניהול פודקאסטים - אקורדישקייט'
                    },
                    {
                        path: 'podcasts/new',
                        loadComponent: () => import('./components/admin/content/podcasts/podcast-form.component').then(m => m.PodcastFormComponent),
                        title: 'פודקאסט חדש - אקורדישקייט'
                    },
                    {
                        path: 'podcasts/edit/:id',
                        loadComponent: () => import('./components/admin/content/podcasts/podcast-form.component').then(m => m.PodcastFormComponent),
                        title: 'עריכת פודקאסט - אקורדישקייט'
                    },
                    {
                        path: 'podcasts/episodes/new',
                        loadComponent: () => import('./components/admin/content/podcasts/podcast-episode-form.component').then(m => m.PodcastEpisodeFormComponent),
                        title: 'פרק פודקאסט חדש - אקורדישקייט'
                    },
                    {
                        path: 'podcasts/episodes/edit/:id',
                        loadComponent: () => import('./components/admin/content/podcasts/podcast-episode-form.component').then(m => m.PodcastEpisodeFormComponent),
                        title: 'עריכת פרק פודקאסט - אקורדישקייט'
                    },
                    {
                        path: 'events/new',
                        loadComponent: () => import('./components/admin/content/events/event-form.component').then(m => m.EventFormComponent),
                        title: 'הופעה חדשה - אקורדישקייט'
                    },
                    {
                        path: 'events/edit/:id',
                        loadComponent: () => import('./components/admin/content/events/event-form.component').then(m => m.EventFormComponent),
                        title: 'עריכת הופעה - אקורדישקייט'
                    },
                    {
                        path: 'stats',
                        loadComponent: () => import('./components/admin/content/content-stats/content-stats.component').then(m => m.ContentStatsComponent),
                        title: 'סטטיסטיקות תוכן - אקורדישקייט'
                    }
                ]
            },
            {
                path: 'notifications',
                loadComponent: () => import('./components/admin/notifications/notifications-layout/notifications-layout.component').then(m => m.AdminNotificationsLayoutComponent),
                children: [
                    { path: '', redirectTo: 'messages', pathMatch: 'full' },
                    {
                        path: 'messages',
                        loadComponent: () => import('./components/admin/notifications/admin-notifications.component').then(m => m.AdminNotificationsComponent),
                        title: 'התראות - ניהול'
                    },
                    {
                        path: 'reports',
                        loadComponent: () => import('./components/admin/reports/reports-list.component').then(m => m.ReportsListComponent),
                        title: 'אנליטיקס התראות - אקורדישקייט'
                    },
                    {
                        path: 'email',
                        redirectTo: 'email-v2',
                        pathMatch: 'full'
                    },
                    {
                        path: 'email-v2',
                        loadComponent: () => import('./components/admin/email-campaign-v2/email-campaign-v2.component').then(m => m.EmailCampaignV2Component),
                        children: [
                            {
                                path: '',
                                loadComponent: () => import('./components/admin/email-campaign-v2/v2-drafts-list.component').then(m => m.V2DraftsListComponent),
                                title: 'השליחה המשודרגת - אקורדישקייט'
                            },
                            {
                                path: 'new',
                                loadComponent: () => import('./components/admin/email-campaign-v2/v2-design-step.component').then(m => m.V2DesignStepComponent),
                                canDeactivate: [() => import('./guards/unsaved-design-changes.guard').then(m => m.unsavedDesignChangesGuard)],
                                title: 'עיצוב המייל - אקורדישקייט'
                            },
                            {
                                path: ':id/edit',
                                loadComponent: () => import('./components/admin/email-campaign-v2/v2-design-step.component').then(m => m.V2DesignStepComponent),
                                canDeactivate: [() => import('./guards/unsaved-design-changes.guard').then(m => m.unsavedDesignChangesGuard)],
                                title: 'עיצוב המייל - אקורדישקייט'
                            },
                            {
                                path: ':id/send',
                                loadComponent: () => import('./components/admin/email-campaign-v2/v2-send-step.component').then(m => m.V2SendStepComponent),
                                title: 'הגדרות ושליחה - אקורדישקייט'
                            },
                            {
                                path: 'send',
                                loadComponent: () => import('./components/admin/email-campaign-v2/v2-send-step.component').then(m => m.V2SendStepComponent),
                                title: 'הגדרות ושליחה זמנית - אקורדישקייט'
                            },
                            {
                                path: ':id/results',
                                loadComponent: () => import('./components/admin/email-campaign-v2/v2-results.component').then(m => m.V2ResultsComponent),
                                title: 'אנליטיקת קמפיין - אקורדישקייט'
                            },
                        ]
                    }
                ]
            },
            { path: 'email', redirectTo: 'notifications/email-v2', pathMatch: 'full' },
            { path: 'content/stats', redirectTo: '/admin/analytics', pathMatch: 'full' },
            {
                path: 'advertising',
                loadComponent: () => import('./components/admin/advertisements/campaigns/campaigns-list.component').then(m => m.CampaignsListComponent),
                title: 'ניהול פרסום - קמפיינים - אקורדישקייט'
            },
            {
                path: 'advertising/spots',
                loadComponent: () => import('./components/admin/advertisements/ad-spots/ad-spots-list.component').then(m => m.AdSpotsListComponent),
                title: 'ניהול פרסום - שדות פרסום - אקורדישקייט'
            },
            {
                path: 'advertising/clients',
                loadComponent: () => import('./components/admin/advertisements/clients/clients-list.component').then(m => m.ClientsListComponent),
                title: 'ניהול פרסום - לקוחות - אקורדישקייט'
            },
            {
                path: 'analytics',
                loadComponent: () => import('./components/admin/content/content-stats/content-stats.component').then(m => m.ContentStatsComponent),
                title: 'אנליטיקס - אקורדישקייט'
            },
            {
                path: 'system',
                loadComponent: () => import('./components/admin/system/system-layout/system-layout.component').then(m => m.SystemLayoutComponent),
                children: [
                    { path: '', redirectTo: 'tables', pathMatch: 'full' },
                    {
                        path: 'smart-add',
                        loadComponent: () => import('./components/admin/content/smart-add/smart-add.component').then(m => m.SmartAddComponent),
                        title: 'הוספה חכמה - אקורדישקייט'
                    },
                    {
                        path: 'tables',
                        loadComponent: () => import('./components/admin/system/value-tables/value-tables.component').then(m => m.ValueTablesComponent),
                        title: 'טבלאות מערכת - אקורדישקייט'
                    },
                    {
                        path: 'settings',
                        loadComponent: () => import('./components/admin/system/system-settings/system-settings.component').then(m => m.SystemSettingsComponent),
                        title: 'הגדרות מערכת - אקורדישקייט'
                    },
                    {
                        path: 'news-sections',
                        loadComponent: () => import('./components/admin/content/news-page-sections/news-page-sections-management.component').then(m => m.NewsPageSectionsMangementComponent),
                        title: 'קטגוריות דפים - אקורדישקייט'
                    },
                    {
                        path: 'news-cleanup',
                        loadComponent: () => import('./components/admin/system/news-cleanup/news-cleanup.component').then(m => m.NewsCleanupComponent),
                        title: 'ניקוי חדשות - אקורדישקייט'
                    },
                ]
            }
        ]
    },
    {
        path: '404',
        loadComponent: () => import('./components/public/not-found-page/not-found-page.component').then(m => m.NotFoundPageComponent),
        title: 'דף לא נמצא - אקורדישקייט'
    },
    {
        path: '**',
        loadComponent: () => import('./components/public/not-found-page/not-found-page.component').then(m => m.NotFoundPageComponent),
        title: 'דף לא נמצא - אקורדישקייט'
    }
];
