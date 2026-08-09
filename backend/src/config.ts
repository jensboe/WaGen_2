import 'dotenv/config';
import path from 'path';

export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
export const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(__dirname, '..', 'data');
export const DATABASE_URL = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:4200';
