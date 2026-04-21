import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-subscription-cancel',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './subscription-cancel.html',
  styleUrls: ['./subscription-cancel.css']
})
export class SubscriptionCancelComponent {}
