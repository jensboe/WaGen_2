export type AspectRatio = 'free' | '1:1' | '16:9' | '4:3';

export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface CropMetadata {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface WatermarkMetadata {
  id?: number;
  src?: string;
  position?: WatermarkPosition;
  proportion?: number;
  border?: number;
}

export interface ImageEditMetadata {
  crop?: CropMetadata;
  aspectRatio?: AspectRatio;
  watermark?: WatermarkMetadata;
}

export interface WatermarkResponse {
  id: number;
  label: string;
  createdAt: Date | string;
  url: string;
}

export interface ImageResponse {
  id: number;
  metadata: ImageEditMetadata | null;
  createdAt: Date | string;
  originalUrl: string | null;
  finalUrl: string | null;
}

export interface SaveEditedImageEvent {
  finalBlob: Blob;
  metadata: ImageEditMetadata;
}
