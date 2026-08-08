import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ImageEditorComponent } from './image-editor.component';
import { ImageService, ImageItem } from './image.service';
import type { SaveEditedImageEvent } from '@shared/image.types';

@Component({
  selector: 'app-image-edit-existing',
  standalone: true,
  imports: [CommonModule, ImageEditorComponent],
  template: `
    <section class="page-shell">
      <header>
        <h2>Edit Existing Image</h2>
        <p>Crop the image, blur sensitive areas, and place a watermark on an already uploaded image.</p>
      </header>

      <ng-container *ngIf="image; else noImage">
        <app-image-editor
          *ngIf="image.originalUrl"
          [sourceUrl]="image.originalUrl"
          [initialMetadata]="image.metadata"
          (save)="handleSave($event)">
        </app-image-editor>

        <div *ngIf="errorMessage" class="error">{{ errorMessage }}</div>
        <div *ngIf="successMessage" class="success">{{ successMessage }}</div>
      </ng-container>

      <ng-template #noImage>
        <div class="placeholder">
          <p>No image selected. Please choose an image from the image list.</p>
        </div>
      </ng-template>
    </section>
  `,
  styles: [
    ".page-shell { padding: 1.5rem; max-width: 820px; margin: 0 auto; }",
    "header { margin-bottom: 1.5rem; }",
    "h2 { margin: 0 0 0.375rem; font-size: 2rem; }",
    ".image-summary { padding: 1rem; border: 1px solid #d1d5db; border-radius: 0.75rem; background: #fff; margin-bottom: 1rem; }",
    ".image-preview img { display: block; max-width: 100%; border-radius: 0.75rem; margin-top: 1rem; }",
    ".placeholder { padding: 1.25rem; border: 1px dashed #cbd5e1; border-radius: 0.75rem; color: #475569; background: #f8fafc; }"
  ]
})
export class ImageEditExistingComponent implements OnInit {
  image: ImageItem | null = null;
  errorMessage = '';
  successMessage = '';
  saving = false;

  constructor(private route: ActivatedRoute, private imageService: ImageService) {}

  ngOnInit() {
    const idString = this.route.snapshot.paramMap.get('id');
    const id = idString ? Number(idString) : null;
    if (id) {
      this.imageService.getImage(id).subscribe({
        next: (image) => (this.image = image),
        error: () => (this.image = null)
      });
    }
  }

  handleSave(event: SaveEditedImageEvent) {
    if (!this.image) {
      this.errorMessage = 'No image loaded for editing.';
      return;
    }
    this.errorMessage = '';
    this.successMessage = '';
    this.saving = true;

    const finalFile = new File([event.finalBlob], `final-${this.image.id}.jpg`, { type: 'image/jpeg' });
    this.imageService.saveFinalImage(this.image.id, finalFile, event.metadata).subscribe({
      next: () => {
        this.saving = false;
        this.successMessage = 'Final image saved successfully.';
      },
      error: () => {
        this.saving = false;
        this.errorMessage = 'Unable to save the final image. Please try again.';
      }
    });
  }
}
