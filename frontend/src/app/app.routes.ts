import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'images', pathMatch: 'full' },
  { path: 'images', loadComponent: () => import('./image-list.component').then((m) => m.ImageListComponent) },
  { path: 'images/new', loadComponent: () => import('./image-upload-edit.component').then((m) => m.ImageUploadEditComponent) },
  { path: 'upload', loadComponent: () => import('./image-upload-edit.component').then((m) => m.ImageUploadEditComponent) },
  { path: 'watermarks', loadComponent: () => import('./watermark-upload.component').then((m) => m.WatermarkUploadComponent) },
  { path: 'images/:id/edit', loadComponent: () => import('./image-edit-existing.component').then((m) => m.ImageEditExistingComponent) },
  { path: '**', redirectTo: 'images' }
];
