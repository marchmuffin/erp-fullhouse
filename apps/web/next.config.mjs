import createNextIntlPlugin from 'next-intl/plugin';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'chart.googleapis.com' },
    ],
  },

  // 注入版本號到客戶端環境變數（從 package.json 讀取，確保永遠同步）
  env: {
    NEXT_PUBLIC_VERSION: pkg.version,
  },

  // 將 /api/* 在 server-side 轉發到 NestJS (port 4001)
  // 公開網域的瀏覽器發請求到同源，Next.js 伺服器負責轉發
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4001/api/:path*',
      },
    ];
  },
};

export default withNextIntl(nextConfig);
