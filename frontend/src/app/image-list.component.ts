import { Component, OnInit } from '@angular/core';

import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { ImageService, ImageItem } from './image.service';

@Component({
    selector: 'app-image-list',
    imports: [FormsModule, RouterLink, MatButtonModule, MatButtonToggleModule, MatCardModule],
    templateUrl: './image-list.component.html',
    styleUrl: './image-list.component.scss'
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
