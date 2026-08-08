# -*- coding: utf-8 -*-
import io

content = """

#### BUG-20260807-038：今日决策缓存不随任务创建失效（产品 Bug，扩展覆盖 confirm 链路）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：today_decision 首次打开 Today 生成后存在即返回；tasks POST 已删决策但 Inbox 确认创建（confirm-service）未覆盖 → 用户先开 Today 再录入，新任务永不进 mustDo
- **修复**：confirm-service 创建后删今日决策；/api/tasks POST 同步
- **验证**：全流程用例环节 6/7 决策重算生效

#### BUG-20260807-039：Inbox 设截止后确认创建 500（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：task-builder 假定 deadline 为 YYYY-MM-DD 拼接 T23:59:59；前端 onModify 传完整 ISO → 二次拼接 Invalid Date → Prisma 500
- **修复**：toDeadlineDate 兼容两种格式（date-only 拼接 / ISO 直接解析）
- **验证**：curl confirm(deadline ISO) 200；E2E 环节 1/2-D/B 通过

#### BUG-20260807-040：带空格时间表达无法识别为 scheduled（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：parser 正则不匹配数字与点之间带空格（真实输入「早上 8 点」）
- **修复**：正则改 \\s*\\d{1,2}\\s*点
- **验证**：curl analyze 返回 scheduled + 08:00 排期

#### BUG-20260807-041：Inbox scheduled 任务确认后丢失排期（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：analyze 返回 startTime/endTime，confirm-service 未写 Schedule → 惰性结算/今日路线/续排全失效
- **修复**：confirm-service 对 scheduled 任务按 startTime/endTime 补建排期
- **验证**：curl confirm 后 schedules=1；E2E 环节 1/2-F2 通过

#### BUG-20260807-042：积累孤儿被排除在待整理池外（产品死链）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：待整理池过滤 accumulate → 积累任务无法挂树 → 无法 ★ → 无法排期 → Today 积累卡今日不可达
- **修复**：待整理池包含积累孤儿（可挂树；习惯区保留）
- **验证**：E2E 环节 3 挂 C 成功

#### BUG-20260807-043：完成路线前置卡后 routeSel 不清除（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：complete 后 routeSel 仍指向旧任务 → 静态未出发前置卡占主卡
- **修复**：doAction complete 成功后 setRouteSel(null)
- **验证**：E2E 环节 6 到 7 主卡切换正常

#### BUG-20260807-044：路线选中任务的前置卡写死 checklist+空清单（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：routeSel 前置卡 items 空 + type 固定 checklist
- **修复**：点击时 fetch 任务详情用 toCardV2 真实构造
- **验证**：E2E 环节 5 A 卡真实清单勾选通过

#### BUG-20260807-045：GET 任务 children 字段 title 与 toCardV2 期待 text 不匹配（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：前置卡 routeSelTask 直接喂 toCardV2 → 清单项文本空
- **修复**：前置卡构造归一化 children（title 到 text）
- **验证**：E2E 环节 5 勾选通过

#### BUG-20260807-046：routeSelTask 不随 load 刷新（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：新增/勾选后 load() 刷新 data 但前置卡详情不更新
- **修复**：useEffect 监听 routeSel/data 同步刷新
- **验证**：E2E 环节 5 新增子项显示通过

#### BUG-20260807-047：任务完成不失效今日决策，mustDo 长期指向已完成任务（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：决策缓存存在即返回；mustDo 项无 status 无法前端跳过
- **修复**：complete 后删今日决策；mustDo 项带 status；前端兜底跳过已完成
- **验证**：E2E 环节 6 到 7 决策重算生效

#### BUG-20260807-048：积累任务默认 imp3 使 mustDo 排序异常（测试数据设计）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：C 未设低（imp3：排期30+6=36 大于 D 的 35）抢占 mustDo[0]（curl 铁证）
- **修复**：脚本 C 录入时设低
- **验证**：环节 7 D 成为 mustDo[0]

#### BUG-20260807-049：enhanceCard 用 buildChecklist 补 children，学习型误判清单型（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：mustDo 兜底卡 children 含 description 拆行项 → hasChildren=true → 无子任务的学习型显示为清单型
- **修复**：enhanceCard 只取真实子任务
- **验证**：curl mustDo children=[]；待全流程确认
"""
with io.open("BUGS.md", "a", encoding="utf-8", newline="\n") as f:
    f.write(content)
print("BUGS.md 追加完成")
