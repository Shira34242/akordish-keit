import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaService } from '../../../services/admin/media.service';
import { LanguageService } from '../../../services/language.service';

@Component({
  selector: 'app-file-upload-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-upload-input.component.html',
  styleUrls: ['./file-upload-input.component.scss']
})
export class FileUploadInputComponent {
  @Input() url: string | undefined = '';
  @Output() urlChange = new EventEmitter<string>();
  @Input() accept: string = 'image/*';
  @Input() placeholder: string = 'https://...';
  @Input() showPreview: boolean = true;
  @Input() inputId?: string;
  @Input() fileOnly: boolean = false;
  @Input() uploadButtonText: string = '';
  @Input() uploadIcon: string = 'attach_file';

  uploading = false;
  private readonly langService = inject(LanguageService);

  constructor(private mediaService: MediaService) {}

  onUrlInput(event: Event): void {
    this.urlChange.emit((event.target as HTMLInputElement).value);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    this.uploading = true;
    this.mediaService.uploadMedia(file).subscribe({
      next: (response) => {
        this.urlChange.emit(response.url);
        this.uploading = false;
      },
      error: () => {
        alert(this.langService.translate('shared.file_upload_error'));
        this.uploading = false;
      }
    });
  }

  isImage(url: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
  }

  clear(): void {
    this.urlChange.emit('');
  }
}
