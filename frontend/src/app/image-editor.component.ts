import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { ImageService, WatermarkItem } from './image.service';
import type {
  AspectRatio,
  BrushRedaction,
  ImageEditMetadata,
  RectangleRedaction,
  Redaction,
  RedactionPoint,
  RedactionTool,
  SaveEditedImageEvent,
  WatermarkPosition
} from '@shared/image.types';

type EditorStep = 'crop' | 'redact';
type CropPointerMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | null;
type RectangleResizeHandle = 'nw' | 'ne' | 'sw' | 'se';
type RedactionPointerMode = 'rectangle-create' | 'rectangle-move' | 'rectangle-rotate' | `rectangle-resize-${RectangleResizeHandle}` | 'brush-draw' | null;
type WatermarkOption = { id: number; label: string; src: string };
type PreviewMetrics = { scale: number; width: number; height: number };
type CropBounds = { x: number; y: number; width: number; height: number };

@Component({
  selector: 'app-image-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSliderModule],
  template: `
    <section class="editor-shell">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Image Editor</mat-card-title>
          <mat-card-subtitle>Crop first, then blur sensitive areas, then place the watermark.</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <div class="step-row">
            <button mat-stroked-button type="button" [color]="currentStep === 'crop' ? 'primary' : undefined" (click)="setCurrentStep('crop')">1. Crop</button>
            <button mat-stroked-button type="button" [color]="currentStep === 'redact' ? 'primary' : undefined" (click)="setCurrentStep('redact')" [disabled]="!loadedImage">2. Blur areas</button>
          </div>

          <div class="canvas-container">
            <canvas #editorCanvas class="editor-canvas"></canvas>
          </div>

          <div class="editor-controls" *ngIf="currentStep === 'crop'">
            <div class="control-hint">Drag and resize the crop rectangle directly on the image. The redaction step will use only the cropped image.</div>

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

          </div>

          <div class="editor-controls" *ngIf="currentStep === 'redact'">
            <div class="control-hint">Only the cropped image is shown here. Add blur with a movable rectangle or paint it with the brush.</div>

            <div class="tool-row">
              <button mat-stroked-button type="button" [color]="redactionTool === 'rectangle' ? 'primary' : undefined" (click)="setRedactionTool('rectangle')">Rectangle</button>
              <button mat-stroked-button type="button" [color]="redactionTool === 'brush' ? 'primary' : undefined" (click)="setRedactionTool('brush')">Brush</button>
              <button mat-button type="button" (click)="removeSelectedRectangle()" [disabled]="!selectedRectangle">Remove rectangle</button>
              <button mat-button type="button" (click)="undoLastBrushStroke()" [disabled]="!hasBrushRedaction()">Undo brush</button>
              <button mat-button type="button" (click)="clearRedactions()" [disabled]="redactions.length === 0">Clear all</button>
            </div>

            <div class="control-hint" *ngIf="redactionTool === 'rectangle'">Draw the rectangle by dragging. Resize it with the corner handles and rotate it with the round handle above the rectangle.</div>

            <div class="control-row" *ngIf="redactionTool === 'brush'">
              <div class="slider-field">
                <label for="brush-size-slider">Brush size: {{ brushSize }}</label>
                <mat-slider min="4" max="160" step="1" discrete class="full-width">
                  <input
                    id="brush-size-slider"
                    matSliderThumb
                    [ngModel]="brushSize"
                    (ngModelChange)="onBrushSizeChange($event)" />
                </mat-slider>
              </div>
            </div>
          </div>

        </mat-card-content>

        <mat-card-actions>
          <button mat-flat-button color="primary" (click)="saveFinal()" [disabled]="!loadedImage || saving">Save image</button>
          <button *ngIf="currentStep === 'crop'" mat-button type="button" (click)="resetCrop()" [disabled]="!loadedImage || saving">Reset crop</button>
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
    ".step-row { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; }",
    ".canvas-container { display: flex; justify-content: center; margin-bottom: 1rem; }",
    ".editor-canvas { max-width: 100%; width: 100%; border: 1px solid #d1d5db; border-radius: 0.75rem; background: white; touch-action: none; }",
    ".editor-controls { display: grid; gap: 1rem; }",
    ".control-row { display: grid; gap: 0.75rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }",
    ".tool-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }",
    ".control-hint { color: #475569; }",
    ".slider-field { display: grid; gap: 0.35rem; align-items: center; }",
    ".slider-field label { font-weight: 600; color: #334155; }",
    ".full-width { width: 100%; }",
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

  private imageService = inject(ImageService);
  loadedImage?: HTMLImageElement;
  crop = { x: 0, y: 0, width: 100, height: 100 };
  aspectRatio: AspectRatio = '1:1';
  currentStep: EditorStep = 'crop';

  selectedWatermarkId: number | null = null;
  watermarkPosition: WatermarkPosition = 'bottom-right';
  watermarkProportion = 10;
  watermarkBorder = 25;
  watermarkOptions: WatermarkOption[] = [];
  watermarkImg?: HTMLImageElement;

  redactions: Redaction[] = [];
  redactionTool: RedactionTool = 'rectangle';
  selectedRedactionId: string | null = null;
  brushSize = 28;

  errorMessage = '';
  successMessage = '';
  saving = false;

  private cropPointerActive = false;
  private cropPointerMode: CropPointerMode = null;
  private cropStartPointer = { x: 0, y: 0 };
  private cropStartRect = { x: 0, y: 0, width: 0, height: 0 };

  private redactionPointerActive = false;
  private redactionPointerMode: RedactionPointerMode = null;
  private redactionStartPoint: RedactionPoint = { x: 0, y: 0 };
  private redactionStartRectangle?: RectangleRedaction;
  private redactionStartAngle = 0;
  private activeBrushStroke?: BrushRedaction;
  private readonly defaultRectangleBlur = 18;
  private readonly defaultBrushBlur = 18;

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

  get selectedRectangle() {
    const redaction = this.redactions.find((item) => item.id === this.selectedRedactionId);
    return redaction?.tool === 'rectangle' ? redaction : null;
  }

  setCurrentStep(step: EditorStep) {
    this.currentStep = step;
    this.drawCanvas();
  }

  setRedactionTool(tool: RedactionTool) {
    this.redactionTool = tool;
    this.drawCanvas();
  }

  onAspectRatioChange(value: AspectRatio) {
    this.clearRedactionsForCropChange();
    this.aspectRatio = value;
    this.resetCrop();
  }

  onBrushSizeChange(value: number | string) {
    this.brushSize = this.clampNumber(value, 4, 160, this.brushSize);
  }

  onWatermarkChange(watermarkId: number | null) {
    this.selectedWatermarkId = watermarkId;
    if (watermarkId == null) {
      this.watermarkImg = undefined;
      this.drawCanvas();
      return;
    }

    this.loadWatermarkImage();
    this.drawCanvas();
  }

  removeSelectedRectangle() {
    if (!this.selectedRectangle) {
      return;
    }

    this.redactions = this.redactions.filter((redaction) => redaction.id !== this.selectedRedactionId);
    this.selectedRedactionId = null;
    this.drawCanvas();
  }

  undoLastBrushStroke() {
    const index = [...this.redactions].reverse().findIndex((redaction) => redaction.tool === 'brush');
    if (index === -1) {
      return;
    }

    const actualIndex = this.redactions.length - 1 - index;
    this.redactions = this.redactions.filter((_redaction, redactionIndex) => redactionIndex !== actualIndex);
    this.drawCanvas();
  }

  hasBrushRedaction() {
    return this.redactions.some((redaction) => redaction.tool === 'brush');
  }

  clearRedactions() {
    this.redactions = [];
    this.selectedRedactionId = null;
    this.activeBrushStroke = undefined;
    this.drawCanvas();
  }

  resetCrop() {
    this.clearRedactionsForCropChange(false);
    this.crop = this.getDefaultCrop();
    this.drawCanvas();
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
    } catch {
      this.errorMessage = 'Unable to create the final image. Please try again.';
    } finally {
      this.saving = false;
    }
  }

  drawCanvas() {
    if (!this.loadedImage) {
      return;
    }

    if (this.currentStep === 'crop') {
      this.drawCropCanvas();
      return;
    }

    this.drawCroppedCanvas(true);
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
      this.crop = this.getDefaultCrop();
      this.redactions = [];
      this.selectedRedactionId = null;
      if (this.initialMetadata) {
        this.applyMetadata(this.initialMetadata);
      }
      this.loadWatermarkImage();
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

  private loadWatermarkOptions(selectWatermark?: WatermarkItem) {
    this.imageService.getWatermarks().subscribe({
      next: (watermarks) => {
        this.watermarkOptions = watermarks.map((watermark) => ({
          id: watermark.id,
          label: watermark.label,
          src: watermark.url
        }));

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
    const watermarkSrc = this.findWatermarkOptionById(this.selectedWatermarkId)?.src;
    if (!watermarkSrc) {
      this.watermarkImg = undefined;
      return;
    }

    const image = new Image();
    if (watermarkSrc.startsWith('http://') || watermarkSrc.startsWith('https://')) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => {
      this.watermarkImg = image;
      this.drawCanvas();
    };
    image.onerror = () => {
      this.watermarkImg = undefined;
    };
    image.src = watermarkSrc;
  }

  private onPointerDown = (event: PointerEvent) => {
    if (!this.loadedImage) {
      return;
    }

    event.preventDefault();
    if (this.currentStep === 'crop') {
      this.startCropInteraction(event);
      return;
    }

    if (this.currentStep === 'redact') {
      this.startRedactionInteraction(event);
    }
  };

  private onCanvasPointerMove = (event: PointerEvent) => {
    if (!this.loadedImage) {
      return;
    }

    const canvas = this.editorCanvas.nativeElement;
    if (this.currentStep === 'crop') {
      if (this.cropPointerActive) {
        return;
      }

      const { canvasX, canvasY } = this.getCanvasCoordinates(event, canvas);
      const mode = this.getCropPointerMode(canvasX, canvasY, canvas);
      canvas.style.cursor = this.getCropCursor(mode);
      return;
    }

    if (this.currentStep === 'redact' && !this.redactionPointerActive) {
      const point = this.getCropCanvasPoint(event);
      if (!point) {
        return;
      }

      if (this.redactionTool === 'rectangle') {
        const handle = this.getRectangleResizeHandleAtPoint(point);
        if (handle) {
          canvas.style.cursor = this.getRectangleResizeCursor(handle);
          return;
        }

        if (this.getRectangleRotationHandleAtPoint(point)) {
          canvas.style.cursor = 'grab';
          return;
        }

        if (this.findRectangleAtPoint(point)) {
          canvas.style.cursor = 'move';
          return;
        }

        canvas.style.cursor = 'crosshair';
      } else if (this.redactionTool === 'brush') {
        canvas.style.cursor = 'crosshair';
      } else {
        canvas.style.cursor = 'default';
      }
    }
  };

  private onCanvasPointerLeave = () => {
    if (!this.cropPointerActive && !this.redactionPointerActive) {
      this.editorCanvas.nativeElement.style.cursor = 'default';
    }
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.loadedImage) {
      return;
    }

    if (this.currentStep === 'crop' && this.cropPointerActive) {
      this.updateCropInteraction(event);
      return;
    }

    if (this.currentStep === 'redact' && this.redactionPointerActive) {
      this.updateRedactionInteraction(event);
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.cropPointerActive) {
      this.cropPointerActive = false;
      this.cropPointerMode = null;
      this.editorCanvas.nativeElement.style.cursor = 'default';
    }

    if (!this.redactionPointerActive) {
      return;
    }

    if (this.redactionPointerMode === 'brush-draw' && this.activeBrushStroke) {
      if (this.activeBrushStroke.points.length > 0) {
        this.redactions = [...this.redactions, this.activeBrushStroke];
      }
      this.activeBrushStroke = undefined;
    }

    if (this.redactionPointerMode === 'rectangle-create' && this.selectedRectangle) {
      if (this.selectedRectangle.width < 4 || this.selectedRectangle.height < 4) {
        this.redactions = this.redactions.filter((redaction) => redaction.id !== this.selectedRectangle?.id);
        this.selectedRedactionId = null;
      }
    }

    this.redactionPointerActive = false;
    this.redactionPointerMode = null;
    this.redactionStartRectangle = undefined;
    this.editorCanvas.nativeElement.style.cursor = 'default';
    try {
      (event.target as Element | null)?.releasePointerCapture?.(event.pointerId);
    } catch {
      // ignore
    }
    this.drawCanvas();
  };

  private startCropInteraction(event: PointerEvent) {
    const canvas = this.editorCanvas.nativeElement;
    const { canvasX, canvasY } = this.getCanvasCoordinates(event, canvas);
    const mode = this.getCropPointerMode(canvasX, canvasY, canvas);
    if (!mode) {
      return;
    }

    if (this.redactions.length > 0) {
      this.clearRedactionsForCropChange();
    }

    this.cropPointerActive = true;
    this.cropPointerMode = mode;
    this.cropStartPointer = { x: canvasX, y: canvasY };
    this.cropStartRect = { ...this.crop };
    canvas.style.cursor = this.getCropCursor(mode);
    (event.target as Element).setPointerCapture(event.pointerId);
  }

  private updateCropInteraction(event: PointerEvent) {
    if (!this.cropPointerMode) {
      return;
    }

    event.preventDefault();
    const canvas = this.editorCanvas.nativeElement;
    const { canvasX, canvasY } = this.getCanvasCoordinates(event, canvas);
    const dx = canvasX - this.cropStartPointer.x;
    const dy = canvasY - this.cropStartPointer.y;
    const dxPct = (dx / canvas.width) * 100;
    const dyPct = (dy / canvas.height) * 100;

    if (this.cropPointerMode === 'move') {
      let nextX = this.cropStartRect.x + dxPct;
      let nextY = this.cropStartRect.y + dyPct;
      nextX = this.clamp(nextX, 0, 100 - this.cropStartRect.width);
      nextY = this.clamp(nextY, 0, 100 - this.cropStartRect.height);
      this.crop.x = nextX;
      this.crop.y = nextY;
    } else {
      const startX = this.cropStartRect.x;
      const startY = this.cropStartRect.y;
      const startWidth = this.cropStartRect.width;
      const startHeight = this.cropStartRect.height;

      if (this.cropPointerMode === 'nw') {
        const nextX = this.clamp(startX + dxPct, 0, startX + startWidth - 10);
        const nextY = this.clamp(startY + dyPct, 0, startY + startHeight - 10);
        this.crop.x = nextX;
        this.crop.y = nextY;
        this.crop.width = this.clamp(startWidth - dxPct, 10, startX + startWidth - nextX);
        this.crop.height = this.clamp(startHeight - dyPct, 10, startY + startHeight - nextY);
      } else if (this.cropPointerMode === 'ne') {
        const nextY = this.clamp(startY + dyPct, 0, startY + startHeight - 10);
        this.crop.y = nextY;
        this.crop.width = this.clamp(startWidth + dxPct, 10, 100 - startX);
        this.crop.height = this.clamp(startHeight - dyPct, 10, startY + startHeight - nextY);
      } else if (this.cropPointerMode === 'sw') {
        const nextX = this.clamp(startX + dxPct, 0, startX + startWidth - 10);
        this.crop.x = nextX;
        this.crop.width = this.clamp(startWidth - dxPct, 10, startX + startWidth - nextX);
        this.crop.height = this.clamp(startHeight + dyPct, 10, 100 - startY);
      } else if (this.cropPointerMode === 'se') {
        this.crop.width = this.clamp(startWidth + dxPct, 10, 100 - startX);
        this.crop.height = this.clamp(startHeight + dyPct, 10, 100 - startY);
      }

      this.enforceAspectRatio();
    }

    this.drawCanvas();
  }

  private startRedactionInteraction(event: PointerEvent) {
    const point = this.getCropCanvasPoint(event);
    if (!point) {
      return;
    }

    if (this.redactionTool === 'brush') {
      this.redactionPointerActive = true;
      this.redactionPointerMode = 'brush-draw';
      this.activeBrushStroke = {
        id: this.createRedactionId('brush'),
        tool: 'brush',
        size: this.brushSize,
        blur: this.defaultBrushBlur,
        points: [point]
      };
      this.editorCanvas.nativeElement.style.cursor = 'crosshair';
      (event.target as Element).setPointerCapture(event.pointerId);
      this.drawCanvas();
      return;
    }

    const resizeHandle = this.getRectangleResizeHandleAtPoint(point);
    if (resizeHandle && this.selectedRectangle) {
      this.redactionPointerActive = true;
      this.redactionPointerMode = `rectangle-resize-${resizeHandle}`;
      this.redactionStartPoint = point;
      this.redactionStartRectangle = { ...this.selectedRectangle };
      this.editorCanvas.nativeElement.style.cursor = this.getRectangleResizeCursor(resizeHandle);
      (event.target as Element).setPointerCapture(event.pointerId);
      return;
    }

    if (this.getRectangleRotationHandleAtPoint(point) && this.selectedRectangle) {
      this.redactionPointerActive = true;
      this.redactionPointerMode = 'rectangle-rotate';
      this.redactionStartRectangle = { ...this.selectedRectangle };
      this.redactionStartAngle = this.getAngleFromRectangleCenter(point, this.selectedRectangle);
      this.editorCanvas.nativeElement.style.cursor = 'grabbing';
      (event.target as Element).setPointerCapture(event.pointerId);
      return;
    }

    const existingRectangle = this.findRectangleAtPoint(point);
    if (existingRectangle) {
      this.selectedRedactionId = existingRectangle.id;
      this.redactionPointerActive = true;
      this.redactionPointerMode = 'rectangle-move';
      this.redactionStartPoint = point;
      this.redactionStartRectangle = { ...existingRectangle };
      this.editorCanvas.nativeElement.style.cursor = 'move';
      (event.target as Element).setPointerCapture(event.pointerId);
      this.drawCanvas();
      return;
    }

    const rectangle = this.createRectangleRedaction(point, point);
    this.redactions = [...this.redactions, rectangle];
    this.selectedRedactionId = rectangle.id;
    this.redactionPointerActive = true;
    this.redactionPointerMode = 'rectangle-create';
    this.redactionStartPoint = point;
    this.redactionStartRectangle = { ...rectangle };
    this.editorCanvas.nativeElement.style.cursor = 'crosshair';
    (event.target as Element).setPointerCapture(event.pointerId);
    this.drawCanvas();
  }

  private updateRedactionInteraction(event: PointerEvent) {
    const point = this.getCropCanvasPoint(event);
    if (!point) {
      return;
    }

    if (this.redactionPointerMode === 'brush-draw' && this.activeBrushStroke) {
      const lastPoint = this.activeBrushStroke.points[this.activeBrushStroke.points.length - 1];
      if (this.getDistance(lastPoint, point) >= 1) {
        this.activeBrushStroke = {
          ...this.activeBrushStroke,
          points: [...this.activeBrushStroke.points, point]
        };
        this.drawCanvas();
      }
      return;
    }

    if (this.redactionPointerMode === 'rectangle-create' && this.selectedRectangle) {
      const nextRectangle = this.createRectangleRedaction(this.redactionStartPoint, point, this.selectedRectangle.id);
      this.replaceRedaction(this.selectedRectangle.id, nextRectangle);
      this.drawCanvas();
      return;
    }

    if (this.redactionPointerMode === 'rectangle-move' && this.redactionStartRectangle && this.selectedRectangle) {
      const deltaX = point.x - this.redactionStartPoint.x;
      const deltaY = point.y - this.redactionStartPoint.y;
      const nextX = this.redactionStartRectangle.x + deltaX;
      const nextY = this.redactionStartRectangle.y + deltaY;
      this.replaceRedaction(this.selectedRectangle.id, {
        ...this.selectedRectangle,
        x: nextX,
        y: nextY
      });
      this.drawCanvas();
      return;
    }

    if (this.redactionPointerMode === 'rectangle-rotate' && this.redactionStartRectangle && this.selectedRectangle) {
      const angle = this.getAngleFromRectangleCenter(point, this.redactionStartRectangle);
      this.replaceRedaction(this.selectedRectangle.id, {
        ...this.selectedRectangle,
        rotation: this.normalizeRotation(this.redactionStartRectangle.rotation + angle - this.redactionStartAngle)
      });
      this.drawCanvas();
      return;
    }

    if (this.isRectangleResizeMode(this.redactionPointerMode) && this.redactionStartRectangle && this.selectedRectangle) {
      const nextRectangle = this.resizeRectangleFromHandle(this.redactionStartRectangle, point, this.getResizeHandleFromMode(this.redactionPointerMode));
      this.replaceRedaction(this.selectedRectangle.id, nextRectangle);
      this.drawCanvas();
    }
  }

  private applyMetadata(metadata: ImageEditMetadata) {
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

    this.redactions = (metadata.redactions ?? []).map((redaction) =>
      redaction.tool === 'brush'
        ? {
            ...redaction,
            points: [...redaction.points]
          }
        : { ...redaction }
    );
    this.selectedRedactionId = null;

    if (metadata.watermark) {
      if (metadata.watermark.id != null) {
        this.selectedWatermarkId = metadata.watermark.id;
      } else if (typeof metadata.watermark.src === 'string') {
        this.selectedWatermarkId = this.findWatermarkOptionBySrc(metadata.watermark.src)?.id ?? null;
      }
      this.watermarkPosition = metadata.watermark.position ?? this.watermarkPosition;
      this.watermarkProportion = metadata.watermark.proportion ?? this.watermarkProportion;
      this.watermarkBorder = metadata.watermark.border ?? this.watermarkBorder;
    }

    this.drawCanvas();
  }

  private buildMetadata(): ImageEditMetadata {
    return {
      crop: { ...this.crop },
      aspectRatio: this.aspectRatio,
      redactions: this.redactions.map((redaction) =>
        redaction.tool === 'brush'
          ? {
              ...redaction,
              points: redaction.points.map((point) => ({ ...point }))
            }
          : { ...redaction }
      ),
      watermark: {
        id: this.selectedWatermarkId ?? undefined,
        position: this.watermarkPosition,
        proportion: this.watermarkProportion,
        border: this.watermarkBorder
      }
    };
  }

  private drawCropCanvas() {
    if (!this.loadedImage) {
      return;
    }

    const canvas = this.editorCanvas.nativeElement;
    const metrics = this.getFullImagePreviewMetrics();
    canvas.width = metrics.width;
    canvas.height = metrics.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(this.loadedImage, 0, 0, canvas.width, canvas.height);

    const cropX = Math.round((this.crop.x / 100) * canvas.width);
    const cropY = Math.round((this.crop.y / 100) * canvas.height);
    const cropW = Math.round((this.crop.width / 100) * canvas.width);
    const cropH = Math.round((this.crop.height / 100) * canvas.height);

    context.save();
    context.fillStyle = 'rgba(0, 0, 0, 0.35)';
    context.fillRect(0, 0, canvas.width, cropY);
    context.fillRect(0, cropY, cropX, cropH);
    context.fillRect(cropX + cropW, cropY, canvas.width - (cropX + cropW), cropH);
    context.fillRect(0, cropY + cropH, canvas.width, canvas.height - (cropY + cropH));
    context.restore();

    context.save();
    context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    context.lineWidth = 2;
    context.strokeRect(cropX + 1, cropY + 1, cropW - 2, cropH - 2);
    context.restore();

    context.save();
    context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    context.setLineDash([6, 6]);
    context.beginPath();
    context.moveTo(cropX + cropW / 3, cropY);
    context.lineTo(cropX + cropW / 3, cropY + cropH);
    context.moveTo(cropX + (cropW / 3) * 2, cropY);
    context.lineTo(cropX + (cropW / 3) * 2, cropY + cropH);
    context.moveTo(cropX, cropY + cropH / 3);
    context.lineTo(cropX + cropW, cropY + cropH / 3);
    context.moveTo(cropX, cropY + (cropH / 3) * 2);
    context.lineTo(cropX + cropW, cropY + (cropH / 3) * 2);
    context.stroke();
    context.restore();

    const handleSize = this.getHandleSize(canvas);
    const halfHandle = handleSize / 2;
    for (const point of [
      { x: cropX, y: cropY },
      { x: cropX + cropW, y: cropY },
      { x: cropX, y: cropY + cropH },
      { x: cropX + cropW, y: cropY + cropH }
    ]) {
      context.beginPath();
      context.rect(point.x - halfHandle, point.y - halfHandle, handleSize, handleSize);
      context.fillStyle = '#2563eb';
      context.strokeStyle = 'white';
      context.lineWidth = 2;
      context.fill();
      context.stroke();
    }

    if (this.watermarkImg) {
      const placement = this.getWatermarkPlacement(cropW, cropH, metrics.scale);
      context.globalAlpha = 0.85;
      context.drawImage(this.watermarkImg, cropX + placement.x, cropY + placement.y, placement.width, placement.height);
      context.globalAlpha = 1;
    }
  }

  private drawCroppedCanvas(showWatermark: boolean) {
    if (!this.loadedImage) {
      return;
    }

    const cropBounds = this.computeCropBounds();
    const previewMetrics = this.getCropPreviewMetrics(cropBounds);
    const baseCanvas = this.createCropCanvas(cropBounds, previewMetrics.width, previewMetrics.height);
    const canvas = this.editorCanvas.nativeElement;
    canvas.width = previewMetrics.width;
    canvas.height = previewMetrics.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(baseCanvas, 0, 0);
    this.drawRedactionsOnCanvas(context, baseCanvas, previewMetrics.scale, this.getRenderableRedactions());
    if (showWatermark) {
      this.drawWatermark(context, canvas.width, canvas.height, previewMetrics.scale);
    }
    this.drawRectangleSelectionOverlay(context, previewMetrics.scale);
  }

  private createFinalBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.loadedImage) {
        reject(new Error('No image loaded'));
        return;
      }

      const cropBounds = this.computeCropBounds();
      const canvas = this.createCropCanvas(cropBounds, cropBounds.width, cropBounds.height);
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas context unavailable'));
        return;
      }

      this.drawRedactionsOnCanvas(context, canvas, 1, this.redactions);
      this.drawWatermark(context, canvas.width, canvas.height, 1);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Blob generation failed'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg', 0.92);
    });
  }

  private drawRedactionsOnCanvas(
    targetContext: CanvasRenderingContext2D,
    sourceCanvas: HTMLCanvasElement,
    scale: number,
    redactions: Redaction[]
  ) {
    const blurCache = new Map<number, HTMLCanvasElement>();
    for (const redaction of redactions) {
      const scaledBlur = Math.max(1, Math.round(redaction.blur * scale));
      const blurredSource = this.getBlurredCanvas(sourceCanvas, scaledBlur, blurCache);
      const maskCanvas = this.createMaskCanvas(sourceCanvas.width, sourceCanvas.height, redaction, scale);
      const effectCanvas = document.createElement('canvas');
      effectCanvas.width = sourceCanvas.width;
      effectCanvas.height = sourceCanvas.height;
      const effectContext = effectCanvas.getContext('2d');
      if (!effectContext) {
        continue;
      }

      effectContext.drawImage(blurredSource, 0, 0);
      effectContext.globalCompositeOperation = 'destination-in';
      effectContext.drawImage(maskCanvas, 0, 0);
      effectContext.globalCompositeOperation = 'source-over';
      targetContext.drawImage(effectCanvas, 0, 0);
    }
  }

  private drawRectangleSelectionOverlay(context: CanvasRenderingContext2D, scale: number) {
    if (!this.selectedRectangle || this.currentStep !== 'redact') {
      return;
    }

    const rectangle = this.selectedRectangle;
    const width = rectangle.width * scale;
    const height = rectangle.height * scale;
    const centerX = rectangle.x * scale;
    const centerY = rectangle.y * scale;
    context.save();
    context.translate(centerX, centerY);
    context.rotate((rectangle.rotation * Math.PI) / 180);
    context.strokeStyle = '#2563eb';
    context.lineWidth = 2;
    context.setLineDash([8, 6]);
    context.strokeRect(-width / 2, -height / 2, width, height);
    context.setLineDash([]);
    context.fillStyle = '#2563eb';
    context.strokeStyle = 'white';
    const handleSize = Math.max(8, Math.round(12 * scale));
    for (const point of [
      { x: -width / 2, y: -height / 2 },
      { x: width / 2, y: -height / 2 },
      { x: -width / 2, y: height / 2 },
      { x: width / 2, y: height / 2 }
    ]) {
      context.beginPath();
      context.rect(point.x - handleSize / 2, point.y - handleSize / 2, handleSize, handleSize);
      context.fill();
      context.stroke();
    }
    const rotationHandleY = -height / 2 - Math.max(24, 32 * scale);
    context.beginPath();
    context.moveTo(0, -height / 2);
    context.lineTo(0, rotationHandleY);
    context.strokeStyle = '#2563eb';
    context.lineWidth = 2;
    context.stroke();
    context.beginPath();
    context.arc(0, rotationHandleY, Math.max(6, 8 * scale), 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  }

  private createMaskCanvas(width: number, height: number, redaction: Redaction, scale: number) {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskContext = maskCanvas.getContext('2d');
    if (!maskContext) {
      return maskCanvas;
    }

    maskContext.fillStyle = '#ffffff';
    maskContext.strokeStyle = '#ffffff';

    if (redaction.tool === 'rectangle') {
      maskContext.save();
      maskContext.translate(redaction.x * scale, redaction.y * scale);
      maskContext.rotate((redaction.rotation * Math.PI) / 180);
      maskContext.fillRect((-redaction.width * scale) / 2, (-redaction.height * scale) / 2, redaction.width * scale, redaction.height * scale);
      maskContext.restore();
      return maskCanvas;
    }

    this.drawBrushMask(maskContext, redaction, scale);
    return maskCanvas;
  }

  private drawBrushMask(context: CanvasRenderingContext2D, redaction: BrushRedaction, scale: number) {
    const points = redaction.points.map((point) => ({ x: point.x * scale, y: point.y * scale }));
    const size = redaction.size * scale;
    if (points.length === 0) {
      return;
    }

    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = size;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) {
      context.lineTo(point.x, point.y);
    }
    context.stroke();

    if (points.length === 1) {
      context.beginPath();
      context.arc(points[0].x, points[0].y, size / 2, 0, Math.PI * 2);
      context.fill();
    }
  }

  private getBlurredCanvas(sourceCanvas: HTMLCanvasElement, blur: number, cache: Map<number, HTMLCanvasElement>) {
    const cached = cache.get(blur);
    if (cached) {
      return cached;
    }

    const blurredCanvas = document.createElement('canvas');
    blurredCanvas.width = sourceCanvas.width;
    blurredCanvas.height = sourceCanvas.height;
    const blurredContext = blurredCanvas.getContext('2d');
    if (!blurredContext) {
      return sourceCanvas;
    }

    blurredContext.filter = `blur(${blur}px)`;
    blurredContext.drawImage(sourceCanvas, 0, 0);
    blurredContext.filter = 'none';
    cache.set(blur, blurredCanvas);
    return blurredCanvas;
  }

  private createCropCanvas(cropBounds: CropBounds, width: number, height: number) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const context = canvas.getContext('2d');
    if (context && this.loadedImage) {
      context.drawImage(this.loadedImage, cropBounds.x, cropBounds.y, cropBounds.width, cropBounds.height, 0, 0, canvas.width, canvas.height);
    }
    return canvas;
  }

  private getFullImagePreviewMetrics(): PreviewMetrics {
    if (!this.loadedImage) {
      return { scale: 1, width: 0, height: 0 };
    }

    const maxWidth = 760;
    const scale = this.loadedImage.naturalWidth > maxWidth ? maxWidth / this.loadedImage.naturalWidth : 1;
    return {
      scale,
      width: Math.round(this.loadedImage.naturalWidth * scale),
      height: Math.round(this.loadedImage.naturalHeight * scale)
    };
  }

  private getCropPreviewMetrics(cropBounds: CropBounds): PreviewMetrics {
    const maxWidth = 760;
    const maxHeight = 560;
    const widthScale = cropBounds.width > maxWidth ? maxWidth / cropBounds.width : 1;
    const heightScale = cropBounds.height > maxHeight ? maxHeight / cropBounds.height : 1;
    const scale = Math.min(widthScale, heightScale);
    return {
      scale,
      width: Math.max(1, Math.round(cropBounds.width * scale)),
      height: Math.max(1, Math.round(cropBounds.height * scale))
    };
  }

  private computeCropBounds(): CropBounds {
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

  private drawWatermark(context: CanvasRenderingContext2D, width: number, height: number, scale: number) {
    if (!this.watermarkImg) {
      return;
    }

    const placement = this.getWatermarkPlacement(width, height, scale);
    context.globalAlpha = 0.85;
    context.drawImage(this.watermarkImg, placement.x, placement.y, placement.width, placement.height);
    context.globalAlpha = 1;
  }

  private getWatermarkPlacement(width: number, height: number, scale: number) {
    if (!this.watermarkImg) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const resized = this.getResizedWatermarkDimensions(width, height, scale);
    const border = (resized.height * this.watermarkBorder) / 100;
    const horizontalPosition = this.watermarkPosition === 'top-right' || this.watermarkPosition === 'bottom-right' ? 1 : 0;
    const verticalPosition = this.watermarkPosition === 'bottom-left' || this.watermarkPosition === 'bottom-right' ? 1 : 0;
    const x = this.calculateWatermarkPosition(border, width, resized.width, horizontalPosition);
    const y = this.calculateWatermarkPosition(border, height, resized.height, verticalPosition);
    return { x, y, width: resized.width, height: resized.height };
  }

  private getResizedWatermarkDimensions(imageWidth: number, imageHeight: number, scale: number) {
    if (!this.watermarkImg) {
      return { width: 0, height: 0 };
    }

    const scaledWatermarkWidth = this.watermarkImg.naturalWidth * scale;
    const scaledWatermarkHeight = this.watermarkImg.naturalHeight * scale;
    const imageArea = imageWidth * imageHeight;
    const watermarkArea = scaledWatermarkWidth * scaledWatermarkHeight;
    const targetArea = imageArea * (this.watermarkProportion / 100);
    return {
      width: this.calculateResizedLength(scaledWatermarkWidth, watermarkArea, targetArea),
      height: this.calculateResizedLength(scaledWatermarkHeight, watermarkArea, targetArea)
    };
  }

  private calculateResizedLength(actualLength: number, actualArea: number, targetArea: number) {
    return Math.round(actualLength * Math.sqrt(targetArea / actualArea));
  }

  private calculateWatermarkPosition(border: number, originalLength: number, watermarkLength: number, relativePosition: number) {
    const minPosition = border;
    const maxPosition = originalLength - (border + watermarkLength);
    return Math.round(minPosition + (maxPosition - minPosition) * relativePosition);
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

  private enforceAspectRatio(changed?: 'width' | 'height') {
    if (this.aspectRatio === 'free' || !this.loadedImage) {
      return;
    }

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

  private getHandleSize(canvas: HTMLCanvasElement) {
    return Math.max(10, Math.round(Math.min(canvas.width, canvas.height) * 0.025));
  }

  private getCropPointerMode(x: number, y: number, canvas: HTMLCanvasElement): CropPointerMode {
    const cropX = Math.round((this.crop.x / 100) * canvas.width);
    const cropY = Math.round((this.crop.y / 100) * canvas.height);
    const cropW = Math.round((this.crop.width / 100) * canvas.width);
    const cropH = Math.round((this.crop.height / 100) * canvas.height);
    const handleSize = this.getHandleSize(canvas);
    const inside = x >= cropX && x <= cropX + cropW && y >= cropY && y <= cropY + cropH;
    const near = (pointX: number, pointY: number) => Math.abs(x - pointX) <= handleSize && Math.abs(y - pointY) <= handleSize;

    if (near(cropX, cropY)) return 'nw';
    if (near(cropX + cropW, cropY)) return 'ne';
    if (near(cropX, cropY + cropH)) return 'sw';
    if (near(cropX + cropW, cropY + cropH)) return 'se';
    if (inside) return 'move';
    return null;
  }

  private getCropCursor(mode: CropPointerMode) {
    if (mode === 'move') return 'move';
    if (mode === 'nw' || mode === 'se') return 'nwse-resize';
    if (mode === 'ne' || mode === 'sw') return 'nesw-resize';
    return 'default';
  }

  private getCanvasCoordinates(event: PointerEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    return {
      canvasX: (event.clientX - rect.left) * scaleX,
      canvasY: (event.clientY - rect.top) * scaleY
    };
  }

  private getCropCanvasPoint(event: PointerEvent): RedactionPoint | null {
    const canvas = this.editorCanvas.nativeElement;
    const cropBounds = this.computeCropBounds();
    if (cropBounds.width <= 0 || cropBounds.height <= 0) {
      return null;
    }

    const metrics = this.getCropPreviewMetrics(cropBounds);
    const { canvasX, canvasY } = this.getCanvasCoordinates(event, canvas);
    return {
      x: this.clamp(canvasX / metrics.scale, 0, cropBounds.width),
      y: this.clamp(canvasY / metrics.scale, 0, cropBounds.height)
    };
  }

  private getRenderableRedactions() {
    return this.activeBrushStroke ? [...this.redactions, this.activeBrushStroke] : this.redactions;
  }

  private createRectangleRedaction(startPoint: RedactionPoint, endPoint: RedactionPoint, id?: string): RectangleRedaction {
    const width = Math.max(2, Math.abs(endPoint.x - startPoint.x));
    const height = Math.max(2, Math.abs(endPoint.y - startPoint.y));
    return {
      id: id ?? this.createRedactionId('rectangle'),
      tool: 'rectangle',
      x: (startPoint.x + endPoint.x) / 2,
      y: (startPoint.y + endPoint.y) / 2,
      width,
      height,
      rotation: 0,
      blur: this.defaultRectangleBlur
    };
  }

  private createRedactionId(tool: RedactionTool) {
    return `${tool}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  }

  private replaceRedaction(redactionId: string, nextRedaction: Redaction) {
    this.redactions = this.redactions.map((redaction) => (redaction.id === redactionId ? nextRedaction : redaction));
  }

  private findRectangleAtPoint(point: RedactionPoint) {
    const rectangles = this.redactions.filter((redaction): redaction is RectangleRedaction => redaction.tool === 'rectangle');
    return [...rectangles].reverse().find((rectangle) => this.isPointInsideRectangle(point, rectangle)) ?? null;
  }

  private getRectangleResizeHandleAtPoint(point: RedactionPoint): RectangleResizeHandle | null {
    if (!this.selectedRectangle) {
      return null;
    }

    const hitRadius = 12;
    const handles = this.getRectangleHandlePoints(this.selectedRectangle, 1);
    const handleMap: Array<{ handle: RectangleResizeHandle; point: RedactionPoint }> = [
      { handle: 'nw', point: handles[0] },
      { handle: 'ne', point: handles[1] },
      { handle: 'sw', point: handles[2] },
      { handle: 'se', point: handles[3] }
    ];

    return handleMap.find((entry) => this.getDistance(entry.point, point) <= hitRadius)?.handle ?? null;
  }

  private getRectangleRotationHandleAtPoint(point: RedactionPoint) {
    if (!this.selectedRectangle) {
      return false;
    }

    return this.getDistance(this.getRectangleRotationHandlePoint(this.selectedRectangle, 1), point) <= 14;
  }

  private getRectangleHandlePoints(rectangle: RectangleRedaction, scale: number) {
    const halfWidth = (rectangle.width * scale) / 2;
    const halfHeight = (rectangle.height * scale) / 2;
    return [
      this.rotateLocalPoint(rectangle, -halfWidth, -halfHeight, scale),
      this.rotateLocalPoint(rectangle, halfWidth, -halfHeight, scale),
      this.rotateLocalPoint(rectangle, -halfWidth, halfHeight, scale),
      this.rotateLocalPoint(rectangle, halfWidth, halfHeight, scale)
    ];
  }

  private getRectangleRotationHandlePoint(rectangle: RectangleRedaction, scale: number) {
    const offset = (rectangle.height * scale) / 2 + Math.max(24, 32 * scale);
    return this.rotateLocalPoint(rectangle, 0, -offset, scale);
  }

  private rotateLocalPoint(rectangle: RectangleRedaction, localX: number, localY: number, scale: number): RedactionPoint {
    const radians = (rectangle.rotation * Math.PI) / 180;
    return {
      x: rectangle.x * scale + localX * Math.cos(radians) - localY * Math.sin(radians),
      y: rectangle.y * scale + localX * Math.sin(radians) + localY * Math.cos(radians)
    };
  }

  private isPointInsideRectangle(point: RedactionPoint, rectangle: RectangleRedaction) {
    const radians = (-rectangle.rotation * Math.PI) / 180;
    const translatedX = point.x - rectangle.x;
    const translatedY = point.y - rectangle.y;
    const localX = translatedX * Math.cos(radians) - translatedY * Math.sin(radians);
    const localY = translatedX * Math.sin(radians) + translatedY * Math.cos(radians);
    return Math.abs(localX) <= rectangle.width / 2 && Math.abs(localY) <= rectangle.height / 2;
  }

  private clearRedactionsForCropChange(showMessage = true) {
    if (this.redactions.length === 0) {
      return;
    }

    this.redactions = [];
    this.selectedRedactionId = null;
    this.activeBrushStroke = undefined;
    if (showMessage) {
      this.successMessage = 'Redactions were cleared because the crop changed.';
    }
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  private clampNumber(value: number | string, min: number, max: number, fallback: number) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return this.clamp(numeric, min, max);
  }

  private getDistance(a: RedactionPoint, b: RedactionPoint) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private isRectangleResizeMode(mode: RedactionPointerMode): mode is `rectangle-resize-${RectangleResizeHandle}` {
    return mode === 'rectangle-resize-nw' || mode === 'rectangle-resize-ne' || mode === 'rectangle-resize-sw' || mode === 'rectangle-resize-se';
  }

  private getResizeHandleFromMode(mode: `rectangle-resize-${RectangleResizeHandle}`): RectangleResizeHandle {
    return mode.replace('rectangle-resize-', '') as RectangleResizeHandle;
  }

  private getRectangleResizeCursor(handle: RectangleResizeHandle) {
    return handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize';
  }

  private getAngleFromRectangleCenter(point: RedactionPoint, rectangle: RectangleRedaction) {
    return (Math.atan2(point.y - rectangle.y, point.x - rectangle.x) * 180) / Math.PI + 90;
  }

  private normalizeRotation(rotation: number) {
    let normalized = rotation;
    while (normalized > 180) {
      normalized -= 360;
    }
    while (normalized < -180) {
      normalized += 360;
    }
    return normalized;
  }

  private resizeRectangleFromHandle(rectangle: RectangleRedaction, point: RedactionPoint, handle: RectangleResizeHandle): RectangleRedaction {
    const radians = (rectangle.rotation * Math.PI) / 180;
    const inverseRadians = -radians;
    const localPointX =
      (point.x - rectangle.x) * Math.cos(inverseRadians) - (point.y - rectangle.y) * Math.sin(inverseRadians);
    const localPointY =
      (point.x - rectangle.x) * Math.sin(inverseRadians) + (point.y - rectangle.y) * Math.cos(inverseRadians);

    const oppositeCorner =
      handle === 'nw'
        ? { x: rectangle.width / 2, y: rectangle.height / 2 }
        : handle === 'ne'
          ? { x: -rectangle.width / 2, y: rectangle.height / 2 }
          : handle === 'sw'
            ? { x: rectangle.width / 2, y: -rectangle.height / 2 }
            : { x: -rectangle.width / 2, y: -rectangle.height / 2 };

    const nextCorner = {
      x:
        handle === 'nw' || handle === 'sw'
          ? Math.min(localPointX, oppositeCorner.x - 2)
          : Math.max(localPointX, oppositeCorner.x + 2),
      y:
        handle === 'nw' || handle === 'ne'
          ? Math.min(localPointY, oppositeCorner.y - 2)
          : Math.max(localPointY, oppositeCorner.y + 2)
    };

    const nextCenterLocal = {
      x: (oppositeCorner.x + nextCorner.x) / 2,
      y: (oppositeCorner.y + nextCorner.y) / 2
    };

    return {
      ...rectangle,
      x: rectangle.x + nextCenterLocal.x * Math.cos(radians) - nextCenterLocal.y * Math.sin(radians),
      y: rectangle.y + nextCenterLocal.x * Math.sin(radians) + nextCenterLocal.y * Math.cos(radians),
      width: Math.max(2, Math.abs(nextCorner.x - oppositeCorner.x)),
      height: Math.max(2, Math.abs(nextCorner.y - oppositeCorner.y))
    };
  }
}
