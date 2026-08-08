import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, AfterViewInit, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ImageService, WatermarkItem } from './image.service';
import { AspectRatio, ImageEditMetadata, SaveEditedImageEvent, WatermarkPosition } from './image.types';

type WatermarkOption = { id: number; label: string; src: string };

@Component({
  selector: 'app-image-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <section class="editor-shell">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Image Editor</mat-card-title>
          <mat-card-subtitle>Use crop and watermark controls to prepare the final image.</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <div class="canvas-container">
                <canvas #editorCanvas class="editor-canvas"></canvas>
              </div>

              <div class="editor-controls">
                <div class="control-row">
                  <div>Drag and resize the crop rectangle directly on the image. Use the aspect ratio selector to constrain proportions.</div>
                </div>

            <mat-form-field appearance="fill" class="full-width">
              <mat-label>Aspect ratio</mat-label>
              <mat-select [(ngModel)]="aspectRatio" (selectionChange)="onAspectRatioChange($event.value)">
                <mat-option value="free">Free</mat-option>
                <mat-option value="1:1">1:1</mat-option>
                <mat-option value="16:9">16:9</mat-option>
                <mat-option value="4:3">4:3</mat-option>
              </mat-select>
            </mat-form-field>

            <div class="control-row">
              <mat-form-field appearance="fill" class="full-width">
                <mat-label>Watermark</mat-label>
                <mat-select [(ngModel)]="selectedWatermarkId" (selectionChange)="onWatermarkChange($event.value)">
                  <mat-option [value]="null">No watermark</mat-option>
                  <mat-option *ngFor="let option of watermarkOptions" [value]="option.id">{{ option.label }}</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="fill" class="full-width">
                <mat-label>Watermark position</mat-label>
                <mat-select [(ngModel)]="watermarkPosition" (selectionChange)="drawCanvas()">
                  <mat-option value="top-left">Top left</mat-option>
                  <mat-option value="top-right">Top right</mat-option>
                  <mat-option value="bottom-left">Bottom left</mat-option>
                  <mat-option value="bottom-right">Bottom right</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div class="watermark-upload-row">
              <button mat-stroked-button type="button" (click)="openWatermarkUpload()">Upload watermark</button>
              <input #watermarkFileInput type="file" accept="image/png,image/webp,image/svg+xml,image/jpeg" (change)="onWatermarkFileSelected($event)" hidden />
            </div>

          </div>
        </mat-card-content>

        <mat-card-actions>
          <button mat-flat-button color="primary" (click)="saveFinal()" [disabled]="!loadedImage || saving">Save final image</button>
          <button mat-button type="button" (click)="resetCrop()" [disabled]="!loadedImage || saving">Reset crop</button>
        </mat-card-actions>

        <mat-card-footer>
          <p *ngIf="errorMessage" class="error-message">{{ errorMessage }}</p>
          <p *ngIf="successMessage" class="success-message">{{ successMessage }}</p>
        </mat-card-footer>
      </mat-card>
    </section>
  `,
  styles: [
    ".editor-shell { padding: 1rem 0; }",
    ".canvas-container { display: flex; justify-content: center; margin-bottom: 1rem; }",
    ".editor-canvas { max-width: 100%; width: 100%; border: 1px solid #d1d5db; border-radius: 0.75rem; background: white; touch-action: none; }",
    ".editor-controls { display: grid; gap: 1rem; }",
    ".control-row { display: grid; gap: 0.75rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }",
    ".control-row label { display: grid; gap: 0.35rem; font-weight: 600; color: #334155; }",
    ".watermark-upload-row { display: flex; justify-content: flex-start; }",
    ".full-width { width: 100%; }",
    ".radio-group { display: grid; gap: 0.5rem; }",
    ".radio-group span { font-weight: 600; color: #334155; }",
    ".error-message { color: #b91c1c; margin: 0; }",
    ".success-message { color: #047857; margin: 0; }"
  ]
})
export class ImageEditorComponent implements OnChanges, OnInit, AfterViewInit, OnDestroy {
  @Input() sourceFile?: File;
  @Input() sourceUrl?: string;
  @Input() initialMetadata?: ImageEditMetadata | null;
  @Output() save = new EventEmitter<SaveEditedImageEvent>();
  @ViewChild('editorCanvas', { static: true }) editorCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('watermarkFileInput', { static: true }) watermarkFileInput!: ElementRef<HTMLInputElement>;

  private imageService = inject(ImageService);
  loadedImage?: HTMLImageElement;
  crop = { x: 0, y: 0, width: 100, height: 100 };
  // aspect ratio: 'free' or ratio string
  aspectRatio: AspectRatio = '1:1';

  // watermark as image asset
  watermarkDisabled = false;
  selectedWatermarkId: number | null = null;
  watermarkPosition: WatermarkPosition = 'bottom-right';
  watermarkProportion = 10;
  watermarkBorder = 25;
  watermarkOptions: WatermarkOption[] = [];
  watermarkImg?: HTMLImageElement;
  errorMessage = '';
  successMessage = '';
  saving = false;

  ngOnInit() {
    this.loadWatermarkOptions();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['sourceFile'] && this.sourceFile) {
      this.loadSourceFile(this.sourceFile);
    }
    if (changes['sourceUrl'] && this.sourceUrl) {
      this.loadSourceUrl(this.sourceUrl);
    }
    if (changes['initialMetadata'] && this.initialMetadata && this.loadedImage) {
      this.applyMetadata(this.initialMetadata);
    }
  }

  private loadSourceFile(file: File) {
    const objectUrl = URL.createObjectURL(file);
    this.loadImage(objectUrl, true);
  }

  private loadSourceUrl(url: string) {
    this.loadImage(url, false);
  }

  private loadImage(source: string, revokeUrl: boolean) {
    this.errorMessage = '';
    this.successMessage = '';
    const image = new Image();
    if (source.startsWith('http://') || source.startsWith('https://')) {
      image.crossOrigin = 'anonymous';
    }

    image.onload = () => {
      this.loadedImage = image;
      this.resetCrop();
      if (this.initialMetadata) {
        this.applyMetadata(this.initialMetadata);
      }
      if (!this.watermarkDisabled) {
        this.loadWatermarkImage();
      }
      this.drawCanvas();
      if (revokeUrl) {
        URL.revokeObjectURL(source);
      }
    };
    image.onerror = () => {
      this.errorMessage = 'Unable to load the image for editing.';
    };
    image.src = source;
  }

  onAspectRatioChange(value: AspectRatio) {
    this.aspectRatio = value;
    this.resetCrop();
    this.drawCanvas();
  }

  onCropWidthChange(value: number | string) {
    const v = Number(value);
    this.crop.width = this.clamp(v, 10, 100);
    this.enforceAspectRatio('width');
    this.drawCanvas();
  }

  onCropHeightChange(value: number | string) {
    const v = Number(value);
    this.crop.height = this.clamp(v, 10, 100);
    this.enforceAspectRatio('height');
    this.drawCanvas();
  }

  private enforceAspectRatio(changed?: 'width' | 'height') {
    if (this.aspectRatio === 'free' || !this.loadedImage) return;

    const ratio = this.getAspectRatioValue();
    if (!ratio) {
      return;
    }

    const imageWidth = this.loadedImage.naturalWidth;
    const imageHeight = this.loadedImage.naturalHeight;
    const maxWidthPx = ((100 - this.crop.x) / 100) * imageWidth;
    const maxHeightPx = ((100 - this.crop.y) / 100) * imageHeight;
    const minWidthPx = (10 / 100) * imageWidth;
    const minHeightPx = (10 / 100) * imageHeight;

    let widthPx = (this.crop.width / 100) * imageWidth;
    let heightPx = (this.crop.height / 100) * imageHeight;

    if (changed === 'height') {
      heightPx = this.clamp(heightPx, minHeightPx, maxHeightPx);
      widthPx = heightPx * ratio;
      if (widthPx > maxWidthPx) {
        widthPx = maxWidthPx;
        heightPx = widthPx / ratio;
      }
    } else {
      widthPx = this.clamp(widthPx, minWidthPx, maxWidthPx);
      heightPx = widthPx / ratio;
      if (heightPx > maxHeightPx) {
        heightPx = maxHeightPx;
        widthPx = heightPx * ratio;
      }
    }

    this.crop.width = this.clamp((widthPx / imageWidth) * 100, 10, 100 - this.crop.x);
    this.crop.height = this.clamp((heightPx / imageHeight) * 100, 10, 100 - this.crop.y);
  }

  onWatermarkChange(watermarkId: number | null) {
    this.selectedWatermarkId = watermarkId;
    if (watermarkId == null) {
      this.watermarkImg = undefined;
      this.drawCanvas();
      return;
    }
    if (!this.watermarkDisabled) {
      this.loadWatermarkImage();
      this.drawCanvas();
    }
  }

  openWatermarkUpload() {
    this.watermarkFileInput.nativeElement.click();
  }

  onWatermarkFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    if (!file) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.imageService.uploadWatermark(file).subscribe({
      next: (watermark) => {
        this.loadWatermarkOptions(watermark);
        this.successMessage = 'Watermark uploaded successfully.';
        input.value = '';
      },
      error: () => {
        this.errorMessage = 'Unable to upload the watermark. Please try again.';
        input.value = '';
      }
    });
  }

  private loadWatermarkOptions(selectWatermark?: WatermarkItem) {
    this.imageService.getWatermarks().subscribe({
      next: (watermarks) => {
        const uploadedOptions = watermarks.map((watermark) => ({
          id: watermark.id,
          label: watermark.label,
          src: watermark.url
        }));
        this.watermarkOptions = uploadedOptions;

        if (selectWatermark) {
          this.selectedWatermarkId = selectWatermark.id;
          this.loadWatermarkImage();
          this.drawCanvas();
          return;
        }

        const selectedOption = this.findWatermarkOptionById(this.selectedWatermarkId);
        if (!selectedOption && this.selectedWatermarkId != null) {
          this.selectedWatermarkId = null;
          this.watermarkImg = undefined;
          this.drawCanvas();
          return;
        }
        this.selectedWatermarkId = selectedOption?.id ?? null;
      },
      error: () => {
        this.watermarkOptions = [];
      }
    });
  }

  private findWatermarkOptionById(id: number | null) {
    return this.watermarkOptions.find((option) => option.id === id);
  }

  private findWatermarkOptionBySrc(src: string) {
    return this.watermarkOptions.find((option) => option.src === src);
  }

  private loadWatermarkImage() {
    if (this.watermarkDisabled) {
      this.watermarkImg = undefined;
      return;
    }
    const watermarkSrc = this.findWatermarkOptionById(this.selectedWatermarkId)?.src;
    if (!watermarkSrc) {
      this.watermarkImg = undefined;
      return;
    }
    const img = new Image();
    if (watermarkSrc.startsWith('http://') || watermarkSrc.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      this.watermarkImg = img;
      this.drawCanvas();
    };
    img.onerror = () => {
      this.watermarkImg = undefined;
    };
    img.src = watermarkSrc;
  }

  resetCrop() {
    this.crop = this.getDefaultCrop();
    this.drawCanvas();
  }

  // Interactive drag/resize for crop rectangle
  private pointerActive = false;
  private pointerMode: 'move' | 'nw' | 'ne' | 'sw' | 'se' | null = null;
  private startPointer = { x: 0, y: 0 };
  private startCrop = { x: 0, y: 0, width: 0, height: 0 };

  ngAfterViewInit(): void {
    const canvas = this.editorCanvas.nativeElement;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onCanvasPointerMove);
    canvas.addEventListener('pointerleave', this.onCanvasPointerLeave);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  ngOnDestroy(): void {
    const canvas = this.editorCanvas.nativeElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onCanvasPointerMove);
    canvas.removeEventListener('pointerleave', this.onCanvasPointerLeave);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
  }

  private onPointerDown = (ev: PointerEvent) => {
    if (!this.loadedImage) return;
    ev.preventDefault();
    const canvas = this.editorCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    this.pointerMode = this.getPointerMode(x, y, canvas);

    if (this.pointerMode) {
      this.pointerActive = true;
      this.startPointer = { x, y };
      this.startCrop = { ...this.crop };
      canvas.style.cursor = this.getCursorForMode(this.pointerMode);
      (ev.target as Element).setPointerCapture(ev.pointerId);
    }
  };

  private onCanvasPointerMove = (ev: PointerEvent) => {
    if (this.pointerActive || !this.loadedImage) {
      return;
    }
    const canvas = this.editorCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const mode = this.getPointerMode(x, y, canvas);
    canvas.style.cursor = this.getCursorForMode(mode);
  };

  private onCanvasPointerLeave = () => {
    if (!this.pointerActive) {
      this.editorCanvas.nativeElement.style.cursor = 'default';
    }
  };

  private onPointerMove = (ev: PointerEvent) => {
    if (!this.pointerActive || !this.loadedImage) return;
    ev.preventDefault();
    const canvas = this.editorCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const dx = x - this.startPointer.x;
    const dy = y - this.startPointer.y;

    const cw = canvas.width;
    const ch = canvas.height;

    const dxPct = (dx / cw) * 100;
    const dyPct = (dy / ch) * 100;

    // operate depending on mode
    if (this.pointerMode === 'move') {
      let nx = this.startCrop.x + dxPct;
      let ny = this.startCrop.y + dyPct;
      nx = this.clamp(nx, 0, 100 - this.startCrop.width);
      ny = this.clamp(ny, 0, 100 - this.startCrop.height);
      this.crop.x = nx;
      this.crop.y = ny;
    } else if (this.pointerMode === 'nw' || this.pointerMode === 'ne' || this.pointerMode === 'sw' || this.pointerMode === 'se') {
      let sx = this.startCrop.x;
      let sy = this.startCrop.y;
      let sw = this.startCrop.width;
      let sh = this.startCrop.height;

      if (this.pointerMode === 'nw') {
        const newX = this.startCrop.x + dxPct;
        const newY = this.startCrop.y + dyPct;
        const newW = sw - dxPct;
        const newH = sh - dyPct;
        this.crop.x = this.clamp(newX, 0, sx + sw - 10);
        this.crop.y = this.clamp(newY, 0, sy + sh - 10);
        this.crop.width = this.clamp(newW, 10, sx + sw - this.crop.x);
        this.crop.height = this.clamp(newH, 10, sy + sh - this.crop.y);
      } else if (this.pointerMode === 'ne') {
        const newY = this.startCrop.y + dyPct;
        const newW = sw + dxPct;
        const newH = sh - dyPct;
        this.crop.y = this.clamp(newY, 0, sy + sh - 10);
        this.crop.width = this.clamp(newW, 10, 100 - sx);
        this.crop.height = this.clamp(newH, 10, sy + sh - this.crop.y);
      } else if (this.pointerMode === 'sw') {
        const newX = this.startCrop.x + dxPct;
        const newW = sw - dxPct;
        const newH = sh + dyPct;
        this.crop.x = this.clamp(newX, 0, sx + sw - 10);
        this.crop.width = this.clamp(newW, 10, sx + sw - this.crop.x);
        this.crop.height = this.clamp(newH, 10, 100 - sy);
      } else if (this.pointerMode === 'se') {
        const newW = sw + dxPct;
        const newH = sh + dyPct;
        this.crop.width = this.clamp(newW, 10, 100 - sx);
        this.crop.height = this.clamp(newH, 10, 100 - sy);
      }

      // enforce aspect ratio if selected
      this.enforceAspectRatio();
    }

    this.drawCanvas();
  };

  private onPointerUp = (ev: PointerEvent) => {
    if (!this.pointerActive) return;
    this.pointerActive = false;
    this.editorCanvas.nativeElement.style.cursor = 'default';
    this.pointerMode = null;
  };

  private applyMetadata(metadata: ImageEditMetadata) {
    if (!metadata) {
      return;
    }
    if (metadata.crop) {
      this.crop = {
        x: this.clamp(metadata.crop.x ?? 0, 0, 100),
        y: this.clamp(metadata.crop.y ?? 0, 0, 100),
        width: this.clamp(metadata.crop.width ?? 100, 10, 100),
        height: this.clamp(metadata.crop.height ?? 100, 10, 100)
      };
    }
    if (metadata.aspectRatio) {
      this.aspectRatio = metadata.aspectRatio;
    } else if (metadata.crop) {
      this.aspectRatio = 'free';
    }
    if (metadata.watermark) {
      if (metadata.watermark.id != null) {
        this.selectedWatermarkId = metadata.watermark.id;
      } else if (typeof metadata.watermark.src === 'string') {
        this.selectedWatermarkId = this.findWatermarkOptionBySrc(metadata.watermark.src)?.id ?? null;
      }
      this.watermarkPosition = metadata.watermark.position ?? this.watermarkPosition;
      this.watermarkProportion = metadata.watermark.proportion ?? this.watermarkProportion;
      this.watermarkBorder = metadata.watermark.border ?? this.watermarkBorder;
      if (!this.watermarkDisabled) this.loadWatermarkImage();
    }
    this.drawCanvas();
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  private getAspectRatioValue() {
    if (this.aspectRatio === '1:1') {
      return 1;
    }
    if (this.aspectRatio === '16:9') {
      return 16 / 9;
    }
    if (this.aspectRatio === '4:3') {
      return 4 / 3;
    }
    return null;
  }

  private getDefaultCrop() {
    if (!this.loadedImage) {
      return { x: 0, y: 0, width: 100, height: 100 };
    }

    const ratio = this.getAspectRatioValue();
    if (!ratio) {
      return { x: 0, y: 0, width: 100, height: 100 };
    }

    const imageWidth = this.loadedImage.naturalWidth;
    const imageHeight = this.loadedImage.naturalHeight;
    const imageRatio = imageWidth / imageHeight;

    let cropWidthPx = imageWidth;
    let cropHeightPx = imageHeight;
    let cropXPx = 0;
    let cropYPx = 0;

    if (imageRatio > ratio) {
      cropHeightPx = imageHeight;
      cropWidthPx = imageHeight * ratio;
      cropXPx = (imageWidth - cropWidthPx) / 2;
    } else {
      cropWidthPx = imageWidth;
      cropHeightPx = imageWidth / ratio;
      cropYPx = (imageHeight - cropHeightPx) / 2;
    }

    return {
      x: (cropXPx / imageWidth) * 100,
      y: (cropYPx / imageHeight) * 100,
      width: (cropWidthPx / imageWidth) * 100,
      height: (cropHeightPx / imageHeight) * 100
    };
  }

  private getHandleSize(canvas: HTMLCanvasElement) {
    return Math.max(10, Math.round(Math.min(canvas.width, canvas.height) * 0.025));
  }

  private getPointerMode(x: number, y: number, canvas: HTMLCanvasElement) {
    const cropX = Math.round((this.crop.x / 100) * canvas.width);
    const cropY = Math.round((this.crop.y / 100) * canvas.height);
    const cropW = Math.round((this.crop.width / 100) * canvas.width);
    const cropH = Math.round((this.crop.height / 100) * canvas.height);
    const handleSize = this.getHandleSize(canvas);
    const inRect = x >= cropX && x <= cropX + cropW && y >= cropY && y <= cropY + cropH;
    const near = (px: number, py: number) => Math.abs(x - px) <= handleSize && Math.abs(y - py) <= handleSize;

    if (near(cropX, cropY)) return 'nw';
    if (near(cropX + cropW, cropY)) return 'ne';
    if (near(cropX, cropY + cropH)) return 'sw';
    if (near(cropX + cropW, cropY + cropH)) return 'se';
    if (inRect) return 'move';
    return null;
  }

  private getCursorForMode(mode: 'move' | 'nw' | 'ne' | 'sw' | 'se' | null) {
    if (mode === 'move') return 'move';
    if (mode === 'nw' || mode === 'se') return 'nwse-resize';
    if (mode === 'ne' || mode === 'sw') return 'nesw-resize';
    return 'default';
  }

  drawCanvas() {
    if (!this.loadedImage) {
      return;
    }

    const canvas = this.editorCanvas.nativeElement;
    const maxWidth = 760;
    const scale = this.loadedImage.naturalWidth > maxWidth ? maxWidth / this.loadedImage.naturalWidth : 1;
    canvas.width = Math.round(this.loadedImage.naturalWidth * scale);
    canvas.height = Math.round(this.loadedImage.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.loadedImage, 0, 0, canvas.width, canvas.height);

    const cropX = Math.round((this.crop.x / 100) * canvas.width);
    const cropY = Math.round((this.crop.y / 100) * canvas.height);
    const cropW = Math.round((this.crop.width / 100) * canvas.width);
    const cropH = Math.round((this.crop.height / 100) * canvas.height);

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, canvas.width, cropY);
    ctx.fillRect(0, cropY, cropX, cropH);
    ctx.fillRect(cropX + cropW, cropY, canvas.width - (cropX + cropW), cropH);
    ctx.fillRect(0, cropY + cropH, canvas.width, canvas.height - (cropY + cropH));
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropX + 1, cropY + 1, cropW - 2, cropH - 2);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(cropX + cropW / 3, cropY);
    ctx.lineTo(cropX + cropW / 3, cropY + cropH);
    ctx.moveTo(cropX + (cropW / 3) * 2, cropY);
    ctx.lineTo(cropX + (cropW / 3) * 2, cropY + cropH);
    ctx.moveTo(cropX, cropY + cropH / 3);
    ctx.lineTo(cropX + cropW, cropY + cropH / 3);
    ctx.moveTo(cropX, cropY + (cropH / 3) * 2);
    ctx.lineTo(cropX + cropW, cropY + (cropH / 3) * 2);
    ctx.stroke();
    ctx.restore();

    const handleSize = this.getHandleSize(canvas);
    const halfHandle = handleSize / 2;
    const handlePoints = [
      { x: cropX, y: cropY },
      { x: cropX + cropW, y: cropY },
      { x: cropX, y: cropY + cropH },
      { x: cropX + cropW, y: cropY + cropH }
    ];

    ctx.save();
    ctx.fillStyle = '#2563eb';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    for (const point of handlePoints) {
      ctx.beginPath();
      ctx.rect(point.x - halfHandle, point.y - halfHandle, handleSize, handleSize);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // Draw watermark preview inside crop area
    if (!this.watermarkDisabled && this.watermarkImg) {
      const placement = this.getWatermarkPlacement(cropW, cropH);
      const x = cropX + placement.x;
      const y = cropY + placement.y;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(this.watermarkImg, x, y, placement.width, placement.height);
      ctx.globalAlpha = 1.0;
    }
  }

  async saveFinal() {
    if (!this.loadedImage) {
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const finalBlob = await this.createFinalBlob();
      this.save.emit({ finalBlob, metadata: this.buildMetadata() });
      this.successMessage = 'Final image is ready to save.';
    } catch (error) {
      this.errorMessage = 'Unable to create the final image. Please try again.';
    } finally {
      this.saving = false;
    }
  }

  private buildMetadata(): ImageEditMetadata {
    return {
      crop: { ...this.crop },
      aspectRatio: this.aspectRatio,
      watermark: {
        id: this.selectedWatermarkId ?? undefined,
        position: this.watermarkPosition,
        proportion: this.watermarkProportion,
        border: this.watermarkBorder
      }
    };
  }

  private createFinalBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.loadedImage) {
        return reject(new Error('No image loaded'));
      }

      const crop = this.computeCropBounds();
      const canvas = document.createElement('canvas');
      canvas.width = crop.width;
      canvas.height = crop.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Canvas context unavailable'));
      }

      ctx.drawImage(
        this.loadedImage,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
      );

      this.drawWatermark(ctx, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Blob generation failed'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg', 0.92);
    });
  }

  private computeCropBounds() {
    if (!this.loadedImage) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    const width = Math.round((this.crop.width / 100) * this.loadedImage.naturalWidth);
    const height = Math.round((this.crop.height / 100) * this.loadedImage.naturalHeight);
    const x = Math.round((this.crop.x / 100) * this.loadedImage.naturalWidth);
    const y = Math.round((this.crop.y / 100) * this.loadedImage.naturalHeight);
    return {
      x: Math.min(Math.max(x, 0), this.loadedImage.naturalWidth - width),
      y: Math.min(Math.max(y, 0), this.loadedImage.naturalHeight - height),
      width: Math.min(width, this.loadedImage.naturalWidth),
      height: Math.min(height, this.loadedImage.naturalHeight)
    };
  }

  private drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
    if (!this.watermarkImg) return;
    const placement = this.getWatermarkPlacement(width, height);

    ctx.globalAlpha = 0.85;
    ctx.drawImage(this.watermarkImg, placement.x, placement.y, placement.width, placement.height);
    ctx.globalAlpha = 1.0;
  }

  private getWatermarkPlacement(width: number, height: number) {
    if (!this.watermarkImg) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const resized = this.getResizedWatermarkDimensions(width, height);
    const border = (resized.height * this.watermarkBorder) / 100;
    const horizontalPosition = this.getHorizontalPositionRelative();
    const verticalPosition = this.getVerticalPositionRelative();

    const x = this.calcWatermarkPosition(border, width, resized.width, horizontalPosition);
    const y = this.calcWatermarkPosition(border, height, resized.height, verticalPosition);

    return { x, y, width: resized.width, height: resized.height };
  }

  private getResizedWatermarkDimensions(imageWidth: number, imageHeight: number) {
    if (!this.watermarkImg) {
      return { width: 0, height: 0 };
    }

    const imageArea = imageWidth * imageHeight;
    const watermarkArea = this.watermarkImg.naturalWidth * this.watermarkImg.naturalHeight;
    const targetArea = imageArea * (this.watermarkProportion / 100);

    return {
      width: this.calculateResizedLength(this.watermarkImg.naturalWidth, watermarkArea, targetArea),
      height: this.calculateResizedLength(this.watermarkImg.naturalHeight, watermarkArea, targetArea)
    };
  }

  private calculateResizedLength(actualLength: number, actualArea: number, targetArea: number) {
    return Math.round(actualLength * Math.sqrt(targetArea / actualArea));
  }

  private calcWatermarkPosition(border: number, originalLength: number, watermarkLength: number, relativePosition: number) {
    const minPosition = border;
    const maxPosition = originalLength - (border + watermarkLength);
    return Math.round(minPosition + (maxPosition - minPosition) * relativePosition);
  }

  private getHorizontalPositionRelative() {
    if (this.watermarkPosition === 'top-right' || this.watermarkPosition === 'bottom-right') {
      return 1;
    }
    return 0;
  }

  private getVerticalPositionRelative() {
    if (this.watermarkPosition === 'bottom-left' || this.watermarkPosition === 'bottom-right') {
      return 1;
    }
    return 0;
  }
}
