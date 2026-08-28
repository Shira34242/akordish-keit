import { ApplicationRef, ComponentRef, EnvironmentInjector, Injectable, createComponent, inject } from '@angular/core';
import { MarketingCampaignSummary } from '../../../../services/admin/marketing-campaign.service';
import { MarketingLinkSelectorDialogComponent } from './marketing-link-selector-dialog.component';

let bridge: MarketingLinkSelectorBridgeService | null = null;

export function openMarketingLinkSelector(): Promise<MarketingCampaignSummary | null> {
  return bridge?.select() ?? Promise.resolve(null);
}

@Injectable({ providedIn: 'root' })
export class MarketingLinkSelectorBridgeService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private dialogRef: ComponentRef<MarketingLinkSelectorDialogComponent> | null = null;

  constructor() { bridge = this; }

  select(): Promise<MarketingCampaignSummary | null> {
    this.destroy();
    return new Promise(resolve => {
      const host = document.createElement('div');
      host.id = 'akd-marketing-link-selector-host';
      document.body.appendChild(host);
      const ref = createComponent(MarketingLinkSelectorDialogComponent, { hostElement: host, environmentInjector: this.environmentInjector });
      ref.instance.selected.subscribe(item => { this.destroy(); resolve(item); });
      ref.instance.closed.subscribe(() => { this.destroy(); resolve(null); });
      this.appRef.attachView(ref.hostView);
      this.dialogRef = ref;
    });
  }

  private destroy(): void {
    if (!this.dialogRef) return;
    const host = this.dialogRef.location.nativeElement as HTMLElement;
    this.appRef.detachView(this.dialogRef.hostView);
    this.dialogRef.destroy();
    host.remove();
    this.dialogRef = null;
  }
}
