import { Routes } from '@angular/router';
import { HomePageComponent } from './components/home-page/home-page.component';
import { SongPageComponent } from './components/song-page/song-page.component';
import { ChordsPageComponent } from './components/chords-page/chords-page.component';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./components/layout/layout.component').then(m => m.LayoutComponent),
        children: [
            {
                path: '',
                component: HomePageComponent,
                title: 'אקורדישקייט - המאגר הגדול לאקורדים'
            },
            {
                path: 'song/:id',
                component: SongPageComponent,
                title: 'אקורדישקייט'
            },
            {
                path: 'chords',
                component: ChordsPageComponent,
                title: 'מאגר האקורדים - אקורדישקייט'
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
                path: 'news/:slug',
                loadComponent: () => import('./components/news/article-view/article-view.component').then(m => m.ArticleViewComponent),
                title: 'אקורדישקייט - חדשות המוזיקה'
            },
            {
                path: 'blog/:slug',
                loadComponent: () => import('./components/news/blog-post-view/blog-post-view.component').then(m => m.BlogPostViewComponent),
                title: 'אקורדישקייט - תוכן'
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
                path: 'my-playlists',
                loadComponent: () => import('./components/playlists-page/playlists-page.component').then(m => m.PlaylistsPageComponent),
                title: 'הרשימות שלי - אקורדישקייט'
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
                title: 'אומנים - אקורדישקייט'
            },
            // ===== יצירת פרופילים מקצועיים =====
            // חשוב! הנתיבים עם /create חייבים להיות לפני הנתיבים עם /:id
            {
                path: 'artist/create',
                loadComponent: () => import('./components/artist-create/artist-create.component').then(m => m.ArtistCreateComponent),
                canActivate: [authGuard],
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
                path: 'artist/:id',
                loadComponent: () => import('./components/artist-detail/artist-detail.component').then(m => m.ArtistDetailComponent),
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
                path: 'submit/article',
                loadComponent: () => import('./components/public/submit-article/submit-article.component').then(m => m.SubmitArticleComponent),
                canActivate: [authGuard],
                title: 'הגשת כתבה - אקורדישקייט'
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
            { path: '', redirectTo: 'users', pathMatch: 'full' },
            {
                path: 'users',
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
                path: 'content/articles',
                loadComponent: () => import('./components/admin/content/articles/articles-list.component').then(m => m.ArticlesListComponent),
                title: 'ניהול תוכן - כתבות - אקורדישקייט'
            },
            {
                path: 'content/articles/new',
                loadComponent: () => import('./components/admin/content/articles/article-form.component').then(m => m.ArticleFormComponent),
                title: 'כתבה חדשה - אקורדישקייט'
            },
            {
                path: 'content/articles/edit/:id',
                loadComponent: () => import('./components/admin/content/articles/article-form.component').then(m => m.ArticleFormComponent),
                title: 'עריכת כתבה - אקורדישקייט'
            },
            {
                path: 'content/songs',
                loadComponent: () => import('./components/admin/content/songs/songs-list.component').then(m => m.SongsListComponent),
                title: 'ניהול שירים - אקורדישקייט'
            },
            {
                path: 'content/events',
                loadComponent: () => import('./components/admin/content/events/events-list.component').then(m => m.EventsListComponent),
                title: 'ניהול הופעות - אקורדישקייט'
            },
            {
                path: 'content/events/new',
                loadComponent: () => import('./components/admin/content/events/event-form.component').then(m => m.EventFormComponent),
                title: 'הופעה חדשה - אקורדישקייט'
            },
            {
                path: 'content/events/edit/:id',
                loadComponent: () => import('./components/admin/content/events/event-form.component').then(m => m.EventFormComponent),
                title: 'עריכת הופעה - אקורדישקייט'
            },
            {
                path: 'content/featured',
                loadComponent: () => import('./components/admin/content/featured-content/featured-content-management.component').then(m => m.FeaturedContentManagementComponent),
                title: 'ניהול תוכן מרכזי - אקורדישקייט'
            },
            {
                path: 'content/news-sections',
                loadComponent: () => import('./components/admin/content/news-page-sections/news-page-sections-management.component').then(m => m.NewsPageSectionsMangementComponent),
                title: 'ניהול פסי חדשות - אקורדישקייט'
            },
            {
                path: 'content/stats',
                loadComponent: () => import('./components/admin/content/content-stats/content-stats.component').then(m => m.ContentStatsComponent),
                title: 'סטטיסטיקות תוכן - אקורדישקייט'
            },
            {
                path: 'reports',
                loadComponent: () => import('./components/admin/reports/reports-list.component').then(m => m.ReportsListComponent),
                title: 'ניהול דיווחים - אקורדישקייט'
            },
            {
                path: 'system',
                loadComponent: () => import('./components/admin/system/system-layout/system-layout.component').then(m => m.SystemLayoutComponent),
                children: [
                    { path: '', redirectTo: 'tables', pathMatch: 'full' },
                    {
                        path: 'tables',
                        loadComponent: () => import('./components/admin/system/value-tables/value-tables.component').then(m => m.ValueTablesComponent),
                        title: 'טבלאות מערכת - אקורדישקייט'
                    },
                    {
                        path: 'settings',
                        // Placeholder, using same component or simple message for now
                        loadComponent: () => import('./components/admin/system/value-tables/value-tables.component').then(m => m.ValueTablesComponent),
                        title: 'הגדרות מערכת - אקורדישקייט'
                    }
                ]
            }
        ]
    },
    {
        path: '**',
        redirectTo: ''
    }
];
