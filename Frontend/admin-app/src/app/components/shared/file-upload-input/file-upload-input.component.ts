import { Component, Input, Output, EventEmitter, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { MediaService } from '../../../services/admin/media.service';
import { LanguageService } from '../../../services/language.service';

@Component({
  selector: 'app-file-upload-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-upload-input.component.html',
  styleUrls: ['./file-upload-input.component.scss']
})
export class FileUploadInputComponent implements OnDestroy {
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
  uploadProgress = 0;
  private uploadSub?: Subscription;
  private readonly langService = inject(LanguageService);

  constructor(private mediaService: MediaService) {}

  ngOnDestroy(): void {
    this.uploadSub?.unsubscribe();
  }

  onUrlInput(event: Event): void {
    this.urlChange.emit((event.target as HTMLInputElement).value);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    this.uploading = true;
    this.uploadProgress = 0;
    this.uploadSub?.unsubscribe();
    this.uploadSub = this.mediaService.uploadMediaWithProgress(file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.uploadProgress = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
          return;
        }

        if (event.type !== HttpEventType.Response || !event.body?.url) return;

        this.urlChange.emit(event.body.url);
        this.uploadProgress = 100;
        this.uploading = false;
      },
      error: (err: any) => {
        console.error('File upload error:', err);
        const message = err?.message || this.langService.translate('shared.file_upload_error');
        alert(message);
        this.uploading = false;
        this.uploadProgress = 0;
      }
    });
  }

  cancelUpload(): void {
    this.uploadSub?.unsubscribe();
    this.uploading = false;
    this.uploadProgress = 0;
  }

  isImage(url: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
  }

  clear(): void {
    this.urlChange.emit('');
  }
}
