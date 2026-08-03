# -*- coding: utf-8 -*-
import io

p = r'G:\Agent_Project\task-manage-sys\UI示例\Meridian-登录页视觉稿-2026-08-03.html'
s = io.open(p, encoding='utf-8').read()

def rep(old, new, label):
    global s
    assert old in s, 'NOT FOUND: ' + label
    s = s.replace(old, new)
    print('ok:', label)

# CSS 小修
rep('.b-story{font-size:14px;color:rgba(255,255,255,.60);line-height:1.8;margin-top:24px;max-width:88%}',
    '.b-story{font-size:13.5px;color:rgba(255,255,255,.60);line-height:1.85;margin-top:24px;max-width:100%}',
    'b-story 换行优化')
rep('.f-btn{height:44px;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;color:#fff;background:var(--navy);transition:all .15s;font-family:var(--font);margin-top:18px}',
    '.f-btn{height:44px;width:100%;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;color:#fff;background:var(--navy);transition:all .15s;font-family:var(--font);margin-top:18px}',
    'f-btn 全宽')

io.open(p, 'w', encoding='utf-8').write(s)
print('PART1 OK')
