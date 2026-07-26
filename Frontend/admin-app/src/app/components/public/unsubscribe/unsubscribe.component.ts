import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';

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
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state = 'error';
      this.message = 'קישור ההסרה חסר או אינו תקין.';
      return;
    }

    const target = `${environment.apiBaseUrl}/api/Email/unsubscribe-page?token=${encodeURIComponent(token)}`;
    window.location.replace(target);
  }
}
