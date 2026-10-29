"""Generate source-backed interactive chart metadata without changing study.json.
python scripts/build_chart_sources.py --baseline <Baseline.csv>
The original poster's ten rules are preserved, not refitted or interpreted causally.
"""
from pathlib import Path
import argparse,csv,json,hashlib,statistics
ROOT=Path(__file__).resolve().parents[1]
FIELDS=['gender_3cat','age','race','parent','income','livingcontext','relstat_3cat','mhdx_anyanx_lifetime','mhdx_mdd_lifetime']
RACE={'Asian/Asian American':'亚裔','Black/African American':'黑人／非裔','Hispanic/Latino':'西班牙裔／拉丁裔','Mixed Race/Ethnicity':'混合族群','White/European American':'白人／欧洲裔','NA':'未报告','':'未报告'}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--baseline',type=Path,required=True);args=ap.parse_args()
 with args.baseline.open(encoding='utf-8-sig',newline='') as stream:rows=list(csv.DictReader(stream))
 data=json.loads((ROOT/'data/study.json').read_text(encoding='utf8'));byid={p['id']:p for p in data['people']};baseline={int(r['PID']):r for r in rows if int(r['PID']) in byid}
 assert len(baseline)==515
 complete=sorted(pid for pid,r in baseline.items() if all(r[k] not in ['NA',''] for k in FIELDS));assert len(complete)==495
 nodes=[]
 def node(key,ids,label,parent=None,expected=None):
  vals=[byid[i]['stats'][0]['mean'] for i in ids];mean=statistics.mean(v for v in vals if v is not None)
  if expected:assert len(ids)==expected[0] and abs(mean-expected[1])<.006,(key,len(ids),mean,expected)
  out={'id':key,'parent':parent,'label':label,'ids':sorted(ids),'n':len(ids),'mean':round(mean,6),'children':[]};nodes.append(out);return out
 def split(p,question,rank,test,leftlabel,rightlabel,le,re):
  p['question']=question;p['splitOrder']=rank
  yes=[i for i in p['ids'] if test(baseline[i])];no=[i for i in p['ids'] if i not in set(yes)]
  a=node(p['id']+'L',yes,leftlabel,p['id'],le);b=node(p['id']+'R',no,rightlabel,p['id'],re);p['children']=[a['id'],b['id']];return a,b
 root=node('root',complete,'身份信息完整',expected=(495,2.89))
 age,older=split(root,'年龄是否不超过64岁？',1,lambda r:float(r['age'])<=64,'年龄≤64岁','年龄>64岁',(452,2.98),(43,1.90))
 single,pair=split(age,'婚恋状态是否为单身？',2,lambda r:r['relstat_3cat']=='Single','单身','已婚／有伴侣',(129,3.77),(323,2.66))
 low,high=split(single,'收入分档代表值是否≤39,999美元？',4,lambda r:float(r['incomeN'])<=39999,'收入分档≤$39,999','收入分档>$39,999',(67,4.21),(62,3.30))
 split(low,'年龄是否大于27岁？',5,lambda r:float(r['age'])>27,'年龄>27岁','年龄≤27岁',(31,4.93),(36,3.59))
 history,nohistory=split(pair,'是否自报终生焦虑诊断史？',3,lambda r:r['mhdx_anyanx_lifetime']=='1','有焦虑诊断史','无焦虑诊断史',(108,3.31),(215,2.34))
 split(history,'婚恋状态是否为有伴侣？',10,lambda r:r['relstat_3cat']=='Partnered','有伴侣','已婚',(55,3.60),(53,3.00))
 under51,over51=split(nohistory,'年龄是否不超过51岁？',6,lambda r:float(r['age'])<=51,'年龄≤51岁','年龄>51岁',(177,2.50),(38,1.61))
 mixed,other=split(under51,'是否为混合族群、白人或欧洲裔？',7,lambda r:r['race'] in ['Mixed Race/Ethnicity','White/European American'],'混合族群／白人／欧洲裔','其他自报族群',(143,2.65),(34,1.85))
 under42,over42=split(mixed,'年龄是否不超过42岁？',8,lambda r:float(r['age'])<=42,'年龄≤42岁','年龄>42岁',(108,2.86),(35,2.00))
 split(under42,'年龄是否大于32岁？',9,lambda r:float(r['age'])>32,'年龄>32岁','年龄≤32岁',(49,3.35),(59,2.45))
 leaves=[n for n in nodes if not n['children']];assert len(nodes)==21 and len(leaves)==11 and sum(n['n'] for n in leaves)==495
 assert set(i for n in leaves for i in n['ids'])==set(complete)
 metadata={'version':1,'baselineSha256':hashlib.sha256(args.baseline.read_bytes()).hexdigest(),'studySha256':hashlib.sha256((ROOT/'data/study.json').read_bytes()).hexdigest(),'total':515,'complete':495,'excludedIds':sorted(set(byid)-set(complete)),'target':'loneliness single item; mean of each person’s valid-day mean, equally weighted','fieldsRequired':FIELDS,'source':'Original ten-split poster thresholds, checked against Baseline and study.json; not a new fitted model','races':[[i,RACE.get(baseline[i]['race'],baseline[i]['race'])] for i in sorted(byid)],'tree':{'root':'root','nodes':nodes}}
 (ROOT/'chart-source-data.js').write_text('// Source-backed metadata for interactive charts. Do not infer diagnoses or causes.\nexport const chartSource = '+json.dumps(metadata,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
 print('PASS: exact poster reconstruction: 495 people, 10 splits, 11 leaves; every node matches original n/mean.')
if __name__=='__main__':main()
