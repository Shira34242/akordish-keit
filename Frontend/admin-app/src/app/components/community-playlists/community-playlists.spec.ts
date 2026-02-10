import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunityPlaylists } from './community-playlists';

describe('CommunityPlaylists', () => {
  let component: CommunityPlaylists;
  let fixture: ComponentFixture<CommunityPlaylists>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityPlaylists]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommunityPlaylists);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
