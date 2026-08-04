// 冒烟测试：树查找 + 完成联动核心逻辑（与演示 HTML 内逻辑一致）
const roots = [
  { id: 'p1', title: '4 轴飞行器', level: 'project', expanded: true, children: [
    { id: 's1', title: '硬件设计', level: 'phase', expanded: true, children: [
      { id: 't1', title: '画原理图', level: 'task', anchor: true, expanded: true, children: [
        { id: 'c1', title: '芯片模块', done: true },
        { id: 'c2', title: 'LED 模块', done: false },
        { id: 'c3', title: '驱动模块', done: false },
      ]},
    ]},
  ]},
];
const findNode = (id, list = roots) => { for (const n of list) { if (n.id === id) return n; const f = findNode(id, n.children || []); if (f) return f; } return null; };
const findParent = (id, list = roots) => { for (const n of list) { if ((n.children || []).some(c => c.id === id)) return n; const f = findParent(id, n.children || []); if (f) return f; } return null; };
const isDescendant = (id, maybe) => { const n = findNode(id); if (!n) return false; const st = [...(n.children || [])]; while (st.length) { const c = st.pop(); if (c.id === maybe) return true; st.push(...(c.children || [])); } return false; };
const toggleDone = (node) => { node.done = !node.done; if (node.done) { let p = findParent(node.id); while (p) { const kids = p.children || []; if (kids.length && kids.every(k => k.done)) { p.done = true; p = findParent(p.id); } else break; } } else { let p = findParent(node.id); while (p) { p.done = false; p = findParent(p.id); } } };

let pass = 0, fail = 0;
const t = (name, cond) => { cond ? pass++ : (fail++, console.log('FAIL:', name)); };

t('findNode c2', findNode('c2').title === 'LED 模块');
t('findParent c1 is t1', findParent('c1').id === 't1');
t('isDescendant p1->c3 true', isDescendant('p1', 'c3') === true);
t('isDescendant c3->p1 false', isDescendant('c3', 'p1') === false);
t('isDescendant c3->s1 false', isDescendant('c3', 's1') === false);

// 勾选 c2 和 c3 → t1 完成（c1 已 done）→ s1 完成（唯一子级）→ p1 完成
toggleDone(findNode('c2'));
toggleDone(findNode('c3'));
t('t1 auto-done after all children', findNode('t1').done === true);
t('s1 auto-done (single child t1 done)', findNode('s1').done === true);
t('p1 auto-done (single child s1 done)', findNode('p1').done === true);
// reopen t1 → 向上清除
toggleDone(findNode('t1'));
t('reopen clears s1', findNode('s1').done === false);
t('reopen clears p1', findNode('p1').done === false);
t('reopen keeps c1 done', findNode('c1').done === true);

console.log('PASS ' + pass + ' / FAIL ' + fail);
process.exit(fail ? 1 : 0);
