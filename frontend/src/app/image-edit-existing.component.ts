import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ImageService, ImageItem } from './image.service';

@Component({
  selector: 'app-image-edit-existing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page-shell">
      <header>
        <h2>Edit Existing Image</h2>
        <p>Modify an image you already uploaded. Select a watermark position or update the crop.</p>
      </header>

      <ng-container *ngIf="image; else noImage">
        <div class="image-summary">
          <h3>{{ image.title || 'Untitled image' }}</h3>
          <p>{{ image.description || 'No description available.' }}</p>
          <p><strong>ID:</strong> {{ image.id }}</p>
          <div *ngIf="image.originalUrl" class="image-preview">
            <img [src]="image.originalUrl" alt="Uploaded image" />
          </div>
        </div>

        <div class="placeholder">
          <p>The detailed edit UI will be implemented here, including crop and watermark placement.</p>
        </div>
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
}
