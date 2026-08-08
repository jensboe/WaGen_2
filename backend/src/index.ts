import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { PORT, UPLOAD_DIR } from './config';

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

// Ensure upload directories exist
fs.mkdirSync(path.join(UPLOAD_DIR, 'originals'), { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, 'finals'), { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(UPLOAD_DIR, 'originals')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${unique}-${file.originalname}`);
  }
});
const upload = multer({ storage });

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Upload original image
app.post('/upload-original', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const originalPath = req.file.path;
  const img = await prisma.image.create({ data: { originalPath } });
  res.json({ id: img.id, originalPath });
});

// Save final image and metadata
app.post('/save-final', upload.single('final'), async (req, res) => {
  // final file should be sent in 'final' field; metadata in body.metadata as JSON
  const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : null;
  const imageId = parseInt(req.body.id, 10);
  let finalPath: string | undefined;
  if (req.file) finalPath = req.file.path;
  const updated = await prisma.image.update({ where: { id: imageId }, data: { finalPath, metadata } });
  res.json({ id: updated.id });
});

// Get image metadata
app.get('/images/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const img = await prisma.image.findUnique({ where: { id } });
  if (!img) return res.status(404).json({ error: 'Not found' });
  res.json(img);
});

app.use('/static', express.static(UPLOAD_DIR));

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
