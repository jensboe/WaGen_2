import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { ImageEditorComponent } from './image-editor.component';
import { ImageService } from './image.service';
import type { SaveEditedImageEvent } from '@shared/image.types';

@Component({
  selector: 'app-image-upload-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ImageEditorComponent, MatTabsModule],
  templateUrl: './image-upload-edit.component.html',
  styleUrl: './image-upload-edit.component.scss'
})
export class ImageUploadEditComponent {
  selectedFile: File | null = null;
  selectedTabIndex = 0;
  uploading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private imageService: ImageService, private router: Router) {}

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    this.selectedFile = file;
    if (file) {
      this.selectedTabIndex = 1;
    }
  }

  resetSelection() {
    this.selectedFile = null;
    this.selectedTabIndex = 0;
    this.errorMessage = '';
    this.successMessage = '';
  }

  onTabChange(index: number) {
    if (index > 0 && !this.selectedFile) {
      this.selectedTabIndex = 0;
      return;
    }
    this.selectedTabIndex = index;
  }

  handleSave(event: SaveEditedImageEvent) {
    if (!this.selectedFile) {
      this.errorMessage = $localize`No image selected for upload.`;
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
            this.successMessage = $localize`Image was successfully uploaded and saved.`;
            this.router.navigate(['/images']);
          },
          error: () => {
            this.uploading = false;
            this.errorMessage = $localize`The final save failed. Please try again.`;
          }
        });
      },
      error: () => {
        this.uploading = false;
        this.errorMessage = $localize`The upload failed. Please try again.`;
      }
    });
  }
}
