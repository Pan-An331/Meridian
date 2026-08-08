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

j = json.loads(req('POST', '/api/inbox/analyze', {'content': 'B复现评审文档，预计 90 分钟'}).read().decode())
it = j['data']['items']
it[0]['importance'] = 1
it[0]['breakdown'] = {'shouldBreakdown': True, 'reason': '手动添加子任务', 'phases': [{'title': '清单 1', 'phaseOrder': 0, 'tasks': [{'title': '评审文档初稿', 'estimatedMinutes': 0}]}]}
r = json.loads(req('POST', '/api/inbox/confirm', {'draftId': j['data']['draftId'], 'confirmed': it}).read().decode())
aid = r['data']['created'][0]['id']
print('A id =', aid)

# 排期用正确格式：确认 apply-decision 的入参（先看 404/400 信息）
try:
    resp = req('POST', '/api/plan/apply-decision', {'changes': [{'taskId': aid, 'newStart': start.strftime('%Y-%m-%dT%H:%M:%S.000+08:00'), 'newEnd': end.strftime('%Y-%m-%dT%H:%M:%S.000+08:00')}]})
    print('apply-decision:', resp.status)
except Exception as ex:
    print('apply-decision EXC:', str(ex)[:200])

t = json.loads(req('GET', '/api/tasks/' + aid).read().decode())
print('A schedules:', len(t.get('schedules') or []), 'status:', t.get('status'), 'level:', t.get('level'))
kids = t.get('children') or []
print('A children:', [(c.get('title'), c.get('level'), c.get('id')) for c in kids])

# 子任务排期？
for c in kids:
    ct = json.loads(req('GET', '/api/tasks/' + c['id']).read().decode())
    print(f"  child {c['title']} schedules:", len(ct.get('schedules') or []))

tv = json.loads(req('GET', '/api/views/today').read().decode())
ct = tv.get('currentTask')
print('currentTask.id =', (ct or {}).get('id'), (ct or {}).get('title'))
md = tv.get('mustDo') or []
print('mustDo =', [(m.get('taskId'), m.get('title')) for m in md])
rec = tv.get('recommended') or []
print('recommended =', [(m.get('taskId'), m.get('title')) for m in rec])

# 反查 currentTask.id 是什么
if ct and ct.get('id'):
    for kid in kids:
        if kid['id'] == ct['id']:
            print('currentTask 是 A 的子任务!')
            break

# 清理 A 及子孙
for c in kids:
    try: req('DELETE', '/api/tasks/' + c['id'])
    except Exception: pass
try: req('DELETE', '/api/tasks/' + aid)
except Exception: pass
