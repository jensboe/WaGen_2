import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface ImageItem {
  id: number;
  title: string;
  description: string;
}

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

      <div class="image-list">
        <article *ngFor="let image of images" class="image-card">
          <div>
            <strong>{{ image.title }}</strong>
            <p>{{ image.description }}</p>
          </div>
          <a [routerLink]="['/images', image.id, 'edit']">Edit</a>
        </article>
      </div>

      <div class="actions">
        <a routerLink="/images/new" class="button">Upload new image</a>
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
    ".button { display: inline-block; padding: 0.85rem 1.1rem; background: #2563eb; color: #fff; border-radius: 0.75rem; text-decoration: none; font-weight: 700; }"
  ]
})
export class ImageListComponent {
  images: ImageItem[] = [
    { id: 1, title: 'Sunset Highway', description: 'A vibrant road trip scene with warm colors.' },
    { id: 2, title: 'Coastal Campsite', description: 'Beachside camping under a starry sky.' },
    { id: 3, title: 'Mountain Van', description: 'A camper van parked near alpine scenery.' }
  ];
}
