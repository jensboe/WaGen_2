import path from 'path';

export const UPLOAD_DIR = path.join(__dirname, '..', 'data');
export const PORT = 3000;
export const DATABASE_URL = 'file:./prisma/dev.db';
