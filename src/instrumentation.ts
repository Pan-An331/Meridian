// Next.js instrumentation — 服务器启动时注册每日 AI 维护定时任务
// 文档：node_modules/next/dist/docs/01-app/02-guides/instrumentation.md
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDailyCron } = await import("./lib/daily-cron");
    startDailyCron();
  }
}
