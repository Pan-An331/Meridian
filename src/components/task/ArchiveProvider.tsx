"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { TaskArchivePanel } from "@/components/task/TaskArchivePanel";

/* ═══════════════════════════════════════════
   ArchiveProvider — V3 任务档案面板全局挂载
   · 任意页面通过 useArchive().open(taskId) 打开 560px 档案面板
   · 挂载在 DashboardShell（layout 级），搜索/周历/卡片共用
   ═══════════════════════════════════════════ */

interface ArchiveCtx {
  open: (taskId: string, seed?: { title?: string; category?: string | null; startTime?: string; endTime?: string | null }) => void;
  close: () => void;
}

const Ctx = createContext<ArchiveCtx>({ open: () => {}, close: () => {} });

export function useArchive() {
  return useContext(Ctx);
}

export function ArchiveProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<{ taskId: string; seed?: { title?: string; category?: string | null; startTime?: string; endTime?: string | null } } | null>(null);

  const open = useCallback((taskId: string, seed?: ArchiveCtx["open"] extends (...a: infer A) => void ? A[1] : never) => {
    setTarget({ taskId, seed });
  }, []);
  const close = useCallback(() => setTarget(null), []);

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      {target && (
        <TaskArchivePanel
          taskId={target.taskId}
          seed={target.seed}
          onClose={close}
        />
      )}
    </Ctx.Provider>
  );
}
