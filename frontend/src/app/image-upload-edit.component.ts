import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImageEditorComponent } from './image-editor.component';
import { ImageService } from './image.service';

@Component({
  selector: 'app-image-upload-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ImageEditorComponent],
  template: `
    <section class="page-shell">
      <header>
        <h2>Upload a New Image</h2>
        <p>Select an image file and crop or watermark it before saving.</p>
      </header>

      <div class="file-selection" *ngIf="!selectedFile">
        <label class="file-picker">
          <span>Select image</span>
          <input type="file" accept="image/*" (change)="onFileSelected($event)" />
        </label>
      </div>

      <div *ngIf="selectedFile">
        <app-image-editor [sourceFile]="selectedFile" (save)="handleSave($event)"></app-image-editor>
      </div>

      <p *ngIf="errorMessage" class="error">{{ errorMessage }}</p>
      <p *ngIf="successMessage" class="success">{{ successMessage }}</p>

      <div class="actions" *ngIf="selectedFile">
        <button type="button" (click)="resetSelection()">Choose another image</button>
        <a routerLink="/images">Cancel</a>
      </div>
    </section>
  `,
  styles: [
    ".page-shell { padding: 1.5rem; max-width: 780px; margin: 0 auto; }",
    "header { margin-bottom: 1.5rem; }",
    "h2 { margin: 0 0 0.375rem; font-size: 2rem; }",
    "p { margin: 0; color: #555; }",
    ".image-form { display: grid; gap: 1rem; }",
    ".image-form label { display: grid; gap: 0.5rem; font-weight: 600; color: #333; }",
    ".image-form input[type=text], .image-form textarea { width: 100%; padding: 0.9rem 1rem; border: 1px solid #d0d0d0; border-radius: 0.75rem; font: inherit; }",
    ".image-form textarea { min-height: 140px; resize: vertical; }",
    ".file-picker { display: inline-flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: #f3f4f6; border-radius: 0.75rem; cursor: pointer; }",
    "input[type='file'] { display: none; }",
    ".preview { padding: 1rem; border: 1px solid #d1d5db; border-radius: 0.75rem; background: #fff; }",
    ".actions { display: flex; gap: 1rem; align-items: center; margin-top: 0.5rem; }",
    ".actions button { padding: 0.85rem 1.2rem; border: none; border-radius: 0.75rem; background: #2563eb; color: white; font-weight: 700; cursor: pointer; }",
    ".actions a { color: #2563eb; text-decoration: none; font-weight: 700; }",
    ".error { color: #b91c1c; }",
    ".success { color: #047857; }"
  ]
})
export class ImageUploadEditComponent {
  selectedFile: File | null = null;
  uploading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private imageService: ImageService, private router: Router) {}

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    this.selectedFile = file;
  }

  resetSelection() {
    this.selectedFile = null;
    this.errorMessage = '';
    this.successMessage = '';
  }

  handleSave(event: { finalBlob: Blob; metadata: any }) {
    if (!this.selectedFile) {
      this.errorMessage = 'No image selected for upload.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.uploading = true;

    this.imageService.uploadImage(this.selectedFile).subscribe({
      next: (result) => {
        const finalFile = new File([event.finalBlob], `final-${this.selectedFile!.name}`, { type: 'image/jpeg' });
        this.imageService.saveFinalImage(result.id, finalFile, event.metadata).subscribe({
          next: () => {
            this.uploading = false;
            this.successMessage = 'Image uploaded and saved successfully.';
            this.router.navigate(['/images']);
          },
          error: () => {
            this.uploading = false;
            this.errorMessage = 'Final save failed. Please try again.';
          }
        });
      },
      error: () => {
        this.uploading = false;
        this.errorMessage = 'Upload failed. Please try again.';
      }
    });
  }
}
