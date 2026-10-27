"""Build a single offline HTML from the working atlas. No third-party Python packages."""
from pathlib import Path
import argparse,base64,hashlib,json,re,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
SVG='http://www.w3.org/2000/svg';ET.register_namespace('',SVG)

def sprite(name):
 root=ET.parse(ROOT/'assets'/name).getroot();renamed={}
 for node in root.iter():
  ident=node.get('id')
  if ident and node.tag!='{'+SVG+'}symbol':
   renamed[ident]='embedded-'+name.split('.')[0]+'-'+ident;node.set('id',renamed[ident])
 for node in root.iter():
  for key,value in list(node.attrib.items()):
   for old,new in renamed.items():
    value=value.replace('url(#'+old+')','url(#'+new+')')
    if value=='#'+old:value='#'+new
   node.set(key,value)
 root.set('id','embedded-'+name.split('.')[0]);root.set('width','0');root.set('height','0');root.set('aria-hidden','true');root.set('style','position:absolute;width:0;height:0;overflow:hidden;pointer-events:none')
 return ET.tostring(root,encoding='unicode')

def build(output):
 names=['index.html','styles.css','data/study.json','data-utils.js','sorting.js','charts.js','hero-motion.js','view-utils.js','coverage.js','coverage-view.js','research-stats.js','figma-model-data.js','figma-gallery.js','research-boards.js','app.js']+[f'assets/{name}'for name in ['tiles.svg','radials.svg','poster-1.svg','poster-2.svg','poster-3.svg','poster-4.svg']]+sorted(str(p.relative_to(ROOT)).replace('\\','/')for p in (ROOT/'assets/figma').glob('*.png'))
 digest=hashlib.sha256()
 for name in names:digest.update((name+'\0').encode());digest.update((ROOT/name).read_bytes())
 html=(ROOT/'index.html').read_text(encoding='utf-8-sig');css=(ROOT/'styles.css').read_text(encoding='utf-8-sig')
 html=re.sub(r'<link\s+rel="stylesheet"\s+href="styles.css"\s*>','<style>'+css+'</style>',html)
 html=re.sub(r'<script\s+src="app.js"\s+type="module"\s*></script>','',html)
 posters={str(i):'data:image/svg+xml;base64,'+base64.b64encode((ROOT/f'assets/poster-{i}.svg').read_bytes()).decode('ascii')for i in range(1,5)}
 html=re.sub(r'src="assets/poster-([1-4])\.svg"',lambda m:'data-poster-image="'+m[1]+'"',html)
 parts=[]
 for name in ['data-utils.js','sorting.js','charts.js','hero-motion.js','view-utils.js','coverage.js','coverage-view.js','research-stats.js','figma-model-data.js','figma-gallery.js','research-boards.js','app.js']:
  code=(ROOT/name).read_text(encoding='utf-8-sig')
  code=re.sub(r'^import\s+.*?;\s*$', '',code,flags=re.M)
  code=re.sub(r'^export\s+', '',code,flags=re.M)
  if name=='data-utils.js':code+='\nconst esc=escapeHTML;\n'
  parts.append(code)
 code='\n'.join(parts)
 code=code.replace('assets/tiles.svg#','#').replace('assets/radials.svg#','#')
 code=code.replace("`assets/poster-${n}.svg`",'POSTERS[String(n)]')
 code=re.sub(r"const embedded=document\.querySelector\('#study-data'\);if\(embedded\)data=JSON\.parse\(embedded\.textContent\);else\{.*?data=await response\.json\(\);\}","data=JSON.parse(document.querySelector('#study-data').textContent);",code,flags=re.S)
 assert 'fetch(' not in code and 'import.meta' not in code,'Unexpected external data dependency in bundle'
 assert not re.search(r'^import\s',code,re.M)
 code=code.replace('请通过本地预览服务器或 GitHub Pages 打开网页，不要直接双击 HTML。','请确认 HTML 已完整保存，再重新打开。')
 code=code.replace('在项目目录运行 <code>npm start</code>，然后访问 <code>http://127.0.0.1:4173</code>。','这个单文件版本已内置数据，不需要服务器。')
 code=code.replace('</script','<\\/script')
 data=json.loads((ROOT/'data/study.json').read_text(encoding='utf-8'))
 payload=json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
 figma_assets={p.stem:'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode('ascii')for p in sorted((ROOT/'assets/figma').glob('*.png'))}
 embedded=sprite('tiles.svg')+sprite('radials.svg')+'<script id="study-data" type="application/json">'+payload+'</script>'+'<script id="figma-assets-data" type="application/json">'+json.dumps(figma_assets,separators=(',',':'))+'</script>'
 script='<script id="standalone-app">\n(()=>{\n\"use strict\";\nconst POSTERS='+json.dumps(posters,separators=(',',':'))+';\ndocument.querySelectorAll("[data-poster-image]").forEach(img=>img.src=POSTERS[img.dataset.posterImage]);\n'+code+'\n})();\n</script>'
 html=html.replace('</head>','<meta name="atlas-source-sha256" content="'+digest.hexdigest()+'"></head>')
 html=html.replace('</body>',embedded+script+'</body>')
 assert not re.search(r'<(?:script[^>]+src|link[^>]+href="styles.css")',html)
 assert not re.search(r'(?:src|href)="assets/',html)
 output.parent.mkdir(parents=True,exist_ok=True);output.write_text(html,encoding='utf-8')
 return {'file':str(output.resolve()),'bytes':output.stat().st_size,'participants':len(data['people']),'featured':sum(p['featured']for p in data['people']),'externalAssets':0,'posters':4}
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=ROOT/'dist/loneliness-atlas.html');args=parser.parse_args();print(json.dumps(build(args.output),ensure_ascii=False,indent=2))
