"""Reproduce the exploratory baseline plane. No diary outcomes enter FAMD or K-Means."""
from pathlib import Path
import argparse,hashlib,json,importlib.metadata
import numpy as np
import pandas as pd
import prince
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score,adjusted_rand_score
ROOT=Path(__file__).resolve().parents[1]
FEATURES=['gender_3cat','age','race','parent','income','livingcontext','relstat_3cat','mhdx_anyanx_lifetime','mhdx_mdd_lifetime']
NAMES=['性别','年龄','族群','子女情况','收入分档','居住状况','婚恋状态','焦虑诊断史','抑郁诊断史']
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--baseline',type=Path,required=True);args=ap.parse_args()
 frame=pd.read_csv(args.baseline,encoding='utf-8-sig');frame.columns=frame.columns.str.strip();frame['age']=pd.to_numeric(frame['age'],errors='coerce')
 study_path=ROOT/'data/study.json';study=json.loads(study_path.read_text(encoding='utf-8'));ids={p['id']for p in study['people']}
 assert set(frame['PID'].astype(int))==ids and frame['PID'].is_unique
 clean=frame.dropna(subset=FEATURES).sort_values('PID').copy();X=clean[FEATURES].copy();X['age']=X['age'].astype(float)
 for column in FEATURES:
  if column!='age':X[column]=X[column].astype(str)
 # The same two displayed dimensions are used for the exploratory clustering.
 model=prince.FAMD(n_components=5,n_iter=10,random_state=42,engine='sklearn',categorical_columns=[c for c in FEATURES if c!='age']).fit(X)
 coordinates=np.asarray(model.transform(X),dtype=float);plane=coordinates[:,:2]
 fitted=KMeans(n_clusters=3,random_state=42,n_init=20).fit(plane)
 centroid_order=np.argsort(fitted.cluster_centers_[:,0]);labels={int(old):'ABC'[new]for new,old in enumerate(centroid_order)}
 ratios=np.asarray(model.percentage_of_variance_,dtype=float).tolist()
 validation=[]
 for k in range(2,7):
  candidate=KMeans(n_clusters=k,random_state=42,n_init=20).fit_predict(plane)
  validation.append({'k':k,'silhouette':round(float(silhouette_score(plane,candidate)),6)})
 stability=[]
 for seed in range(5):
  other=KMeans(n_clusters=3,random_state=seed,n_init=20).fit_predict(plane);stability.append(float(adjusted_rand_score(fitted.labels_,other)))
 records=[];profiles=[]
 for row,(index,person) in enumerate(clean.iterrows()):records.append({'id':int(person.PID),'f1':round(float(plane[row,0]),7),'f2':round(float(plane[row,1]),7),'cluster':labels[int(fitted.labels_[row])]})
 for group in 'ABC':
  mask=np.array([labels[int(x)]==group for x in fitted.labels_]);subset=clean.iloc[np.flatnonzero(mask)];c=plane[mask].mean(axis=0)
  profiles.append({'id':group,'n':int(mask.sum()),'center':[round(float(v),7)for v in c], 'ageMedian':float(subset.age.median()),'categories':{name:{str(k):int(v)for k,v in subset[column].value_counts().items()}for name,column in zip(NAMES,FEATURES)if column!='age'}})
 missing=[]
 for _,person in frame[~frame.PID.isin(clean.PID)].sort_values('PID').iterrows():missing.append({'id':int(person.PID),'fields':[name for name,column in zip(NAMES,FEATURES)if pd.isna(person[column])]})
 contributions=[]
 if hasattr(model,'column_contributions_'):
  for key,row in model.column_contributions_.iterrows():contributions.append({'variable':str(key),'dim1':round(float(row.iloc[0]),7),'dim2':round(float(row.iloc[1]),7)})
 result={'method':'FAMD + exploratory K-Means','total':len(frame),'fitted':len(clean),'missing':missing,'features':[{'key':key,'name':name,'type':'numeric'if key=='age'else'categorical'}for key,name in zip(FEATURES,NAMES)],'componentsFitted':5,'componentsDisplayed':2,'variancePercent':[round(float(x),6)for x in ratios],'k':3,'clusterSpace':'前两个FAMD坐标；未使用任何日记指标','clusterNames':'A/B/C仅为探索性编号，无高低或临床含义','randomState':42,'nInit':20,'validation':validation,'stabilityARI':[round(x,6)for x in stability],'groups':profiles,'contributions':contributions,'records':records,'provenance':{'baselineFile':args.baseline.name,'baselineSHA256':hashlib.sha256(args.baseline.read_bytes()).hexdigest(),'packages':{name:importlib.metadata.version(name)for name in ['prince','scikit-learn','pandas','numpy']},'missingPolicy':'九项完整案例；不补值、不为资料不足者生成坐标','incomePolicy':'收入使用原始分类分档；incomeN不参与拟合'}}
 assert len(records)+len(missing)==515 and set(r['id']for r in records)|set(r['id']for r in missing)==ids
 assert np.isfinite(plane).all()
 (ROOT/'data/famd.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 # Add a separate derived field; all existing observations and source-audit fields stay intact.
 study['famd']=result;study_path.write_text(json.dumps(study,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 print(json.dumps({'fitted':len(clean),'unlocated':len(missing),'varianceFirstTwo':ratios[:2],'groups':[(x['id'],x['n'])for x in profiles],'silhouette':validation,'stabilityARI':stability},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
