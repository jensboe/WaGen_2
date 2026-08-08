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
  template: `
    <section class="page-shell">
      <header>
        <h2>Watermarks</h2>
        <p>Upload watermark files and reuse them in the editor.</p>
      </header>

      <mat-card class="upload-card" appearance="outlined">
        <mat-card-content>
          <div class="upload-actions">
            <button mat-flat-button color="primary" type="button" (click)="fileInput.click()">Upload watermark</button>
            <input #fileInput type="file" accept="image/png,image/webp,image/svg+xml,image/jpeg" (change)="onFileSelected($event)" hidden />
          </div>
          <p *ngIf="errorMessage" class="error-message">{{ errorMessage }}</p>
          <p *ngIf="successMessage" class="success-message">{{ successMessage }}</p>
        </mat-card-content>
      </mat-card>

      <div *ngIf="watermarks.length; else emptyState" class="watermark-grid">
        <mat-card *ngFor="let watermark of watermarks" class="watermark-card" appearance="outlined">
          <div class="watermark-preview">
            <img [src]="watermark.url" [alt]="watermark.label" />
          </div>
          <mat-card-content>
            <ng-container *ngIf="editingWatermarkId === watermark.id; else readMode">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Name</mat-label>
                <input matInput [(ngModel)]="editingLabel" />
              </mat-form-field>
            </ng-container>
            <ng-template #readMode>
              <p class="watermark-label">{{ watermark.label }}</p>
            </ng-template>
          </mat-card-content>
          <mat-card-actions align="end">
            <ng-container *ngIf="editingWatermarkId === watermark.id; else actionMode">
              <button mat-button type="button" (click)="cancelEdit()">Cancel</button>
              <button mat-flat-button color="primary" type="button" (click)="saveRename(watermark)">Save</button>
            </ng-container>
            <ng-template #actionMode>
              <button mat-button type="button" (click)="startEdit(watermark)">Rename</button>
              <button mat-button color="warn" type="button" (click)="deleteWatermark(watermark)">Delete</button>
            </ng-template>
          </mat-card-actions>
        </mat-card>
      </div>

      <ng-template #emptyState>
        <mat-card class="empty-state" appearance="outlined">
          <mat-card-content>
            <p>No watermarks uploaded yet.</p>
          </mat-card-content>
        </mat-card>
      </ng-template>
    </section>
  `,
  styles: [
    ".page-shell { padding: 1.5rem; max-width: 920px; margin: 0 auto; }",
    "header { margin-bottom: 1.5rem; }",
    "h2 { margin: 0 0 0.375rem; font-size: 2rem; }",
    "p { margin: 0; color: #555; }",
    ".upload-card { margin-bottom: 1.5rem; }",
    ".upload-actions { display: flex; gap: 1rem; align-items: center; }",
    ".watermark-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }",
    ".watermark-card { overflow: hidden; }",
    ".watermark-preview { min-height: 180px; display: flex; align-items: center; justify-content: center; background: #f8fafc; padding: 1rem; }",
    ".watermark-preview img { max-width: 100%; max-height: 180px; display: block; }",
    ".full-width { width: 100%; }",
    ".watermark-label { font-weight: 600; color: #334155; word-break: break-word; }",
    ".empty-state { color: #475569; background: #f8fafc; }",
    ".error-message { color: #b91c1c; margin-top: 0.75rem; }",
    ".success-message { color: #047857; margin-top: 0.75rem; }"
  ]
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
        this.successMessage = 'Watermark uploaded successfully.';
        input.value = '';
      },
      error: () => {
        this.errorMessage = 'Unable to upload watermark. Please try again.';
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
      this.errorMessage = 'Watermark name cannot be empty.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.imageService.renameWatermark(watermark.id, label).subscribe({
      next: (updatedWatermark) => {
        this.watermarks = this.watermarks.map((item) => (item.id === updatedWatermark.id ? updatedWatermark : item));
        this.successMessage = 'Watermark renamed successfully.';
        this.cancelEdit();
      },
      error: () => {
        this.errorMessage = 'Unable to rename watermark. Please try again.';
      }
    });
  }

  deleteWatermark(watermark: WatermarkItem) {
    const confirmed = globalThis.confirm(`Delete watermark "${watermark.label}"?`);
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
        this.successMessage = 'Watermark deleted successfully.';
      },
      error: () => {
        this.errorMessage = 'Unable to delete watermark. Please try again.';
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
        this.errorMessage = 'Unable to load watermarks.';
      }
    });
  }
}
