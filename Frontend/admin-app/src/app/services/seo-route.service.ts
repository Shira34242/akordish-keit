import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { SeoService } from './seo.service';

interface StaticSeo {
  title: string;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class SeoRouteService {
  private readonly staticSeo: Record<string, StaticSeo> = {
    '/': {
      title: 'אקורדישקייט',
      description: 'מאגר אקורדים, שירים, אמנים, חדשות מוזיקה, הופעות ואינדקס בעלי מקצוע במוזיקה היהודית.'
    },
    '/chords': {
      title: 'מאגר האקורדים - אקורדישקייט',
      description: 'חיפוש אקורדים לשירים במוזיקה היהודית, כולל שירים חדשים, פופולאריים וכלי עזר לנגינה.'
    },
    '/chords/dictionary': {
      title: 'מילון האקורדים - אקורדישקייט',
      description: 'מילון אקורדים לגיטרה, פסנתר ויוקלילי עם הסברים ותצוגה נוחה לנגנים.'
    },
    '/tuner': {
      title: 'כיוון גיטרה אונליין – טיונר גיטרה חינמי | אקורדישקייט',
      description: 'טיונר גיטרה ויוקלילי חינם אונליין – כיוון גיטרה לפי שמיעה ומיקרופון. טיונר גיטרה מדויק למיתרים EADGBE, כיוון יוקלילי למיתרים GCEA, כיוון גיטרה קלאסית, כיוון יוקלילי סטנדרטי. עובד ישירות מהדפדפן.'
    },
    '/music-news': {
      title: 'חדשות המוזיקה - אקורדישקייט',
      description: 'חדשות, עדכונים וכתבות על עולם המוזיקה היהודית.'
    },
    '/articles': {
      title: 'כתבות - אקורדישקייט',
      description: 'כתבות, מדריכים ותוכן מקצועי על מוזיקה, אמנים ונגינה.'
    },
    '/blog': {
      title: 'בלוג - אקורדישקייט',
      description: 'מאמרים, מדריכים ותוכן עומק לנגנים, יוצרים וחובבי מוזיקה.'
    },
    '/artists': {
      title: 'אמנים - אקורדישקייט',
      description: 'דפי אמנים עם שירים, אקורדים, כתבות, וידאו ועדכונים.'
    },
    '/events': {
      title: 'הופעות - אקורדישקייט',
      description: 'הופעות ואירועי מוזיקה קרובים, עם פרטי מיקום, תאריך וקישורים לכרטיסים.'
    },
    '/professionals': {
      title: 'אינדקס עולם המוזיקה - אקורדישקייט',
      description: 'אינדקס מורים, נגנים, אולפנים ובעלי מקצוע בתחום המוזיקה.'
    },
    '/community-playlists': {
      title: 'מאגר רשימות קהילתי - אקורדישקייט',
      description: 'רשימות שירים קהילתיות לשמירה, לימוד ונגינה.'
    },
    '/podcasts': {
      title: 'פודקאסטים - אקורדישקייט',
      description: 'פודקאסטים בנושא מוזיקה יהודית, ראיונות עם אמנים, תוכן מוזיקלי והפקות.'
    },
    '/about': {
      title: 'אודות - אקורדישקייט',
      description: 'אקורדישקייט – המאגר הגדול לאקורדים, שירים, אמנים, חדשות מוזיקה ואינדקס בעלי מקצוע במוזיקה היהודית.'
    },
    '/contact': {
      title: 'צור קשר - אקורדישקייט',
      description: 'יצירת קשר עם צוות אקורדישקייט – שאלות, הצעות, שיתופי פעולה ופרסום.'
    },
    '/privacy': {
      title: 'מדיניות פרטיות - אקורדישקייט',
      description: 'מדיניות הפרטיות של אתר אקורדישקייט.'
    },
    '/terms': {
      title: 'תנאי שימוש - אקורדישקייט',
      description: 'תנאי השימוש באתר אקורדישקייט.'
    },
    '/copyright': {
      title: 'זכויות יוצרים - אקורדישקייט',
      description: 'מדיניות זכויות יוצרים באתר אקורדישקייט.'
    },
    '/accessibility': {
      title: 'הצהרת נגישות - אקורדישקייט',
      description: 'הצהרת הנגישות של אתר אקורדישקייט.'
    }
  };

  constructor(
    private readonly router: Router,
    private readonly seo: SeoService
  ) {}

  start(): void {
    this.apply(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => this.apply(event.urlAfterRedirects));
  }

  private apply(url: string): void {
    const path = url.split('?')[0].split('#')[0] || '/';
    const staticConfig = this.staticSeo[path];
    const noIndex = this.shouldNoIndex(path);

    if (staticConfig) {
      this.seo.set({ ...staticConfig, path, noIndex });
      return;
    }

    if (noIndex) {
      this.seo.set({
        title: 'אזור אישי - אקורדישקייט',
        description: 'אזור אישי באתר אקורדישקייט.',
        path,
        noIndex
      });
    }
  }

  private shouldNoIndex(path: string): boolean {
    return [
      '/admin',
      '/my-profile',
      '/my-playlists',
      '/notifications',
      '/subscription',
      '/chord-requests',
      '/artist/create',
      '/teacher/create',
      '/service-provider/create',
      '/submit'
    ].some(prefix => path === prefix || path.startsWith(`${prefix}/`));
  }
}
