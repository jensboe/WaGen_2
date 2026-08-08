import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { ImageEditMetadata, ImageResponse, WatermarkResponse } from '@shared/image.types';

export type ImageItem = ImageResponse;
export type WatermarkItem = WatermarkResponse;

const API_BASE = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class ImageService {
  private http = inject(HttpClient);

  getImages(): Observable<ImageResponse[]> {
    return this.http.get<ImageResponse[]>(`${API_BASE}/images`);
  }

  getImage(id: number): Observable<ImageResponse> {
    return this.http.get<ImageResponse>(`${API_BASE}/images/${id}`);
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

  getWatermarks(): Observable<WatermarkResponse[]> {
    return this.http.get<WatermarkResponse[]>(`${API_BASE}/watermarks`);
  }

  uploadWatermark(file: File): Observable<WatermarkResponse> {
    const form = new FormData();
    form.append('watermark', file);
    return this.http.post<WatermarkResponse>(`${API_BASE}/watermarks`, form);
  }

  renameWatermark(id: number, label: string): Observable<WatermarkResponse> {
    return this.http.patch<WatermarkResponse>(`${API_BASE}/watermarks/${id}`, { label });
  }

  deleteWatermark(id: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/watermarks/${id}`);
  }
}
