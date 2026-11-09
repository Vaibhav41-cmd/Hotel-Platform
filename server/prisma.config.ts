import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    // A local placeholder lets `prisma generate` run in CI without database secrets.
    // Migrations and runtime use the real DATABASE_URL from the environment.
    url: process.env.DATABASE_URL || 'postgresql://serein:serein@127.0.0.1:5432/serein?schema=public',
  },
});
