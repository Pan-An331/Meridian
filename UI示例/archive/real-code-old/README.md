# Task OS · 导航 UI 真实代码包

> 本目录是「导航设计方案」的可落地代码，**未改动项目 src/**。
> 核对无误后，按下方映射复制进项目即可。
> 设计依据：`../导航方案实施文档.md` · 视觉预览：`../导航栏方案演示.html`

## 文件映射

| 本包路径 | 落点（项目 src/） | 说明 |
|---------|------------------|------|
| `lib/ui-preferences.ts` | `src/lib/ui-preferences.ts` | 新增：导航形态 + Focus Card 版式偏好（localStorage） |
| `components/nav/nav-items.ts` | `src/components/nav/nav-items.ts` | 新增：共享导航项定义（工作流序 ①②③④） |
| `components/nav/sidebar.tsx` | `src/components/sidebar.tsx` | **改造**：工作流排序 + 序号 + Today「默认」徽章 + 设置降级底部 |
| `components/nav/topbar.tsx` | `src/components/topbar.tsx` | 新增：顶栏导航（形态 B） |
| `components/nav/mobile-nav.tsx` | `src/components/mobile-nav.tsx` | **改造**：只留 4 个主 Tab（设置移出） |
| `components/layout/dashboard-shell.tsx` | `src/components/DashboardShell.tsx` | **改造**：读偏好渲染 侧栏/顶栏 + 内容宽度容器 |
| `components/layout/content-container.tsx` | `src/components/layout/ContentContainer.tsx` | 新增：页面级宽度规则（720 / 1000 / 1100 居中） |
| `components/settings/nav-layout-settings.tsx` | `src/components/settings/NavLayoutSettings.tsx` | 新增：设置页「导航与版式」卡（事件广播） |
| `components/today/focus-card-layouts.tsx` | `src/components/today/` | 新增：Focus Card 一栏/两栏骨架 + `useFcLayout()` |
| `app/(dashboard)/layout.tsx` | `src/app/(dashboard)/layout.tsx` | **改造**：默认落地 `/today`（待确认首页规则） |

## 宽度规则（ContentContainer）

| 页面 | 侧栏模式 | 顶栏模式 |
|------|---------|---------|
| Today / Plan | `max-w-[1000px]` | `max-w-[1100px]` |
| Inbox / Review / 设置 | `max-w-[720px]` | `max-w-[720px]` |

均 `mx-auto` 居中；`DashboardShell` 传对应 padding（侧栏 `px-10` / 顶栏 `px-12`）保证呼吸留白。

## 设置联动（事件广播）

设置页 `NavLayoutSettings` 修改后通过 CustomEvent 广播：

```
taskos:nav-change    → DashboardShell 监听 → 切换 侧栏/顶栏
taskos:fclayout-change → Today 页 useFcLayout() 监听 → 切换 一栏/两栏
```

持久化：`localStorage`（`taskos.nav` / `taskos.fcLayout`），首版可用，后续可迁移 UserProfile。

## Focus Card 集成说明

- `focus-card-layouts.tsx` 提供 `FocusCardLayoutOne`（一栏放大版）与 `FocusCardLayoutTwo`（两栏：左信息栏/右内容区）两个骨架，以及 `FocusCardData` / `ChecklistItem` 数据形态
- 接入：现有 `FocusTaskCard.tsx`（V3，真实执行状态）内部按 `useFcLayout()` 渲染对应版式组件；主体区按任务类型渲染（计时型→圆环计时器、清单型→执行清单、学习型→知识点勾选）
- 两栏版式在 `<700px` 容器降级一栏（`flex-wrap` / 媒体查询）

## 落地顺序

1. 复制 `ui-preferences.ts` → `nav-items.ts` → `content-container.tsx`（无依赖）
2. 替换 `sidebar.tsx` / `mobile-nav.tsx` / `DashboardShell.tsx`（互相依赖）
3. 新增 `topbar.tsx`、`NavLayoutSettings.tsx`，设置页挂载该卡
4. Focus Card：`focus-card-layouts.tsx` 接入 `FocusTaskCard.tsx`
5. 确认默认落地页（`/today`）规则后改 `(dashboard)/layout.tsx`
6. `npm run build` 验收（55 页面零错误）

## 验收清单

- [ ] 设置页切换导航形态 → 桌面立即切换 侧栏/顶栏，刷新后保留
- [ ] 设置页切换 Focus Card 版式 → Today 立即切换 一栏/两栏
- [ ] 宽度：Today/Plan 侧栏 1000 / 顶栏 1100 居中；其余 720
- [ ] 移动端底部 4 tab（无设置），设置从页头齿轮进入
- [ ] Ctrl+↑↓ 页面循环切换正常
- [ ] `npm run build` 通过
