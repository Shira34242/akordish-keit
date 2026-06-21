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
  @Input() maxLength?: number;
  @Input() fileOnly: boolean = false;
  @Input() uploadButtonText: string = '';
  @Input() uploadIcon: string = 'attach_file';
  @Input() multiple: boolean = false;
  @Output() uploadedUrls = new EventEmitter<string[]>();

  uploading = false;
  uploadProgress = 0;
  uploadTotalFiles = 0;
  uploadCompletedFiles = 0;
  private uploadSub?: Subscription;
  private uploadCancelled = false;
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
    const files = Array.from(input.files || []);
    if (files.length === 0) return;
    input.value = '';
    this.uploading = true;
    this.uploadProgress = 0;
    this.uploadTotalFiles = files.length;
    this.uploadCompletedFiles = 0;
    this.uploadCancelled = false;
    this.uploadSub?.unsubscribe();

    this.uploadFiles(files);
  }

  private uploadFiles(files: File[], index = 0, uploadedUrls: string[] = []): void {
    if (this.uploadCancelled) return;

    if (index >= files.length) {
      this.uploadProgress = uploadedUrls.length > 0 ? 100 : 0;
      this.uploading = false;
      this.uploadTotalFiles = 0;
      this.uploadCompletedFiles = 0;
      return;
    }

    const file = files[index];
    this.uploadSub = this.mediaService.uploadMediaWithProgress(file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          const currentFileProgress = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
          this.uploadProgress = Math.round(
            ((this.uploadCompletedFiles * 100) + currentFileProgress) / this.uploadTotalFiles
          );
          return;
        }

        if (event.type !== HttpEventType.Response || !event.body?.url) return;

        uploadedUrls.push(event.body.url);
        this.urlChange.emit(event.body.url);
        this.uploadedUrls.emit([event.body.url]);
        this.uploadCompletedFiles += 1;
        this.uploadProgress = Math.round((this.uploadCompletedFiles / this.uploadTotalFiles) * 100);
        this.uploadFiles(files, index + 1, uploadedUrls);
      },
      error: (err: any) => {
        console.error('File upload error:', err);
        const message = err?.message || this.langService.translate('shared.file_upload_error');
        alert(message);
        this.uploadCompletedFiles += 1;
        this.uploadFiles(files, index + 1, uploadedUrls);
      }
    });
  }

  cancelUpload(): void {
    this.uploadCancelled = true;
    this.uploadSub?.unsubscribe();
    this.uploading = false;
    this.uploadProgress = 0;
    this.uploadTotalFiles = 0;
    this.uploadCompletedFiles = 0;
  }

  isImage(url: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|avif|svg|bmp|tif|tiff|ico|heic|heif|jxl)(\?.*)?$/i.test(url);
  }

  clear(): void {
    this.urlChange.emit('');
  }
}
