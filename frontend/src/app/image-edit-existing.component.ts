import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ImageEditorComponent } from './image-editor.component';
import { ImageService, ImageItem } from './image.service';
import type { SaveEditedImageEvent } from '@shared/image.types';

@Component({
    selector: 'app-image-edit-existing',
    imports: [CommonModule, ImageEditorComponent],
    templateUrl: './image-edit-existing.component.html',
    styleUrl: './image-edit-existing.component.scss'
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
      this.errorMessage = $localize`No image loaded for editing.`;
      return;
    }
    this.errorMessage = '';
    this.successMessage = '';
    this.saving = true;

    const finalFile = new File([event.finalBlob], `final-${this.image.id}.jpg`, { type: 'image/jpeg' });
    this.imageService.saveFinalImage(this.image.id, finalFile, event.metadata).subscribe({
      next: () => {
        this.saving = false;
        this.successMessage = $localize`The final image was saved successfully.`;
      },
      error: () => {
        this.saving = false;
        this.errorMessage = $localize`The final image could not be saved. Please try again.`;
      }
    });
  }
}
