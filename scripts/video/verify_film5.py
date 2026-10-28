"""Audit actual music-only output, audio provenance and the closing typewriter."""
import hashlib,json,re,subprocess,wave
from pathlib import Path
import numpy as np
import film5 as v

def main():
    out=v.OUT;plan=json.loads((out/'film5-plan.json').read_text(encoding='utf8'))
    assert plan['duration']==214 and plan['totalFrames']==6420
    assert plan['scriptSha256']==hashlib.sha256(v.SCRIPT.read_bytes()).hexdigest()
    audit=json.loads((out/'render-audit.json').read_text(encoding='utf8'))
    assert sum(s['frames'] for s in audit)==6420 and not any(s['overflow'] for s in audit)
    assert v.SCRIPT.stat().st_mtime<min(Path(s['path']).stat().st_mtime for s in audit),'Screenplay must precede rendering'
    assert plan['audio']['mode']=='background-music-only' and plan['audio']['narration'] is False
    assert plan['ending']['text']=='看见互动，看见日常，看见个体，看见孤独'
    assert v.old.SUBTITLES==[]
    sk=v.old.SK
    assert len(sk['variables'])==6 and len(sk['nodes'])==31 and len(sk['paths'])==283
    for node in sk['nodes']:
        assert sum(p['n'] for p in sk['paths'] if p['labels'][node['stage']]==node['label'])==node['n']
    times=[(s['end']-.15 if s['id']!='ending' else 210) for s in v.SEGMENTS]
    for t in times:
        im,bad=v.render_frame(round(t*30));assert not bad,(t,bad);assert im.size==(1920,1080)
    paper=np.array(v.f.rgb(v.PAPER))
    im,_=v.render_frame(6419);assert np.max(abs(np.array(im).astype(int)-paper))==0,'Final frame must fade to paper'
    full,_=v.render_frame(210*30);faded,_=v.render_frame(round(212.5*30))
    ink=lambda im:float(abs(np.array(im,dtype=float)-paper).sum())
    assert ink(full)>ink(faded)>ink(im)
    movie=out/'看见孤独-纯音乐版-3分34秒-v5.mp4'
    decoded=subprocess.run([v.old.ffmpeg(),'-hide_banner','-i',str(movie),'-progress','pipe:1','-nostats','-f','null','-'],capture_output=True,text=True,encoding='utf8',errors='replace')
    frames=[int(x) for x in re.findall(r'^frame=(\d+)',decoded.stdout,re.M)]
    assert decoded.returncode==0 and frames[-1]==6420
    assert 'Duration: 00:03:34.00' in decoded.stderr and '1920x1080' in decoded.stderr and '30 fps' in decoded.stderr
    (out/'decode-check.txt').write_text(decoded.stderr+'\n'+decoded.stdout,encoding='utf8')
    # AAC decoded output must match the music-only master, proving no voice mix.
    raw=subprocess.run([v.old.ffmpeg(),'-v','error','-i',str(movie),'-map','0:a:0','-f','s16le','-ac','2','-ar','48000','pipe:1'],capture_output=True,check=True).stdout
    audio=np.frombuffer(raw,dtype='<i2').reshape(-1,2)
    with wave.open(str(out/'music-master.wav'),'rb') as w:
        assert w.getnchannels()==2 and w.getframerate()==48000 and w.getnframes()==214*48000
        master=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').reshape(-1,2)
    n=min(len(master),len(audio));a=master[:n:8].astype(float).ravel();b=audio[:n:8].astype(float).ravel()
    correlation=float(np.corrcoef(a,b)[0,1]);assert correlation>.98,correlation
    tail=audio[-24000:].astype(float);end_rms=float(np.sqrt(np.mean(tail**2)))
    mid_rms=float(np.sqrt(np.mean(audio[100*48000:101*48000].astype(float)**2)))
    assert end_rms<mid_rms*.15
    provenance=json.loads((out/'music-source.json').read_text(encoding='utf8'))
    assert provenance['narration'] is False and provenance['referenceAudioUsed'] is False
    report={'status':'passed','durationSeconds':214,'decodedFrames':6420,'resolution':[1920,1080],'fps':30,'scriptSavedBeforeVideo':True,'narration':False,'speechCaptions':False,'audioSource':'In This Moment / Scott Buckley','license':'CC BY 4.0','musicOnlyMasterCorrelation':correlation,'endingText':v.END_TEXT,'endingFadesToBlank':True,'musicFadesOut':True,'sankeyVariables':6,'sankeyNodes':31,'sankeyPaths':283,'allNodesConserved':True,'sourceCommit':v.old.PLAN['sourceCommit'],'movieSha256':hashlib.sha256(movie.read_bytes()).hexdigest(),'bytes':movie.stat().st_size}
    (out/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
