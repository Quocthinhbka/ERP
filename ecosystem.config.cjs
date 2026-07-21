// PM2 process manager cho môi trường production.
// Chạy:  pm2 startOrReload ecosystem.config.cjs --update-env
// Biến môi trường (DATABASE_URL, REDIS_*, JWT_*, ...) được nạp từ file .env ở gốc repo
// (api dùng @nestjs/config, worker dùng dotenv). Xem scripts/deploy.sh.
module.exports = {
  apps: [
    {
      name: 'erp-api',
      cwd: './apps/api',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'erp-worker',
      cwd: './apps/worker',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
