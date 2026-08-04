# -*- coding: utf-8 -*-
import io, re

p = r'G:\Agent_Project\task-manage-sys\UI示例\Meridian-登录页视觉稿-2026-08-03.html'
s = io.open(p, encoding='utf-8').read()

def rep(old, new, label):
    global s
    assert old in s, 'NOT FOUND: ' + label
    s = s.replace(old, new)
    print('ok:', label)

# ═══ 精修区 V2 卡（正则整卡替换）═══
V2_CARD = re.compile(r'<div class="lc-head"><span class="lc-name">V2 · 日晷</span>.*?</div>\n      </div>', re.S)
V2_NEW = '''<div class="lc-head"><span class="lc-name">V2 · 日晷 v2</span><span class="lc-tag">时间语义 · 收敛版</span></div>
      <div class="lc-body">
        <div class="logo-96">
          <svg width="118" height="106" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="36" stroke="#1E3A8A" stroke-width="5"/>
            <line x1="50" y1="9.5" x2="50" y2="17.5" stroke="#F59E0B" stroke-width="3.6" stroke-linecap="round"/>
            <line x1="50" y1="50" x2="50" y2="20" stroke="#F59E0B" stroke-width="8" stroke-linecap="round"/>
            <circle cx="50" cy="50" r="5" fill="#F59E0B"/>
          </svg>
        </div>
        <div class="logo-horiz">
          <svg width="24" height="24" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="36" stroke="#1E3A8A" stroke-width="15"/><line x1="50" y1="9.5" x2="50" y2="17.5" stroke="#F59E0B" stroke-width="11"/><line x1="50" y1="50" x2="50" y2="20" stroke="#F59E0B" stroke-width="24" stroke-linecap="round"/><circle cx="50" cy="50" r="15" fill="#F59E0B"/></svg>
          <span class="lh-word">Meridian</span><span class="lh-cn">子午</span>
        </div>
        <div class="fav-row">
          <div class="fav-box"><div class="fav-frame" style="width:48px;height:48px"><svg width="48" height="48" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.3" stroke="#1E3A8A" stroke-width="1.15"/><line x1="8" y1="8" x2="8" y2="3.3" stroke="#F59E0B" stroke-width="1.55" stroke-linecap="round"/><circle cx="8" cy="8" r="1" fill="#F59E0B"/></svg></div><div class="fav-lbl">48</div></div>
          <div class="fav-box"><div class="fav-frame" style="width:32px;height:32px"><svg width="32" height="32" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.3" stroke="#1E3A8A" stroke-width="1.15"/><line x1="8" y1="8" x2="8" y2="3.3" stroke="#F59E0B" stroke-width="1.55" stroke-linecap="round"/><circle cx="8" cy="8" r="1" fill="#F59E0B"/></svg></div><div class="fav-lbl">32</div></div>
          <div class="fav-box"><div class="fav-frame" style="width:16px;height:16px"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.3" stroke="#1E3A8A" stroke-width="1.15"/><line x1="8" y1="8" x2="8" y2="3.3" stroke="#F59E0B" stroke-width="1.55" stroke-linecap="round"/><circle cx="8" cy="8" r="1" fill="#F59E0B"/></svg></div><div class="fav-lbl">16</div></div>
        </div>
        <div class="lc-meta"><b>完整日环 + 金色指针与 12 点刻度</b><br>收敛无断口 · 指向正午</div>
      </div>'''
assert V2_CARD.search(s), 'V2 CARD NOT FOUND'
s = V2_CARD.sub(V2_NEW, s, count=1)
print('ok: 精修区 V2 卡')

# ═══ 精修区 V3 卡 ═══
V3_CARD = re.compile(r'<div class="lc-head"><span class="lc-name">V3 · 准星中轴</span>.*?</div>\n      </div>', re.S)
V3_NEW = '''<div class="lc-head"><span class="lc-name">V3 · 同心双环</span><span class="lc-tag">层次 · 新</span></div>
      <div class="lc-body">
        <div class="logo-96">
          <svg width="118" height="106" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="36" stroke="#1E3A8A" stroke-width="6"/>
            <circle cx="50" cy="50" r="23" stroke="#1E3A8A" stroke-width="3"/>
            <line x1="50" y1="12" x2="50" y2="88" stroke="#F59E0B" stroke-width="6" stroke-linecap="round"/>
            <circle cx="50" cy="50" r="4.5" fill="#F59E0B"/>
          </svg>
        </div>
        <div class="logo-horiz">
          <svg width="24" height="24" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="36" stroke="#1E3A8A" stroke-width="18"/><circle cx="50" cy="50" r="23" stroke="#1E3A8A" stroke-width="9"/><line x1="50" y1="12" x2="50" y2="88" stroke="#F59E0B" stroke-width="18" stroke-linecap="round"/><circle cx="50" cy="50" r="14" fill="#F59E0B"/></svg>
          <span class="lh-word">Meridian</span><span class="lh-cn">子午</span>
        </div>
        <div class="fav-row">
          <div class="fav-box"><div class="fav-frame" style="width:48px;height:48px"><svg width="48" height="48" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.3" stroke="#1E3A8A" stroke-width="1.15"/><circle cx="8" cy="8" r="3.4" stroke="#1E3A8A" stroke-width="0.85"/><line x1="8" y1="2.2" x2="8" y2="13.8" stroke="#F59E0B" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="8" r="0.95" fill="#F59E0B"/></svg></div><div class="fav-lbl">48</div></div>
          <div class="fav-box"><div class="fav-frame" style="width:32px;height:32px"><svg width="32" height="32" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.3" stroke="#1E3A8A" stroke-width="1.15"/><circle cx="8" cy="8" r="3.4" stroke="#1E3A8A" stroke-width="0.85"/><line x1="8" y1="2.2" x2="8" y2="13.8" stroke="#F59E0B" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="8" r="0.95" fill="#F59E0B"/></svg></div><div class="fav-lbl">32</div></div>
          <div class="fav-box"><div class="fav-frame" style="width:16px;height:16px"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.3" stroke="#1E3A8A" stroke-width="1.15"/><circle cx="8" cy="8" r="3.4" stroke="#1E3A8A" stroke-width="0.85"/><line x1="8" y1="2.2" x2="8" y2="13.8" stroke="#F59E0B" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="8" r="0.95" fill="#F59E0B"/></svg></div><div class="fav-lbl">16</div></div>
        </div>
        <div class="lc-meta"><b>同心双环 + 金色中轴 + 金心</b><br>年轮层次 · 环环相扣</div>
      </div>'''
assert V3_CARD.search(s), 'V3 CARD NOT FOUND'
s = V3_CARD.sub(V3_NEW, s, count=1)
print('ok: 精修区 V3 卡')

# ═══ 精修区 V4 卡 ═══
V4_CARD = re.compile(r'<div class="lc-head"><span class="lc-name">V4 · 经线球</span>.*?</div>\n      </div>', re.S)
V4_NEW = '''<div class="lc-head"><span class="lc-name">V4 · 罗盘</span><span class="lc-tag">方向 · 新</span></div>
      <div class="lc-body">
        <div class="logo-96">
          <svg width="118" height="106" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="36" stroke="#1E3A8A" stroke-width="5"/>
            <line x1="50" y1="10" x2="50" y2="17" stroke="#1E3A8A" stroke-width="3.4" stroke-linecap="round"/>
            <line x1="83" y1="50" x2="90" y2="50" stroke="#1E3A8A" stroke-width="3.4" stroke-linecap="round"/>
            <line x1="50" y1="83" x2="50" y2="90" stroke="#1E3A8A" stroke-width="3.4" stroke-linecap="round"/>
            <line x1="10" y1="50" x2="17" y2="50" stroke="#1E3A8A" stroke-width="3.4" stroke-linecap="round"/>
            <path d="M50 16 L58 50 L50 84 L42 50 Z" fill="#F59E0B"/>
          </svg>
        </div>
        <div class="logo-horiz">
          <svg width="24" height="24" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="36" stroke="#1E3A8A" stroke-width="15"/><line x1="50" y1="10" x2="50" y2="17" stroke="#1E3A8A" stroke-width="10" stroke-linecap="round"/><line x1="83" y1="50" x2="90" y2="50" stroke="#1E3A8A" stroke-width="10" stroke-linecap="round"/><line x1="50" y1="83" x2="50" y2="90" stroke="#1E3A8A" stroke-width="10" stroke-linecap="round"/><line x1="10" y1="50" x2="17" y2="50" stroke="#1E3A8A" stroke-width="10" stroke-linecap="round"/><path d="M50 16 L58 50 L50 84 L42 50 Z" fill="#F59E0B"/></svg>
          <span class="lh-word">Meridian</span><span class="lh-cn">子午</span>
        </div>
        <div class="fav-row">
          <div class="fav-box"><div class="fav-frame" style="width:48px;height:48px"><svg width="48" height="48" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.3" stroke="#1E3A8A" stroke-width="1.1"/><path d="M8 3.8 L9.6 8 L8 12.2 L6.4 8 Z" fill="#F59E0B"/></svg></div><div class="fav-lbl">48</div></div>
          <div class="fav-box"><div class="fav-frame" style="width:32px;height:32px"><svg width="32" height="32" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.3" stroke="#1E3A8A" stroke-width="1.1"/><path d="M8 3.8 L9.6 8 L8 12.2 L6.4 8 Z" fill="#F59E0B"/></svg></div><div class="fav-lbl">32</div></div>
          <div class="fav-box"><div class="fav-frame" style="width:16px;height:16px"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.3" stroke="#1E3A8A" stroke-width="1.1"/><path d="M8 3.8 L9.6 8 L8 12.2 L6.4 8 Z" fill="#F59E0B"/></svg></div><div class="fav-lbl">16</div></div>
        </div>
        <div class="lc-meta"><b>罗盘环 + 四向刻度 + 金色菱形指针</b><br>方向感最强 · 菱形有辨识度</div>
      </div>'''
assert V4_CARD.search(s), 'V4 CARD NOT FOUND'
s = V4_CARD.sub(V4_NEW, s, count=1)
print('ok: 精修区 V4 卡')

# ═══ 登录页 V2 Logo + 水印 ═══
rep('<div class="wm"><svg width="140" height="140" viewBox="0 0 100 100" fill="none"><path d="M41.9 14.6 A36 36 0 1 1 58.1 14.6" stroke="#fff" stroke-width="9"/><line x1="50" y1="50" x2="50" y2="17" stroke="#F59E0B" stroke-width="15"/><circle cx="50" cy="50" r="10" fill="#F59E0B"/></svg></div>',
    '<div class="wm"><svg width="140" height="140" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="36" stroke="#fff" stroke-width="9"/><line x1="50" y1="9.5" x2="50" y2="17.5" stroke="#F59E0B" stroke-width="7"/><line x1="50" y1="50" x2="50" y2="20" stroke="#F59E0B" stroke-width="15"/><circle cx="50" cy="50" r="10" fill="#F59E0B"/></svg></div>', '登录页 V2 水印')
rep('<svg width="44" height="44" viewBox="0 0 100 100" fill="none"><path d="M41.9 14.6 A36 36 0 1 1 58.1 14.6" stroke="#fff" stroke-width="9"/><line x1="50" y1="50" x2="50" y2="17" stroke="#F59E0B" stroke-width="15"/><circle cx="50" cy="50" r="10" fill="#F59E0B"/></svg>',
    '<svg width="44" height="44" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="36" stroke="#fff" stroke-width="9"/><line x1="50" y1="9.5" x2="50" y2="17.5" stroke="#F59E0B" stroke-width="7"/><line x1="50" y1="50" x2="50" y2="20" stroke="#F59E0B" stroke-width="15"/><circle cx="50" cy="50" r="10" fill="#F59E0B"/></svg>', '登录页 V2 Logo')

# ═══ 登录页 V3 Logo + 水印 ═══
rep('<div class="wm"><svg width="140" height="140" viewBox="0 0 100 100" fill="none"><path d="M41.9 14.6 A36 36 0 1 1 58.1 14.6" stroke="#fff" stroke-width="10"/><line x1="50" y1="12" x2="50" y2="88" stroke="#fff" stroke-width="12"/><line x1="34" y1="50" x2="66" y2="50" stroke="#F59E0B" stroke-width="11"/><circle cx="50" cy="50" r="9" fill="#F59E0B"/></svg></div>',
    '<div class="wm"><svg width="140" height="140" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="36" stroke="#fff" stroke-width="11"/><circle cx="50" cy="50" r="23" stroke="#fff" stroke-width="5.5"/><line x1="50" y1="12" x2="50" y2="88" stroke="#F59E0B" stroke-width="11"/><circle cx="50" cy="50" r="8.5" fill="#F59E0B"/></svg></div>', '登录页 V3 水印')
rep('<svg width="44" height="44" viewBox="0 0 100 100" fill="none"><path d="M41.9 14.6 A36 36 0 1 1 58.1 14.6" stroke="#fff" stroke-width="10"/><line x1="50" y1="12" x2="50" y2="88" stroke="#fff" stroke-width="12"/><line x1="34" y1="50" x2="66" y2="50" stroke="#F59E0B" stroke-width="11"/><circle cx="50" cy="50" r="9" fill="#F59E0B"/></svg>',
    '<svg width="44" height="44" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="36" stroke="#fff" stroke-width="11"/><circle cx="50" cy="50" r="23" stroke="#fff" stroke-width="5.5"/><line x1="50" y1="12" x2="50" y2="88" stroke="#F59E0B" stroke-width="11"/><circle cx="50" cy="50" r="8.5" fill="#F59E0B"/></svg>', '登录页 V3 Logo')

# ═══ 登录页 V4 Logo + 水印 ═══
rep('<div class="wm"><svg width="140" height="140" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="36" stroke="#fff" stroke-width="9"/><ellipse cx="50" cy="50" rx="13.5" ry="36" stroke="#fff" stroke-width="6"/><ellipse cx="50" cy="50" rx="36" ry="13.5" stroke="#fff" stroke-width="6"/><line x1="50" y1="14" x2="50" y2="86" stroke="#F59E0B" stroke-width="10"/><circle cx="50" cy="50" r="9" fill="#F59E0B"/></svg></div>',
    '<div class="wm"><svg width="140" height="140" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="36" stroke="#fff" stroke-width="9"/><line x1="50" y1="10" x2="50" y2="17" stroke="#fff" stroke-width="6.5"/><line x1="83" y1="50" x2="90" y2="50" stroke="#fff" stroke-width="6.5"/><line x1="50" y1="83" x2="50" y2="90" stroke="#fff" stroke-width="6.5"/><line x1="10" y1="50" x2="17" y2="50" stroke="#fff" stroke-width="6.5"/><path d="M50 16 L58 50 L50 84 L42 50 Z" fill="#F59E0B"/></svg></div>', '登录页 V4 水印')
rep('<svg width="44" height="44" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="36" stroke="#fff" stroke-width="9"/><ellipse cx="50" cy="50" rx="13.5" ry="36" stroke="#fff" stroke-width="6"/><ellipse cx="50" cy="50" rx="36" ry="13.5" stroke="#fff" stroke-width="6"/><line x1="50" y1="14" x2="50" y2="86" stroke="#F59E0B" stroke-width="10"/><circle cx="50" cy="50" r="9" fill="#F59E0B"/></svg>',
    '<svg width="44" height="44" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="36" stroke="#fff" stroke-width="9"/><line x1="50" y1="10" x2="50" y2="17" stroke="#fff" stroke-width="6.5"/><line x1="83" y1="50" x2="90" y2="50" stroke="#fff" stroke-width="6.5"/><line x1="50" y1="83" x2="50" y2="90" stroke="#fff" stroke-width="6.5"/><line x1="10" y1="50" x2="17" y2="50" stroke="#fff" stroke-width="6.5"/><path d="M50 16 L58 50 L50 84 L42 50 Z" fill="#F59E0B"/></svg>', '登录页 V4 Logo')

# ═══ 登录页标签 ═══
rep('<b>V2 · 日晷</b>', '<b>V2 · 日晷 v2</b>', 'V2 标签')
rep('<b>V3 · 准星中轴</b>', '<b>V3 · 同心双环</b>', 'V3 标签')
rep('<b>V4 · 经线球</b>', '<b>V4 · 罗盘</b>', 'V4 标签')

io.open(p, 'w', encoding='utf-8').write(s)
print('ALL REPLACED')
