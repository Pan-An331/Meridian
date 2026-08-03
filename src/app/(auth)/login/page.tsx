"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MailIcon, LockIcon } from "@/components/ui/icons";

/* ═══════════════════════════════════════════
   Login Page V3 — 对标 design-preview .login-screen
   · 渐变背景 var(--grad-login)
   · 品牌图标 + 卡片阴影
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

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "linear-gradient(135deg, var(--color-gray-50) 0%, var(--color-brand-50) 100%)" }}>
      <div className="w-full max-w-[420px] bg-[var(--color-surface)] rounded-2xl p-10 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)] border border-[var(--color-border-default)]">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <path d="M9 14l2 2 4-4"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">Task OS</h1>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-8">不是记录任务，而是减少心理负担</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] text-sm rounded-lg border border-[var(--color-danger-border)]">{error}</div>
          )}

          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1.5">邮箱</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]">
                <MailIcon size={15} />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border-[1.5px] border-[var(--color-border-default)] rounded-xl focus:outline-none focus:ring-[3px] focus:ring-brand-500/15 focus:border-brand-300 transition-all bg-[var(--color-surface)] placeholder:text-[var(--color-text-tertiary)]"
                placeholder="your@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1.5">密码</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]">
                <LockIcon size={15} />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border-[1.5px] border-[var(--color-border-default)] rounded-xl focus:outline-none focus:ring-[3px] focus:ring-brand-500/15 focus:border-brand-300 transition-all bg-[var(--color-surface)] placeholder:text-[var(--color-text-tertiary)]"
                placeholder="至少 6 位"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand-600 text-white rounded-xl text-[14px] font-semibold hover:bg-brand-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--color-text-secondary)] mt-6">
          还没有账号？{" "}
          <Link href="/register" className="text-brand-600 hover:text-brand-700 font-semibold transition-colors">
            注册
          </Link>
        </p>
      </div>
    </div>
  );
}
