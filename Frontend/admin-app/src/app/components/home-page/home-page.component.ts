import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { SongService } from '../../services/song.service';
import { ArtistService } from '../../services/artist.service';
import { SongCardComponent } from '../shared/song-card/song-card.component';
import { ArtistCircleComponent } from '../shared/artist-circle/artist-circle.component';
import { CarouselComponent } from '../shared/carousel/carousel.component';
import { AdDisplayComponent } from '../public/ad-display/ad-display.component';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    SongCardComponent,
    ArtistCircleComponent,
    CarouselComponent,
    AdDisplayComponent
  ],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css']
})
export class HomePageComponent implements OnInit {
  searchQuery = '';
  searchResults: any[] = [];
  showSearchResults = false;
  private searchSubject = new Subject<string>();

  recentSongs: any[] = [];
  popularSongs: any[] = [];
  topArtists: any[] = [];
  featuredArtists: any[] = [];

  constructor(
    private router: Router,
    private songService: SongService,
    private artistService: ArtistService
  ) {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.length < 2) {
          return of({ songs: [] });
        }
        return this.songService.getSongs(query, 1, 5);
      })
    ).subscribe((response: any) => {
      this.searchResults = response.songs || [];
      this.showSearchResults = this.searchQuery.length >= 2;
    });
  }

  ngOnInit() {
    this.loadContent();
  }

  loadContent() {
    // Recent Songs
    this.songService.getSongs(undefined, 1, 10).subscribe((res: any) => {
      this.recentSongs = res.songs || [];
    });

    // Popular Songs
    this.songService.getPopularSongs(10).subscribe((songs: any[]) => {
      this.popularSongs = songs;
    });

    // Top Artists (legacy)
    this.artistService.getTopArtists(10).subscribe((artists: any[]) => {
      this.topArtists = artists;
    });

    // Featured Artists (Premium + Boost)
    this.artistService.getFeaturedArtists(10).subscribe((artists: any[]) => {
      this.featuredArtists = artists;
    });
  }

  onSearchInput(query: string) {
    this.searchSubject.next(query);
  }

  selectSong(song: any) {
    this.router.navigate(['/song', song.id]);
  }

  onSearchBlur() {
    // Delay to allow click on results
    setTimeout(() => {
      this.showSearchResults = false;
    }, 200);
  }
}