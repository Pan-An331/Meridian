import io
p = "BUGS.md"
s = io.open(p, encoding="utf-8").read()

# 更新汇总表：产品代码 12→13
old = "| 产品代码（排期/档案/认证/并发/统计/账户/Today/计时） | 12 | — |"
new = "| 产品代码（排期/档案/认证/并发/统计/账户/Today/计时） | 13 | — |"
assert old in s
s = s.replace(old, new)
old = "| 合计 | **33** | **4** |"
new = "| 合计 | **34** | **4** |"
assert old in s
s = s.replace(old, new)

# 追加 BUG-052
content = """

#### BUG-20260808-052：planned 任务被拖拽排期后误判「固定时间」卡，提前执行不可达（产品 Bug）
- **状态**：已修复 ｜ 2026-08-08
- **现象**：11-fullflow-ui 环节 ⑤ 路线点击任务 A（无子任务+有排期）后前置卡显示「固定时间 · 到点自动完成」（无「出发」按钮）→ 提前执行不可达；此前通过属「排期失败反而假绿」（A 无排期→learning→出发）
- **根因**：`toCardV2` 的 timer 判定 `hasSchedule ? "timer"` 过宽——用户手动拖拽排期的 planned 任务被误判为「固定时间」；但惰性结算（到点自动完成）仅对 taskType=scheduled 生效，planned 不会自动完成，卡片语义错误且交互错乱
- **修复**：timer 判定收窄为 `hasSchedule && taskType === "scheduled"`；planned+排期+无子任务 → learning 卡（「出发」→计时→完成）
- **代码变更**：`src/app/(dashboard)/today/page.tsx` toCardV2（type 判定）
- **联动脚本**：12-daily-flow 环节 8 E（planned 组会）改 learning 交互；11-fullflow-ui 搜索定位改「未 」前缀（text= 误匹配主卡 heading）
- **验证**：11+12 定向重跑 `2 passed (6.2m)`；单元 95/95、tsc 0 错误
"""
with io.open(p, "a", encoding="utf-8", newline="\n") as f:
    f.write(content)
print("BUGS.md BUG-052 已登记")
