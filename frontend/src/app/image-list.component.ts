import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { ImageService, ImageItem } from './image.service';

@Component({
  selector: 'app-image-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatButtonModule, MatButtonToggleModule, MatCardModule],
  template: `
    <section class="page-shell">
      <header>
        <h2>Image Gallery</h2>
        <p>Browse uploaded images and open them for editing.</p>
      </header>

      <div class="gallery-toolbar" *ngIf="images.length">
        <span>Show</span>
        <mat-button-toggle-group [(ngModel)]="displayMode" aria-label="Image version">
          <mat-button-toggle value="original">Original</mat-button-toggle>
          <mat-button-toggle value="final">Final</mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      <div *ngIf="images.length; else emptyState" class="image-list">
        <mat-card *ngFor="let image of images" class="image-card" appearance="outlined">
          <div class="image-preview" [class.missing-image]="!getDisplayUrl(image)">
            <img *ngIf="getDisplayUrl(image); else missingImage" [src]="getDisplayUrl(image)!" [alt]="displayMode === 'original' ? 'Original image' : 'Final image'" />
            <ng-template #missingImage>
              <div class="missing-image-label">No final image yet</div>
            </ng-template>
          </div>
          <mat-card-actions align="end">
            <a mat-button color="primary" [routerLink]="['/images', image.id, 'edit']">Edit</a>
          </mat-card-actions>
        </mat-card>
      </div>

      <ng-template #emptyState>
        <mat-card class="empty-state" appearance="outlined">
          <p>No images available yet. Upload a new image to get started.</p>
        </mat-card>
      </ng-template>

      <div class="actions">
        <a mat-flat-button color="primary" routerLink="/upload">Upload new image</a>
      </div>
    </section>
  `,
  styles: [
    ".page-shell { padding: 1.5rem; max-width: 920px; margin: 0 auto; }",
    "header { margin-bottom: 1.5rem; }",
    "h2 { margin: 0 0 0.375rem; font-size: 2rem; }",
    "p { margin: 0; color: #555; }",
    ".gallery-toolbar { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; color: #334155; }",
    ".image-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }",
    ".image-card { overflow: hidden; }",
    ".image-preview { min-height: 140px; border-radius: 0.75rem; overflow: hidden; background: #f8fafc; display: flex; align-items: center; justify-content: center; padding: 0.5rem; }",
    ".image-preview img { max-width: 100%; max-height: 220px; width: auto; height: auto; display: block; }",
    ".missing-image { border: 1px dashed #cbd5e1; }",
    ".missing-image-label { color: #64748b; font-weight: 600; text-align: center; padding: 1rem; }",
    ".actions { margin-top: 1.5rem; }",
    ".empty-state { padding: 1.5rem; color: #475569; background: #f8fafc; }"
  ]
})
export class ImageListComponent implements OnInit {
  images: ImageItem[] = [];
  displayMode: 'original' | 'final' = 'original';

  constructor(private imageService: ImageService) {}

  ngOnInit() {
    this.imageService.getImages().subscribe({
      next: (images) => (this.images = images),
      error: () => {
        this.images = [];
      }
    });
  }

  getDisplayUrl(image: ImageItem) {
    if (this.displayMode === 'final') {
      return image.finalUrl || null;
    }
    return image.originalUrl || null;
  }
}
