/**
 * Ad Display Widget - Pure JavaScript
 *
 * שימוש:
 * <div id="ad-container"></div>
 * <script src="ad-widget.js"></script>
 * <script>
 *   new AdWidget({
 *     containerId: 'ad-container',
 *     spotTechnicalId: 'header-banner',
 *     apiUrl: 'https://localhost:44395/api/AdCampaigns',
 *     rotationInterval: 45000, // 45 seconds
 *     isMobile: false
 *   });
 * </script>
 */

class AdWidget {
  constructor(options) {
    this.containerId = options.containerId;
    this.spotTechnicalId = options.spotTechnicalId;
    this.apiUrl = options.apiUrl || 'https://localhost:44395/api/AdCampaigns';
    this.rotationInterval = options.rotationInterval || 45000;
    this.isMobile = options.isMobile || this.detectMobile();

    this.campaigns = [];
    this.currentIndex = 0;
    this.currentAd = null;
    this.hasTrackedView = false;
    this.rotationTimer = null;

    this.container = document.getElementById(this.containerId);

    if (!this.container) {
      console.error(`Container with id "${this.containerId}" not found`);
      return;
    }

    this.init();
  }

  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  async init() {
    await this.loadAds();
    this.startRotation();
  }

  async loadAds() {
    try {
      const response = await fetch(
        `${this.apiUrl}/Public/GetAd?spotTechnicalId=${this.spotTechnicalId}`
      );

      if (!response.ok) {
        throw new Error('Failed to load ads');
      }

      const data = await response.json();
      this.campaigns = data.campaigns;

      if (this.campaigns.length > 0) {
        this.currentIndex = 0;
        this.currentAd = this.campaigns[0];
        this.renderAd();
      } else {
        this.showError('אין פרסומות זמינות');
      }
    } catch (error) {
      console.error('Error loading ads:', error);
      this.showError('שגיאה בטעינת פרסומות');
    }
  }

  renderAd() {
    if (!this.currentAd) return;

    const mediaUrl = this.isMobile && this.currentAd.mobileMediaUrl
      ? this.currentAd.mobileMediaUrl
      : this.currentAd.mediaUrl;

    this.container.innerHTML = `
      <a href="${this.currentAd.knownUrl}"
         target="_blank"
         onclick="window.adWidget_trackClick(${this.currentAd.id})"
         style="display: block; width: 100%; text-decoration: none;">
        <img src="${mediaUrl}"
             alt="${this.currentAd.name}"
             style="width: 100%; height: auto; display: block;"
             onload="window.adWidget_trackView(${this.currentAd.id})" />
      </a>
    `;

    this.hasTrackedView = false;
  }

  startRotation() {
    if (this.campaigns.length <= 1) return;

    this.rotationTimer = setInterval(() => {
      this.rotateToNextAd();
    }, this.rotationInterval);
  }

  rotateToNextAd() {
    if (this.campaigns.length <= 1) return;

    this.currentIndex = (this.currentIndex + 1) % this.campaigns.length;
    this.currentAd = this.campaigns[this.currentIndex];
    this.renderAd();
  }

  async trackView(campaignId) {
    if (this.hasTrackedView) return;
    this.hasTrackedView = true;

    try {
      await fetch(`${this.apiUrl}/${campaignId}/track-view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  }

  async trackClick(campaignId) {
    try {
      await fetch(`${this.apiUrl}/${campaignId}/track-click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error tracking click:', error);
    }
  }

  showError(message) {
    this.container.innerHTML = `
      <div style="padding: 1rem; text-align: center; color: #dc3545;">
        ${message}
      </div>
    `;
  }

  destroy() {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }
  }
}

// Global functions for tracking (called from inline onclick/onload)
window.adWidget_trackView = function(campaignId) {
  if (window.adWidgetInstance) {
    window.adWidgetInstance.trackView(campaignId);
  }
};

window.adWidget_trackClick = function(campaignId) {
  if (window.adWidgetInstance) {
    window.adWidgetInstance.trackClick(campaignId);
  }
};
