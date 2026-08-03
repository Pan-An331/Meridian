import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getNavMode, setNavMode, getFcLayout, setFcLayout,
  NAV_DEFAULT, LAYOUT_DEFAULT, NAV_CHANGE_EVENT, FCLAYOUT_CHANGE_EVENT,
  listenNavMode, listenFcLayout,
} from "@/lib/ui-preferences";

/* localStorage stub（node 环境无 window/localStorage） */
function makeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
    _map: map,
  };
}

let storage: ReturnType<typeof makeStorage>;

beforeEach(() => {
  storage = makeStorage();
  const win = new EventTarget() as any; // node 无 window：提供 addEventListener + localStorage
  win.localStorage = storage;
  (globalThis as any).window = win;
  (globalThis as any).localStorage = storage;
});

describe("导航偏好读写", () => {
  it("默认侧栏，非法值回落默认", () => {
    expect(getNavMode()).toBe(NAV_DEFAULT);
    expect(getNavMode()).toBe("side");
  });

  it("写入顶栏后读回", () => {
    setNavMode("top");
    expect(getNavMode()).toBe("top");
    expect(storage.getItem("taskos.nav")).toBe("top");
  });

  it("垃圾值回落默认（防御）", () => {
    storage.setItem("taskos.nav", "hacker");
    expect(getNavMode()).toBe("side");
  });
});

describe("Focus Card 版式读写", () => {
  it("默认一栏", () => {
    expect(getFcLayout()).toBe(LAYOUT_DEFAULT);
    expect(getFcLayout()).toBe(1);
  });

  it("写入两栏后读回", () => {
    setFcLayout(2);
    expect(getFcLayout()).toBe(2);
    expect(storage.getItem("taskos.fcLayout")).toBe("2");
  });

  it("非法值回落默认（防御）", () => {
    storage.setItem("taskos.fcLayout", "99");
    expect(getFcLayout()).toBe(1);
  });
});

describe("事件广播与类型守卫", () => {
  it("listenNavMode 只接收合法值", () => {
    const cb = vi.fn();
    const off = listenNavMode(cb);
    window.dispatchEvent(new CustomEvent(NAV_CHANGE_EVENT, { detail: "top" }));
    window.dispatchEvent(new CustomEvent(NAV_CHANGE_EVENT, { detail: "bogus" }));
    window.dispatchEvent(new CustomEvent(NAV_CHANGE_EVENT, { detail: 42 }));
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("top");
    off();
  });

  it("listenFcLayout 只接收 1|2", () => {
    const cb = vi.fn();
    const off = listenFcLayout(cb);
    window.dispatchEvent(new CustomEvent(FCLAYOUT_CHANGE_EVENT, { detail: 2 }));
    window.dispatchEvent(new CustomEvent(FCLAYOUT_CHANGE_EVENT, { detail: 3 }));
    window.dispatchEvent(new CustomEvent(FCLAYOUT_CHANGE_EVENT, { detail: "2" }));
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(2);
    off();
  });

  it("取消订阅后不再收到事件", () => {
    const cb = vi.fn();
    const off = listenNavMode(cb);
    off();
    window.dispatchEvent(new CustomEvent(NAV_CHANGE_EVENT, { detail: "top" }));
    expect(cb).not.toHaveBeenCalled();
  });
});
