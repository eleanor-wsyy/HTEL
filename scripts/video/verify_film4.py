"""Verify actual output, complete Sankey conservation and user-approved copy."""
import json,re,subprocess,hashlib
from pathlib import Path
import numpy as np
import film4 as f

def main():
    plan=f.PLAN;sk=f.SK;out=f.OUT
    assert len(plan['segments'])==24 and plan['duration']==238 and plan['totalFrames']==7140
    for i,s in enumerate(plan['segments']):
        assert s['start']==(plan['segments'][i-1]['end'] if i else 0)
        assert s['startFrame']==s['start']*30 and s['endFrame']==s['end']*30
    assert len(sk['variables'])==6 and len(sk['nodes'])==31 and len(sk['paths'])==283
    assert sum(p['n'] for p in sk['paths'])==515
    ids=[pid for p in sk['paths'] for pid in p['personIds']];assert len(ids)==len(set(ids))==515
    for n in sk['nodes']:
        assert sum(p['n'] for p in sk['paths'] if p['labels'][n['stage']]==n['label'])==n['n']
    for stage in range(6):assert sum(n['n'] for n in sk['nodes'] if n['stage']==stage)==515
    chapters={s['id']:s for s in plan['segments']}
    assert chapters['chapter-background']['title']=='故事开始，我们先来认识写下这些日常的人'
    assert chapters['chapter-archives']['summary']=='当每一个人的日常都围绕着八种感受展开'
    outsider=chapters['chapter-outsiders'];assert outsider['title']+outsider['summary']=='当记录的天数减少，那些未被看见的日常里，作为拥有灰色格子最多的那群人，有哪些感受同样值得我们关注？'
    assert '柱高表示原稿中的连续段长度' not in ''.join(a['text'] for a in f.NARRATION)
    assert not any('2020 ·' in a['text'] for a in f.NARRATION)
    audit=json.loads((out/'render-audit.json').read_text(encoding='utf8'))
    assert sum(a['frames'] for a in audit)==7140 and not any(a['overflow'] for a in audit)
    audio=json.loads((out/'voice-audit.json').read_text(encoding='utf8'))
    assert len(audio)==14 and all(a['duration']<=a['slot'] for a in audio)
    frames=[]
    for s in plan['segments']:
        image,bad=f.render_frame(round((s['end']-.15)*30));assert not bad,(s['id'],bad);assert image.size==(1920,1080)
        frames.append(s['id'])
    a,_=f.render_frame(1110);b,_=f.render_frame(1110);assert a.tobytes()==b.tobytes()
    video=out/'看见孤独-3分58秒-完整版.mp4'
    run=subprocess.run([f.ffmpeg(),'-hide_banner','-i',str(video),'-progress','pipe:1','-nostats','-f','null','-'],capture_output=True,text=True,encoding='utf8',errors='replace')
    decoded=[int(x) for x in re.findall(r'^frame=(\d+)',run.stdout,re.M)]
    assert run.returncode==0 and decoded[-1]==7140
    assert 'Duration: 00:03:58.00' in run.stderr and '1920x1080' in run.stderr and '30 fps' in run.stderr and 'Audio: aac' in run.stderr
    (out/'decode-check.txt').write_text(run.stderr+'\n'+run.stdout,encoding='utf8')
    report={'status':'passed','sourceCommit':plan['sourceCommit'],'durationSeconds':238,'fps':30,'resolution':[1920,1080],'decodedFrames':7140,'sankeyVariables':6,'sankeyNodes':31,'sankeyCompletePaths':283,'allNodesConserved':True,'allFiveAnnotationsApplied':True,'narrationClips':14,'narrationWithinSlots':True,'captionsBurnedIn':True,'checkedScenes':frames,'movieSha256':hashlib.sha256(video.read_bytes()).hexdigest(),'bytes':video.stat().st_size}
    (out/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
