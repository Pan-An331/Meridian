import json, urllib.request
from datetime import datetime, timedelta

d = json.load(open('.e2e/state/linkage.json', encoding='utf-8'))
CK = '; '.join(f"{c['name']}={c['value']}" for c in d['cookies'])
def req(method, url, body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request("http://localhost:3000"+url, data=data, method=method, headers={'Content-Type':'application/json','Cookie':CK})
    return urllib.request.urlopen(r, timeout=timeout)

now = datetime.now()
start = now - timedelta(minutes=10)
end = start + timedelta(minutes=90)
print('now =', now.strftime('%H:%M'), ' A排期 =', start.strftime('%H:%M'), '-', end.strftime('%H:%M'))

# 造 A 同款：清单型任务 + 子任务 + 排期在窗口
j = json.loads(req('POST', '/api/inbox/analyze', {'content': 'A复现评审文档，预计 90 分钟'}).read().decode())
it = j['data']['items']
it[0]['importance'] = 1
it[0]['breakdown'] = {'shouldBreakdown': True, 'reason': '手动添加子任务', 'phases': [{'title': '清单 1', 'phaseOrder': 0, 'tasks': [{'title': '评审文档初稿', 'estimatedMinutes': 0}]}]}
r = json.loads(req('POST', '/api/inbox/confirm', {'draftId': j['data']['draftId'], 'confirmed': it}).read().decode())
aid = r['data']['created'][0]['id']
print('A id =', aid)

# 排期：apply-decision 或 schedule API
def make_schedule(task_id, s, e):
    # 用 plan 的 apply-decision 或直接 schedule 表——先试 apply-decision
    try:
        req('POST', '/api/plan/apply-decision', {'changes': [{'taskId': task_id, 'newStart': s.isoformat(), 'newEnd': e.isoformat()}]})
        return 'apply-decision'
    except Exception as ex:
        return f'apply-decision FAIL {ex}'

m = make_schedule(aid, start, end)
print('排期方式:', m)
t = json.loads(req('GET', '/api/tasks/' + aid).read().decode())
print('A schedules:', len(t.get('schedules') or []), 'status:', t.get('status'))

tv = json.loads(req('GET', '/api/views/today').read().decode())
ct = tv.get('currentTask')
print('currentTask =', (ct or {}).get('title') or None, '(应为 A 复现评审文档)')
md = tv.get('mustDo') or []
print('mustDo[0] =', (md[0].get('title') if md else None), md[0].get('importance') if md else '')

# 清理
try: req('DELETE', '/api/tasks/' + aid)
except Exception: pass
