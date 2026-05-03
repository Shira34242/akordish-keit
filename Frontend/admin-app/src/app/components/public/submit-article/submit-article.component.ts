import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { QuickAddAssistantService, QuickAddEntryPoint } from '../../../services/quick-add-assistant.service';

@Component({
  selector: 'app-submit-article',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './submit-article.component.html',
  styleUrls: ['./submit-article.component.css']
})
export class SubmitArticleComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly quickAddAssistantService = inject(QuickAddAssistantService);

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const entryPoint: QuickAddEntryPoint = params['type'] === 'content' ? 'article' : 'news';
      this.quickAddAssistantService.requestOpen(entryPoint);
      this.router.navigate(['/']);
    });
  }
}
