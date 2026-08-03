"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthBrand from "@/components/auth/AuthBrand";

/* ═══════════════════════════════════════════
   Register · Meridian v4（全宽横版）
   · 品牌区复用 AuthBrand · 表单区「开始你的子午」
   · 注册 API 逻辑保留 · 仅 UI 品牌层
   ═══════════════════════════════════════════ */

export default function RegisterPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, nickname }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "注册失败");
        setLoading(false);
        return;
      }

      router.push("/login");
    } catch {
      setError("网络错误");
      setLoading(false);
    }
  }

  const inputCls =
    "w-full h-[42px] px-4 text-[13.5px] border-[1.5px] border-[var(--v2-border)] rounded-[10px] bg-white outline-none transition-colors focus:border-[var(--v2-brand)] placeholder:text-[var(--v2-text3)]";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8" style={{ background: "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)" }}>
      <div className="w-full max-w-[1100px] auth-grid">
        {/* 左 · 品牌区 */}
        <AuthBrand />

        {/* 右 · 表单区 */}
        <div className="auth-form">
          <div className="text-[22px] font-bold tracking-[-0.3px] text-[var(--v2-text)]">开始你的子午</div>
          <div className="text-[12.5px] text-[var(--v2-text3)] mt-1.5">创建账号，从今天起让中轴浮现</div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error && (
              <div className="px-3 py-2.5 text-sm rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger-border)]">{error}</div>
            )}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--v2-text2)] mb-1.5">昵称</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className={inputCls}
                placeholder="你的昵称"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--v2-text2)] mb-1.5">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--v2-text2)] mb-1.5">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="至少 6 位"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[44px] rounded-[10px] text-[14px] font-semibold text-white bg-[var(--v2-brand)] hover:bg-[var(--v2-brand-deep)] transition-all shadow-[0_5px_16px_rgba(30,58,138,.3)] disabled:opacity-50"
            >
              {loading ? "注册中…" : "开始我的子午 →"}
            </button>
          </form>

          <div className="text-center text-[12px] text-[var(--v2-text3)] mt-6">
            已有账号？{" "}
            <Link href="/login" className="text-[var(--v2-brand)] font-semibold cursor-pointer">登录 →</Link>
          </div>
          <div className="text-center text-[10.5px] text-[var(--v2-text3)] mt-4">AI 驱动的个人时间操作系统 · © 2026 Meridian</div>
        </div>
      </div>
    </div>
  );
}
