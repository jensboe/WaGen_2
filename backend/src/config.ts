import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
export const UPLOAD_DIR = process.env.UPLOAD_DIR || './data';
export const DATABASE_URL = process.env.DATABASE_URL || '';
