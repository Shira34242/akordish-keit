import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MarketingCampaignService } from '../../../services/admin/marketing-campaign.service';

@Component({
  selector: 'app-marketing-redirect',
  standalone: true,
  template: `
    <main class="redirect-page" dir="rtl">
      <span class="loader" aria-hidden="true"></span>
      <h1>מעבירים אותך לדף המבוקש</h1>
      <p>זה ייקח רק רגע.</p>
    </main>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: #f7f7f7; }
    .redirect-page { display: grid; min-height: 100vh; padding: 24px; box-sizing: border-box; place-content: center; justify-items: center; color: #000; font-family: 'Open Sans', sans-serif; text-align: center; }
    .loader { width: 42px; height: 42px; border: 4px solid #ddd; border-top-color: #404040; border-radius: 50%; animation: spin .8s linear infinite; }
    h1 { margin: 20px 0 6px; font-size: 22px; }
    p { margin: 0; color: #666; font-size: 14px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class MarketingRedirectComponent implements OnInit {
  constructor(
    private readonly route: ActivatedRoute,
    private readonly campaignService: MarketingCampaignService
  ) {}

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('code')?.trim() ?? '';
    if (!code) {
      window.location.replace('/404');
      return;
    }

    this.campaignService.resolve(code).subscribe({
      next: result => window.location.replace(result.destinationPath),
      error: () => window.location.replace('/404')
    });
  }
}
