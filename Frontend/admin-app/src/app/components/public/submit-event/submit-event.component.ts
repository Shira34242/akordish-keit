import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { QuickAddAssistantService } from '../../../services/quick-add-assistant.service';

@Component({
  selector: 'app-submit-event',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './submit-event.component.html',
  styleUrls: ['./submit-event.component.css']
})
export class SubmitEventComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly quickAddAssistantService = inject(QuickAddAssistantService);

  ngOnInit(): void {
    this.quickAddAssistantService.requestOpen('event');
    this.router.navigate(['/']);
  }
}
