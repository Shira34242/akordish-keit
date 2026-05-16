import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Meta } from '@angular/platform-browser';
import { SeoService } from '../../../services/seo.service';

@Component({
    selector: 'app-not-found-page',
    standalone: true,
    imports: [CommonModule, RouterModule],
    template: `
    <div class="not-found-page">
      <div class="not-found-content">
        <h1 class="not-found-code">404</h1>
        <h2 class="not-found-title">הדף לא נמצא</h2>
        <p class="not-found-message">
          הדף שחיפשת לא קיים או הוסר מהאתר.
          <br>אפשר לחזור לדף הבית או לחפש תוכן באקורדישקייט.
        </p>
        <a class="not-found-home-link" routerLink="/">לדף הבית</a>
      </div>
    </div>
  `,
    styles: [`
    .not-found-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      padding: 2rem;
      text-align: center;
    }
    .not-found-code {
      font-size: 6rem;
      font-weight: 800;
      color: #f4b400;
      margin: 0 0 0.5rem;
      line-height: 1;
      font-family: 'Karantina', 'Open Sans', sans-serif;
    }
    .not-found-title {
      font-size: 1.5rem;
      font-weight: 700;
      margin: 0 0 1rem;
    }
    .not-found-message {
      color: #666;
      margin: 0 0 2rem;
      line-height: 1.6;
    }
    .not-found-home-link {
      display: inline-block;
      padding: 0.75rem 2rem;
      background: #f4b400;
      color: #000;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 700;
    }
  `]
})
export class NotFoundPageComponent implements OnInit {
    private readonly seo = inject(SeoService);

    ngOnInit(): void {
        this.seo.set({
            title: 'דף לא נמצא',
            description: 'הדף שחיפשת לא קיים באתר אקורדישקייט.',
            path: '/404',
            noIndex: true,
            structuredData: this.seo.organizationSchema()
        });
    }
}
