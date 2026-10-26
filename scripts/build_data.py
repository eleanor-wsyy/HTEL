from __future__ import annotations
import argparse, csv, json, math, statistics, hashlib, shutil, re
from collections import defaultdict, Counter
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
FIELDS=['loneliness','depressedmood','leftout','anhedonia','socialintgross','vulnerability','ppr','anxietycovid']
NAMES=['孤独感','低落情绪','被排斥感','兴趣缺失','社交互动量','自我表露','感知回应','疫情焦虑']
COLORS=['#398194','#b05d67','#726896','#b88245','#348a79','#7c8b47','#5c94a0','#a08e35']
SELECTED=[1002,1013,1041,1045,1113,1122,1130,1147,1150,1157,1159,1167,1173,1191,1204,1245,1247,1291,1309,1312,1456,1471,1478,1483,1489,1497,1498]
NS='http://www.w3.org/2000/svg'; ET.register_namespace('',NS)
def tag(t):return '{'+NS+'}'+t
def number(v):
 try:
  x=float(v)
  return x if math.isfinite(x) else None
 except (ValueError,TypeError):return None
def avg(v):
 v=[x for x in v if x is not None]
 return round(statistics.mean(v),5) if v else None
def stat(v):
 a=[x for x in v if x is not None]
 return {'mean':avg(a),'sd':round(statistics.stdev(a),5)if len(a)>1 else None,'n':len(a)}
def load(p):
 with p.open(encoding='utf-8-sig',newline='')as f:return list(csv.DictReader(f))
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--source',type=Path,required=True);ap.add_argument('--artwork',type=Path,required=True);a=ap.parse_args()
 src=a.source; art=a.artwork
 paths=[src/'0039_kuczynski_ts(1).csv',src/'DailyDiary(1).csv',src/'Baseline(1)(1).csv']
 ts,diary,base=map(load,paths)
 ids=sorted({int(r['id'])for r in ts}); assert len(ids)==515
 baseline={int(r['PID']):r for r in base}; assert len(baseline)==515
 mapping={(int(r['id']),r['date']):int(r['day'])for r in ts}
 d=defaultdict(lambda:defaultdict(lambda:[[]for _ in FIELDS]))
 dates=defaultdict(dict);scores=defaultdict(lambda:defaultdict(list));recorddays=defaultdict(set)
 for r in ts:
  pid=int(r['id']);day=int(r['day'])
  if not 1<=day<=75:continue
  x,y=number(r['loneliness']),number(r['left_out'])
  dates[pid][day]=r['date']
  if x is not None and y is not None:scores[pid][day].append((x+y)/2)
 for r in diary:
  pid=int(r['PID']);day=mapping[(pid,r['date'])]
  if not 1<=day<=75:continue
  recorddays[pid].add(day)
  for i,k in enumerate(FIELDS):
   x=number(r[k])
   if x is not None:
    assert 0<=x<=10,(pid,day,k,x)
    d[pid][day][i].append(x)
 positions=json.loads((art/'sorted_tiles_positions.json').read_text(encoding='utf-8'))
 order=sorted(ids,key=lambda pid:(positions[f'participant_{pid}']['y'],positions[f'participant_{pid}']['x']))
 # The original mosaic uses the strict two-item composite. Archive plots use single items.
 gender={'Cisgender woman':'女性','Cisgender man':'男性','Transgender/Non-binary/Other Gender':'跨性别／非二元／其他性别'}
 living={'No (I live alone)':'独居','Yes (family/romantic partner)':'与家人／伴侣同住','Yes (friends/roommates)':'与朋友／室友同住'}
 rel={'Married':'已婚','Partnered':'有伴侣','Single':'单身'}
 parent={'No':'无子女','Yes, and some/all of my children live with me':'有子女且同住','Yes, and none of my children live with me':'有子女但不同住'}
 def tr(v,m=None):return '未报告' if v in ('NA','',None) else (m.get(v,v)if m else v)
 people=[]
 for pid in ids:
  b=baseline[pid]; rows=[[avg(d[pid][day][i])for i in range(8)]for day in range(1,76)]
  heat=[avg(scores[pid][day])for day in range(1,76)]
  dt=[dates[pid].get(day)for day in range(1,76)]
  inc=b['income'].replace('More than $100,000','超过 $100,000').replace('Less than $9,999','低于 $9,999')
  people.append({'id':pid,'displayId':str(pid-1000),'featured':pid in SELECTED,'days':len(recorddays[pid]),'validDays':sum(v is not None for v in heat),'mean':avg(heat),'dates':dt,'heat':heat,'daily':rows,'stats':[stat([r[i]for r in rows])for i in range(8)],'profile':{'gender':tr(b['gender_3cat'],gender),'age':number(b['age']),'income':tr(inc),'living':tr(b['livingcontext'],living),'relationship':tr(b['relstat_3cat'],rel),'parent':tr(b['parent'],parent)}})
 byid={p['id']:p for p in people}
 reference=[avg([byid[pid]['stats'][i]['mean']for pid in SELECTED])for i in range(8)]
 valid=sum(p['validDays']for p in people)
 audit={'participants':len(people),'sourceRows':len(ts),'diaryRows':len(diary),'baselineRows':len(base),'windowDays':75,'possibleCells':515*75,'validCompositeCells':valid,'missingCompositeCells':515*75-valid,'pairedItems':'(loneliness + left_out) / 2, both required','archiveLoneliness':'DailyDiary.loneliness, single item','duplicatePersonDayExtraRows':sum(Counter((r['id'],r['day'])for r in ts).values())-len(set((r['id'],r['day'])for r in ts)),'outsideWindowRows':sum(not 1<=int(r['day'])<=75 for r in ts),'dateMin':min(r['date']for r in ts),'dateMax':max(r['date']for r in ts),'featuredIds':SELECTED,'sources':[{'name':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in paths]}
 assert valid==27785
 data={'meta':audit,'metrics':[{'key':k,'name':n,'color':c}for k,n,c in zip(FIELDS,NAMES,COLORS)],'referenceMeans':reference,'order':order,'people':people}
 (ROOT/'data/study.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 (ROOT/'data/audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
 # Reuse each exact original editable tile rather than approximating its microgrid.
 original=ET.parse(art/'sorted_tiles_compact.svg').getroot()
 sprite=ET.Element(tag('svg'))
 for g in list(original):
  pid=int(g.get('id').split('_')[1]);g.attrib.pop('transform',None);g.attrib.pop('id',None)
  s=ET.SubElement(sprite,tag('symbol'),{'id':f'tile-{pid}','viewBox':'0 0 1 1'});s.append(g)
 ET.ElementTree(sprite).write(ROOT/'assets/tiles.svg',encoding='utf-8',xml_declaration=True)
 original27=next((art/'outputs/poster_27_archives_A0_大图版').glob('*A0可编辑.svg'))
 # Preserve exact original chart paths and add the matching 75-day tile bottom-right.
 plots=ET.parse(original27).getroot(); ns={'s':NS}; chartSprite=ET.Element(tag('svg'))
 for pid in SELECTED:
  g=plots.find(f'.//s:g[@id="archive-{pid}"]',ns)
  label=next(t for t in g.findall('s:text',ns)if t.text==str(pid))
  cx=float(label.get('x'));cy=float(label.get('y'))+2;label.text=str(pid-1000)
  s=ET.SubElement(chartSprite,tag('symbol'),{'id':f'radial-{pid}','viewBox':f'{cx-218} {cy-218} 436 436'})
  # Remove serial and date labels outside the circular plot.
  for t in list(g):
   if t.tag==tag('text')and t.get('text-anchor')=='start':g.remove(t)
  s.append(g)
  tile=ET.SubElement(s,tag('svg'),{'x':str(cx+150),'y':str(cy+149),'width':'58','height':'45','viewBox':'0 0 1 1','preserveAspectRatio':'none'})
  sourceSymbol=next(z for z in sprite if z.get('id')==f'tile-{pid}')
  import copy
  for z in sourceSymbol:tile.append(copy.deepcopy(z))
 ET.ElementTree(chartSprite).write(ROOT/'assets/radials.svg',encoding='utf-8',xml_declaration=True)
 originals=[None, original27]
 mirror=art/'outputs/posters_03_04_人物图片版'
 originals +=[next(mirror.glob('03_*可编辑.svg')),next(mirror.glob('04_*可编辑.svg'))]
 for i,p in enumerate(originals,1):
  if p is not None:shutil.copy2(p,ROOT/f'assets/poster-{i}.svg')
 assert (ROOT/'assets/poster-1.svg').exists(), 'Keep the shipped live Figma PDF-derived SVG for poster 1.'
 poster2=ET.parse(original27).getroot()
 for pid in SELECTED:
  g=poster2.find(f'.//s:g[@id="archive-{pid}"]',ns)
  label=next(t for t in g.findall('s:text',ns)if t.text==str(pid))
  cx=float(label.get('x'));cy=float(label.get('y'))+2;label.text=str(pid-1000)
  mini=ET.SubElement(g,tag('svg'),{'x':str(cx+150),'y':str(cy+149),'width':'58','height':'45','viewBox':'0 0 1 1','preserveAspectRatio':'none'})
  sourceSymbol=next(z for z in sprite if z.get('id')==f'tile-{pid}')
  for z in sourceSymbol:mini.append(copy.deepcopy(z))
 (ROOT/'assets/poster-2.svg').write_text(ET.tostring(poster2,encoding='unicode'),encoding='utf-8')
 print(json.dumps(audit,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
