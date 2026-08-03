import MeridianLogo from "@/components/auth/MeridianLogo";

/* ═══════════════════════════════════════════
   AuthBrand — 登录/注册品牌区（v4 定稿 · 文案三层结构）
   · Logo（C 方案）+ 主 Slogan + 解释句（不可拆分）+ 故事段
   · 价值三卡（子午为向/正午为时/万千归一）+ 流程条 + 信任条 + 水印
   · 文案规格：docs/Meridian-登录页品牌文案规格-2026-08-03.md §2.1
   ═══════════════════════════════════════════ */

const VALUES = [
  { t: "子午为向", d: "AI 从纷繁里帮你挑出主线，过滤未来" },
  { t: "正午为时", d: "专注当下，今天只围绕一条中轴运转" },
  { t: "万千归一", d: "复盘成长闭环，看见自己的中轴" },
];
const FLOW = ["输入", "规划", "执行", "复盘"];

export default function AuthBrand() {
  return (
    <div className="auth-brand">
      <div className="ring" />
      <div className="ring r2" />
      {/* 中轴水印（右下 · 低透明度） */}
      <div className="wm">
        <MeridianLogo size={140} />
      </div>

      {/* Logo 行 */}
      <div className="flex items-center gap-3 mb-8">
        <MeridianLogo size={40} />
        <span className="text-[20px] font-extrabold tracking-[1px]">Meridian</span>
        <span className="text-[11px] opacity-85 tracking-[2px] border-l border-white/30 pl-2.5">子午</span>
        <span className="text-[9.5px] opacity-60 border border-white/25 rounded-lg px-2 py-0.5 ml-1.5 tracking-[0.5px]">BETA</span>
      </div>

      {/* ① 主 Slogan（34px 单行） */}
      <div className="text-[30px] sm:text-[34px] font-extrabold tracking-[2px] leading-[1.3] whitespace-nowrap">你的时间，自有中轴。</div>
      {/* ② 解释句（紧贴下方 · 不可拆分） */}
      <div className="text-[15px] sm:text-[16px] text-white/72 mt-3 tracking-[0.5px]">一天有万千事物，总有一条中轴。</div>
      {/* ③ 品牌故事段 */}
      <div className="text-[13.5px] text-white/60 leading-[1.85] mt-6">子午为向，正午为时——把脑海里的纷繁交给 Meridian，每一天围绕真正重要的事物运转。</div>

      {/* 价值点三卡 */}
      <div className="flex gap-2.5 mt-6">
        {VALUES.map((v) => (
          <div key={v.t} className="flex-1 bg-white/7 border border-white/14 rounded-xl px-3 py-3">
            <div className="w-[26px] h-[26px] rounded-lg bg-amber-400/16 flex items-center justify-center mb-2">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#F59E0B" strokeWidth="2" /><line x1="8" y1="8" x2="8" y2="2.5" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" /></svg>
            </div>
            <div className="text-[12px] font-semibold tracking-[0.3px]">{v.t}</div>
            <div className="text-[10.5px] text-white/62 mt-1 leading-[1.5]">{v.d}</div>
          </div>
        ))}
      </div>

      {/* 成长闭环流程 */}
      <div className="flex items-center gap-2 mt-6 px-3.5 py-3 bg-white/6 rounded-xl">
        {FLOW.map((f, i) => (
          <div key={f} className="flex items-center gap-2">
            <span className="w-[22px] h-[22px] rounded-full bg-[#F59E0B] text-white text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
            <span className="text-[11.5px] font-semibold tracking-[0.3px]">{f}</span>
            {i < FLOW.length - 1 && <span className="text-white/40 text-[12px]">→</span>}
          </div>
        ))}
      </div>

      {/* 底部信任条 */}
      <div className="flex items-center gap-2 mt-auto pt-7 text-[11px] text-white/55">
        <span className="w-[6px] h-[6px] rounded-full bg-[#F59E0B] shrink-0" />
        已帮你记录 <b className="text-white/85 font-semibold">1,284</b> 小时专注 · 沉淀 <b className="text-white/85 font-semibold">12</b> 条个人中轴
      </div>
    </div>
  );
}
