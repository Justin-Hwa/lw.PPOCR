"""Three selectable engines, real V5 Thai inference, lazy load and offline PDF highlights."""
import argparse
import tempfile
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
from test_thai_html import FIXTURES, QUERIES, run_case


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--html',type=Path,required=True)
    parser.add_argument('--browser-executable',type=Path)
    args=parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='lw-v5-thai-') as temp,sync_playwright() as p:
        scanned=Path(temp)/'thai-scanned.pdf'
        with Image.open(FIXTURES/'scan.png') as im:
            rgb=im.convert('RGB');rgb.save(scanned,'PDF',resolution=180,save_all=True,append_images=[rgb])
        options={'headless':True}
        if args.browser_executable:options['executable_path']=str(args.browser_executable.resolve())
        browser=p.chromium.launch(**options)
        context=browser.new_context(offline=True,viewport={'width':1280,'height':900})
        requests=[];errors=[]
        context.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
        page=context.new_page()
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        page.goto(args.html.resolve().as_uri(),timeout=180000)
        page.evaluate('lwPpocrDemo.ready()')
        assert page.locator('#ocr-language option').evaluate_all('(xs)=>xs.map(x=>x.value)')==['ppocr','ppocrv5-thai','tha+eng']
        page.evaluate('''()=>{const original=LwPpocrV5Thai;window.__creates=0;
            window.LwPpocrV5Thai={...original,create:async()=>{__creates++;return original.create();}};}''')
        page.locator('#ocr-language').select_option('ppocrv5-thai')
        page.locator('#search-queries').fill('\n'.join(QUERIES))
        run_case(page,FIXTURES/'text.pdf',1,'text-layer',model='ppocrv5-thai')
        assert page.evaluate('__creates')==0
        page.locator('#file').set_input_files(str(scanned))
        page.wait_for_function("!document.getElementById('run').disabled")
        page.locator('#zoom-in').click()
        page.evaluate('__lwOcrTest.openPreview()');page.keyboard.press('Escape')
        assert page.evaluate('__creates')==0
        result=run_case(page,scanned,2,'ocr',model='ppocrv5-thai')
        assert page.evaluate('__creates')==1
        assert all(line['ocr_engine']=='ppocrv5-thai' for p in result['pages'] for line in p['lines'])
        for model in ['tha+eng','ppocr','ppocrv5-thai']:
            page.locator('#ocr-language').select_option(model)
            page.wait_for_function("!document.getElementById('run').disabled")
        assert page.evaluate('__creates')==1
        assert not requests,requests
        assert not errors,errors
        browser.close()
        print('PP-OCRv5 Thai offline PDF/model selection test passed')

if __name__=='__main__':main()
