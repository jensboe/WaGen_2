import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrate: {
    adapter() {
      return new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' });
    },
  },
});
