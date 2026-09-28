import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';
import path from 'node:path';

export default defineWorkersConfig(async () => {
  const migrationsPath = path.join(__dirname, 'migrations');
  const migrations = await readD1Migrations(migrationsPath);

  return {
    test: {
      setupFiles: ['./test/apply-migrations.js'],
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            bindings: { TEST_MIGRATIONS: migrations, JWT_SECRET: 'test_only_jwt_secret_do_not_use_in_prod' },
            // R2 is not yet enabled on the real Cloudflare account (see plan),
            // so this binding exists ONLY in the test Miniflare environment —
            // it lets us fully test the upload/media security logic without
            // touching wrangler.toml or requiring the real bucket to exist.
            r2Buckets: ['SQ_MEDIA']
          }
        }
      }
    }
  };
});
