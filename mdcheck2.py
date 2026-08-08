import json, urllib.request, time
from datetime import datetime

d = json.load(open('.e2e/state/linkage.json', encoding='utf-8'))
CK = '; '.join(f"{c['name']}={c['value']}" for c in d['cookies'])
def req(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request("http://localhost:3000"+url, data=data, method=method, headers={'Content-Type':'application/json','Cookie':CK})
    return urllib.request.urlopen(r, timeout=60)

today = datetime.now().strftime('%Y-%m-%d')
j = json.loads(req('POST', '/api/inbox/analyze', {'content': 'D验证2-' + str(int(time.time())) + '，预计 40 分钟'}).read().decode())
it = j['data']['items']; it[0]['importance'] = 5; it[0]['deadline'] = today + 'T23:59:59.000Z'
r = json.loads(req('POST', '/api/inbox/confirm', {'draftId': j['data']['draftId'], 'confirmed': it}).read().decode())
tid = r['data']['created'][0]['id']
tv = json.loads(req('GET', '/api/views/today').read().decode())
md = tv.get('mustDo') or []
for m in md:
    if m.get('taskId') == tid:
        print('mustDo children =', json.dumps(m.get('children'), ensure_ascii=False)[:150])
try: req('DELETE', '/api/tasks/' + tid)
except Exception: pass
