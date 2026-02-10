import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ArtistService } from '../../services/artist.service';
import { Artist, SocialPlatform } from '../../models/artist.model';
import { SongDto } from '../../models/song.model';
import { Article } from '../../models/article.model';
import { UpcomingEventDto } from '../../models/event.model';

@Component({
  selector: 'app-artist-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './artist-detail.component.html',
  styleUrls: ['./artist-detail.component.css']
})
export class ArtistDetailComponent implements OnInit {
  artist: Artist | null = null;
  songs: SongDto[] = [];
  articles: Article[] = [];
  events: UpcomingEventDto[] = [];

  loading = true;
  loadingSongs = false;
  loadingArticles = false;
  loadingEvents = false;

  // Pagination
  songsPage = 1;
  articlesPage = 1;
  totalSongs = 0;
  totalArticles = 0;

  SocialPlatform = SocialPlatform;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private artistService: ArtistService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      if (id) {
        this.loadArtist(id);
      }
    });
  }

  loadArtist(id: number): void {
    this.loading = true;

    this.artistService.getArtistById(id).subscribe({
      next: (artist) => {
        this.artist = artist;
        this.loading = false;

        // טעינת תכנים
        this.loadSongs(id);
        this.loadArticles(id);
        this.loadEvents(id);
      },
      error: (error) => {
        console.error('Error loading artist:', error);
        this.loading = false;
        this.router.navigate(['/']);
      }
    });
  }

  loadSongs(artistId: number, page: number = 1): void {
    this.loadingSongs = true;

    this.artistService.getArtistSongs(artistId, page, 6).subscribe({
      next: (result) => {
        this.songs = result.items;
        this.totalSongs = result.totalCount;
        this.songsPage = page;
        this.loadingSongs = false;
      },
      error: (error) => {
        console.error('Error loading songs:', error);
        this.loadingSongs = false;
      }
    });
  }

  loadArticles(artistId: number, page: number = 1): void {
    this.loadingArticles = true;

    this.artistService.getArtistArticles(artistId, page, 6).subscribe({
      next: (result) => {
        this.articles = result.items;
        this.totalArticles = result.totalCount;
        this.articlesPage = page;
        this.loadingArticles = false;
      },
      error: (error) => {
        console.error('Error loading articles:', error);
        this.loadingArticles = false;
      }
    });
  }

  loadEvents(artistId: number): void {
    this.loadingEvents = true;

    this.artistService.getArtistEvents(artistId).subscribe({
      next: (events) => {
        this.events = events;
        this.loadingEvents = false;
      },
      error: (error) => {
        console.error('Error loading events:', error);
        this.loadingEvents = false;
      }
    });
  }

  getSocialPlatformName(platform: SocialPlatform): string {
    const names: { [key: number]: string } = {
      [SocialPlatform.Facebook]: 'Facebook',
      [SocialPlatform.Instagram]: 'Instagram',
      [SocialPlatform.YouTube]: 'YouTube',
      [SocialPlatform.Twitter]: 'Twitter',
      [SocialPlatform.TikTok]: 'TikTok',
      [SocialPlatform.Spotify]: 'Spotify',
      [SocialPlatform.Website]: 'אתר'
    };
    return names[platform] || 'קישור';
  }

  getSocialIcon(platform: SocialPlatform): string {
    // SVG icons או Font Awesome classes
    return '🔗'; // placeholder
  }

  onBoost(): void {
    if (!this.artist) return;

    if (confirm('האם לבצע בוסט לאומן? (10₪)')) {
      this.artistService.boostArtist(this.artist.id).subscribe({
        next: (response) => {
          alert(response.message);
          if (this.artist) {
            this.loadArtist(this.artist.id);
          }
        },
        error: (error) => {
          alert('שגיאה בביצוע בוסט');
        }
      });
    }
  }

  onUpgrade(): void {
    if (!this.artist) return;

    this.artistService.upgradeToPremium(this.artist.id).subscribe({
      next: (response) => {
        if (response.paymentUrl) {
          window.location.href = response.paymentUrl;
        } else {
          alert(response.message);
        }
      },
      error: (error) => {
        alert('שגיאה בשדרוג חשבון');
      }
    });
  }

  navigateToSong(songId: number): void {
    this.router.navigate(['/song', songId]);
  }

  navigateToArticle(slug: string): void {
    this.router.navigate(['/news', slug]);
  }

  navigateToEvent(eventId: number): void {
    // TODO: ניווט לדף הופעה
    window.open(this.events.find(e => e.id === eventId)?.ticketUrl || '', '_blank');
  }

  getYouTubeEmbedUrl(videoUrl: string): string {
    // המרת URL רגיל ל-embed
    const videoId = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/)?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : videoUrl;
  }
}
