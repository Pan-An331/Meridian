"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthBrand from "@/components/auth/AuthBrand";

/* ═══════════════════════════════════════════
   Login · Meridian v4（全宽横版）
   · 左品牌区 7fr（C 方案 Logo + 文案三层）| 右表单区 5fr
   · signIn 逻辑保留 · 仅 UI 品牌层
   ═══════════════════════════════════════════ */

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError("邮箱或密码错误");
    } else {
      router.push("/today");
      router.refresh();
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
          <div className="text-[22px] font-bold tracking-[-0.3px] text-[var(--v2-text)]">欢迎回来</div>
          <div className="text-[12.5px] text-[var(--v2-text3)] mt-1.5">登录后继续你的成长闭环</div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error && (
              <div className="px-3 py-2.5 text-sm rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger-border)]">{error}</div>
            )}
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
                placeholder="请输入密码"
                required
              />
            </div>
            <div className="flex items-center justify-between text-[11.5px] text-[var(--v2-text3)]">
              <label className="flex items-center gap-1.5 cursor-pointer font-normal text-[var(--v2-text2)]">
                <span className="w-[15px] h-[15px] rounded border-[1.5px] border-[#D1D5DB] bg-white inline-block" />
                记住我
              </label>
              <span className="text-[var(--v2-brand)] font-medium cursor-pointer">忘记密码？</span>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[44px] rounded-[10px] text-[14px] font-semibold text-white bg-[var(--v2-brand)] hover:bg-[var(--v2-brand-deep)] transition-all shadow-[0_5px_16px_rgba(30,58,138,.3)] disabled:opacity-50"
            >
              {loading ? "登录中…" : "进入子午 →"}
            </button>
          </form>

          <div className="flex items-center gap-2.5 mt-6 text-[10.5px] text-[var(--v2-text3)]">
            <span className="flex-1 h-px bg-[#F1F2F5]" />
            <span>或使用以下方式</span>
            <span className="flex-1 h-px bg-[#F1F2F5]" />
          </div>
          <div className="flex gap-2.5 mt-3.5">
            <span className="flex-1 h-[42px] border-[1.5px] border-[var(--v2-border)] rounded-[10px] flex items-center justify-center gap-2 text-[12.5px] font-medium text-[var(--v2-text2)] cursor-pointer hover:border-[var(--v2-brand)] hover:text-[var(--v2-brand)] transition-colors">微信登录</span>
            <span className="flex-1 h-[42px] border-[1.5px] border-[var(--v2-border)] rounded-[10px] flex items-center justify-center gap-2 text-[12.5px] font-medium text-[var(--v2-text2)] cursor-pointer hover:border-[var(--v2-brand)] hover:text-[var(--v2-brand)] transition-colors">Google</span>
          </div>

          <div className="text-center text-[12px] text-[var(--v2-text3)] mt-5">
            还没有账号？{" "}
            <Link href="/register" className="text-[var(--v2-brand)] font-semibold cursor-pointer">立即注册 →</Link>
          </div>
          <div className="text-center text-[10.5px] text-[var(--v2-text3)] mt-4">AI 驱动的个人时间操作系统 · © 2026 Meridian</div>
        </div>
      </div>
    </div>
  );
}
