import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { PrismaLibSql } from '@prisma/adapter-libsql';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrate: {
    adapter() {
      return new PrismaLibSql({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' });
    },
  },
});
