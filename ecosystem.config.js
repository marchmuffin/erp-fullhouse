// pm2 ecosystem config — ERP 全家桶
// 啟動: pm2 start ecosystem.config.js
// 停止: pm2 stop all
// 重啟: pm2 restart all
// 查看: pm2 status / pm2 logs

const path = require('path');
const ROOT = __dirname;

module.exports = {
  apps: [
    // ── NestJS API (port 4001) ──────────────────────────────────────────
    {
      name: 'erp-api',
      cwd: path.join(ROOT, 'apps/api'),
      script: 'dist/main.js',   // 使用已編譯的輸出，避免 --watch 重啟迴圈
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
      },
      // 自動重啟策略
      autorestart: true,
      watch: false,
      max_restarts: 20,      // 最多重啟 20 次後停止嘗試
      min_uptime: '10s',     // 若運行不足 10s 視為不穩定啟動
      restart_delay: 3000,   // 重啟前等待 3 秒
      exp_backoff_restart_delay: 100, // 指數退避重啟
      // 記憶體溢出自動重啟
      max_memory_restart: '512M',
      // 日誌
      out_file: path.join(ROOT, 'logs/api-out.log'),
      error_file: path.join(ROOT, 'logs/api-err.log'),
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── Next.js Web (port 4000) ─────────────────────────────────────────
    {
      name: 'erp-web',
      cwd: path.join(ROOT, 'apps/web'),
      script: 'node_modules/.bin/next',
      args: 'dev --port 4000',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
      },
      // 自動重啟策略
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '15s',
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: '1G',
      // 日誌
      out_file: path.join(ROOT, 'logs/web-out.log'),
      error_file: path.join(ROOT, 'logs/web-err.log'),
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
