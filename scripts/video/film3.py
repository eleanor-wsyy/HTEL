"""看见孤独 · 180-second revised data film. Native Pillow/NumPy renderer.
Original film2.py and source movies are read-only. All random-looking motion is deterministic.
python scripts/video/film3.py --stills 7,27,42,61,87,109,126,146,169,178
python scripts/video/film3.py --render --workers 8
"""
from __future__ import annotations
import argparse, json, math, os, shutil, subprocess, time
from pathlib import Path
from functools import lru_cache
from collections import Counter
from concurrent.futures import ProcessPoolExecutor, as_completed
os.environ.setdefault('OMP_NUM_THREADS','1')
os.environ.setdefault('OPENBLAS_NUM_THREADS','1')
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE=Path(__file__).resolve().parent
SOURCE=HERE/'data'
REPO=HERE.parents[1]
W,H,FPS,TOTAL,S=1920,1080,30,180,1.25
PAPER='#f7f6ef'; INK='#1c294b'; MUTED='#66716f'; LINE='#d8dcd2'
BLUE='#285de8'; TEAL='#398194'; RUST='#b05d67'; GREY='#e4e7ec'
STUDY=json.loads((REPO/'data/study.json').read_text(encoding='utf8'))
DATA=np.load(SOURCE/'video_data.npz',allow_pickle=False)
HEAT=DATA['heat'].astype(float); MEAN=DATA['mean']; SD=DATA['sd']; DAYS=np.isfinite(HEAT).sum(1)
N=515; VALID=int(np.isfinite(HEAT).sum()); MISSING=int(np.isnan(HEAT).sum())
METRICS=STUDY['metrics']; REF=STUDY['referenceMeans']; DER=json.loads((SOURCE/'derived.json').read_text(encoding='utf8'))
PEOPLE=STUDY['people']; DISP=np.array([int(p['displayId']) for p in PEOPLE]); INDEX={int(v):i for i,v in enumerate(DISP)}
P={v:PEOPLE[INDEX[v]] for v in [478,498,113,45]}
LON={v:np.array([np.nan if r[0] is None else r[0] for r in p['daily']]) for v,p in P.items()}
text=(REPO/'figma-model-data.js').read_text(encoding='utf8')
MODELS=json.loads(text.split('export const figmaModels = ',1)[1].strip().rstrip(';'))
assert HEAT.shape==(515,75) and VALID==27785 and MISSING==10840
assert sum(m['count'] for m in MODELS)==515
def font_path(env, candidates, fallback=None):
    configured=os.environ.get(env)
    if configured:
        path=Path(configured).expanduser()
        if not path.is_file():raise FileNotFoundError(f'{env}: {path}')
        return path
    for candidate in candidates:
        if Path(candidate).is_file():return Path(candidate)
    if fallback is not None:return fallback
    raise FileNotFoundError(f'Chinese font missing; configure {env}. See scripts/video/README.md.')
FONT=font_path('LONELINESS_FONT_REGULAR',[r'C:\Windows\Fonts\Noto Sans SC (TrueType).otf',r'C:\Windows\Fonts\msyh.ttc'])
BOLD=font_path('LONELINESS_FONT_BOLD',[r'C:\Windows\Fonts\Noto Sans SC Bold (TrueType).otf',r'C:\Windows\Fonts\msyhbd.ttc'],FONT)
NUM=font_path('LONELINESS_FONT_NUM',[r'C:\Windows\Fonts\georgia.ttf'],FONT)
SERIF=font_path('LONELINESS_FONT_SERIF',[r'C:\Windows\Fonts\simsun.ttc'],FONT)

def clamp(x):return np.clip(x,0.,1.)
def smooth(x):x=clamp(x);return x*x*(3-2*x)
def u(t,a,b):return float(smooth((t-a)/(b-a)))
def lin(t,a,b):return float(clamp((t-a)/(b-a)))
def rgb(c):
    if isinstance(c,str):return tuple(int(c[i:i+2],16) for i in (1,3,5))
    return tuple(int(v) for v in c[:3])
def mix(c,d,a):return tuple(int(round(x*(1-a)+y*a)) for x,y in zip(rgb(c),rgb(d)))
@lru_cache(maxsize=120)
def font(size,kind='regular'):
    return ImageFont.truetype(str({'regular':FONT,'bold':BOLD,'num':NUM,'serif':SERIF}[kind]),round(size*S))

def score_colors(vals):
    stops=np.array([0,1.6,3.2,4.1,5.3,6.7,10])
    colors=np.array([rgb(x) for x in ['#fff5ba','#ffe066','#f7bb38','#72c7cf','#1686bd','#174c94','#10233f']])
    safe=np.nan_to_num(vals,nan=0.)
    a=np.stack([np.interp(safe,stops,colors[:,i]) for i in range(3)],-1).astype(np.uint8)
    a[~np.isfinite(vals)]=rgb(GREY)
    return a
HEAT_RGB=score_colors(HEAT)
def metric_colors(vals,col):
    vals=np.array(vals);amount=(.18+.82*np.nan_to_num(vals)/10)[...,None]
    a=np.array(rgb('#fcfbf7'))*(1-amount)+np.array(rgb(col))*amount
    a[~np.isfinite(vals)]=rgb(GREY)
    return a.astype(np.uint8)

class Canvas:
    def __init__(self):
        self.im=Image.new('RGB',(round(W*S),round(H*S)),PAPER);self.d=ImageDraw.Draw(self.im);self.overflow=[]
    def text(self,x,y,s,size=30,col=INK,kind='regular',anchor='la',a=1):
        if a<.002:return
        if kind=='num' and any(ord(ch)>127 for ch in str(s)):kind='regular'
        f=font(size,kind);xy=(round(x*S),round(y*S));c=mix(PAPER,col,float(a))
        self.d.text(xy,str(s),font=f,fill=c,anchor=anchor)
        box=self.d.textbbox(xy,str(s),font=f,anchor=anchor)
        if box[0]<0 or box[1]<0 or box[2]>W*S or box[3]>H*S:self.overflow.append(str(s))
    def line(self,pts,col=LINE,width=2,a=1):
        if a<.002 or len(pts)<2:return
        self.d.line([(round(x*S),round(y*S)) for x,y in pts],fill=mix(PAPER,col,float(a)),width=max(1,round(width*S)),joint='curve')
    def rect(self,box,col,outline=None,width=1):
        b=[round(v*S) for v in box]
        if b[2]<b[0] or b[3]<b[1]:return
        self.d.rectangle(b,fill=col,outline=outline,width=max(1,round(width*S)))
    def circle(self,x,y,r,col=None,outline=None,width=2):
        self.d.ellipse([round(v*S) for v in (x-r,y-r,x+r,y+r)],fill=col,outline=outline,width=max(1,round(width*S)))
    def polygon(self,pts,col):self.d.polygon([(round(x*S),round(y*S)) for x,y in pts],fill=col)
    def paste(self,im,x,y,w=None,h=None):
        if w is not None:im=im.resize((max(1,round(w*S)),max(1,round(h*S))),Image.Resampling.NEAREST)
        if im.mode=='RGBA':self.im.paste(im,(round(x*S),round(y*S)),im)
        else:self.im.paste(im,(round(x*S),round(y*S)))
    def header(self,t,k,tag,title,sub=''):
        a=u(t,.1,.8)
        self.text(116,54,f'{k:02d}  /  {tag}',22,TEAL,a=a)
        self.text(112,104,title,58,kind='bold',a=a)
        if sub:self.text(116,192,sub,27,MUTED,a=u(t,.6,1.3))
        self.line([(116,251),(1804,251)],width=1,a=a)
    def footer(self,s):self.text(116,983,s,23,MUTED)
    def progress(self,t):
        self.line([(116,1033),(1804,1033)],LINE,2)
        self.line([(116,1033),(116+1688*min(1,t/TOTAL),1033)],TEAL,2)
        self.text(116,1044,'看见孤独  /  THE SHAPE OF LONELINESS',16,MUTED)
        self.text(1804,1044,f'{int(t)//60:02d}:{int(t)%60:02d}  /  03:00',16,MUTED,anchor='ra')
    def image(self):return self.im.resize((W,H),Image.Resampling.LANCZOS)

def label_axis(c,box,xmax=10,ymax=5,xticks=None,yticks=None,xlabel='',ylabel=''):
    x,y,w,h=box
    c.line([(x,y),(x,y+h),(x+w,y+h)],MUTED,2)
    for val,lab in (xticks if xticks is not None else [(0,'0'),(5,'5'),(10,'10')]):
        xx=x+w*val/xmax;c.line([(xx,y+h),(xx,y+h+8)],MUTED,1)
        c.text(xx,y+h+17,lab,25,MUTED,anchor='ma')
    for val in (yticks if yticks is not None else [0,1,2,3,4,5]):
        yy=y+h-h*val/ymax;c.line([(x,yy),(x+w,yy)],LINE,1)
        c.text(x-18,yy,str(val),24,MUTED,anchor='rm')
    if xlabel:c.text(x+w,y+h+57,xlabel,25,MUTED,anchor='ra')
    if ylabel:c.text(x,y-45,ylabel,25,MUTED)

def tile(v):return Image.fromarray(HEAT_RGB[INDEX[v]].reshape(5,15,3))
TILES=[Image.fromarray(a.reshape(5,15,3)) for a in HEAT_RGB]
SORT=np.argsort(-MEAN,kind='stable');RANK=np.empty(515,int);RANK[SORT]=np.arange(515)
def tilepos(i):r,c=divmod(i,26);return np.array([116+c*65,302+r*27],float)

def scene_hook(c,t):
    c.text(116,52,'看见孤独  /  THE SHAPE OF LONELINESS',24,TEAL,a=u(t,.1,.8))
    c.text(116,124,'同样的分数，是相同的日常吗？',66,kind='serif',a=u(t,.6,1.6))
    for j,pid in enumerate([478,498]):
        x=122+910*j;a=u(t,1+j*.5,2.8+j*.5)
        c.text(x,323,f'编号 {pid}',32,MUTED,a=a)
        c.text(x,374,'3.44',146,kind='num',a=a)
        c.text(x+10,568,'孤独感单题均值',34,TEAL,a=a)
        c.line([(x,696),(x+720,696)],LINE,3)
        xx=x+720*.344*u(t,2,4)
        c.circle(xx,696,12,TEAL)
        c.text(x,720,'0',25,MUTED);c.text(x+720,720,'10',25,MUTED,anchor='ra')
    c.text(116,842,'75 天，会留下怎样不同的轨迹？',42,INK,a=u(t,4.7,6))
    c.footer('真实人物对照 · 孤独感单题 · 0—10 分；只比较各自入组日次，不表示同一日历日。')

def scene_collective(c,t):
    c.header(t,2,'FROM ONE DAY TO 515 PEOPLE','一天，怎样成为一幅人群画像？','总览口径：双题复合分；孤独感和被排斥感两题均有效才计算。')
    if t<8.5:
        c.text(120,291,'（孤独感 ＋ 被排斥感）÷ 2',38,TEAL,a=u(t,.4,1.4))
        c.text(120,351,'编号 478  /  一大格是一人，内部是 D01—D75',28,MUTED,a=u(t,1,2))
        grow=max(1,int(lin(t,.9,6.2)*75));vals=HEAT_RGB[INDEX[478]]
        for d in range(grow):
            r,k=divmod(d,15);x=120+k*96;y=425+r*83
            c.rect((x,y,x+89,y+76),tuple(vals[d]))
        c.text(1630,464,'515',82,kind='num',a=u(t,5,6.2));c.text(1630,568,'个人',31,MUTED,a=u(t,5,6.2))
        c.text(1630,655,'75',82,TEAL,kind='num',a=u(t,5.6,7));c.text(1630,758,'个日次',31,MUTED,a=u(t,5.6,7))
    else:
        sort=u(t,14,17.3)
        for i in range(515):
            if i==INDEX[478] and t<12:continue
            pos=tilepos(i)*(1-sort)+tilepos(RANK[i])*sort
            settle=u(t,8.6+(i%29)*.032,10.6+(i%29)*.032)
            if settle<=0:continue
            pos[1]-=(1-settle)*(95+80*(i%7)/6)
            c.paste(TILES[i],*pos,60,20)
        if t<12:
            z=u(t,8.5,11.5);target=tilepos(INDEX[478]);xy=np.array([120,425])*(1-z)+target*z
            c.paste(tile(478),*xy,1440*(1-z)+60*z,408*(1-z)+20*z)
        c.text(116,864,'515 人  ×  75 日次  ＝  38,625 个可能格',38,kind='serif',a=u(t,10.5,11.8))
        c.text(116,923,'按个人双题均值重排；移动的是同一个人的完整 75 格。',26,MUTED,a=u(t,14.3,15.5))
        # Explicit source-consistent score key.
        grad=Image.fromarray(score_colors(np.linspace(0,10,300))[None,:,:])
        c.paste(grad,1370,870,390,20)
        c.text(1370,905,'0',22,MUTED);c.text(1760,905,'10',22,MUTED,anchor='ra')
    c.footer('D01 是每个人各自入组后的第一天；黄—蓝表示分数，灰色表示不可计算，灰色不等于 0。')

# Three-field joint Sankey: every ribbon is an actual joint group of the same 515 people.
FIELD_KEYS=['gender','living','parent']
FIELD_VALS=[['女性','男性','跨性别／非二元／其他性别','未报告'],['独居','与朋友／室友同住','与家人／伴侣同住','未报告'],['无子女','有子女但不同住','有子女且同住','未报告']]
SHORT={'跨性别／非二元／其他性别':'其他性别','与朋友／室友同住':'朋友／室友','与家人／伴侣同住':'家人／伴侣','有子女但不同住':'有子女不同住','有子女且同住':'有子女同住'}
FLOWCOL=['#DD6248','#D59B32','#0C8F7B','#969B91']
SCOUNTS=Counter(tuple(p['profile'][k] or '未报告' for k in FIELD_KEYS) for p in PEOPLE)
NODES=[];lookup={};cursor_used={};unit=445/515
for j,vals in enumerate(FIELD_VALS):
    y=324
    for val in vals:
        count=sum(n for keys,n in SCOUNTS.items() if keys[j]==val)
        node=(j,val,count,310+j*650,y,count*unit);NODES.append(node);lookup[j,val]=node;cursor_used[j,val]=0;y+=count*unit+22
FLOWS=[]
for keys,n in sorted(SCOUNTS.items(),key=lambda it:tuple(FIELD_VALS[j].index(v) for j,v in enumerate(it[0]))):
    ys=[]
    for j,val in enumerate(keys):
        node=lookup[j,val];ys.append(node[4]+cursor_used[j,val]*unit);cursor_used[j,val]+=n
    FLOWS.append((keys,n,ys))

def bezier(a,b,n=28):
    t=np.linspace(0,1,n)[:,None];a=np.array(a);b=np.array(b);dx=(b[0]-a[0])*.43
    c1=a+np.array([dx,0]);c2=b-np.array([dx,0])
    return (1-t)**3*a+3*(1-t)**2*t*c1+3*(1-t)*t*t*c2+t**3*b
@lru_cache(maxsize=1)
def sankey_base():
    layer=Image.new('RGBA',(round(W*S),round(H*S)),(0,0,0,0));dr=ImageDraw.Draw(layer)
    for keys,n,ys in FLOWS:
        col=rgb(FLOWCOL[FIELD_VALS[1].index(keys[1])]);h=n*unit
        for j in [0,1]:
            a=bezier((332+j*650,ys[j]),(310+(j+1)*650,ys[j+1]))
            b=bezier((310+(j+1)*650,ys[j+1]+h),(332+j*650,ys[j]+h))
            # Reversing endpoints requires the control direction to reverse too.
            b=bezier((332+j*650,ys[j]+h),(310+(j+1)*650,ys[j+1]+h))[::-1]
            pts=np.concatenate([a,b])*S;dr.polygon([tuple(p) for p in pts],fill=col+(107,))
    return layer

def scene_background(c,t):
    c.header(t,3,'THE SAME PEOPLE, DIFFERENT BACKGROUNDS','同一批人，不同的生活组合。','性别 → 居住状况 → 子女情况；流带宽度表示实际人数。')
    layer=sankey_base();clipx=int((310+1300*u(t,1.5,9))*S)
    crop=layer.crop((0,0,min(layer.width,clipx),layer.height));c.im.paste(crop,(0,0),crop)
    for j in range(3):
        a=u(t,j*2,.8+j*2)
        c.text(310+j*650,280,['性别','居住状况','子女情况'][j],30,kind='bold',a=a)
    for j,val,n,x,y,h in NODES:
        a=u(t,j*2,.8+j*2)
        if a<=0:continue
        col=FLOWCOL[FIELD_VALS[1].index(val)] if j==1 else INK
        c.rect((x,y,x+22,y+h),mix(PAPER,col,a))
        if val!='未报告':
            c.text(x-20,y+h/2,f'{SHORT.get(val,val)}  {n}',26,INK,anchor='rm',a=a)
    for j,n in enumerate([3,13,2]):c.text(310+j*650,866,f'未报告 {n} 人',23,MUTED,a=u(t,6,7))
    c.text(116,918,'独居 104 人；其余人有不同的同住安排，也包括未报告者。',32,TEAL,a=u(t,10.5,12))
    c.footer('三列均为同一批 515 人；流向表示背景类别的交叉，不表示人生状态随时间改变。')

SCATTER_OK=np.isfinite(MEAN)&np.isfinite(SD);SCATTER_ORDER=np.argsort(MEAN)
def scene_variation(c,t):
    c.header(t,4,'LEVEL AND VARIATION','把水平和起伏，分开看。','每个点是一人；两轴均由该人的有效双题日计算。')
    box=(165,350,1070,475);x,y,w,h=box
    label_axis(c,box,xmax=10,ymax=5,xlabel='双题复合均值',ylabel='日常起伏 / 样本标准差')
    n=int(lin(t,1,7)*515)
    for i in SCATTER_ORDER[:n]:
        if SCATTER_OK[i]:c.circle(x+w*MEAN[i]/10,y+h-h*SD[i]/5,4,mix(PAPER,BLUE,.48))
    b=DER['bins'];k=int(lin(t,8,11)*len(b))
    pts=[(x+w*p['mean']/10,y+h-h*p['sd']/5) for p in b[:k]]
    c.line(pts,RUST,4)
    for xx,yy in pts:c.circle(xx,yy,6,RUST)
    c.text(1360,359,'515',104,kind='num',a=u(t,3,4.5));c.text(1370,493,'个真实人物点',31,MUTED,a=u(t,3,4.5))
    c.text(1350,620,'同一水平附近，',34,kind='serif',a=u(t,10,11.3))
    c.text(1350,677,'仍有不同的起伏。',34,kind='serif',a=u(t,10.8,12))
    c.line([(1350,771),(1414,771)],RUST,4,a=u(t,9,10))
    c.text(1435,747,'10 个分箱摘要',26,MUTED,a=u(t,9,10))
    c.text(116,925,'均值告诉我们“多高”，标准差告诉我们“起伏多大”。',34,INK,a=u(t,12.2,13.7))
    c.footer('横轴完整保留 0—10 分，未截去高分人物；折线为分箱汇总，不是个人轨迹或因果模型。')

def scene_radial(c,t):
    c.header(t,5,'EIGHT DIMENSIONS OF EVERYDAY LIFE','一个人的八种感受，怎样画成圆？','从总览双题分切换到八项单题：每个扇区独立阅读。')
    cx,cy,r0,rmax=635,584,48,280;step=2*math.pi/8
    a=u(t,.6,2)
    for v in [0,2,4,6,8,10]:
        r=r0+(rmax-r0)*v/10;c.circle(cx,cy,r,None,mix(PAPER,LINE,a),1)
    for v in [0,5,10]:
        r=r0+(rmax-r0)*v/10;c.text(cx+12,cy-r,str(v),22,MUTED,anchor='lm',a=a)
    focused=u(t,22,24)
    for m,metric in enumerate(METRICS):
        mid=-math.pi/2+m*step;col=metric['color'];fade=1 if m==0 else 1-.8*focused
        sa=u(t,2+m*.19,2.6+m*.19)*fade
        c.line([(cx+r0*math.cos(mid),cy+r0*math.sin(mid)),(cx+rmax*math.cos(mid),cy+rmax*math.sin(mid))],LINE,1,a=sa)
        c.text(cx+312*math.cos(mid),cy+312*math.sin(mid),f'{m+1:02d}',27,col,anchor='mm',a=sa)
        count=int(lin(t,5+m*.18,11+m*.18)*75)
        for d in range(count):
            v=P[478]['daily'][d][m]
            if v is None:continue
            ang=mid-step*.43+step*.86*d/74;r=r0+(rmax-r0)*float(v)/10
            c.line([(cx+r0*math.cos(ang),cy+r0*math.sin(ang)),(cx+r*math.cos(ang),cy+r*math.sin(ang))],col,1.15,a=.55*fade)
        stat=P[478]['stats'][m];mu=stat['mean'];sd=stat['sd'];ma=u(t,13,15)*fade
        if mu is not None and sd is not None:
            lo=r0+(rmax-r0)*max(0,mu-sd)/10;hi=r0+(rmax-r0)*min(10,mu+sd)/10;rr=r0+(rmax-r0)*mu/10
            c.line([(cx+lo*math.cos(mid),cy+lo*math.sin(mid)),(cx+hi*math.cos(mid),cy+hi*math.sin(mid))],col,5,a=ma)
            if ma>0:c.circle(cx+rr*math.cos(mid),cy+rr*math.sin(mid),6,mix(PAPER,col,ma))
        ra=u(t,18,20)*fade
        if ra>0:
            r=r0+(rmax-r0)*REF[m]/10;c.circle(cx+r*math.cos(mid),cy+r*math.sin(mid),6,PAPER,mix(PAPER,col,ra),2)
    c.circle(cx,cy,r0,PAPER)
    c.text(cx,cy-10,'478',42,kind='num',anchor='mm');c.text(cx,cy+25,'75日次',17,MUTED,anchor='mm')
    c.text(1180,301,'编号 478',42,kind='serif',a=u(t,1,2))
    c.text(1180,370,'3.44',90,TEAL,kind='num',a=u(t,21,23));c.text(1490,411,'孤独感单题均值',27,MUTED,a=u(t,21,23))
    for m,metric in enumerate(METRICS):
        yy=520+m*44;on=u(t,2+m*.19,3+m*.19)
        c.circle(1193,yy+17,5,metric['color'])
        c.text(1215,yy,f'{m+1:02d}  {metric["name"]}',27,metric['color'],a=on)
        c.text(1760,yy,f'{P[478]["stats"][m]["mean"]:.2f}',27,MUTED,anchor='ra',a=u(t,13,15))
    c.text(116,929,'细线：每天的单题分  ·  实心点与线段：均值 ± 1 SD',28,INK,a=u(t,13,15))
    c.footer('空心点为精选 27 人的等权均值，不是 515 人总体均值；0 分位于内圈，缺失日不画射线。')

def curve_points(vals,box):
    x,y,w,h=box
    return np.stack([x+np.arange(75)/74*w,y+h-np.asarray(vals)/10*h],-1)
def draw_curve(c,pts,col,cut,width=3):
    count=min(75,int(cut));fraction=cut-int(cut);group=[]
    for i in range(count):
        if np.all(np.isfinite(pts[i])):group.append(tuple(pts[i]))
        else:c.line(group,col,width);group=[]
    if 0<count<75 and fraction>0 and np.isfinite(pts[count-1:count+1]).all():group.append(tuple(pts[count-1]*(1-fraction)+pts[count]*fraction))
    c.line(group,col,width)
    if group:c.circle(*group[-1],5,col)

def scene_compare(c,t):
    c.header(t,6,'SAME MEAN, DIFFERENT DAYS','同样 3.44，不同的 75 天。','孤独感单题 · 两人共用 0—10 分尺与日次轴。')
    box=(165,390,1590,365)
    if t<4:
        for j,pid in enumerate([478,498]):
            a=metric_colors(LON[pid],TEAL).reshape(5,15,3)
            c.text(170+j*900,303,f'编号 {pid}  /  均值 3.44',35,kind='serif')
            c.paste(Image.fromarray(a),170+j*900,440,600,200)
        c.text(116,836,'先按相同色尺看日格，再把每天的值放到时间轴。',34,INK,a=u(t,.8,2))
    else:
        label_axis(c,box,xmax=74,ymax=10,xticks=[(0,'D01'),(24,'D25'),(49,'D50'),(74,'D75')],yticks=[0,5,10],ylabel='孤独感单题 / 分')
        for j,(pid,col) in enumerate([(478,BLUE),(498,RUST)]):
            pts=curve_points(LON[pid],box)
            if t<7:
                p=u(t,4,7)
                for d in range(75):
                    r,k=divmod(d,15);start=np.array([190+j*900+k*40,440+r*40])
                    xx,yy=start*(1-p)+pts[d]*p;c.circle(xx,yy,4,col)
            else:draw_curve(c,pts,col,lin(t,7,12)*75,3.5)
            c.text(165+j*900,292,f'编号 {pid}  /  均值 3.44',34,col,kind='serif')
        y=box[1]+box[3]*(1-.344);on=u(t,12,13.5)
        for xx in np.arange(165,1755,25):c.line([(xx,y),(xx+13,y)],INK,1.5,a=on)
        c.text(1755,y-34,'共同均值 3.44',25,INK,anchor='ra',a=on)
        for j,(sd,col) in enumerate([(1.89,BLUE),(2.51,RUST)]):
            x=165+j*900;c.text(x,846,f'SD {sd:.2f}',52,col,kind='num',a=u(t,14+j*.7,15.5+j*.7))
        c.text(1050,922,'均值相同，日常波动相差 0.62。',32,INK,a=u(t,17,18.4))
    c.footer('曲线颜色区分人物；D01 为各自入组首日，不表示共同经历同一日历事件。样本标准差以有效日计算。')

# Original vector geometry: no model rows are assigned to participant IDs.
MODEL_ARRAYS=[]
for g in MODELS:
    a=np.array([[ord(ch)-48 for ch in row] for row in g['rows']],float)
    rr,dd=np.where(a>0);units=a[rr,dd]
    assert len(rr)==g['barCount']
    MODEL_ARRAYS.append((rr,dd,units))

def rotate(points,yaw,pitch,cy):
    p=np.asarray(points);a=p[...,0]-742.5;b=p[...,1]-cy
    rx=a*math.cos(yaw)-b*math.sin(yaw);ry=a*math.sin(yaw)+b*math.cos(yaw);rz=p[...,2]-225
    q=math.sqrt(.5);co=math.cos(pitch);si=math.sin(pitch);dot=(rx-ry)*q
    xx=rx*co-rz*q*si+q*dot*(1-co)
    yy=ry*co-rz*q*si-q*dot*(1-co)
    zz=rz*co+(rx+ry)*q*si
    return np.stack([xx,yy,zz],-1)
def projected(points):return np.stack([points[...,0]-points[...,1],points[...,0]*2/9+points[...,1]*(.30624/.46464)-points[...,2]],-1)

def draw_model(c,g,box,yaw=0,pitch=0,extrude=1,reveal=75,axes=True):
    rr,dd,units=MODEL_ARRAYS[g];sel=dd<reveal;rr=rr[sel];dd=dd[sel];units=units[sel]
    x=dd*19.8;y=rr*2.42;z=units*6*extrude
    cy=(MODELS[g]['count']-1)*1.21
    vx=np.array([0,15.05,15.05,0,0,15.05,15.05,0]);vy=np.array([0,0,1.75,1.75,0,0,1.75,1.75]);vz=np.array([0,0,0,0,1,1,1,1])
    world=np.stack([x[:,None]+vx,y[:,None]+vy,z[:,None]*vz],-1)
    r=rotate(world,yaw,pitch,cy);screen=projected(r)
    # Constant world bounds include full height even during extrusion, preventing breathing scale.
    ext=np.array([[x,y,z] for x in [0,1500] for y in [0,584] for z in [0,450]],float)
    e=projected(rotate(ext,yaw,pitch,cy));lo=e.min(0);hi=e.max(0)
    bx,by,bw,bh=box;scale=min(bw/(hi[0]-lo[0]),bh/(hi[1]-lo[1]));offset=np.array([bx+bw/2,by+bh/2])-(lo+hi)/2*scale
    screen=screen*scale+offset
    basecolor=['#7897c6','#76a9a9','#6eae9c','#ca9c59','#bf7c87'][g]
    view=np.array([1,1,2/9+.30624/.46464])
    o=rotate(np.array([0,0,0]),yaw,pitch,cy)
    axesworld=np.array([[1,0,0],[0,1,0],[0,0,1]])
    normals=rotate(axesworld,yaw,pitch,cy)-o
    choices=[([1,2,6,5] if np.dot(normals[0],view)>0 else [0,3,7,4],mix(basecolor,INK,.19)),([2,3,7,6] if np.dot(normals[1],view)>0 else [0,1,5,4],mix(basecolor,INK,.09)),([4,5,6,7],mix(basecolor,PAPER,.16))]
    if len(rr):
        faces=np.concatenate([screen[:,idx,:] for idx,col in choices],axis=0)
        depth=np.concatenate([(r[:,idx,:].mean(1)@view) for idx,col in choices])
        order=np.argsort(depth,kind='stable');colors=[rgb(col) for idx,col in choices]
        n=len(rr)
        for i in order:
            c.d.polygon([tuple(p) for p in faces[i]*S],fill=colors[int(i)//n])
    if axes:
        origin=projected(rotate(np.array([[0,0,0],[1485,0,0],[0,max(2,(MODELS[g]['count']-1)*2.42),0],[0,0,450]]),yaw,pitch,cy))*scale+offset
        for i in [1,2,3]:c.line([origin[0],origin[i]],INK,1.5)
        c.text(*origin[1]+np.array([0,18]),'D75',21,MUTED,anchor='ma')
        c.text(*origin[0]+np.array([-8,18]),'D01',21,MUTED,anchor='ra')
    return screen

GPNAMES=['几乎每天填写','时间较短但基本连续','断断续续填写','5月前停止填写','填写少于7晚']
def scene_models(c,t):
    c.header(t,7,'THE SHAPE OF RECORDING','让记录，长成立体的形状。','X：D01—D75　 Y：原稿组内行序号　 Z：连续段高度编码；不是孤独分数。')
    if t<20:
        extrusion=u(t,6,11);reveal=max(1,lin(t,.8,5.5)*75)
        top=-1.0135*u(t,13,15)*(1-u(t,17,19))
        yaw=.13*math.sin(math.pi*lin(t,11,19))
        draw_model(c,0,(170,328,1430,540),yaw,top,extrusion,reveal)
        c.text(1370,286,'192 人',44,kind='serif');c.text(1370,350,'几乎每天填写',29,MUTED)
        note='先展开时间与人物所在的平面。' if t<6 else ('真实连续段，长出各自的高度。' if t<13 else '俯视看缺口，斜视看连续段高低。')
        c.text(116,924,note,35,INK)
    elif t<28:
        g=min(4,1+int((t-20)/2));local=(t-20)%2
        draw_model(c,g,(155,325,1450,550),yaw=.12*math.sin(local*.9),extrude=.6+.4*u(local,0,1))
        c.text(1260,289,f'{MODELS[g]["count"]} 人',51,kind='serif')
        c.text(1260,371,GPNAMES[g],30,MUTED)
        c.text(116,924,'同样 75 个日次，留下不同的连续与断裂。',35,INK)
    else:
        # Same x/z scale, same world-row spacing, no group-specific height normalization.
        for g in range(5):
            draw_model(c,g,(110+g*350,370,330,390),yaw=.04*math.sin(t*.35),axes=False)
            x=110+g*350
            c.text(x,793,f'{MODELS[g]["count"]} 人',43,['#7897c6','#76a9a9','#6eae9c','#ca9c59','#bf7c87'][g],kind='num')
            c.text(x,858,GPNAMES[g],22,INK)
        c.text(116,923,'有些日常，只留下了很少的记录。',35,INK,a=u(t,32,33.5))
    # Independent common height key, prevents minimum group being auto-scaled to 100%.
    c.line([(1780,454),(1780,724)],MUTED,2)
    for n in [0,25,50,75]:
        yy=724-n/75*270;c.line([(1773,yy),(1787,yy)],MUTED,2);c.text(1757,yy,str(n),22,MUTED,anchor='rm')
    c.text(1795,438,'天',21,MUTED)
    c.footer('原稿五组共 515 行、28,019 根柱；高度编码对应连续段长度，原稿行序号尚未映射到具体人物 ID。')

COVER=np.isfinite(HEAT);COVER_SORT=np.argsort(DAYS,kind='stable');COVER_RANK=np.empty(515,int);COVER_RANK[COVER_SORT]=np.arange(515)
COVER_COLORS=np.where(COVER[...,None],np.array(rgb(TEAL)),np.array(rgb(GREY))).astype(np.uint8)
LOW=DAYS<=15;NLOW=int(LOW.sum());LOWMISS=float((~COVER[LOW]).sum()/(~COVER).sum())
def scene_missing(c,t):
    c.header(t,8,'BEYOND THE OBSERVED','这些空白，让谁更难被看见？','回到可关联人物 ID 的日记数据；此处有效＝当天两题均有效。')
    x,y,w,h=160,357,1090,474
    grow=max(1,int(lin(t,.8,3.8)*75));sort=u(t,4,8)
    c.rect((x,y,x+w,y+h),GREY)
    # Each identity owns one 75-day column; move it instead of dissolving between different people.
    for i in range(515):
        xx=x+(i*(1-sort)+COVER_RANK[i]*sort)*w/515
        arr=COVER_COLORS[i,:grow,:][:,None,:]
        c.paste(Image.fromarray(arr),xx,y,w/515+0.15,h*grow/75)
    c.line([(x,y),(x,y+h),(x+w,y+h)],MUTED,1.5)
    for d in [1,25,50,75]:c.text(x-20,y+(d-1)/74*h,f'D{d:02d}',24,MUTED,anchor='rm')
    c.text(x,y+h+24,'每列一人',24,MUTED);c.text(x+w,y+h+24,'515 人',24,MUTED,anchor='ra')
    on=u(t,8,10);border=x+w*NLOW/515
    c.line([(border,y-10),(border,y+h+8)],RUST,3,a=on)
    if on>0:c.text(x,y-50,'≤15 有效双题日',27,RUST,a=on)
    c.text(1350,337,'49',134,RUST,kind='num',a=on)
    c.text(1350,510,'人，占样本 9.5%',33,MUTED,a=on)
    c.text(1350,632,'对应全部不可计算格的',26,MUTED,a=u(t,12,13.5))
    c.text(1350,683,'31.3%',67,TEAL,kind='num',a=u(t,12,13.5))
    c.rect((1350,791,1770,817),GREY)
    c.rect((1350,791,1350+420*LOWMISS*u(t,12,14),817),TEAL)
    c.text(116,924,'记录少，不能告诉我们他们为何没有写。',35,INK,a=u(t,16,17.5))
    c.footer('≤15 天为探索性阈值；灰色是不可计算，并非零分、退出证明或人的性格标签。')

def scene_close(c,t):
    c.text(116,66,'看见孤独  /  THE SHAPE OF LONELINESS',25,TEAL)
    c.text(116,167,'看见感受，也看见记录之外的空白。',64,kind='serif',a=u(t,.4,1.4))
    v=VALID/(515*75);a=u(t,.8,2.6)
    c.rect((116,496,1804,565),GREY);c.rect((116,496,116+1688*v*a,565),TEAL)
    c.text(116,337,'27,785',91,TEAL,kind='num',a=a);c.text(116,448,'有效双题格 · 71.9%',30,MUTED,a=a)
    c.text(1804,337,'10,840',91,MUTED,kind='num',anchor='ra',a=a);c.text(1804,448,'不可计算格 · 28.1%',30,MUTED,anchor='ra',a=a)
    c.text(116,652,'515 人 × 75 日次 ＝ 38,625 个可能格',43,kind='serif',a=u(t,2.8,4))
    c.text(116,755,'一个人，不止一个平均分。',49,INK,a=u(t,4,5.2))
    c.text(116,884,'数据来源：Kuczynski 等；项目提供的三份 CSV。',25,MUTED,a=u(t,4.8,6))
    c.footer('原始日记 28,027 条；各自入组后最多 75 日次。原稿模型柱数、原始行数和双题有效人日分别计数。')

SCENES=[(0,10,scene_hook),(10,30,scene_collective),(30,46,scene_background),(46,64,scene_variation),(64,90,scene_radial),(90,112,scene_compare),(112,150,scene_models),(150,171,scene_missing),(171,180,scene_close)]

def render_frame(i):
    sec=i/FPS;c=Canvas()
    for start,end,scene in SCENES:
        if start<=sec<end:
            scene(c,sec-start)
            # Brief paper cuts only. Last scene holds its final frame instead of fading away.
            fade=1.
            if sec-start<.25:fade=u(sec,start,start+.25)
            if sec>end-.18 and end<TOTAL:fade=1-u(sec,end-.18,end)
            if fade<1:c.im=Image.blend(Image.new('RGB',c.im.size,PAPER),c.im,fade)
            break
    c.progress(sec)
    return c.image(),c.overflow

def encode_batch(task):
    begin,end,path=task;ff=shutil.which('ffmpeg')
    cmd=[ff,'-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-threads','2','-video_track_timescale','15360',str(path)]
    errors=[];started=time.time()
    with open(str(path)+'.log','wb') as log:
        proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=log)
        try:
            for i in range(begin,end):
                im,bad=render_frame(i)
                if bad:errors.extend([(i,b) for b in bad])
                proc.stdin.write(im.tobytes())
            proc.stdin.close();code=proc.wait()
            if code:raise RuntimeError(f'Encoder failed: {path}')
        finally:
            if proc.poll() is None:proc.kill();proc.wait()
    return {'path':str(path),'frames':end-begin,'seconds':round(time.time()-started,2),'overflow':list(dict.fromkeys((i,s) for i,s in errors))[:20]}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--stills',default='');ap.add_argument('--render',action='store_true');ap.add_argument('--workers',type=int,default=8);ap.add_argument('--outdir',default=str(HERE/'film3_output'));ap.add_argument('--frames',nargs=2,type=int)
    args=ap.parse_args();out=Path(args.outdir);out.mkdir(parents=True,exist_ok=True)
    if args.stills:
        audit=[]
        for s in args.stills.split(','):
            i=min(TOTAL*FPS-1,round(float(s)*FPS));im,bad=render_frame(i);name=f'still_{i:05d}.png';im.save(out/name);audit.append({'time':float(s),'file':name,'overflow':bad});print('STILL',float(s),'overflow',len(bad),flush=True)
        (out/'stills_audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf8')
    if args.render:
        if not shutil.which('ffmpeg'):ap.error('ffmpeg must be installed and available on PATH')
        if args.workers<1:ap.error('--workers must be at least 1')
        a,b=args.frames if args.frames else (0,TOTAL*FPS)
        if not 0<=a<b<=TOTAL*FPS:ap.error('--frames must be within 0..5400, with an exclusive end')
        parts=out/'parts';parts.mkdir(exist_ok=True)
        tasks=[(k,min(k+300,b),parts/f'part_{k:05d}.mp4') for k in range(a,b,300)]
        results=[]
        with ProcessPoolExecutor(max_workers=args.workers) as pool:
            futures={pool.submit(encode_batch,t):t for t in tasks}
            for f in as_completed(futures):
                result=f.result();results.append(result);print('PART',len(results),'/',len(tasks),'frames',result['frames'],'sec',result['seconds'],'overflow',len(result['overflow']),flush=True)
        (out/'render_audit.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
        concat=out/'concat.txt';concat.write_text(''.join("file '"+str(t[2]).replace('\\','/')+"'\n" for t in tasks),encoding='utf8')
        dest=out/('loneliness_recut_180s_1080p.mp4' if (a,b)==(0,TOTAL*FPS) else f'loneliness_recut_frames_{a:05d}-{b:05d}_1080p.mp4')
        subprocess.run([shutil.which('ffmpeg'),'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-c','copy','-an','-movflags','+faststart',str(dest)],check=True)
        print('COMPLETE',str(dest).encode('ascii','backslashreplace').decode(),flush=True)

if __name__=='__main__':main()
