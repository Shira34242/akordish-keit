import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { EmailCampaignService } from '../../../services/email-campaign.service';

type UnsubscribeState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-unsubscribe',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './unsubscribe.component.html',
  styleUrl: './unsubscribe.component.css'
})
export class UnsubscribeComponent implements OnInit {
  state: UnsubscribeState = 'loading';
  message = 'מסירים אותך מרשימת התפוצה...';

  constructor(
    private route: ActivatedRoute,
    private emailService: EmailCampaignService
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state = 'error';
      this.message = 'קישור ההסרה חסר או אינו תקין.';
      return;
    }

    this.emailService.unsubscribe(token).subscribe({
      next: result => {
        this.state = result.success ? 'success' : 'error';
        this.message = result.message;
      },
      error: error => {
        this.state = 'error';
        this.message = error?.error?.message || error?.message ||
          'לא הצלחנו להשלים את ההסרה. אפשר לפנות אלינו ונשמח לעזור.';
      }
    });
  }
}
