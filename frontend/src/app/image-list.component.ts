import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ImageService, ImageItem } from './image.service';

@Component({
  selector: 'app-image-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page-shell">
      <header>
        <h2>Image Gallery</h2>
        <p>Browse uploaded images and open them for editing.</p>
      </header>

      <div *ngIf="images.length; else emptyState" class="image-list">
        <article *ngFor="let image of images" class="image-card">
          <div>
            <strong>{{ image.title || 'Untitled image' }}</strong>
            <p>{{ image.description || 'No description provided.' }}</p>
            <p *ngIf="image.originalUrl">ID: {{ image.id }}</p>
          </div>
          <a [routerLink]="['/images', image.id, 'edit']">Edit</a>
        </article>
      </div>

      <ng-template #emptyState>
        <div class="empty-state">
          <p>No images available yet. Upload a new image to get started.</p>
        </div>
      </ng-template>

      <div class="actions">
        <a routerLink="/upload" class="button">Upload new image</a>
      </div>
    </section>
  `,
  styles: [
    ".page-shell { padding: 1.5rem; max-width: 920px; margin: 0 auto; }",
    "header { margin-bottom: 1.5rem; }",
    "h2 { margin: 0 0 0.375rem; font-size: 2rem; }",
    "p { margin: 0; color: #555; }",
    ".image-list { display: grid; gap: 1rem; }",
    ".image-card { display: flex; justify-content: space-between; align-items: center; padding: 1rem; border: 1px solid #ddd; border-radius: 0.75rem; background: #fff; }",
    ".image-card strong { display: block; font-size: 1rem; margin-bottom: 0.5rem; }",
    ".image-card p { margin: 0; color: #666; }",
    ".image-card a { color: #2563eb; text-decoration: none; font-weight: 700; }",
    ".image-card a:hover { text-decoration: underline; }",
    ".actions { margin-top: 1.5rem; }",
    ".button { display: inline-block; padding: 0.85rem 1.1rem; background: #2563eb; color: #fff; border-radius: 0.75rem; text-decoration: none; font-weight: 700; }",
    ".empty-state { padding: 1.5rem; border: 1px dashed #cbd5e1; border-radius: 0.75rem; color: #475569; background: #f8fafc; }"
  ]
})
export class ImageListComponent implements OnInit {
  images: ImageItem[] = [];

  constructor(private imageService: ImageService) {}

  ngOnInit() {
    this.imageService.getImages().subscribe({
      next: (images) => (this.images = images),
      error: () => {
        this.images = [];
      }
    });
  }
}
