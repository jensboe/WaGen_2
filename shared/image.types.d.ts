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

export type RedactionTool = 'rectangle' | 'brush';

export interface RedactionPoint {
  x: number;
  y: number;
}

export interface RectangleRedaction {
  id: string;
  tool: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  blur: number;
}

export interface BrushRedaction {
  id: string;
  tool: 'brush';
  size: number;
  blur: number;
  points: RedactionPoint[];
}

export type Redaction = RectangleRedaction | BrushRedaction;

export interface ImageEditMetadata {
  crop?: CropMetadata;
  aspectRatio?: AspectRatio;
  redactions?: Redaction[];
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
