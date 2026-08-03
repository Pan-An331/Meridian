"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { DOMAINS, normalizeCategory } from "@/lib/plan/colors";

// 收件箱分类短名（与 Review 图例一致）
const INBOX_SHORT: Record<string, string> = {
  course: "课程", learning: "学习", practice: "实践", competition: "竞赛",
  health: "健康", life: "生活", external: "外部", other: "未分类",
};

/* ═══════════════════════════════════════════
   Project · 项目整理页（V5 层级重构）
   · 数据源：GET /api/projects/tree + POST /api/projects/move
   · 树 = 产出型层级（项目根/阶段/★任务）；习惯区 = 积累型独立成列
   · 交互：拖拽=成为子级；悬停 ↑↓=换序；新建类型自动推断；键盘流 Enter/Tab/Shift+Tab
   · 方案 B：积累型不进树，右侧习惯区点阵打卡
   ═══════════════════════════════════════════ */

/* ── 类型 ── */
interface TreeNode {
  id: string;
  title: string;
  level: string;
  status: string;
  accumulate: boolean;
  completedAt: string | null;
  category: string | null;
  estimatedMinutes: number | null;
  deadline: string | null;
  importance: number;
  parentId: string | null;
  children: TreeNode[];
}
interface TreeResponse {
  trees: TreeNode[];
  orphans: TreeNode[];
}
interface StreakInfo {
  current: number;
  longest: number;
  lastDate: string | null;
  todayChecked: boolean;
  last30: string[];
}

const LEVEL_LABEL: Record<string, string> = { project: "项目", phase: "阶段", task: "★ 任务" };

/* ── 工具 ── */
function findNode(list: TreeNode[], id: string): TreeNode | null {
  for (const n of list) {
    if (n.id === id) return n;
    const f = findNode(n.children || [], id);
    if (f) return f;
  }
  return null;
}
function findParent(list: TreeNode[], id: string): TreeNode | null {
  for (const n of list) {
    if ((n.children || []).some(c => c.id === id)) return n;
    const f = findParent(n.children || [], id);
    if (f) return f;
  }
  return null;
}
function isDescendant(node: TreeNode, maybeDesc: string): boolean {
  const stack = [...(node.children || [])];
  while (stack.length) {
    const c = stack.pop()!;
    if (c.id === maybeDesc) return true;
    stack.push(...(c.children || []));
  }
  return false;
}
function flatten(list: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  for (const n of list) {
    out.push(n);
    out.push(...flatten(n.children || []));
  }
  return out;
}
function countDone(list: TreeNode[]): number {
  return list.reduce((acc, n) => acc + (n.status === "completed" ? 1 : 0) + countDone(n.children || []), 0);
}

const cardCls = "bg-[var(--v2-card)] border border-[var(--v2-border)] rounded-xl sh-v2";
const inputCls = "text-sm px-3 py-1.5 rounded-lg border border-[var(--v2-border)] bg-white focus:outline-none focus:border-[var(--v2-brand)]";
const btnGhost = "text-sm font-medium rounded-lg border border-[var(--v2-border)] text-[var(--v2-text2)] hover:bg-[var(--color-gray-50)] transition-all px-3 py-1.5";
const btnPrimary = "text-sm font-medium rounded-lg bg-[var(--v2-brand)] text-white hover:bg-[var(--v2-brand-deep)] transition-all px-4 py-1.5";

/* ── 图标（行内小 SVG，Feather 风格） ── */
const Ic = {
  folder: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></svg>,
  phase: <svg viewBox="0 0 24 24" fill="#9ca3af" width="10" height="10"><circle cx="12" cy="12" r="5" /></svg>,
  star: <svg width="13" height="13" viewBox="0 0 24 24" fill="#6366f1" stroke="#6366f1" strokeWidth="1.4" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  task: <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" width="12" height="12"><circle cx="12" cy="12" r="4" /></svg>,
  check: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" width="11" height="11"><polyline points="9 18 15 12 9 6" /></svg>,
  dots: <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>,
  grip: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="12" height="12"><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg>,
  cal: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  up: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>,
  down: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>,
};

function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="fixed left-1/2 bottom-8 -translate-x-1/2 z-[99] bg-[#1f2937] text-white text-[13px] px-4 py-2.5 rounded-xl shadow-lg max-w-[80vw] text-center">
      <span dangerouslySetInnerHTML={{ __html: msg }} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   主页面
   ═══════════════════════════════════════════ */
export default function ProjectsPage() {
  const [trees, setTrees] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [treeSearch, setTreeSearch] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [streaks, setStreaks] = useState<Record<string, StreakInfo>>({});
  const [mode, setMode] = useState<"A" | "B">("A"); // 设计稿模式：A=单任务聚焦+执行清单 / B=同级任务
  const [bOpen, setBOpen] = useState<Set<string>>(new Set()); // 模式 B：展开查看各自清单

  // 新建表单状态
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTarget, setNewTarget] = useState<{ parentId: string | null; mode: "child" | "sibling" | "root" }>({ parentId: null, mode: "root" });
  const [newType, setNewType] = useState<string>("project");
  const newInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((html: string) => {
    setToastMsg(html);
    setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const r = await fetch("/api/projects/tree");
      if (!r.ok) throw new Error();
      const d: TreeResponse = await r.json();
      setTrees(d.trees || []);
      // 默认展开全部项目根
      setExpanded(prev => {
        const next = new Set(prev);
        (d.trees || []).forEach(t => next.add(t.id));
        return next;
      });
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 习惯区 streak 数据（所有积累型任务）
  useEffect(() => {
    if (!trees.length) return;
    const accTasks = flatten(trees).filter(t => t.accumulate);
    if (!accTasks.length) return;
    let alive = true;
    accTasks.forEach(async (t) => {
      try {
        const r = await fetch(`/api/tasks/${t.id}/streak`);
        if (r.ok) {
          const d = await r.json();
          if (alive) setStreaks(prev => ({ ...prev, [t.id]: d.streak }));
        }
      } catch { /* 静默 */ }
    });
    return () => { alive = false; };
  }, [trees]);

  /* ── 数据派生 ── */
  const allNodes = flatten(trees);
  const habits = allNodes.filter(t => t.accumulate);                      // 习惯区（含挂树的习惯）
  const [poolList, setPoolList] = useState<TreeNode[]>([]);
  const [hintOff, setHintOff] = useState(false); // 三步上手横幅可关闭（localStorage 记忆）
  const [archiveList, setArchiveList] = useState<TreeNode[]>([]);

  // 读取横幅关闭记忆
  useEffect(() => {
    try { if (localStorage.getItem("taskos.projects.hint.dismissed") === "1") setHintOff(true); } catch { /* 存储不可用忽略 */ }
  }, []);

  useEffect(() => {
    if (!trees.length) return;
    // 树外孤儿：未挂树的 task 级任务 → 待整理池（产出型） + 习惯区（积累型）
    fetch("/api/projects/tree").then(async r => {
      if (!r.ok) return;
      const d: TreeResponse = await r.json();
      const orphans = (d.orphans || []).filter(o => o.status !== "cancelled");
      setPoolList(orphans.filter(o => !o.accumulate));
      // 归档：全部已完成任务（树内 + 孤儿已完成）
      const doneInTree = flatten(d.trees || []).filter(t => t.status === "completed");
      const doneOrphans = (d.orphans || []).filter(o => o.status === "completed");
      setArchiveList([...doneInTree, ...doneOrphans].filter((v, i, a) => a.findIndex(x => x.id === v.id) === i));
    }).catch(() => {});
  }, [trees]);

  /* ── API 操作 ── */
  const moveNode = useCallback(async (taskId: string, newParentId: string | null, sortOrder?: number) => {
    const r = await fetch("/api/projects/move", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, newParentId, sortOrder }),
    });
    if (!r.ok) throw new Error("移动失败");
  }, []);

  const updateTask = useCallback(async (id: string, data: Record<string, unknown>) => {
    const r = await fetch(`/api/tasks/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error("更新失败");
  }, []);

  const createTask = useCallback(async (data: Record<string, unknown>) => {
    const r = await fetch("/api/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error("创建失败");
    return r.json();
  }, []);

  const doAction = useCallback(async (taskId: string, action: string, extra: Record<string, unknown> = {}) => {
    const r = await fetch(`/api/tasks/${taskId}/action`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    if (!r.ok) throw new Error("操作失败");
  }, []);

  /* ── 同级排序（↑↓） ── */
  const moveSibling = useCallback(async (node: TreeNode, dir: number) => {
    const parent = findParent(trees, node.id);
    const siblings = parent ? (parent.children || []) : trees;
    const idx = siblings.findIndex(s => s.id === node.id);
    const ni = idx + dir;
    if (ni < 0 || ni >= siblings.length) return;
    const arr = [...siblings];
    const [n] = arr.splice(idx, 1);
    arr.splice(ni, 0, n);
    try {
      // 逐个写 sortOrder（0..n-1）
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].id !== siblings[i]?.id) await moveNode(arr[i].id, parent?.id || null, i);
      }
      setSelectedId(node.id);
      showToast(`已${dir < 0 ? "上移" : "下移"}「${node.title}」`);
      await load();
    } catch { setError(true); }
  }, [trees, moveNode, load, showToast]);

  /* ── 新建：类型自动推断 ── */
  const inferType = useCallback(() => {
    if (!newTarget.parentId) return "project";
    const p = findNode(trees, newTarget.parentId);
    if (!p) return "project";
    if (p.level === "project") return "phase";
    return "task";
  }, [newTarget, trees]);

  const legalTypes = useCallback(() => {
    if (!newTarget.parentId) return ["project", "task"];
    const p = findNode(trees, newTarget.parentId);
    if (!p) return ["project", "task"];
    if (p.level === "project") return ["phase", "task"];
    return ["task"];
  }, [newTarget, trees]);

  const openCreateForm = useCallback((target: { parentId: string | null; mode: "child" | "sibling" | "root" }) => {
    setNewTarget(target);
    setNewOpen(true);
    setNewTitle("");
    setNewType(inferTypeRef.current());
  }, []);

  // inferType 需要读取最新 newTarget，用 ref 桥接
  const newTargetRef = useRef(newTarget);
  newTargetRef.current = newTarget;
  const inferTypeRef = useRef(inferType);
  inferTypeRef.current = () => {
    const t = newTargetRef.current;
    if (!t.parentId) return "project";
    const p = findNode(trees, t.parentId);
    if (!p) return "project";
    if (p.level === "project") return "phase";
    return "task";
  };

  const cycleType = useCallback(() => {
    const legal = legalTypes();
    const idx = legal.indexOf(newType);
    setNewType(legal[(idx + 1) % legal.length]);
  }, [legalTypes, newType]);

  const createNode = useCallback(async () => {
    const v = newTitle.trim();
    if (!v) return;
    const target = newTargetRef.current;
    const level = newType;
    const body: Record<string, unknown> = { title: v, level, taskType: "task" };
    if (target.mode === "child" && target.parentId) {
      body.parentId = target.parentId;
    } else if (target.mode === "sibling" && target.parentId) {
      const parent = findParent(trees, target.parentId);
      body.parentId = parent?.id || null;
    } else {
      body.parentId = null;
    }
    try {
      const d = await createTask(body);
      setNewOpen(false);
      setSelectedId(d.task?.id || null);
      showToast(`已创建「${v}」`);
      await load();
    } catch { setError(true); }
  }, [newTitle, newType, createTask, trees, load, showToast]);

  /* ── 键盘流（Workflowy 习惯） ── */
  const handleKbd = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (e.key === "Escape") { setNewOpen(false); setSelectedId(null); return; }
    if (!selectedId) return;
    const node = findNode(trees, selectedId);
    if (!node) return;
    const parent = findParent(trees, selectedId);
    const siblings = parent ? (parent.children || []) : trees;
    const idx = siblings.findIndex(s => s.id === selectedId);

    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      openCreateForm({ parentId: parent?.id || null, mode: "sibling" });
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const prev = idx > 0 ? siblings[idx - 1] : null;
      if (prev) {
        moveNode(selectedId, prev.id).then(() => {
          showToast(`「${node.title}」已缩进为「${prev.title}」的子级`);
          load();
        }).catch(() => setError(true));
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      if (parent) {
        const gp = findParent(trees, parent.id);
        moveNode(selectedId, gp?.id || null).then(() => {
          showToast(`「${node.title}」已提升层级`);
          load();
        }).catch(() => setError(true));
      }
    }
  }, [selectedId, trees, moveNode, load, showToast, openCreateForm]);

  useEffect(() => {
    window.addEventListener("keydown", handleKbd);
    return () => window.removeEventListener("keydown", handleKbd);
  }, [handleKbd]);

  /* ── 拖拽（只做"成为子级"） ── */
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<"tree" | "pool" | "archive" | null>(null);
  const [dragOver, setDragOver] = useState<{ id: string; state: "child" | "forbidden" } | null>(null);
  // 执行清单拖拽排序 state
  const [checkDragId, setCheckDragId] = useState<string | null>(null);
  const [checkOverId, setCheckOverId] = useState<string | null>(null);

  // 执行清单拖拽排序：拖 A 到 B 行 = 插入到 B 位置，按新顺序重分配 sortOrder
  const reorderChecklist = useCallback(async (parentId: string, draggedId: string, targetId: string) => {
    const parent = findNode(trees, parentId);
    if (!parent) return;
    const kids = parent.children || [];
    const from = kids.findIndex((k) => k.id === draggedId);
    const to = kids.findIndex((k) => k.id === targetId);
    if (from < 0 || to < 0 || from === to) { setCheckDragId(null); setCheckOverId(null); return; }
    const newOrder = [...kids];
    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, moved);
    // 只更新位置变化的项
    const changes: { id: string; newIndex: number }[] = [];
    newOrder.forEach((k, i) => {
      const oldIdx = kids.findIndex((x) => x.id === k.id);
      if (oldIdx !== i) changes.push({ id: k.id, newIndex: i });
    });
    setCheckDragId(null); setCheckOverId(null);
    try {
      for (const c of changes) {
        const r = await fetch("/api/projects/move", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: c.id, newParentId: parentId, sortOrder: c.newIndex }),
        });
        if (!r.ok) throw new Error("排序失败");
      }
      await load(true);
      showToast("清单顺序已调整");
    } catch { setError(true); }
  }, [trees, load]);

  const handleDrop = useCallback(async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const id = dragId;
    const src = dragSource;
    setDragOver(null);
    setDragId(null);
    setDragSource(null);
    if (!id || !src) return;
    if (id === targetId) return;
    const target = findNode(trees, targetId);
    if (!target) return;
    const dragNode = findNode(trees, id);
    if (src === "tree" && dragNode && isDescendant(dragNode, targetId)) {
      showToast("禁止：不能放入自身子树");
      return;
    }
    try {
      await moveNode(id, targetId);
      showToast(`${src === "archive" ? "归档" : src === "pool" ? "挂入" : "移入"}「${src === "pool" ? id : target.title}」→ 成为「${target.title}」的子级`);
      await load();
    } catch { setError(true); }
  }, [dragId, dragSource, trees, moveNode, load, showToast]);

  const onTreeDragOver = useCallback((e: React.DragEvent, node: TreeNode) => {
    e.preventDefault();
    if (!dragId) return;
    const self = dragId === node.id;
    const forbidden = dragSource === "tree" && findNode(trees, dragId) ? isDescendant(findNode(trees, dragId)!, node.id) : false;
    setDragOver(self || forbidden ? { id: node.id, state: "forbidden" } : { id: node.id, state: "child" });
  }, [dragId, dragSource, trees]);

  /* ── 渲染：树节点行 ── */
  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const kids = node.children || [];
    const hasKids = kids.length > 0;
    const isOpen = expanded.has(node.id);
    const isDone = node.status === "completed";
    const isAnchor = node.level === "task";
    const isAccum = node.accumulate;
    const sel = selectedId === node.id;
    const ov = dragOver?.id === node.id;

    return (
      <div key={node.id}>
        <div
          className={`group flex items-center gap-1.5 rounded-lg transition-all select-none relative ${sel ? "bg-[var(--v2-brand-bg)] shadow-[inset_0_0_0_1.5px_var(--v2-brand)]" : "hover:bg-[var(--color-gray-100)]"}`}
          style={{ paddingLeft: 8 + depth * 20, height: 38 }}
          draggable
          onDragStart={(e) => { setDragId(node.id); setDragSource("tree"); e.dataTransfer.effectAllowed = "move"; }}
          onDragEnd={() => { setDragId(null); setDragSource(null); setDragOver(null); }}
          onDragOver={(e) => onTreeDragOver(e, node)}
          onDrop={(e) => handleDrop(e, node.id)}
          onClick={() => setSelectedId(node.id)}
        >
          {/* 选中指示条 */}
          {sel && <span className="absolute left-0 top-[7px] bottom-[7px] w-[3px] rounded-r bg-[var(--v2-brand)]" />}
          {/* 折叠箭头 */}
          <button
            className={`w-[18px] h-[18px] flex items-center justify-center rounded text-[var(--v2-text3)] hover:bg-[var(--color-gray-200)] transition-transform ${isOpen ? "rotate-90" : ""} ${hasKids ? "" : "invisible"}`}
            onClick={(e) => { e.stopPropagation(); setExpanded(prev => { const n = new Set(prev); if (n.has(node.id)) n.delete(node.id); else n.add(node.id); return n; }); }}
          >
            {Ic.arrow}
          </button>
          {/* 层级图标 */}
          <span className="flex-none flex items-center">
            {node.level === "project" ? Ic.folder : isAnchor ? Ic.star : hasKids ? Ic.phase : Ic.task}
          </span>
          {/* 完成勾选（task 且有子级） */}
          {isAnchor && hasKids && (
            <button
              className={`w-[17px] h-[17px] rounded-[5px] flex-none flex items-center justify-center border transition-all ${isDone ? "bg-[var(--v2-green)] border-[var(--v2-green)]" : "border-[#d1d5db] hover:border-[var(--v2-brand)]"}`}
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await doAction(node.id, isDone ? "reopen" : "complete");
                  showToast(`已完成「${node.title}」${isDone ? "（重新打开）" : ""}`);
                  await load();
                } catch { setError(true); }
              }}
            >
              {isDone && <span className="text-white">{Ic.check}</span>}
            </button>
          )}
          {/* 标题 */}
          <span className={`text-[13.5px] min-w-0 truncate ${isAnchor ? "font-semibold" : ""} ${isDone ? "line-through text-[var(--v2-text3)]" : ""}`}>
            {node.title}
          </span>
          {/* 徽章 */}
          {node.level === "project" && <span className="text-[11px] px-[7px] py-px rounded-md bg-[var(--v2-brand-bg)] text-[var(--v2-brand-deep)] font-medium flex-none">项目</span>}
          {node.level === "phase" && !isAnchor && <span className="text-[11px] px-[7px] py-px rounded-md bg-[var(--color-gray-100)] text-[var(--v2-text2)] font-medium flex-none">阶段</span>}
          {isAnchor && <span className="text-[11px] px-[7px] py-px rounded-md bg-[var(--v2-brand)] text-white font-medium flex-none">★</span>}
          {isAccum && <span className="text-[11px] px-[7px] py-px rounded-md bg-[var(--v2-amber-bg)] text-[var(--v2-amber)] font-medium flex-none">积累</span>}
          {isDone && !hasKids && <span className="text-[11px] px-[7px] py-px rounded-md bg-[var(--v2-green-bg)] text-[var(--v2-green-deep)] font-medium flex-none">完成</span>}
          {/* 打卡勾（积累型） */}
          {isAccum && (
            <button
              className={`w-[17px] h-[17px] rounded-[5px] flex-none flex items-center justify-center border transition-all ${streaks[node.id]?.todayChecked ? "bg-[#d97706] border-[#d97706]" : "border-[#d97706] hover:bg-[var(--v2-amber-bg)]"}`}
              title={streaks[node.id]?.todayChecked ? "今日已打卡" : "今日未打卡"}
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const r = await fetch(`/api/tasks/${node.id}/checkin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
                  if (r.ok) {
                    const d = await r.json();
                    setStreaks(prev => ({ ...prev, [node.id]: d.streak }));
                    showToast(`已打卡「${node.title}」· 连续 ${d.streak?.current ?? 0} 天`);
                  }
                } catch { setError(true); }
              }}
            >
              {streaks[node.id]?.todayChecked && <span className="text-white">{Ic.check}</span>}
            </button>
          )}
          {isAccum && <span className="text-[11px] text-[var(--v2-text3)] flex-none">连续 {streaks[node.id]?.current ?? 0} 天</span>}
          {/* 排序 + 新建 + 菜单（悬停显示） */}
          <span className="flex-1" />
          <span className="hidden group-hover:flex items-center gap-0.5 flex-none">
            <button className="w-[22px] h-[22px] flex items-center justify-center rounded-md text-[var(--v2-text3)] hover:bg-[var(--color-gray-200)] hover:text-[var(--v2-brand)]" title="上移" onClick={(e) => { e.stopPropagation(); moveSibling(node, -1); }}>{Ic.up}</button>
            <button className="w-[22px] h-[22px] flex items-center justify-center rounded-md text-[var(--v2-text3)] hover:bg-[var(--color-gray-200)] hover:text-[var(--v2-brand)]" title="下移" onClick={(e) => { e.stopPropagation(); moveSibling(node, 1); }}>{Ic.down}</button>
            <button className="w-[22px] h-[22px] flex items-center justify-center rounded-md text-[var(--v2-text3)] hover:bg-[var(--color-gray-200)] hover:text-[var(--v2-brand)]" title="新建子级" onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); openCreateForm({ parentId: node.id, mode: "child" }); }}>{Ic.plus}</button>
            <button className="w-[22px] h-[22px] flex items-center justify-center rounded-md text-[var(--v2-text3)] hover:bg-[var(--color-gray-200)]" title="更多" onClick={(e) => { e.stopPropagation(); openMenu(node); }}>{Ic.dots}</button>
          </span>
          {/* 拖拽反馈 */}
          {ov && dragOver?.state === "child" && (
            <span className="absolute inset-0 rounded-lg pointer-events-none bg-[var(--v2-brand-bg)] shadow-[inset_0_0_0_2px_var(--v2-brand)]" />
          )}
          {ov && dragOver?.state === "forbidden" && (
            <span className="absolute inset-0 rounded-lg pointer-events-none bg-[var(--color-gray-50)] shadow-[inset_0_0_0_2px_#dc2626]" />
          )}
        </div>
        {/* 子级 */}
        {hasKids && isOpen && (
          <div className="ml-[26px] border-l border-[var(--v2-border)] pl-2">
            {kids.map(k => renderNode(k, depth + 1))}
            {kids.length === 0 && null}
          </div>
        )}
      </div>
    );
  };

  /* 节点菜单（⋯） */
  const [menuFor, setMenuFor] = useState<TreeNode | null>(null);
  const openMenu = (node: TreeNode) => setMenuFor(node);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuFor]);

  const menuAct = useCallback(async (node: TreeNode, act: string) => {
    setMenuFor(null);
    try {
      if (act === "anchor") {
        await updateTask(node.id, { level: node.level === "task" ? "phase" : "task" });
        showToast(node.level === "task" ? `已取消「${node.title}」的 ★ 锚点` : `已设为 ★ 锚点 — Today 将以此任务为中心`);
      } else if (act === "accum") {
        await updateTask(node.id, { accumulate: !node.accumulate });
        showToast(node.accumulate ? `已关闭「${node.title}」积累型` : `已开启积累型「${node.title}」— 生成每日重复排期`);
      } else if (act === "remove") {
        await updateTask(node.id, { parentId: null });
        showToast(`已移除「${node.title}」的挂接`);
      } else if (act === "child") {
        openCreateForm({ parentId: node.id, mode: "child" });
        return;
      }
      await load();
    } catch { setError(true); }
  }, [updateTask, load, showToast, openCreateForm]);

  /* ── 渲染：右侧池/习惯区/归档 ── */
  const habitsOutside = habits.filter(h => !findParent(trees, h.id)); // 未挂树的习惯
  // 任务收件箱 = 未挂树的产出型 + 积累型（去重，按 id）
  const inboxList = [...poolList, ...habitsOutside].filter((v, i, a) => a.findIndex(x => x.id === v.id) === i);

  const renderDotMatrix = (task: TreeNode) => {
    const last30 = streaks[task.id]?.last30 || [];
    const days: { date: string; checked: boolean; future: boolean }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      days.push({ date: ds, checked: last30.includes(ds), future: i < 0 });
    }
    return (
      <div className="flex gap-[3px] flex-wrap">
        {days.map((d, i) => (
          <span
            key={i}
            title={d.date}
            className={`w-[10px] h-[10px] rounded-[3px] ${d.checked ? "bg-[#d97706]" : "bg-[#fde68a]/60"}`}
          />
        ))}
      </div>
    );
  };

  /* ── 页面骨架 ── */
  // 树只显示已确定层级（project/phase 根）；task 级根 → 任务收件箱（不重复显示）
  const treeRoots = trees.filter(t => t.level !== "task");
  const filteredTrees = treeSearch.trim()
    ? (() => {
        const q = treeSearch.trim().toLowerCase();
        const all = flatten(trees);
        // 搜索：标题 + 清单项文本（设计稿：title + checks 文本）
        const hits = new Set(all.filter(t => t.title.toLowerCase().includes(q) || (t.children ?? []).some(c => c.title.toLowerCase().includes(q))).map(t => t.id));
        const show = new Set<string>();
        hits.forEach(id => { let p = findParent(trees, id); while (p) { show.add(p.id); p = findParent(trees, p.id); } });
        const walk = (list: TreeNode[], depth: number): React.ReactNode[] => list
          .filter(n => hits.has(n.id) || show.has(n.id))
          .map(n => renderNode(n, depth));
        return walk(treeRoots, 0);
      })()
    : treeRoots.map(n => renderNode(n, 0));

  if (loading) return <div className="space-y-3"><div className="h-8 w-56 rounded bg-[var(--color-gray-100)] animate-pulse" /><div className="h-96 rounded-xl bg-[var(--color-gray-100)] animate-pulse" /></div>;
  if (error) return (
    <div className="text-center py-16">
      <div className="text-[15px] font-medium text-[var(--v2-text)] mb-2">加载项目树失败</div>
      <button onClick={() => load()} className="text-sm px-4 py-2 rounded-lg bg-[var(--v2-brand)] text-white hover:bg-[var(--v2-brand-deep)] transition">重试</button>
    </div>
  );

  const legal = legalTypes();

  /* ── 设计稿右面板：归属链 + 模式 A（单任务聚焦） / 模式 B（同级任务） ── */
  const chainOfNode = (list: TreeNode[], id: string): TreeNode[] => {
    for (const n of list) {
      if (n.id === id) return [n];
      const sub = chainOfNode(n.children || [], id);
      if (sub.length) return [n, ...sub];
    }
    return [];
  };
  const selected = selectedId ? findNode(trees, selectedId) : null;
  const selChain = selected ? chainOfNode(trees, selected.id) : [];
  const selParent = selected ? findParent(trees, selected.id) : null;
  const selSiblings = selParent ? (selParent.children || []) : trees;

  // 模式 A：聚焦当前任务 + 执行清单（children 即清单项，可勾选完成）
  const renderModeA = (node: TreeNode): React.ReactNode => {
    const kids = node.children || [];
    return (
      <div className="space-y-3">
        {/* 归属链（breadcrumb） */}
        {selChain.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap text-[12px] text-[var(--v2-text3)]">
            {selChain.map((c, i) => (
              <span key={c.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-[var(--v2-text3)]/60">/</span>}
                <button
                  className={`hover:text-[var(--v2-brand)] transition ${c.id === node.id ? "text-[var(--v2-brand)] font-medium" : ""}`}
                  onClick={() => setSelectedId(c.id)}
                >{c.title}</button>
              </span>
            ))}
          </div>
        )}
        {/* 任务主体 */}
        <div className="flex items-start gap-2.5">
          <span className="flex-none mt-0.5">{node.level === "project" ? Ic.folder : node.level === "task" ? Ic.star : Ic.phase}</span>
          <div className="min-w-0 flex-1">
            <div className={`text-[16px] font-semibold leading-snug ${node.status === "completed" ? "line-through text-[var(--v2-text3)]" : "text-[var(--v2-text)]"}`}>{node.title}</div>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {node.level === "project" && <span className="text-[11px] px-2 py-px rounded-md bg-[var(--v2-brand-bg)] text-[var(--v2-brand-deep)] font-medium">项目</span>}
              {node.level === "phase" && <span className="text-[11px] px-2 py-px rounded-md bg-[var(--color-gray-100)] text-[var(--v2-text2)] font-medium">阶段</span>}
              {node.level === "task" && <span className="text-[11px] px-2 py-px rounded-md bg-[var(--v2-brand)] text-white font-medium">★ 锚点任务</span>}
              {node.accumulate && <span className="text-[11px] px-2 py-px rounded-md bg-[var(--v2-amber-bg)] text-[var(--v2-amber)] font-medium">积累型 · 连续 {streaks[node.id]?.current ?? 0} 天</span>}
              {node.status === "completed" && <span className="text-[11px] px-2 py-px rounded-md bg-[var(--v2-green-bg)] text-[var(--v2-green-deep)] font-medium">已完成</span>}
              {node.category && <span className="text-[11px] px-2 py-px rounded-md bg-[var(--color-gray-100)] text-[var(--v2-text2)] font-medium">{node.category}</span>}
            </div>
            {/* 元信息 */}
            <div className="flex items-center gap-3 mt-2 text-[12.5px] text-[var(--v2-text3)] flex-wrap">
              {typeof node.estimatedMinutes === "number" && node.estimatedMinutes > 0 && <span>预估 {node.estimatedMinutes} 分钟</span>}
              {node.deadline && <span className="text-[var(--color-danger-text)]">截止 {new Date(node.deadline).getMonth() + 1}/{new Date(node.deadline).getDate()}</span>}
              {node.importance > 0 && <span>重要度 {node.importance}</span>}
            </div>
          </div>
          {/* 操作：完成/打卡 */}
          <div className="flex flex-col gap-1.5 flex-none">
            {node.level === "task" && (
              <button
                className={`text-[12px] px-3 py-1.5 rounded-lg transition-all ${node.status === "completed" ? "bg-[var(--v2-green-bg)] text-[var(--v2-green-deep)] hover:bg-[var(--v2-green)] hover:text-white" : "bg-[var(--v2-brand)] text-white hover:bg-[var(--v2-brand-deep)]"}`}
                onClick={async () => { try { await doAction(node.id, node.status === "completed" ? "reopen" : "complete"); showToast(node.status === "completed" ? `已重新打开「${node.title}」` : `已完成「${node.title}」`); await load(); } catch { setError(true); } }}
              >{node.status === "completed" ? "重新打开" : "标记完成"}</button>
            )}
            {node.accumulate && (
              <button
                className={`text-[12px] px-3 py-1.5 rounded-lg border transition-all ${streaks[node.id]?.todayChecked ? "bg-[#d97706] text-white border-[#d97706]" : "bg-white text-[var(--v2-amber)] border-[var(--v2-amber)] hover:bg-[var(--v2-amber-bg)]"}`}
                onClick={async () => { try { const r = await fetch(`/api/tasks/${node.id}/checkin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }); if (r.ok) { const d = await r.json(); setStreaks(prev => ({ ...prev, [node.id]: d.streak })); showToast(`已打卡 · 连续 ${d.streak?.current ?? 0} 天`); } } catch { setError(true); } }}
              >{streaks[node.id]?.todayChecked ? "已打卡 ✓" : "今日打卡"}</button>
            )}
          </div>
        </div>
        {/* 执行清单（children） */}
        <div className="border-t border-[var(--v2-border)] pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-semibold text-[var(--v2-text2)]">执行清单 · {kids.filter(k => k.status === "completed").length}/{kids.length}</span>
            <button className="text-[12px] text-[var(--v2-brand)] hover:text-[var(--v2-brand-deep)] transition" onClick={() => openCreateForm({ parentId: node.id, mode: "child" })}>＋ 添加清单项</button>
          </div>
          {kids.length === 0 && (
            <div className="text-[12.5px] text-[var(--v2-text3)] py-4 text-center border border-dashed border-[var(--v2-border)] rounded-lg">
              {node.level === "project" ? "项目还没有子阶段/任务 · 添加清单项或子任务" : "任务还没有执行清单 · 添加清单项后可在 Today 逐步勾选"}
            </div>
          )}
          <div className="space-y-1">
            {kids.map(k => (
              <div
                key={k.id}
                draggable
                onDragStart={(e) => { setCheckDragId(k.id); e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (checkOverId !== k.id) setCheckOverId(k.id); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (checkDragId && checkDragId !== k.id) reorderChecklist(node.id, checkDragId, k.id); }}
                onDragEnd={() => { setCheckDragId(null); setCheckOverId(null); }}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border bg-[var(--v2-card)] transition-all cursor-pointer ${
                  checkOverId === k.id ? "border-[var(--v2-brand)] shadow-[inset_0_0_0_1px_var(--v2-brand)]" : "border-[var(--v2-border)] hover:border-[var(--v2-brand)]/40"
                } ${selectedId === k.id ? "border-[var(--v2-brand)]/60 shadow-[inset_0_0_0_1px_var(--v2-brand)]" : ""} ${checkDragId === k.id ? "opacity-40" : ""}`}
                onClick={() => setSelectedId(k.id)}
              >
                <span className="text-[var(--v2-text3)] text-[12px] flex-none cursor-grab opacity-40">{Ic.grip}</span>
                <button
                  className={`w-[17px] h-[17px] rounded-[5px] flex-none flex items-center justify-center border transition-all ${k.status === "completed" ? "bg-[var(--v2-green)] border-[var(--v2-green)]" : "border-[#d1d5db] hover:border-[var(--v2-brand)]"}`}
                  onClick={async (e) => { e.stopPropagation(); try { await doAction(k.id, k.status === "completed" ? "reopen" : "complete"); await load(); } catch { setError(true); } }}
                >{k.status === "completed" && <span className="text-white">{Ic.check}</span>}</button>
                <span className={`text-[13px] min-w-0 truncate flex-1 ${k.status === "completed" ? "line-through text-[var(--v2-text3)]" : "text-[var(--v2-text)]"}`}>{k.title}</span>
                {k.level === "phase" && <span className="text-[11px] px-1.5 py-px rounded bg-[var(--color-gray-100)] text-[var(--v2-text3)] flex-none">阶段</span>}
                {k.level === "task" && !k.accumulate && <span className="text-[11px] px-1.5 py-px rounded bg-[var(--v2-brand-bg)] text-[var(--v2-brand-deep)] flex-none">任务</span>}
                {k.accumulate && <span className="text-[11px] px-1.5 py-px rounded bg-[var(--v2-amber-bg)] text-[var(--v2-amber)] flex-none">积累</span>}
                {(k.children?.length ?? 0) > 0 && <span className="text-[11px] text-[var(--v2-text3)] flex-none">{(k.children || []).length} 子项 ›</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 模式 B：同级任务浏览 + 各自清单（设计稿新版：同级 Task 列表 + 各自清单）
  const renderModeB = (node: TreeNode): React.ReactNode => {
    const siblings = selSiblings.filter(s => s.level === "task");
    const title = selParent ? `${selParent.title} 下的任务` : "根层任务";
    return (
      <div className="space-y-3">
        <div className="text-[13px] font-semibold text-[var(--v2-text2)]">{title} · {siblings.length} 个</div>
        {siblings.length === 0 && <div className="text-[12.5px] text-[var(--v2-text3)] py-6 text-center border border-dashed border-[var(--v2-border)] rounded-lg">暂无任务</div>}
        <div className="space-y-1.5">
          {siblings.map(s => {
            const open = bOpen.has(s.id);
            const kids = s.children || [];
            const doneKids = kids.filter(k => k.status === "completed").length;
            return (
              <div key={s.id} className={`rounded-lg border transition-all ${selectedId === s.id ? "border-[var(--v2-brand)]/60 bg-[var(--v2-brand-bg)]" : "border-[var(--v2-border)] bg-[var(--v2-card)] hover:border-[var(--v2-brand)]/40"}`}>
                <div className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer ${open ? "border-b border-[var(--v2-border)]" : ""}`} onClick={() => { setSelectedId(s.id); setBOpen(prev => { const n = new Set(prev); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; }); }}>
                  <button className={`w-[16px] h-[16px] flex items-center justify-center text-[var(--v2-text3)] transition-transform flex-none ${open ? "rotate-90" : ""} ${kids.length === 0 ? "invisible" : ""}`}>{Ic.arrow}</button>
                  <span className={`flex-none ${s.status === "completed" ? "text-[var(--v2-green)]" : "text-[var(--v2-brand)]"}`}>{s.status === "completed" ? Ic.check : Ic.star}</span>
                  <span className={`text-[13.5px] truncate flex-1 ${s.status === "completed" ? "line-through text-[var(--v2-text3)]" : "text-[var(--v2-text)]"}`}>{s.title}</span>
                  {s.accumulate && <span className="text-[11px] px-1.5 py-px rounded bg-[var(--v2-amber-bg)] text-[var(--v2-amber)] flex-none">积累 {streaks[s.id]?.current ?? 0}天</span>}
                  {kids.length > 0 && <span className="text-[11px] text-[var(--v2-text3)] flex-none">{doneKids}/{kids.length}</span>}
                </div>
                {/* 各自清单（可勾选） */}
                {open && (
                  <div className="px-3 py-2 space-y-1">
                    {kids.length === 0 && <div className="text-[12px] text-[var(--v2-text3)] text-center py-1.5">暂无清单项</div>}
                    {kids.map(k => (
                      <div key={k.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--color-gray-50)] cursor-pointer" onClick={() => setSelectedId(k.id)}>
                        <button
                          className={`w-[15px] h-[15px] rounded-[4px] flex-none flex items-center justify-center border transition-all ${k.status === "completed" ? "bg-[var(--v2-green)] border-[var(--v2-green)]" : "border-[#d1d5db] hover:border-[var(--v2-brand)]"}`}
                          onClick={async (e) => { e.stopPropagation(); try { await doAction(k.id, k.status === "completed" ? "reopen" : "complete"); await load(); } catch { setError(true); } }}
                        >{k.status === "completed" && <span className="text-white">{Ic.check}</span>}</button>
                        <span className={`text-[13px] truncate flex-1 ${k.status === "completed" ? "line-through text-[var(--v2-text3)]" : "text-[var(--v2-text)]"}`}>{k.title}</span>
                        {k.accumulate && <span className="text-[11px] px-1.5 py-px rounded bg-[var(--v2-amber-bg)] text-[var(--v2-amber)] flex-none">积累</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Toast msg={toastMsg} />

      {/* 页头 */}
      <div className="flex items-start gap-3">
        <div className="w-[34px] h-[34px] rounded-[10px] bg-[#1b1833] flex items-center justify-center flex-none">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></svg>
        </div>
        <div className="min-w-0">
          <h2 className="text-[24px] font-semibold tracking-[-0.3px] text-[var(--v2-text)]">Project · 项目整理</h2>
          <div className="text-[13px] text-[var(--v2-text3)] mt-0.5">拖拽整理任务层级 · 标 ★ 定义 Today 锚点 · 已完成任务拖入 = 归档复盘</div>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-none">
          <div className="text-sm text-[var(--v2-text2)] bg-[var(--v2-card)] border border-[var(--v2-border)] rounded-lg px-3 py-1.5 sh-v2">
            <span className="text-[var(--v2-brand)] font-semibold tabular-nums">{trees.filter(t => t.level === "project").length}</span> 项目
          </div>
          <div className="text-sm text-[var(--v2-text2)] bg-[var(--v2-card)] border border-[var(--v2-border)] rounded-lg px-3 py-1.5 sh-v2">
            <span className="text-[var(--v2-orange)] font-semibold tabular-nums">{poolList.length}</span> 待整理
          </div>
          <div className="text-sm text-[var(--v2-text2)] bg-[var(--v2-card)] border border-[var(--v2-border)] rounded-lg px-3 py-1.5 sh-v2">
            <span className="text-[var(--v2-green)] font-semibold tabular-nums">{countDone(trees) + archiveList.length}</span> 已完成
          </div>
        </div>
      </div>

      {/* 提示横幅（可关闭 · localStorage 记忆 · 方案顺手项 4） */}
      {!hintOff && (
        <div className="flex items-center gap-2.5 text-[12.5px] text-[var(--v2-brand-deep)] bg-[var(--v2-brand-bg)] rounded-[10px] px-4 py-2.5 leading-[1.5]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-none"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2z" /></svg>
          <span className="flex-1"><b>三步上手</b>：<b>归属</b>＝拖到节点上成为子级；<b>排序</b>＝悬停节点点 ↑↓；<b>新建</b>＝底部「＋」输名字回车，类型自动判断。选中节点后 <b>Enter</b> 新建同级、<b>Tab</b> 缩进。勾选子任务，父节点自动完成。</span>
          <button onClick={() => { setHintOff(true); try { localStorage.setItem("taskos.projects.hint.dismissed", "1"); } catch { /* 存储不可用忽略 */ } }}
            className="text-[var(--v2-brand-deep)]/50 hover:text-[var(--v2-brand-deep)] transition shrink-0 text-sm leading-none" title="不再显示">✕</button>
        </div>
      )}

      {/* 设计稿比例：左窄右宽（树 400px 固定 · 详情占剩余，不过分宽） */}
      <div className="grid grid-cols-1 xl:grid-cols-[400px_minmax(0,1fr)] gap-4 items-start">
        {/* 左：项目树（设计稿：Todoist 式树，文件夹层层展开） */}
        <div className={`${cardCls} overflow-hidden`}>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--v2-border)]">
            <span className="text-sm font-semibold text-[var(--v2-text2)]">项目</span>
            <span className="text-xs text-[var(--v2-text3)]">文件夹层层展开 · 拖拽整理</span>
            <div className="flex items-center gap-2 ml-auto">
              <input
                value={treeSearch}
                onChange={(e) => setTreeSearch(e.target.value)}
                placeholder="搜索项目…"
                className={`${inputCls} w-[140px]`}
              />
              <button className={btnGhost} onClick={() => { const s = new Set<string>(); trees.forEach(t => s.add(t.id)); setExpanded(s); }}>展开全部</button>
              <button className={btnGhost} onClick={() => setExpanded(new Set())}>折叠全部</button>
            </div>
          </div>
          <div className="p-2.5">
            {filteredTrees.length === 0 && !treeSearch && (
              <div className="text-center py-10">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--v2-brand-bg)] flex items-center justify-center mb-3">🗂</div>
                <div className="text-[15px] font-medium text-[var(--v2-text)] mb-1.5">还没有项目</div>
                <div className="text-sm text-[var(--v2-text3)] mb-4">点下方「新建节点」创建第一个项目</div>
                <button className={btnPrimary} onClick={() => openCreateForm({ parentId: null, mode: "root" })}>＋ 新建项目</button>
              </div>
            )}
            {filteredTrees.length > 0 && <div className="space-y-px">{filteredTrees}</div>}
            {treeSearch && filteredTrees.length === 0 && <div className="text-center text-sm text-[var(--v2-text3)] py-8">没有匹配的项目</div>}

            {/* 键盘提示 */}
            <div className="flex items-center gap-3 text-[11.5px] text-[var(--v2-text3)] px-2 pt-2 flex-wrap">
              <span className="text-[var(--v2-text2)]">选中后：</span>
              <span className="flex items-center gap-1"><kbd className="text-[10px] px-1 rounded border border-[var(--v2-border)] bg-[var(--color-gray-50)]">Enter</kbd> 新建同级</span>
              <span className="flex items-center gap-1"><kbd className="text-[10px] px-1 rounded border border-[var(--v2-border)] bg-[var(--color-gray-50)]">Tab</kbd> 缩进</span>
              <span className="flex items-center gap-1"><kbd className="text-[10px] px-1 rounded border border-[var(--v2-border)] bg-[var(--color-gray-50)]">Shift+Tab</kbd> 提升</span>
              <span className="ml-auto">悬停节点看 ↑↓ ＋ ⋯</span>
            </div>

            {/* 新建入口 */}
            {!newOpen ? (
              <button
                className="flex items-center gap-2 w-full mt-2 px-3 py-2 rounded-lg border-[1.5px] border-dashed border-[var(--v2-border)] text-[12.5px] text-[var(--v2-text3)] hover:border-[var(--v2-brand)] hover:text-[var(--v2-brand)] hover:bg-[var(--v2-brand-bg)] transition-all"
                onClick={() => openCreateForm({ parentId: selectedId ? findNode(trees, selectedId)?.level === "task" ? selectedId : null : null, mode: selectedId && findNode(trees, selectedId) ? "child" : "root" })}
              >
                {Ic.plus} 新建节点
              </button>
            ) : (
              <div className="mt-2 border-t border-[var(--v2-border)] pt-2.5">
                <div className="flex gap-2">
                  <input
                    ref={newInputRef}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") createNode(); if (e.key === "Escape") setNewOpen(false); }}
                    placeholder="输入名称，回车创建…"
                    className={`${inputCls} flex-1 border-[var(--v2-brand)]`}
                    autoFocus
                  />
                  <button className="flex-none text-[12px] px-3 py-1.5 rounded-lg border border-dashed border-[var(--v2-brand)] bg-[var(--v2-brand-bg)] text-[var(--v2-brand-deep)] hover:border-solid transition-all flex items-center gap-1.5" onClick={cycleType}>
                    <span className="flex items-center">{newType === "project" ? Ic.folder : newType === "phase" ? Ic.phase : Ic.star}</span>
                    {LEVEL_LABEL[newType]}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" width="11" height="11"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <span className="text-[11px] text-[var(--v2-text3)] mr-auto">
                    {newTarget.mode === "child" && newTarget.parentId ? `将创建为「${findNode(trees, newTarget.parentId)?.title ?? ""}」的子级` : newTarget.mode === "sibling" && newTarget.parentId ? `与「${findNode(trees, newTarget.parentId)?.title ?? ""}」同级` : "将创建在根层级"}
                    {" · "}类型可点右侧切换
                  </span>
                  <button className={btnGhost} onClick={() => setNewOpen(false)}>取消</button>
                  <button className={btnPrimary} onClick={createNode}>创建</button>
                </div>
              </div>
            )}

            {/* 分隔线 + 任务收件箱（未挂树 task · Inbox 风格） */}
            <div className="border-t border-[var(--v2-border)] mt-2.5 pt-2">
              <div className="flex items-center gap-1.5 px-1 pb-1.5">
                <span className="text-[12.5px] font-semibold text-[var(--v2-text2)]">任务收件箱</span>
                <span className="text-[10px] px-1.5 py-px rounded bg-[var(--v2-orange-bg)] text-[var(--v2-orange)] font-semibold">未挂树</span>
                <span className="text-[11px] text-[var(--v2-text3)]">{inboxList.length}</span>
                <span className="ml-auto text-[11px] text-[var(--v2-text3)]">拖到树上 = 挂项目</span>
              </div>
              {inboxList.length === 0 ? (
                <div className="text-center text-[12px] text-[var(--v2-text3)] py-3 border border-dashed border-[var(--v2-border)] rounded-lg">收件箱已清空 · 新任务会先到这里</div>
              ) : (
                <div className="space-y-0.5">
                  {inboxList.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer border transition-all ${
                        selectedId === p.id ? "bg-[var(--v2-brand-bg)] border-[var(--v2-brand)]/30" : "border-transparent hover:bg-[var(--color-gray-50)]"
                      }`}
                      onClick={() => setSelectedId(p.id)}
                      draggable
                      onDragStart={(e) => { setDragId(p.id); setDragSource("pool"); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { setDragId(null); setDragSource(null); setDragOver(null); }}
                    >
                      <span className="w-2 h-2 rounded-full flex-none" style={{ background: DOMAINS[normalizeCategory(p.category)].border }} />
                      <span className="text-[13px] truncate flex-1 min-w-0">{p.title}</span>
                      {p.accumulate && (
                        <span className="text-[10.5px] px-1.5 py-px rounded bg-[var(--v2-amber-bg)] text-[var(--v2-amber)] font-medium flex-none">🔥 {streaks[p.id]?.current ?? 0} 天</span>
                      )}
                      <span className="text-[10.5px] px-1.5 py-px rounded bg-[var(--color-gray-100)] text-[var(--v2-text3)] flex-none">
                        {INBOX_SHORT[p.category ?? "other"] ?? "未分类"}
                      </span>
                      <span className="text-[var(--v2-text3)] text-[11px] flex-none opacity-0 hover:opacity-100">⠿</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-[11px] text-[var(--v2-text3)] px-1 pt-1.5">拖到「我的项目」节点上 = 成为子级 · 点击查看详情</div>
            </div>
          </div>
        </div>

        {/* 右：详情面板（设计稿：模式 A 单任务聚焦 + 执行清单 / 模式 B 同级任务） */}
        <div className="space-y-4">
          <div className={`${cardCls} overflow-hidden`}>
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--v2-border)]">
              <div className="inline-flex bg-white border border-[var(--v2-border)] rounded-full p-0.5 flex-none">
                <button onClick={() => setMode("A")} className={`text-[12px] px-3.5 py-1 rounded-full transition-all ${mode === "A" ? "bg-[var(--v2-brand)] text-white font-medium" : "text-[var(--v2-text3)] hover:text-[var(--v2-text2)]"}`}>模式 A · 单任务</button>
                <button onClick={() => setMode("B")} className={`text-[12px] px-3.5 py-1 rounded-full transition-all ${mode === "B" ? "bg-[var(--v2-brand)] text-white font-medium" : "text-[var(--v2-text3)] hover:text-[var(--v2-text2)]"}`}>模式 B · 同级</button>
              </div>
              <span className="text-[11.5px] text-[var(--v2-text3)] ml-auto truncate">{mode === "A" ? "聚焦当前 Task 及其执行清单" : "浏览同级任务 · 点击切换"}</span>
            </div>
            <div className="p-3 max-h-[560px] overflow-y-auto">
              {selected ? (
                mode === "A" ? renderModeA(selected) : renderModeB(selected)
              ) : (
                <div className="text-center py-10">
                  <div className="w-11 h-11 mx-auto rounded-2xl bg-[var(--v2-brand-bg)] flex items-center justify-center text-lg mb-2.5">🗂</div>
                  <div className="text-[13.5px] font-medium text-[var(--v2-text2)] mb-1">选中左侧节点查看详情</div>
                  <div className="text-[12px] text-[var(--v2-text3)]">归属链 · 执行清单 · 同级任务</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 节点菜单 */}
      {menuFor && (
        <div
          ref={menuRef}
          className="fixed z-[80] bg-white border border-[var(--v2-border)] rounded-[10px] shadow-lg p-1.5 min-w-[176px]"
          style={{ right: 24, bottom: 24 }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const n = menuFor;
            const parent = findParent(trees, n.id);
            const siblings = parent ? (parent.children || []) : trees;
            const idx = siblings.findIndex(s => s.id === n.id);
            return (
              <div className="space-y-0.5">
                <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] hover:bg-[var(--color-gray-100)] disabled:opacity-40 disabled:hover:bg-transparent text-left" disabled={idx <= 0} onClick={() => moveSibling(n, -1)}>
                  <span className="text-[var(--v2-text2)]">{Ic.up}</span>上移
                </button>
                <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] hover:bg-[var(--color-gray-100)] disabled:opacity-40 disabled:hover:bg-transparent text-left" disabled={idx >= siblings.length - 1} onClick={() => moveSibling(n, 1)}>
                  <span className="text-[var(--v2-text2)]">{Ic.down}</span>下移
                </button>
                <div className="h-px bg-[var(--v2-border)] my-1" />
                <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] hover:bg-[var(--color-gray-100)] text-left" onClick={() => menuAct(n, "anchor")}>
                  <span className="text-[var(--v2-brand)]">{Ic.star}</span>{n.level === "task" ? "取消 ★ 锚点" : "标为 ★ 任务"}
                </button>
                <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] hover:bg-[var(--color-gray-100)] text-left" onClick={() => menuAct(n, "accum")}>
                  <span className="text-[var(--v2-amber)]">{Ic.cal}</span>
                  <span className="flex-1">{n.accumulate ? "关闭积累型" : "开启积累型"}</span>
                  <span className={`w-[34px] h-[18px] rounded-full transition-all relative flex-none ${n.accumulate ? "bg-[var(--v2-brand)]" : "bg-[#e5e7eb]"}`}>
                    <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all ${n.accumulate ? "left-[18px]" : "left-[2px]"}`} />
                  </span>
                </button>
                <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)] text-left" onClick={() => menuAct(n, "remove")}>
                  <span>{Ic.trash}</span>移除关系
                </button>
                <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] hover:bg-[var(--color-gray-100)] text-left" onClick={() => menuAct(n, "child")}>
                  <span className="text-[var(--v2-text2)]">{Ic.plus}</span>新建子级
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
