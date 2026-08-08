import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-edit-existing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page">
      <header>
        <h1>Edit Existing Image</h1>
        <p>Modify an image you already uploaded. Select a watermark position or update the crop.</p>
      </header>

      <div *ngIf="imageId; else noImage">
        <p>Editing image ID: {{ imageId }}</p>
        <div class="placeholder">
          <p>Image editing UI for the selected image will be implemented here.</p>
        </div>
      </div>

      <ng-template #noImage>
        <p>No image selected. Please choose an image from the image list.</p>
      </ng-template>
    </section>
  `,
  styles: [
    `
      .page { padding: 1.5rem; }
      .placeholder { margin-top: 1rem; padding: 1.25rem; border: 1px dashed #cbd5e1; border-radius: 0.75rem; color: #475569; }
    `
  ]
})
export class ImageEditExistingComponent {
  imageId: string | null = null;

  constructor(route: ActivatedRoute) {
    this.imageId = route.snapshot.paramMap.get('id');
  }
}
