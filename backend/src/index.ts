import cors from 'cors';
import express, { Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { PORT, UPLOAD_DIR } from './config';

type MulterRequest = Request & { file?: Express.Multer.File };

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

// Ensure upload directories exist
fs.mkdirSync(path.join(UPLOAD_DIR, 'originals'), { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, 'finals'), { recursive: true });

const storage = multer.diskStorage({
  destination: (req: MulterRequest, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) =>
    cb(null, path.join(UPLOAD_DIR, 'originals')),
  filename: (req: MulterRequest, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${unique}-${file.originalname}`);
  }
});
const upload = multer({ storage });

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Upload original image
app.post('/upload-original', upload.single('image'), async (req: MulterRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const originalPath = req.file.path;
  const img = await prisma.image.create({
    data: { originalPath }
  });
  res.json({ id: img.id, originalPath, originalUrl: publicUrlFromRequest(req, originalPath) });
});

// Save final image and metadata
app.post('/save-final', upload.single('final'), async (req: MulterRequest, res) => {
  // final file should be sent in 'final' field; metadata in body.metadata as JSON string
  const metadataObj = req.body.metadata ? JSON.parse(req.body.metadata as string) : null;
  const metadata = metadataObj ? JSON.stringify(metadataObj) : null;
  const imageId = parseInt(req.body.id as string, 10);
  let finalPath: string | undefined;
  if (req.file) finalPath = req.file.path;
  const updated = await prisma.image.update({ where: { id: imageId }, data: { finalPath, metadata } });
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
      metadata: image.metadata ? JSON.parse(image.metadata) : null,
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
    metadata: img.metadata ? JSON.parse(img.metadata) : null,
    createdAt: img.createdAt,
    originalUrl: img.originalPath ? publicUrlFromRequest(req, img.originalPath) : null,
    finalUrl: img.finalPath ? publicUrlFromRequest(req, img.finalPath) : null
  });
});

app.use('/static', express.static(UPLOAD_DIR));

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
