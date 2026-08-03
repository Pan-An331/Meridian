# Task OS · 导航代码包评审报告（资深开发）

> 评审对象：`UI示例/真实代码/`（10 文件）
> 评审视角：Senior Developer · 代码质量与工程可维护性
> 结论：**P0 × 2（已修复）· P1 × 4（建议落地前处理）· P2 × 5（规范项）**

---

## 一、P0 · 阻断级（已修复 ✅）

### P0-1 JSX 编译错误 — `focus-card-layouts.tsx` L53-54
**问题**：复选框 `<span className="...${it.done ? '...' : '...'}">` 把 `${}` 表达式写进了**普通双引号字符串**的 className 里。JSX 属性若需表达式必须用模板字符串（反引号），否则 SWC 编译直接报错 → `npm run build` 必挂。
**影响**：构建失败，整个包不可用。
**修复**：改为 `className={\`...${it.done ? "bg-[#d4a853] text-white" : "border border-[#d4a853]"}\`}`。

### P0-2 除零隐患 — `focus-card-layouts.tsx` L89
**问题**：`(data.doneCount / data.totalCount) * 100`，当清单为空（totalCount=0）时产出 `NaN%`，进度条宽度和百分比文本都会渲染异常。
**修复**：新增 `clampProgress(n)`（NaN/Infinity 回落 0，收敛 0-100）与 `ratioPercent(done, total)`（total≤0 返回 0），两处进度条 + 百分比文本统一走 `ratioPercent`。

---

## 二、P1 · 工程隐患（建议落地前处理）

### P1-1 Hydration 不一致（导航形态闪烁）
`DashboardShell` 初始 `navMode="side"`，`useEffect` 里才读 localStorage → **SSR 渲染侧栏，客户端可能换成顶栏**，首帧会闪一下导航形态。
**建议**：
- 短期：接受闪烁，并在代码注释 + README 标注（当前包内已如此）
- 中期：偏好上移为 **cookie**，由 `middleware.ts` 读取并注入，服务端直接拿到正确形态（消除闪烁）
- 长期：迁移 `UserProfile` 表字段，实现多端同步

### P1-2 CustomEvent 类型不安全
`useFcLayout` 中 `(e as CustomEvent).detail as FcLayout` 直接断言——若外部广播非法值（如 `"3"`），状态进入非法态。
**建议**：定义事件名与 payload 的类型常量，接收时校验：
```ts
const FC_LAYOUT_CHANGE = "taskos:fclayout-change";
function isFcLayout(v: unknown): v is FcLayout { return v === 1 || v === 2; }
// detail 校验通过才 setState，否则忽略并保留当前值
```

### P1-3 路径列表三处散落，易漂移
`navOrder`（shell）、`WIDE_PATHS`（container）、`NAV_ITEMS`（nav-items）各自维护页面路径，新增页面时容易漏改。
**建议**：收敛到单一数据源 `src/lib/navigation.ts`：
```ts
export const PAGE_ROUTES = {
  inbox: "/inbox", plan: "/plan", today: "/today", review: "/review", settings: "/settings",
} as const;
export const WORKFLOW_ORDER = [PAGE_ROUTES.inbox, PAGE_ROUTES.plan, PAGE_ROUTES.today, PAGE_ROUTES.review] as const;
export const WIDE_ROUTES = new Set([PAGE_ROUTES.today, PAGE_ROUTES.plan, "/week"]);
```
所有组件从这一处 import，杜绝漂移。

### P1-4 `doneCount/totalCount` 与 `items` 数据冗余
`FocusCardData` 同时暴露 `doneCount/totalCount` 与 `items`——两者可能不一致（调用方手填错）。
**建议**：数据驱动单一来源，`doneCount` 由 `items.filter(i => i.done).length` 推导（组件内部计算），接口只收 `items`。`progress` 同理可推导，或保留但文档化"必须与 items 一致"。

---

## 三、P2 · 规范与优化

| # | 项 | 建议 |
|---|----|------|
| P2-1 | 序号 ①②③④ 手写在 nav-items | 用 `const NUMS = ["①","②","③","④"] as const` 按索引取，避免抄错 |
| P2-2 | `ContentContainer` 每次渲染 `.some()` 扫描 | WIDE_ROUTES 用模块级 `Set`（O(1) 查询） |
| P2-3 | 文案硬编码中文（"已完成 1/3 · 总耗时…"） | 至少抽成模块常量；后续接 i18n |
| P2-4 | `padding` 由 shell 传入 container | 可接受；建议在 README 记录"侧栏 px-10 / 顶栏 px-12"的约定来源（设计稿呼吸留白） |
| P2-5 | 缺少纯函数单测 | `ui-preferences` / `clampProgress` / `ratioPercent` / `ContentContainer` 路由判断都是纯逻辑，优先补单测 |

---

## 四、团队技术提升规范（沉淀为项目约定）

### 1. 组件分层
- **Presentational**（如 `focus-card-layouts.tsx`）：纯展示，props 进数据出 JSX，无副作用、无业务 import
- **Container**（如 `FocusTaskCard.tsx`）：状态、数据获取、事件处理
- 新组件一律遵守：container 可 import presentational，反向禁止

### 2. 防御性编程（外部数据入口三原则）
localStorage / API 响应 / CustomEvent / URL 参数 —— 所有外部数据入口必须：
1. **校验**（类型守卫 `isXxx(v): v is Xxx`）
2. **fallback**（非法值回落默认，不抛错、不进入非法态）
3. **单一出口**（统一 util，不散落各处断言）

### 3. 事件广播规范
- 自定义事件统一 `taskos:` 前缀，集中定义常量表（`src/lib/events.ts`）
- 接收方必须校验 `detail`（见 P1-2），发送方不裸抛

### 4. 偏好存储演进路线
`localStorage`（当前，单端）→ `cookie + middleware`（SSR 无闪烁）→ `UserProfile`（多端同步）——每步都有明确收益，按需推进，不提前过度设计。

### 5. 性能
- 渲染期不做线性扫描（路径判断用 Set）
- 动画只动 `transform`/`opacity`；尊重 `prefers-reduced-motion`
- 组件库 token 优先于硬编码色值（项目已有完整 `@theme` 体系，新代码不得裸写颜色）

### 6. TypeScript 纪律
- 确认 `tsconfig.json` 开启 `strict`（含 `noUncheckedIndexedAccess` 收益最大）
- 配置对象用 `as const` / `satisfies` 收窄
- 禁止 `any`；不可避免时用 `unknown` + 类型守卫

---

## 五、落地前置检查（README 验收清单补充）

- [ ] 修复后的 `focus-card-layouts.tsx` 通过 `npm run build`（P0 回归）
- [ ] P1-1 hydration：决定接受闪烁 or 走 cookie 方案
- [ ] P1-3：路径收敛到 `lib/navigation.ts` 单数据源后再合入
- [ ] 补 `clampProgress` / `ratioPercent` / 偏好读写的最小单测

---
*评审完成：P0 已修复；P1 建议合入前处理；P2 在迭代中随手落实。*
