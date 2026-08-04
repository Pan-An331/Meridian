"use client";

import { useEffect } from "react";

/* PWA Service Worker 注册（2026-08-05 平板端优化）
   生产环境注册，开发环境跳过（避免缓存干扰热更新） */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
