import cors from 'cors';
import express, { Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ImageRedaction, Prisma, PrismaClient, Watermark } from '@prisma/client';
import { createClient } from '@libsql/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PORT, UPLOAD_DIR, DATABASE_URL, CORS_ORIGIN } from './config';
import type { AspectRatio, BrushRedaction, ImageEditMetadata, ImageResponse, RectangleRedaction, Redaction, WatermarkPosition, WatermarkResponse } from '@shared/image.types';

type MulterRequest = Request & { file?: Express.Multer.File };
type ImageWithRelations = Prisma.ImageGetPayload<{
  include: {
    watermark: true;
    redactions: {
      include: { points: true };
    };
  };
}>;


const adapter = new PrismaLibSql(createClient({ url: DATABASE_URL }));
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Ensure upload directories exist
fs.mkdirSync(path.join(UPLOAD_DIR, 'originals'), { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, 'finals'), { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, 'watermarks'), { recursive: true });

const createStorage = (folder: 'originals' | 'finals' | 'watermarks') =>
  multer.diskStorage({
    destination: (_req: MulterRequest, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) =>
      cb(null, path.join(UPLOAD_DIR, folder)),
    filename: (_req: MulterRequest, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `${unique}-${file.originalname}`);
    }
  });

const originalUpload = multer({ storage: createStorage('originals') });
const finalUpload = multer({ storage: createStorage('finals') });
const watermarkUpload = multer({ storage: createStorage('watermarks') });

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Upload original image
app.post('/upload-original', originalUpload.single('image'), async (req: MulterRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const originalPath = req.file.path;
  const img = await prisma.image.create({
    data: { originalPath }
  });
  res.json({ id: img.id, originalPath, originalUrl: publicUrlFromRequest(req, originalPath) });
});

// Save final image and metadata
app.post('/save-final', finalUpload.single('final'), async (req: MulterRequest, res) => {
  const metadata = parseMetadata(req.body.metadata);
  const imageId = parseInt(req.body.id as string, 10);
  if (Number.isNaN(imageId)) {
    return res.status(400).json({ error: 'Invalid image id' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No final image file provided' });
  }

  const updated = await prisma.image.update({
    where: { id: imageId },
    data: buildImageUpdateData(req.file.path, metadata)
  });
  res.json({ id: updated.id });
});

app.get('/watermarks', async (req, res) => {
  const watermarks = await prisma.watermark.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(watermarks.map((watermark) => buildWatermarkResponse(req, watermark)));
});

app.post('/watermarks', watermarkUpload.single('watermark'), async (req: MulterRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No watermark file provided' });
  }

  const watermark = await prisma.watermark.create({
    data: {
      label: req.file.originalname,
      filePath: req.file.path
    }
  });

  res.status(201).json(buildWatermarkResponse(req, watermark));
});

app.patch('/watermarks/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const label = typeof req.body.label === 'string' ? req.body.label.trim() : '';

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid watermark id' });
  }
  if (!label) {
    return res.status(400).json({ error: 'Watermark label is required' });
  }

  const watermark = await prisma.watermark.update({
    where: { id },
    data: { label }
  });

  res.json(buildWatermarkResponse(req, watermark));
});

app.delete('/watermarks/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid watermark id' });
  }

  const watermark = await prisma.watermark.findUnique({ where: { id } });
  if (!watermark) {
    return res.status(404).json({ error: 'Watermark not found' });
  }

  await prisma.image.updateMany({
    where: { watermarkId: id },
    data: {
      watermarkId: null,
      watermarkPosition: null,
      watermarkProportion: null,
      watermarkBorder: null
    }
  });

  await prisma.watermark.delete({ where: { id } });

  if (fs.existsSync(watermark.filePath)) {
    fs.unlinkSync(watermark.filePath);
  }

  res.status(204).send();
});

// Get image metadata
function publicUrl(filePath: string) {
  const relativePath = path.relative(UPLOAD_DIR, filePath).split(path.sep).join('/');
  return `/static/${encodeURI(relativePath)}`;
}

function publicUrlFromRequest(req: express.Request, filePath: string) {
  const host = req.get('host') || `localhost:${PORT}`;
  const url = `${req.protocol}://${host}${publicUrl(filePath)}`;
  return url;
}

app.get('/images', async (req, res) => {
  const images = await prisma.image.findMany({
    include: {
      watermark: true,
      redactions: {
        orderBy: { sortOrder: 'asc' },
        include: { points: { orderBy: { sortOrder: 'asc' } } }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(images.map((image) => buildImageResponse(req, image)));
});

app.get('/images/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const img = await prisma.image.findUnique({
    where: { id },
    include: {
      watermark: true,
      redactions: {
        orderBy: { sortOrder: 'asc' },
        include: { points: { orderBy: { sortOrder: 'asc' } } }
      }
    }
  });
  if (!img) return res.status(404).json({ error: 'Not found' });
  res.json(buildImageResponse(req, img));
});

app.use('/static', express.static(UPLOAD_DIR));

function parseMetadata(rawMetadata: unknown): ImageEditMetadata | null {
  if (typeof rawMetadata !== 'string' || rawMetadata.trim().length === 0) {
    return null;
  }

  return JSON.parse(rawMetadata) as ImageEditMetadata;
}

function buildImageUpdateData(finalPath: string, metadata: ImageEditMetadata | null): Prisma.ImageUncheckedUpdateInput {
  return {
    finalPath,
    cropX: metadata?.crop?.x ?? null,
    cropY: metadata?.crop?.y ?? null,
    cropWidth: metadata?.crop?.width ?? null,
    cropHeight: metadata?.crop?.height ?? null,
    aspectRatio: metadata?.aspectRatio ?? null,
    watermarkId: metadata?.watermark?.id ?? null,
    watermarkPosition: metadata?.watermark?.position ?? null,
    watermarkProportion: metadata?.watermark?.proportion != null ? Math.round(metadata.watermark.proportion) : null,
    watermarkBorder: metadata?.watermark?.border != null ? Math.round(metadata.watermark.border) : null,
    redactions: {
      deleteMany: {},
      create: buildRedactionCreateInputs(metadata?.redactions ?? [])
    }
  };
}

function buildImageMetadata(req: express.Request, image: ImageWithRelations): ImageEditMetadata | null {
  const hasCrop =
    image.cropX != null &&
    image.cropY != null &&
    image.cropWidth != null &&
    image.cropHeight != null;
  const hasWatermark =
    image.watermarkId != null ||
    image.watermarkPosition != null ||
    image.watermarkProportion != null ||
    image.watermarkBorder != null;
  const hasRedactions = image.redactions.length > 0;

  if (!hasCrop && !image.aspectRatio && !hasWatermark && !hasRedactions) {
    return null;
  }

  return {
    crop: hasCrop
      ? {
          x: image.cropX ?? undefined,
          y: image.cropY ?? undefined,
          width: image.cropWidth ?? undefined,
          height: image.cropHeight ?? undefined
        }
      : undefined,
    aspectRatio: normalizeAspectRatio(image.aspectRatio),
    redactions: hasRedactions ? image.redactions.map(buildRedactionMetadata) : undefined,
    watermark: hasWatermark
      ? {
          id: image.watermarkId ?? undefined,
          src: image.watermark ? publicUrlFromRequest(req, image.watermark.filePath) : undefined,
          position: normalizeWatermarkPosition(image.watermarkPosition),
          proportion: image.watermarkProportion ?? undefined,
          border: image.watermarkBorder ?? undefined
        }
      : undefined
  };
}

function buildRedactionCreateInputs(redactions: Redaction[]) {
  return redactions.map((redaction, index) => ({
    tool: redaction.tool,
    sortOrder: index,
    x: redaction.tool === 'rectangle' ? redaction.x : null,
    y: redaction.tool === 'rectangle' ? redaction.y : null,
    width: redaction.tool === 'rectangle' ? redaction.width : null,
    height: redaction.tool === 'rectangle' ? redaction.height : null,
    rotation: redaction.tool === 'rectangle' ? redaction.rotation : null,
    brushSize: redaction.tool === 'brush' ? redaction.size : null,
    blur: Math.round(redaction.blur),
    points: redaction.tool === 'brush'
      ? {
          create: redaction.points.map((point, pointIndex) => ({
            sortOrder: pointIndex,
            x: point.x,
            y: point.y
          }))
        }
      : undefined
  }));
}

function buildRedactionMetadata(redaction: ImageRedaction & { points: Array<{ x: number; y: number; sortOrder: number }> }): Redaction {
  if (redaction.tool === 'brush') {
    const brush: BrushRedaction = {
      id: `brush-${redaction.id}`,
      tool: 'brush',
      size: redaction.brushSize ?? 24,
      blur: redaction.blur,
      points: redaction.points
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((point) => ({ x: point.x, y: point.y }))
    };
    return brush;
  }

  const rectangle: RectangleRedaction = {
    id: `rectangle-${redaction.id}`,
    tool: 'rectangle',
    x: redaction.x ?? 0,
    y: redaction.y ?? 0,
    width: redaction.width ?? 0,
    height: redaction.height ?? 0,
    rotation: redaction.rotation ?? 0,
    blur: redaction.blur
  };
  return rectangle;
}

function normalizeAspectRatio(value: string | null): AspectRatio | undefined {
  if (value === 'free' || value === '1:1' || value === '16:9' || value === '4:3') {
    return value;
  }
  return undefined;
}

function normalizeWatermarkPosition(value: string | null): WatermarkPosition | undefined {
  if (value === 'top-left' || value === 'top-right' || value === 'bottom-left' || value === 'bottom-right') {
    return value;
  }
  return undefined;
}

function buildWatermarkResponse(req: express.Request, watermark: Watermark): WatermarkResponse {
  return {
    id: watermark.id,
    label: watermark.label,
    createdAt: watermark.createdAt,
    url: publicUrlFromRequest(req, watermark.filePath)
  };
}

function buildImageResponse(req: express.Request, image: ImageWithRelations): ImageResponse {
  return {
    id: image.id,
    metadata: buildImageMetadata(req, image),
    createdAt: image.createdAt,
    originalUrl: image.originalPath ? publicUrlFromRequest(req, image.originalPath) : null,
    finalUrl: image.finalPath ? publicUrlFromRequest(req, image.finalPath) : null
  };
}

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
