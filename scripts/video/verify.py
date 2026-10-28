"""Validate repository-local movie inputs and renderer; does not encode a movie."""
from pathlib import Path
import hashlib,itertools,json
import numpy as np
import film3 as f

def main():
    base=Path(__file__).resolve().parent
    manifest=json.loads((base/'data/provenance.json').read_text(encoding='utf8'))
    for name,expected in manifest['inputs'].items():
        payload=(f.REPO/name).read_bytes()
        if Path(name).suffix in ['.json','.js']:payload=payload.replace(b'\r\n',b'\n')
        assert hashlib.sha256(payload).hexdigest()==expected, 'Input changed: '+name
    people=f.PEOPLE
    expected=np.array([[np.nan if v is None else v for v in p['heat']] for p in people])
    np.testing.assert_allclose(f.HEAT,expected,atol=1e-5,equal_nan=True)
    assert len(people)==515 and len(set(f.DISP))==515
    assert f.COVER_COLORS.transpose(1,0,2).shape==(75,515,3)
    assert f.VALID==27785 and f.MISSING==10840
    assert f.NLOW==49 and round(f.LOWMISS*100,1)==31.3
    assert sum(f.SCOUNTS.values())==515
    for j in range(3):assert sum(n[2] for n in f.NODES if n[0]==j)==515
    for j,val,count,*_ in f.NODES:
        assert sum(n for keys,n,ys in f.FLOWS if keys[j]==val)==count
    for pid in [478,498]:assert abs(np.nanmean(f.LON[pid])-3.44)<1e-12
    for m in range(8):
        vals=[np.nan if row[m] is None else row[m] for row in f.P[478]['daily']]
        assert abs(np.nanmean(vals)-f.P[478]['stats'][m]['mean'])<1e-5
    for m in [0,1]:assert not np.allclose([r[m] for r in f.P[478]['daily']],f.HEAT[f.INDEX[478]])
    runs=bars=0
    for model in f.MODELS:
        assert len(model['rows'])==model['count']
        total=0
        for row in model['rows']:
            assert len(row)==75
            vals=np.array([ord(ch)-48 for ch in row]);assert np.all((vals>=0)&(vals<=75))
            total+=int((vals>0).sum());offset=0
            for present,items in itertools.groupby(vals>0):
                n=len(list(items))
                if present:runs+=1;assert np.all(vals[offset:offset+n]==n)
                offset+=n
        assert total==model['barCount'];bars+=total
    assert bars==28019
    for yaw,pitch in [(.2,-.5),(-.3,.4),(0,-1.0135)]:
        pts=np.array([[0.,0,0],[35,20,80]]);rot=f.rotate(pts,yaw,pitch,230)
        assert abs(np.linalg.norm(rot[1]-rot[0])-np.linalg.norm(pts[1]-pts[0]))<1e-9
    assert len(f.SCATTER_ORDER)==515 and int((f.MEAN>7.2).sum())==3
    assert f.SCENES[0][0]==0 and f.SCENES[-1][1]==180
    for a,b in zip(f.SCENES,f.SCENES[1:]):assert a[1]==b[0]
    assert sum(end-start for start,end,_ in f.SCENES)*f.FPS==5400
    for t in [27,87,123,146,169,178]:
        image,bad=f.render_frame(t*30);assert not bad,(t,bad);assert image.size==(1920,1080)
    im1,_=f.render_frame(123*30);im2,_=f.render_frame(123*30)
    assert im1.tobytes()==im2.tobytes()
    report={'status':'passed','participants':515,'windowDays':75,'validCompositeCells':27785,'missingCompositeCells':10840,'original3DBars':bars,'verifiedConsecutiveRuns':runs,'timelineSeconds':180,'plannedFrames':5400,'renderIsDeterministic':True,'sampledFrames':[27,87,123,146,169,178]}
    target=base/'film3_output';target.mkdir(exist_ok=True)
    (target/'verification.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    print('PASS: 515 people, 38625 cells, 28019 original bars, 3907 runs, six sampled frames and deterministic camera.')

if __name__=='__main__':main()
