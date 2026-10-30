"""Write fictional capture data only to the dedicated Todo-Store-Capture simulator."""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
capture_id = 'D22569B9-504E-4B30-96B9-4EC67D0CF760'
root = Path(sys.argv[1]).resolve()
if capture_id not in str(root) or '/Containers/Data/Application/' not in str(root):
    raise SystemExit('Refusing to write outside the dedicated capture simulator')
jst = timezone(timedelta(hours=9))
now = datetime.now(jst)
def iso(days, hour, minute=0):
    date = (now + timedelta(days=days)).replace(hour=hour,minute=minute,second=0,microsecond=0)
    return date.astimezone(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
items = [('企画書を仕上げる',True,True,iso(0,20)),('来週の目標を考える',False,True,iso(1,10)),('打ち合わせの日程を返信',True,False,iso(0,21)),('読みたい本を探す',False,False,None)]
tasks = [dict(id=f'store-sample-{i}',title=title,urgent=u,important=im,dueAt=due,reminderAt=None,note='',order=i,completedAt=None,createdAt=now.isoformat()) for i,(title,u,im,due) in enumerate(items)]
doc = dict(version=1,tasks=tasks,settings=dict(showTodayCount=True,showNextTask=True,theme='light'),draft=None)
folder=root/'Library/Application Support/com.nagaiasuka.todo/RCTAsyncLocalStorage_V1'
folder.mkdir(parents=True,exist_ok=True)
(folder/'manifest.json').write_text(json.dumps({'todo.document.v1':json.dumps(doc,ensure_ascii=False)},ensure_ascii=False))
print('Seeded four fictional tasks; no reminder notifications scheduled.')
