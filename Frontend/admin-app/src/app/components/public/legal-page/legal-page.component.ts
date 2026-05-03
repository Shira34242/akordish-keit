import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SeoService } from '../../../services/seo.service';
import { QuickAddAssistantService } from '../../../services/quick-add-assistant.service';

interface LegalPageContent {
  title: string;
  description: string;
  sections: Array<{ title: string; body: string }>;
}

const PAGES: Record<string, LegalPageContent> = {
  about: {
    title: 'אודות אקורדישקייט',
    description: 'אקורדישקייט הוא אתר למוזיקה יהודית, אקורדים, אמנים, כתבות, הופעות ואינדקס בעלי מקצוע.',
    sections: [
      {
        title: 'מה האתר עושה',
        body: 'אקורדישקייט מרכז במקום אחד אקורדים לשירים, דפי אמנים, חדשות מוזיקה, כתבות, הופעות וכלים לנגנים.'
      },
      {
        title: 'למי זה מיועד',
        body: 'האתר מיועד לנגנים, מורים, יוצרים, אמנים וחובבי מוזיקה שרוצים למצוא תוכן מוזיקלי בצורה ברורה ונוחה.'
      },
      {
        title: 'אמינות ותוכן',
        body: 'אנחנו שואפים להציג מידע מסודר, שימושי ומכבד, עם שמירה על זכויות יוצרים ויכולת לדווח על תוכן שדורש בדיקה.'
      }
    ]
  },
  contact: {
    title: 'צור קשר',
    description: 'יצירת קשר עם מערכת אקורדישקייט לנושאי תוכן, פרסום, זכויות יוצרים ושיתופי פעולה.',
    sections: [
      {
        title: 'פנייה למערכת',
        body: 'ניתן לפנות אלינו בנושאי תוכן, תיקונים, פרסום, שיתופי פעולה או זכויות יוצרים דרך אפשרות "צרו קשר" בתחתית האתר.'
      },
      {
        title: 'דיווח על תוכן',
        body: 'אם מצאתם טעות, תוכן לא תקין או עניין הקשור לזכויות יוצרים, אפשר לשלוח דיווח דרך כפתור הדיווח באתר.'
      },
      {
        title: 'פרסום ושיתופי פעולה',
        body: 'מפרסמים ובעלי מקצוע מוזמנים לפנות דרך האתר כדי לבדוק אפשרויות פרסום ושיתוף פעולה.'
      }
    ]
  },
  privacy: {
    title: 'מדיניות פרטיות',
    description: 'מדיניות פרטיות כללית לאתר אקורדישקייט והסבר פשוט על שימוש במידע.',
    sections: [
      {
        title: 'איזה מידע נאסף',
        body: 'בעת שימוש באתר עשוי להישמר מידע שנמסר בהרשמה, בפרופיל, בטפסים, בדיווחים ובפעולות שימוש בסיסיות באתר.'
      },
      {
        title: 'למה המידע משמש',
        body: 'המידע משמש להפעלת החשבון, שמירת רשימות, הצגת תוכן מתאים, טיפול בפניות, אבטחה ושיפור השירות.'
      },
      {
        title: 'שמירה ואבטחה',
        body: 'האתר משתמש באמצעי אבטחה מקובלים, כולל התחברות מאובטחת, כדי לצמצם גישה לא מורשית למידע אישי.'
      },
      {
        title: 'פנייה בנושא פרטיות',
        body: 'לבקשות בנושא פרטיות, עדכון מידע או מחיקה, ניתן לפנות למערכת דרך עמוד צור קשר.'
      }
    ]
  },
  terms: {
    title: 'תנאי שימוש',
    description: 'תנאי שימוש כלליים באתר אקורדישקייט.',
    sections: [
      {
        title: 'שימוש באתר',
        body: 'השימוש באתר נועד לצפייה בתוכן מוזיקלי, לימוד, נגינה, יצירת פרופילים ושימוש בכלים הקיימים באתר.'
      },
      {
        title: 'תוכן משתמשים',
        body: 'משתמשים שמעלים תוכן אחראים לוודא שהתוכן נכון, מכבד ואינו פוגע בזכויות של אחרים.'
      },
      {
        title: 'שינויים וזמינות',
        body: 'האתר עשוי להשתנות מעת לעת. ייתכנו תקלות, עבודות תחזוקה או שינויים בתכנים ובשירותים.'
      },
      {
        title: 'שימוש הוגן',
        body: 'אין להשתמש באתר לפגיעה במערכת, העתקה לא מורשית, ספאם, התחזות או העלאת תוכן פוגעני.'
      }
    ]
  },
  copyright: {
    title: 'זכויות יוצרים',
    description: 'הסבר על זכויות יוצרים, רישוי ודיווח על תוכן באתר אקורדישקייט.',
    sections: [
      {
        title: 'כיבוד זכויות',
        body: 'אקורדישקייט מכבד זכויות יוצרים ופועל להסדרת תוכן בהתאם לרישוי ולדיווחים שמתקבלים במערכת.'
      },
      {
        title: 'רישוי',
        body: 'האתר מציג בפוטר מידע על פעילות ברישיון אקו"ם ועל מחויבות לכיבוד זכויות יוצרים.'
      },
      {
        title: 'דיווח',
        body: 'אם לדעתכם תוכן מסוים פוגע בזכויותיכם, ניתן לדווח דרך אפשרות יצירת הקשר או הדיווח באתר, והפנייה תיבדק.'
      }
    ]
  }
};

@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './legal-page.component.html',
  styleUrls: ['./legal-page.component.css']
})
export class LegalPageComponent implements OnInit {
  page: LegalPageContent = PAGES['about'];
  key = 'about';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly seo: SeoService,
    private readonly quickAddAssistant: QuickAddAssistantService
  ) {}

  ngOnInit(): void {
    this.key = this.route.snapshot.data['page'] || 'about';
    this.page = PAGES[this.key] || PAGES['about'];
    const path = this.key === 'about' ? '/about' : `/${this.key}`;

    this.seo.set({
      title: this.page.title,
      description: this.page.description,
      path,
      structuredData: [
        this.seo.organizationSchema(),
        this.seo.breadcrumbSchema([
          { name: 'בית', path: '/' },
          { name: this.page.title, path }
        ])
      ]
    });
  }

  get isContactPage(): boolean {
    return this.key === 'contact';
  }

  openContactForm(): void {
    this.quickAddAssistant.requestOpen('contact');
  }
}
