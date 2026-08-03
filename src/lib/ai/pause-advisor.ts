// Step16 — 暂停建议规则引擎（纯规则，可替换为 LLM）

export interface PauseContext {
  reason: string;           // pause reason code
  taskTitle: string;
  elapsedMin: number;       // how long they've been working
  plannedMin: number;       // total planned
  progressPct: number;      // 0-100
  hasHistoryPauses: boolean; // past frequent pauses?
}

export interface PauseOption {
  action: "resume" | "switch" | "adjust" | "rest";
  label: string;
  description: string;
  recommended: boolean;
}

export interface PauseAdvice {
  insight: string;
  detail: string;
  options: PauseOption[];
}

export function getPauseAdvice(ctx: PauseContext): PauseAdvice {
  const { reason, taskTitle, elapsedMin, plannedMin, progressPct, hasHistoryPauses } = ctx;
  const nearDone = progressPct >= 70;

  switch (reason) {
    // ── 精力下降 ──
    case "tired": {
      const opts: PauseOption[] = [];
      opts.push({ action: "rest", label: "休息一会儿", description: "休息 10-15 分钟，恢复精力后再回来", recommended: true });
      if (nearDone) {
        opts.push({ action: "resume", label: `继续完成${taskTitle}（剩余${Math.max(0, 100 - progressPct)}%）`, description: "只剩最后一点，坚持完成再休息", recommended: false });
      }
      opts.push({ action: "switch", label: "切换到简单任务", description: "先做不需要高度专注的事情热身", recommended: !nearDone });
      return {
        insight: "精力下降是正常的，不必勉强",
        detail: `你已经工作了 ${elapsedMin} 分钟${nearDone ? "，接近完成了" : ""}。${hasHistoryPauses ? "注意到你最近经常因疲劳暂停，建议之后把高难度任务安排在精力更好的时段。" : ""}`,
        options: opts,
      };
    }

    // ── 遇到困难 ──
    case "stuck": {
      return {
        insight: "遇到困难不代表能力不足",
        detail: `${taskTitle}已经完成了 ${progressPct}%。可以尝试把任务拆成更小的步骤，或稍后向 AI 求助分析难点。`,
        options: [
          { action: "adjust", label: "调整任务计划", description: "降低预期，只完成核心部分", recommended: true },
          { action: "switch", label: "先做其他任务", description: "换个思路，稍后再回来", recommended: false },
          { action: "resume", label: "再试一次", description: "休息5分钟后继续", recommended: false },
        ],
      };
    }

    // ── 被其他事情打断 ──
    case "interrupted": {
      const opts: PauseOption[] = [
        { action: "resume", label: `继续${taskTitle}`, description: "处理完干扰后直接回来", recommended: progressPct > 40 },
      ];
      opts.push({ action: "switch", label: "先做简单任务热身", description: "被打断后先做容易的事重新进入状态", recommended: progressPct <= 40 });
      return {
        insight: "被打断后重新进入状态需要时间",
        detail: `当前任务已完成 ${progressPct}%。${progressPct > 50 ? "已经投入不少时间，建议稍后继续。" : "如果频繁被打断，可以考虑调整到更安静的时间段。"}`,
        options: opts,
      };
    }

    // ── 需要处理临时任务 ──
    case "urgent": {
      return {
        insight: "临时任务完成后记得回来",
        detail: `${taskTitle}已完成 ${progressPct}%，预计还需约 ${Math.max(0, plannedMin - elapsedMin)} 分钟。`,
        options: [
          { action: "adjust", label: "调整今日计划", description: "把当前任务延期，先处理临时的", recommended: true },
          { action: "resume", label: "快速完成当前任务", description: `还剩 ${Math.max(0, plannedMin - elapsedMin)} 分钟，先做完再说`, recommended: false },
        ],
      };
    }

    // ── 主动调整计划 ──
    default: {
      return {
        insight: "主动调整计划是高效的表现",
        detail: `已记录本次暂停。${taskTitle}已完成 ${progressPct}%。`,
        options: [
          { action: "adjust", label: "重新安排今天计划", description: "用 AI 助手调整任务优先级", recommended: false },
          { action: "resume", label: "继续执行", description: "按原计划推进", recommended: true },
          { action: "switch", label: "换一个任务", description: "从今日重点中选择替代", recommended: false },
        ],
      };
    }
  }
}
