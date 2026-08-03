import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ["192.168.10.9"],
  // ⚠️ Vercel 部署关键（数据库迁移方案 §2.3）：Vercel 构建约定输出 .next，
  // 自定义 distDir 会导致部署产物找不到。本地可用 .next-prod，推 GitHub 前必须注释/改回默认。
  // distDir: ".next-prod",
};

export default nextConfig;