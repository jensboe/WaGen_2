import cors from 'cors';
import express, { Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { PORT, UPLOAD_DIR } from './config';

type MulterRequest = Request & { file?: Express.Multer.File };
type EditMetadata = {
  crop?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  aspectRatio?: 'free' | '1:1' | '16:9' | '4:3';
  watermark?: {
    src?: string;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    proportion?: number;
    border?: number;
  };
};

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

// Ensure upload directories exist
fs.mkdirSync(path.join(UPLOAD_DIR, 'originals'), { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, 'finals'), { recursive: true });

const createStorage = (folder: 'originals' | 'finals') =>
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
  const images = await prisma.image.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(
    images.map((image) => ({
      id: image.id,
      metadata: buildImageMetadata(image),
      createdAt: image.createdAt,
      originalUrl: image.originalPath ? publicUrlFromRequest(req, image.originalPath) : null,
      finalUrl: image.finalPath ? publicUrlFromRequest(req, image.finalPath) : null
    }))
  );
});

app.get('/images/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const img = await prisma.image.findUnique({ where: { id } });
  if (!img) return res.status(404).json({ error: 'Not found' });
  res.json({
    id: img.id,
    metadata: buildImageMetadata(img),
    createdAt: img.createdAt,
    originalUrl: img.originalPath ? publicUrlFromRequest(req, img.originalPath) : null,
    finalUrl: img.finalPath ? publicUrlFromRequest(req, img.finalPath) : null
  });
});

app.use('/static', express.static(UPLOAD_DIR));

function parseMetadata(rawMetadata: unknown): EditMetadata | null {
  if (typeof rawMetadata !== 'string' || rawMetadata.trim().length === 0) {
    return null;
  }

  return JSON.parse(rawMetadata) as EditMetadata;
}

function buildImageUpdateData(finalPath: string, metadata: EditMetadata | null) {
  return {
    finalPath,
    cropX: metadata?.crop?.x ?? null,
    cropY: metadata?.crop?.y ?? null,
    cropWidth: metadata?.crop?.width ?? null,
    cropHeight: metadata?.crop?.height ?? null,
    aspectRatio: metadata?.aspectRatio ?? null,
    watermarkSrc: metadata?.watermark?.src ?? null,
    watermarkPosition: metadata?.watermark?.position ?? null,
    watermarkProportion: metadata?.watermark?.proportion != null ? Math.round(metadata.watermark.proportion) : null,
    watermarkBorder: metadata?.watermark?.border != null ? Math.round(metadata.watermark.border) : null
  };
}

function buildImageMetadata(image: {
  cropX: number | null;
  cropY: number | null;
  cropWidth: number | null;
  cropHeight: number | null;
  aspectRatio: string | null;
  watermarkSrc: string | null;
  watermarkPosition: string | null;
  watermarkProportion: number | null;
  watermarkBorder: number | null;
}) {
  const hasCrop =
    image.cropX != null &&
    image.cropY != null &&
    image.cropWidth != null &&
    image.cropHeight != null;
  const hasWatermark =
    image.watermarkSrc != null ||
    image.watermarkPosition != null ||
    image.watermarkProportion != null ||
    image.watermarkBorder != null;

  if (!hasCrop && !image.aspectRatio && !hasWatermark) {
    return null;
  }

  return {
    crop: hasCrop
      ? {
          x: image.cropX,
          y: image.cropY,
          width: image.cropWidth,
          height: image.cropHeight
        }
      : undefined,
    aspectRatio: image.aspectRatio ?? undefined,
    watermark: hasWatermark
      ? {
          src: image.watermarkSrc ?? undefined,
          position: image.watermarkPosition ?? undefined,
          proportion: image.watermarkProportion ?? undefined,
          border: image.watermarkBorder ?? undefined
        }
      : undefined
  };
}

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
