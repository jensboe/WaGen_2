import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ImageService, WatermarkItem } from './image.service';

@Component({
  selector: 'app-watermark-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  templateUrl: './watermark-upload.component.html',
  styleUrl: './watermark-upload.component.scss'
})
export class WatermarkUploadComponent {
  watermarks: WatermarkItem[] = [];
  errorMessage = '';
  successMessage = '';
  editingWatermarkId: number | null = null;
  editingLabel = '';

  constructor(private imageService: ImageService) {
    this.loadWatermarks();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    if (!file) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.imageService.uploadWatermark(file).subscribe({
      next: (watermark) => {
        this.watermarks = [watermark, ...this.watermarks];
        this.successMessage = $localize`Watermark uploaded successfully.`;
        input.value = '';
      },
      error: () => {
        this.errorMessage = $localize`Failed to upload watermark. Please try again.`;
        input.value = '';
      }
    });
  }

  startEdit(watermark: WatermarkItem) {
    this.editingWatermarkId = watermark.id;
    this.editingLabel = watermark.label;
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelEdit() {
    this.editingWatermarkId = null;
    this.editingLabel = '';
  }

  saveRename(watermark: WatermarkItem) {
    const label = this.editingLabel.trim();
    if (!label) {
      this.errorMessage = $localize`The watermark name cannot be empty.`;
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.imageService.renameWatermark(watermark.id, label).subscribe({
      next: (updatedWatermark) => {
        this.watermarks = this.watermarks.map((item) => (item.id === updatedWatermark.id ? updatedWatermark : item));
        this.successMessage = $localize`Watermark renamed successfully.`;
        this.cancelEdit();
      },
      error: () => {
        this.errorMessage = $localize`Failed to rename watermark. Please try again.`;
      }
    });
  }

  deleteWatermark(watermark: WatermarkItem) {
    const confirmed = globalThis.confirm(
      $localize`Delete watermark "${watermark.label}:watermarkLabel:"?`
    );
    if (!confirmed) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.imageService.deleteWatermark(watermark.id).subscribe({
      next: () => {
        this.watermarks = this.watermarks.filter((item) => item.id !== watermark.id);
        if (this.editingWatermarkId === watermark.id) {
          this.cancelEdit();
        }
        this.successMessage = $localize`Watermark deleted successfully.`;
      },
      error: () => {
        this.errorMessage = $localize`Failed to delete watermark. Please try again.`;
      }
    });
  }

  private loadWatermarks() {
    this.imageService.getWatermarks().subscribe({
      next: (watermarks) => {
        this.watermarks = watermarks;
      },
      error: () => {
        this.watermarks = [];
        this.errorMessage = $localize`Failed to load watermarks.`;
      }
    });
  }
}
