import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Migrations rodam SEMPRE com o papel dono (DB_OWNER_URL). O servidor da API nunca usa esse papel.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DB_OWNER_URL'),
  },
});
