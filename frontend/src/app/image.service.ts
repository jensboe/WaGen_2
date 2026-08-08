import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ImageItem {
  id: number;
  title?: string;
  description?: string;
  originalUrl?: string | null;
  finalUrl?: string | null;
  metadata?: any;
  createdAt: string;
}

const API_BASE = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class ImageService {
  private http = inject(HttpClient);

  getImages(): Observable<ImageItem[]> {
    return this.http.get<ImageItem[]>(`${API_BASE}/images`);
  }

  getImage(id: number): Observable<ImageItem> {
    return this.http.get<ImageItem>(`${API_BASE}/images/${id}`);
  }

  uploadImage(file: File, title: string, description: string): Observable<{ id: number; originalUrl: string }> {
    const form = new FormData();
    form.append('image', file);
    form.append('title', title);
    form.append('description', description);
    return this.http.post<{ id: number; originalUrl: string }>(`${API_BASE}/upload-original`, form);
  }
}
