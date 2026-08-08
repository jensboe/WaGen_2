import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-image-upload-edit',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page-shell">
      <header>
        <h2>Upload a New Image</h2>
        <p>Choose a file and add image details before saving.</p>
      </header>

      <form class="image-form">
        <label>
          Image title
          <input type="text" placeholder="Enter a title" />
        </label>

        <label>
          Image description
          <textarea placeholder="Describe the image"></textarea>
        </label>

        <label class="file-picker">
          <span>Select image</span>
          <input type="file" accept="image/*" (change)="onFileSelected($event)" />
        </label>

        <div *ngIf="selectedFile" class="preview">
          <p><strong>Selected file:</strong> {{ selectedFile.name }}</p>
          <p><strong>Size:</strong> {{ selectedFile.size | number }} bytes</p>
        </div>

        <div class="actions">
          <button type="button">Save image</button>
          <a routerLink="/images">Cancel</a>
        </div>
      </form>
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
    ".actions a { color: #2563eb; text-decoration: none; font-weight: 700; }"
  ]
})
export class ImageUploadEditComponent {
  selectedFile: File | null = null;

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    this.selectedFile = file;
  }
}
