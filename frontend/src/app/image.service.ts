import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ImageEditMetadata } from './image.types';

export interface ImageItem {
  id: number;
  originalUrl?: string | null;
  finalUrl?: string | null;
  metadata?: ImageEditMetadata | null;
  createdAt: string;
}

export interface WatermarkItem {
  id: number;
  label: string;
  url: string;
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

  uploadImage(file: File): Observable<{ id: number; originalUrl: string }> {
    const form = new FormData();
    form.append('image', file);
    return this.http.post<{ id: number; originalUrl: string }>(`${API_BASE}/upload-original`, form);
  }

  saveFinalImage(imageId: number, finalFile: File, metadata: ImageEditMetadata): Observable<{ id: number }> {
    const form = new FormData();
    form.append('id', imageId.toString());
    form.append('final', finalFile);
    form.append('metadata', JSON.stringify(metadata));
    return this.http.post<{ id: number }>(`${API_BASE}/save-final`, form);
  }

  getWatermarks(): Observable<WatermarkItem[]> {
    return this.http.get<WatermarkItem[]>(`${API_BASE}/watermarks`);
  }

  uploadWatermark(file: File): Observable<WatermarkItem> {
    const form = new FormData();
    form.append('watermark', file);
    return this.http.post<WatermarkItem>(`${API_BASE}/watermarks`, form);
  }

  renameWatermark(id: number, label: string): Observable<WatermarkItem> {
    return this.http.patch<WatermarkItem>(`${API_BASE}/watermarks/${id}`, { label });
  }

  deleteWatermark(id: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/watermarks/${id}`);
  }
}
