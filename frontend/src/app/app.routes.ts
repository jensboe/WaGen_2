import { Routes } from '@angular/router';
import { ImageListComponent } from './image-list.component';
import { ImageUploadEditComponent } from './image-upload-edit.component';
import { ImageEditExistingComponent } from './image-edit-existing.component';

export const routes: Routes = [
  { path: '', redirectTo: 'images', pathMatch: 'full' },
  { path: 'images', component: ImageListComponent },
  { path: 'images/new', component: ImageUploadEditComponent },
  { path: 'upload', component: ImageUploadEditComponent },
  { path: 'images/:id/edit', component: ImageEditExistingComponent },
  { path: '**', redirectTo: 'images' }
];
