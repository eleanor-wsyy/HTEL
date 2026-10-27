"""Reflow the living/age chart and translate the first-week display copy."""
from collections import Counter
import json
import statistics
from PIL import Image, ImageDraw, ImageFont

def refine(root):
    paper = '#f7f6ef'
    ink, muted = '#26312e', '#79807d'
    def font(size, bold=False):
        return ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc' if bold else 'C:/Windows/Fonts/msyh.ttc', size)
    people = json.loads((root / 'data/study.json').read_text(encoding='utf-8'))['people']
    # Use the original chart's exact point colors, sampled by pixel frequency.
    original = Image.open(root / 'assets/figma/age-living.png').convert('RGB')
    colors = Counter(original.getdata())
    candidates = [rgb for rgb, n in colors.most_common() if max(rgb)-min(rgb)>45 and n>100]
    palette = [next(c for c in candidates if c[0]>c[1]>c[2] and c[1]<160),
               next(c for c in candidates if c[0]>c[1]>c[2] and c[1]>=160),
               next(c for c in candidates if c[1]>c[0] and c[2]>c[0])]
    groups = [('独居','独居',104,39),('与朋友／室友同住','与朋友或室友同住',65,27),('与家人／伴侣同住','与家人或伴侣同住',333,38)]
    im = Image.new('RGB',(1140,1024),paper); d=ImageDraw.Draw(im)
    d.text((60,48),'不同居住方式的年龄分布',font=font(42,True),fill=ink)
    d.text((60,130),'每个点代表一人，深色竖线为年龄中位数。',font=font(20),fill=muted)
    x=lambda age:310+(age-18)*12
    for row,(key,label,n,median) in enumerate(groups):
        ages=[p['profile']['age'] for p in people if p['profile']['living']==key and isinstance(p['profile']['age'],(int,float))]
        assert len(ages)==n and statistics.median(ages)==median
        y=304+row*215
        # Line breaks keep the label column separate from the plotted ages.
        lines={'独居':['独居'],'与朋友或室友同住':['与朋友或室友','同住'],'与家人或伴侣同住':['与家人或伴侣','同住']}[label]
        for j,line in enumerate(lines): d.text((60,y-48+j*30),line,font=font(25),fill=ink)
        d.text((60,y+18),f'{n} 人 · 中位数 {median} 岁',font=font(19),fill=muted)
        d.line((310,y,1078,y),fill='#d8dcd2',width=1)
        for age,count in sorted(Counter(ages).items()):
            for j in range(count):
                yy=y+(j-(count-1)/2)*7
                d.ellipse((x(age)-3,yy-3,x(age)+3,yy+3),fill=palette[row])
        d.line((x(median),y-37,x(median),y+37),fill=ink,width=4)
    for age in range(20,81,10): d.text((x(age),912),str(age),font=font(21),fill=muted,anchor='mt')
    d.text((690,952),'年龄 / 岁',font=font(20),fill=muted,anchor='mt')
    d.text((60,993),'502 人具备年龄与居住资料；其余 13 人未绘点。缺失不补值。',font=font(14),fill=muted)
    im.save(root/'assets/figma/age-living-paper.png',optimize=True)

    im=Image.open(root/'assets/figma/first-week-paper.png').convert('RGB'); before=im.crop((230,190,1223,721)).tobytes();d=ImageDraw.Draw(im)
    d.rectangle((110,55,1300,110),fill=paper)
    d.text((121,62),'按后续填写时长分组：首周孤独感均值',font=font(26,True),fill='#62758e')
    d.rectangle((230,725,1223,794),fill=paper)
    for xx,n in zip([345,538,732,926,1119],[29,53,128,148,157]):d.text((xx,732),f'{n} 人',font=font(19),fill='#62758e',anchor='mt')
    d.text((1180,773),'累计填写晚数',font=font(18),fill='#62758e',anchor='rt')
    d.rectangle((110,825,1320,966),fill=paper)
    for yy,line in zip([840,882,924],['计算每人最初七次孤独评分的平均值。后续填写晚数越少，','首周孤独感越高。记录流失并非随机：继续留在研究中的人，','孤独感相对较低。']):d.text((121,yy),line,font=font(21),fill='#40516b')
    assert im.crop((230,190,1223,721)).tobytes()==before, 'Numeric chart and error bars must stay exact'
    im.save(root/'assets/figma/first-week-paper.png',optimize=True)

if __name__=='__main__':
    from pathlib import Path
    refine(Path(__file__).resolve().parents[1])
