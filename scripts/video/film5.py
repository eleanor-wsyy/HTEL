"""Music-only revision. Authoritative screenplay is saved before this renderer.
python scripts/video/film5.py --stills
python scripts/video/film5.py --render --workers 8
No narration, speech synthesis, narration audio or subtitle layer is used.
"""
from __future__ import annotations
import os
os.environ['LONELINESS_DISABLE_NARRATION']='1'
import argparse,hashlib,json,math,subprocess,time,wave
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor,as_completed
import numpy as np
from PIL import Image,ImageDraw
import film4 as old

f=old.f
HERE=Path(__file__).resolve().parent
OUT=HERE/'film5_output'
SCRIPT=f.REPO/'docs/video/storyboard-v5-music.md'
W,H,FPS,TOTAL=1920,1080,30,214
PAPER,INK,MUTED,LINE=old.PAPER,old.INK,old.MUTED,old.LINE
MUSIC_NAME='InThisMoment-ScottBuckley.mp3'
MUSIC_URL='https://www.scottbuckley.com.au/library/wp-content/uploads/2026/08/InThisMoment.mp3'
CREDIT="'In This Moment' by Scott Buckley — released under CC-BY 4.0. www.scottbuckley.com.au"
END_TEXT='看见互动，看见日常，看见个体，看见孤独'
TIMES=[('intro',0,11),('chapter-background',11,15),('sankey',15,38),('chapter-overview',38,41),('mosaic',41,54),('models',54,75),('variation',75,88),('chapter-archives',88,91),('radial',91,109),('chapter-compare',109,112),('compare-overview',112,118),('compare-daily',118,130),('compare-score',130,140),('chapter-participation',140,143),('daily-participation',143,148),('longest-streak',148,152),('weekly-trend',152,157),('attrition',157,164),('first-week',164,170),('chapter-outsiders',170,179),('coverage',179,186),('coverage-profiles',186,194),('coverage-gallery',194,199),('close',199,204),('ending',204,214)]
OLD_SEGS={s['id']:s for s in old.PLAN['segments']}
PAGE_NAMES={'home':'看见孤独','background':'01 / 背景画像','overview':'02 / 人群总览','archives':'03 / 人物档案','compare':'04 / 日常对照','participation':'05 / 填写与缺失','outsiders':'06 / 局外人'}
SEGMENTS=[]
for name,start,end in TIMES:
    if name=='ending':s={'id':name,'kind':'ending','title':END_TEXT,'summary':'','page':'home'}
    else:s={**OLD_SEGS[name]}
    s.update(start=start,end=end,startFrame=start*30,endFrame=end*30)
    if isinstance(s.get('transition'),dict):s['transition']={**s['transition'],'duration':1.6 if end-start<9 else 2.2}
    if name=='coverage-gallery':s['transition']['duration']=1.0
    SEGMENTS.append(s)
ACTIVE_PAGE='home'

def header(c,title,sub=''):
    c.text(112,38,PAGE_NAMES[ACTIVE_PAGE],19,MUTED)
    old.para(c,title,109,83,48 if len(title)<28 else 44,1700,INK,1.25)
    if sub:old.para(c,sub,114,170,25,1680,MUTED)

def footer(c,text):
    # Data notes stay separate from any former voice captions.
    old.para(c,text,115,949,22,1680,MUTED)

old.header=header;old.footer=footer

def transition(c,s,t,duration=None):
    duration=duration or s['end']-s['start'];title,summary=s['title'],s['summary']
    large=60 if len(title)<22 else 49
    first=duration*.35;second=duration*.34
    title_p=min(1,max(0,t)/max(.35,first));summary_p=min(1,max(0,t-first)/max(.35,second))
    if s['id']=='chapter-outsiders':large=60
    nrows=len(old.lines(title,large,1510));y=385-(nrows-1)*large*.6
    old.para(c,title[:int(len(title)*title_p)],960,y,large,1510,INK,1.45,True)
    old.para(c,summary[:int(len(summary)*summary_p)],960,y+nrows*large*1.45+38,33,1420,MUTED,1.6,True)

def scene_sankey(c,t):
    full=old.sankey_image(round(f.lin(t,1.0,7)*30));c.im=full.copy();c.d=ImageDraw.Draw(c.im)
    if 10<t<20:
        z=1+.48*f.u(t,10,11)*(1-f.u(t,19,20))
        cx=600+720*f.u(t,12,18);cy=590+30*f.u(t,15,18)
        cw,ch=1700/z,660/z
        viewport=full.transform((1700,660),Image.Transform.EXTENT,(cx-cw/2,cy-ch/2,cx+cw/2,cy+ch/2),Image.Resampling.BICUBIC,fillcolor=PAPER)
        c.rect((100,240,1820,940),PAPER);c.paste(viewport,110,262)
        thumb=full.crop((100,248,1880,930)).resize((445,170),Image.Resampling.LANCZOS)
        c.rect((1330,751,1805,935),PAPER);c.paste(thumb,1345,758)
    if t>=20:
        flow,ys,h=next(item for item in old.SKPATHS if 1478 in item[0]['personIds'])
        for j in range(5):c.line(f.bezier((110+316*j+180,ys[j]+h/2),(110+316*(j+1),ys[j+1]+h/2)),flow['color'],4)
    header(c,'故事开始，我们先来认识写下这些日常的人','疫情期间，用日记记录社交与孤独。六个维度，连接同一批515人。')
    footer(c,'515人 · 六个变量 · 31个节点 · 全部283条组合路径　｜　流带宽度＝人数；颜色＝居住状况')

def scene_close(c,t):
    fstage=f.u(t,0,.7)
    c.text(960,190,'看见孤独',91,kind='serif',anchor='ma',a=fstage)
    v=f.VALID/(515*75);c.rect((160,520,1760,580),f.GREY);c.rect((160,520,160+1600*v,580),f.TEAL)
    c.text(160,411,'27,785',70,f.TEAL,kind='num');c.text(1760,411,'10,840',70,MUTED,kind='num',anchor='ra')
    c.text(160,615,'有效双题格',29);c.text(1760,615,'不可计算格',29,MUTED,anchor='ra')
    c.text(960,780,'515个人 · 每人最多75个入组日次',34,INK,anchor='ma')
    c.text(960,916,'Music: In This Moment — Scott Buckley · CC BY 4.0',23,MUTED,anchor='ma')
    c.text(960,954,'www.scottbuckley.com.au',21,MUTED,anchor='ma')
    if t>4.2:c.im=Image.blend(c.im,Image.new('RGB',(W,H),PAPER),f.u(t,4.2,5))

def ending(c,t):
    phrases=['看见互动，','看见日常，','看见个体，','看见孤独']
    starts=[0,1.3,2.6,3.9]
    for i,(phrase,start) in enumerate(zip(phrases,starts)):
        n=int(len(phrase)*f.lin(t,start,start+1.1))
        if n:c.text(960,282+i*116,phrase[:n],69,INK,kind='serif',anchor='ma')
    if t>=7:c.im=Image.blend(c.im,Image.new('RGB',(W,H),PAPER),f.u(t,7,9.5))

# End states of existing data scenes remain unchanged; only camera timing is retimed.
CONTENT_LENGTH={'intro':14,'mosaic':15,'models':21,'variation':11,'radial':22,'compare-overview':6,'compare-daily':10,'compare-score':7,'daily-participation':6,'longest-streak':3,'weekly-trend':3,'attrition':6,'first-week':5,'coverage':8,'coverage-profiles':7,'coverage-gallery':2}

def render_frame(index):
    global ACTIVE_PAGE
    sec=index/FPS;s=next(s for s in SEGMENTS if s['start']<=sec<s['end']);t=sec-s['start'];ACTIVE_PAGE=s['page'];c=f.Canvas()
    if s['kind']=='chapter-transition':transition(c,s,t)
    elif s['id']=='ending':ending(c,t)
    elif s['id']=='close':scene_close(c,t)
    else:
        lead=s['transition']['duration'] if isinstance(s.get('transition'),dict) else 0
        if t<lead:transition(c,s,t,lead)
        else:
            name=s['id'];duration=s['end']-s['start']-lead;local=(t-lead)*CONTENT_LENGTH.get(name,duration)/duration
            if name=='sankey':scene_sankey(c,t)
            else:old.SCENES[name](c,local)
            if name in ['variation','daily-participation','longest-streak','attrition','first-week']:header(c,s['title'],s['summary'])
        # Subtle paper ease at a chart's entrance, with no flash or decorative cursor.
        if lead and lead<=t<lead+.16:c.im=Image.blend(Image.new('RGB',(W,H),PAPER),c.im,f.u(t,lead,lead+.16))
    # Do not call film4.render_frame, subtitle compositing, or its progress overlay.
    return c.image(),c.overflow

def encode(task):
    begin,end,path=task;started=time.time();bad=[]
    cmd=[old.ffmpeg(),'-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1920x1080','-r','30','-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-threads','2',str(path)]
    with open(str(path)+'.log','wb') as log:
        p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log,stdout=subprocess.DEVNULL)
        try:
            for i in range(begin,end):
                im,overflow=render_frame(i)
                if overflow:bad.extend((i,x) for x in overflow)
                p.stdin.write(im.tobytes())
            p.stdin.close()
            if p.wait():raise RuntimeError('Encoder failed: '+str(path))
        finally:
            if p.poll() is None:p.kill();p.wait()
    return {'path':str(path),'frames':end-begin,'seconds':round(time.time()-started,2),'overflow':bad[:20]}

def prepare(out):
    assert SCRIPT.is_file(),'Save screenplay before producing video'
    for i,s in enumerate(SEGMENTS):assert s['start']==(SEGMENTS[i-1]['end'] if i else 0)
    assert SEGMENTS[-1]['end']==214
    plan={'version':5,'sourceCommit':old.PLAN['sourceCommit'],'script':str(SCRIPT.relative_to(f.REPO)),'scriptSha256':hashlib.sha256(SCRIPT.read_bytes()).hexdigest(),'reference':'fe36bbdf2560771256634cfc164178eb.mp4','duration':214,'fps':30,'totalFrames':6420,'resolution':[1920,1080],'audio':{'mode':'background-music-only','narration':False,'speechCaptions':False,'soundEffects':False,'track':'In This Moment','artist':'Scott Buckley','source':MUSIC_URL,'license':'CC BY 4.0','credit':CREDIT,'preservePitch':True,'tempo':0.93,'fadeIn':1.8,'fadeOutStart':210,'fadeOut':4},'ending':{'text':END_TEXT,'start':204,'hold':[209,211],'fade':[211,213.5],'blankUntil':214},'segments':SEGMENTS}
    (out/'film5-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf8')
    (out/'音乐署名.txt').write_text(CREDIT+'\nOfficial track: https://www.scottbuckley.com.au/library/in-this-moment/\nLicense: https://creativecommons.org/licenses/by/4.0/\nChanges: 0.93x tempo with original pitch preserved, excerpt, loudness normalization, opening and closing fades. No speech or other audio mixed.\n',encoding='utf8')
    return plan

def make_music(out):
    music=out/MUSIC_NAME
    assert music.is_file() and music.stat().st_size==7984316,'Complete the official music download before mastering'
    dest=out/'music-master.wav'
    subprocess.run([old.ffmpeg(),'-v','error','-y','-i',str(music),'-t','214','-vn','-af','atempo=0.93,loudnorm=I=-19:TP=-1.5:LRA=9,apad=whole_dur=214,afade=t=in:st=0:d=1.8,afade=t=out:st=210:d=4','-ar','48000','-ac','2','-c:a','pcm_s16le',str(dest)],check=True)
    # Some FFmpeg builds retain a small filter-delay offset. Align the already
    # faded music tail to the exact picture duration without looping the track.
    with wave.open(str(dest),'rb') as w:
        channels,rate,frames=w.getnchannels(),w.getframerate(),w.getnframes();payload=w.readframes(frames)
    target=TOTAL*rate;assert channels==2 and rate==48000 and abs(target-frames)<rate*.25
    payload=payload[:target*channels*2]+b'\x00'*max(0,(target-frames)*channels*2)
    with wave.open(str(dest),'wb') as w:
        w.setnchannels(channels);w.setsampwidth(2);w.setframerate(rate);w.writeframes(payload)
    (out/'music-source.json').write_text(json.dumps({'source':MUSIC_URL,'sha256':hashlib.sha256(music.read_bytes()).hexdigest(),'credit':CREDIT,'master':dest.name,'narration':False,'referenceAudioUsed':False},ensure_ascii=False,indent=2),encoding='utf8')
    return dest

def mux(out):
    music=make_music(out);picture=out/'picture-only.mp4';dest=out/'看见孤独-纯音乐版-3分34秒-v5.mp4'
    subprocess.run([old.ffmpeg(),'-v','error','-y','-i',str(picture),'-i',str(music),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t','214','-movflags','+faststart',str(dest)],check=True)
    print('COMPLETE',dest,flush=True)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--stills',action='store_true');ap.add_argument('--render',action='store_true');ap.add_argument('--workers',type=int,default=8);ap.add_argument('--picture-only',action='store_true');ap.add_argument('--mux',action='store_true');args=ap.parse_args();OUT.mkdir(exist_ok=True);prepare(OUT)
    if args.stills:
        audit=[]
        for s in SEGMENTS:
            index=int((s['end']-.15)*FPS)
            if s['id']=='ending':index=210*30
            im,bad=render_frame(index);im.save(OUT/(s['id']+'.png'));audit.append({'scene':s['id'],'overflow':bad});print('STILL',s['id'],bad,flush=True)
        (OUT/'stills-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf8')
    if args.render:
        parts=OUT/'parts';parts.mkdir(exist_ok=True);tasks=[]
        for s in SEGMENTS:
            for start in range(s['startFrame'],s['endFrame'],180):tasks.append((start,min(start+180,s['endFrame']),parts/f'{start:05d}.mp4'))
        results=[]
        with ProcessPoolExecutor(max_workers=args.workers) as pool:
            for result in as_completed([pool.submit(encode,t) for t in tasks]):
                r=result.result();results.append(r);print('PART',len(results),'/',len(tasks),'sec',r['seconds'],'overflow',len(r['overflow']),flush=True)
        (OUT/'render-audit.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
        assert sum(r['frames'] for r in results)==6420 and not any(r['overflow'] for r in results)
        listing=OUT/'concat.txt';listing.write_text(''.join("file '"+str(t[2]).replace('\\','/')+"'\n" for t in tasks),encoding='utf8')
        picture=OUT/'picture-only.mp4';subprocess.run([old.ffmpeg(),'-v','error','-y','-f','concat','-safe','0','-i',str(listing),'-c','copy','-an',str(picture)],check=True)
        if not args.picture_only:mux(OUT)
        else:print('PICTURE_COMPLETE',picture,flush=True)
    if args.mux:mux(OUT)

if __name__=='__main__':main()
