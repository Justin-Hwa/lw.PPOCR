"""Offline quarter-turn preview/OCR test using synthetic fixtures only."""
import argparse
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright


def text_pdf(path):
    objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Count 4 /Kids [3 0 R 4 0 R 5 0 R 6 0 R] >>']
    for angle in [0,90,180,270]:
        objects.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 250] /Rotate {angle} /Resources << /Font << /F1 7 0 R >> >> /Contents 8 0 R >>'.encode())
    objects.append(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    stream=b'BT /F1 20 Tf 40 160 Td (Orientation text 12345) Tj ET'
    objects.append(b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream')
    pdf=bytearray(b'%PDF-1.4\n');offsets=[0]
    for i,obj in enumerate(objects,1):
        offsets.append(len(pdf));pdf.extend(f'{i} 0 obj\n'.encode()+obj+b'\nendobj\n')
    start=len(pdf);pdf.extend(f'xref\n0 {len(offsets)}\n0000000000 65535 f \n'.encode())
    for offset in offsets[1:]:pdf.extend(f'{offset:010d} 00000 n \n'.encode())
    pdf.extend(f'trailer << /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF'.encode());path.write_bytes(pdf)


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--html',type=Path,required=True);ap.add_argument('--browser-executable',type=Path);args=ap.parse_args()
    with tempfile.TemporaryDirectory() as temp,sync_playwright() as p:
        temp=Path(temp);text_pdf(temp/'text-directions.pdf')
        image=Image.open(Path(__file__).resolve().parent.parent/'tests/fixtures/thai/scan.png').convert('RGB')
        pages=[image,image.transpose(Image.Transpose.ROTATE_270),image.transpose(Image.Transpose.ROTATE_180),image.transpose(Image.Transpose.ROTATE_90)]
        pages[0].save(temp/'scan-directions.pdf','PDF',resolution=180,save_all=True,append_images=pages[1:])
        english=Image.new('RGB',(1000,500),'white')
        ImageDraw.Draw(english).multiline_text((45,80),'OFFLINE ORIENTATION CHECK 12345\nContract reference 987654321\nLocal document preview test',font=ImageFont.load_default(size=40),fill='black',spacing=30)
        english.transpose(Image.Transpose.ROTATE_90).save(temp/'PRIVATE-FIXTURE.pdf','PDF',resolution=180)
        options={'headless':True}
        if args.browser_executable:options['executable_path']=str(args.browser_executable.resolve())
        browser=p.chromium.launch(**options);context=browser.new_context(offline=True);page=context.new_page()
        network=[];errors=[]
        context.on('request',lambda r:network.append(r.url) if r.url.startswith(('http:','https:')) else None)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(args.html.resolve().as_uri());page.evaluate('lwPpocrDemo.ready()')
        page.evaluate('''() => { const original=LwPdfOrientation; window.__directions=0;
          window.LwPdfOrientation={...original,detect:async(...args)=>{window.__directions++;return original.detect(...args);}}; }''')
        # 导入、翻页、弹窗、切换扫描语言只预览，不运行方向推理。
        page.locator('#reading-order').select_option('vertical-rtl')
        page.locator('#file').set_input_files(str(temp/'scan-directions.pdf'))
        page.wait_for_function("() => !document.getElementById('run').disabled",timeout=180_000)
        page.locator('#preview-next').click()
        page.wait_for_function("() => !document.getElementById('run').disabled",timeout=180_000)
        assert page.evaluate("document.getElementById('canvas').width < document.getElementById('canvas').height")
        assert '开始识别' in page.locator('#preview-orientation-status').inner_text()
        page.locator('#ocr-language').select_option('tha+eng')
        page.wait_for_function("() => !document.getElementById('run').disabled",timeout=180_000)
        page.evaluate('__lwOcrTest.openPreview()')
        page.locator('#zoom-in').click()
        page.locator('#pdf-reorient').click()
        page.wait_for_function("() => !document.getElementById('run').disabled",timeout=180_000)
        page.keyboard.press('Escape')
        assert page.evaluate('__directions')==0
        assert page.evaluate('__lwOcrTest.structuredResult()') is None
        assert page.evaluate('__lwOcrTest.orientationDiagnostics().orientation') is None
        print('file selection/navigation/settings/popup/reset: zero orientation calls')
        for filename,term,method in [('text-directions.pdf','Orientation text 12345','text-layer'),('scan-directions.pdf','สัญญาเช่า','ocr-probe')]:
            page.locator('#search-queries').fill(term)
            page.locator('#file').set_input_files(str(temp/filename))
            page.wait_for_function("() => !document.getElementById('run').disabled",timeout=180_000)
            assert page.evaluate("document.getElementById('canvas').width > document.getElementById('canvas').height")
            calls=page.evaluate('__directions')
            page.locator('#run').click()
            page.wait_for_function("() => __lwOcrTest.structuredResult()?.document.status === 'complete'",timeout=180_000)
            assert page.evaluate('__directions')==calls+4
            result=page.evaluate('__lwOcrTest.structuredResult()')
            rotations=[v['pdf']['orientation']['rotation'] for v in result['pages']]
            assert rotations == [0,270,180,90],rotations
            assert all(v['pdf']['orientation']['method']==method for v in result['pages'])
            expected=1 if method=='text-layer' else 2
            assert [v['count'] for v in result['search']['results'][0]['pages']]==[expected]*4
            for part in result['pages']:
                assert part['image']['width']>part['image']['height']
                for line in part['lines']:
                    assert all(-1<=x<=part['pdf']['width_pt']+1 for x in line['pdf_box'][::2])
                    assert all(-1<=y<=part['pdf']['height_pt']+1 for y in line['pdf_box'][1::2])
            calls=page.evaluate('__directions');page.locator('.query-hit').first.click()
            page.locator('#overlay .search-hit.active').wait_for(state='visible')
            page.evaluate('__lwOcrTest.openPreview()');page.locator('#zoom-in').click()
            assert page.locator('#preview-dialog #overlay .search-hit.active').count()==1
            page.keyboard.press('Escape');assert page.evaluate('__directions')==calls
            print(filename,rotations,'search/coordinates/preview/cache passed')
        # 重置方向也不触发推理，清除旧坐标，保留查询；下一次识别才重判。
        page.evaluate('__lwOcrTest.openPreview()')
        calls=page.evaluate('__directions')
        page.locator('#pdf-reorient').click()
        page.wait_for_function("() => !document.getElementById('run').disabled",timeout=180_000)
        assert page.evaluate('__directions')==calls
        assert page.evaluate('__lwOcrTest.structuredResult()') is None
        assert page.locator('#overlay .search-hit').count()==0
        assert page.locator('#search-queries').input_value()=='สัญญาเช่า'
        assert '开始识别' in page.locator('#preview-orientation-status').inner_text()
        page.keyboard.press('Escape')
        page.locator('#pdf-scope').select_option('current')
        page.locator('#run').click()
        page.wait_for_function("() => __lwOcrTest.structuredResult()?.document.status === 'partial'",timeout=180_000)
        assert page.evaluate('__directions')==calls+1
        assert '无需旋转' in page.locator('#preview-orientation-status').inner_text()
        print('reset waits for explicit recognition; current-page scope checked')
        # 用户在探测中停止后，不进入备用引擎，也不留下错误缓存；再点击可正常运行。
        page.evaluate("""() => { const original=LwPdfOrientation;window.__cancelOriginal=original;
          window.LwPdfOrientation={...original,detect:async(...args)=>{
            __lwOcrTest.cancelPdfOcr(); throw new Error('worker stopped during inference');
          }}; }""")
        page.locator('#pdf-reorient').click()
        page.wait_for_function("() => !document.getElementById('run').disabled")
        page.locator('#run').click()
        page.wait_for_function("() => !document.getElementById('run').disabled",timeout=180_000)
        assert page.evaluate('__lwOcrTest.orientationDiagnostics().orientation') is None
        assert page.evaluate('__lwOcrTest.structuredResult()') is None
        assert '已停止' in page.locator('#pdf-progress-label').inner_text()
        page.evaluate('window.LwPdfOrientation=window.__cancelOriginal')
        page.locator('#run').click()
        page.wait_for_function("() => __lwOcrTest.structuredResult()?.document.status === 'partial'",timeout=180_000)
        assert page.evaluate('__lwOcrTest.structuredResult().pages[0].pdf.orientation.method')=='ocr-probe'
        print('cancel during orientation leaves no result or cache; restart succeeds')
        # 注入主引擎低分／异常，备用引擎仍对真实图像运行；验证错误分类和诊断隐私。
        page.locator('#pdf-mode').select_option('text')
        for failure in ('uncertain','timeout','both-failed'):
            page.evaluate("""kind => {
              window.__faultOriginal=LwPdfOrientation;window.__faultCalls=0;
              window.LwPdfOrientation={...__faultOriginal,detect:async(...args)=>{
                __faultCalls++;
                if(kind==='both-failed'||(__faultCalls===1&&kind==='timeout'))throw new Error('Thai OCR worker timed out');
                if(__faultCalls===1&&kind==='uncertain')return {rotation:0,method:'uncertain',margin:0.01,candidates:[]};
                return __faultOriginal.detect(...args);
              }};
            }""",failure)
            fixture=temp/f'PRIVATE-FIXTURE-{failure}.pdf'
            fixture.write_bytes((temp/'PRIVATE-FIXTURE.pdf').read_bytes())
            page.locator('#file').set_input_files(str(fixture))
            page.wait_for_function("() => !document.getElementById('run').disabled")
            assert page.evaluate('__faultCalls')==0
            page.locator('#run').click()
            page.wait_for_function("() => __lwOcrTest.structuredResult()?.document.status === 'complete'",timeout=180_000)
            diagnostic=page.evaluate('__lwOcrTest.orientationDiagnostics()')
            direction=diagnostic['orientation']
            assert len(direction['attempts'])==2
            if failure=='both-failed':
                assert direction['method']=='unavailable'
                assert '方向识别失败' in page.locator('#pdf-meta').inner_text()
            else:
                assert direction['rotation']==90 and direction['engine']=='ppocr',direction
                assert direction['attempts'][0]['method']==('uncertain' if failure=='uncertain' else 'unavailable')
            if failure!='uncertain':assert direction['attempts'][0]['error_kind']=='timeout'
            assert 'PRIVATE-FIXTURE' not in str(diagnostic)
            assert 'OFFLINE ORIENTATION' not in str(diagnostic)
            assert 'user_agent' in diagnostic and 'app_build' in diagnostic
            page.evaluate('window.LwPdfOrientation=window.__faultOriginal')
            print(failure,'fallback/diagnostics passed')
        page.locator('#run').click()
        page.wait_for_function("() => __lwOcrTest.structuredResult()?.document.status === 'complete'",timeout=180_000)
        assert page.evaluate('__lwOcrTest.orientationDiagnostics().orientation.rotation')==90
        print('failed direction is retried on the next recognition click')
        page.locator('#ocr-language').select_option('ppocr')
        page.wait_for_function("() => !document.getElementById('run').disabled")
        assert page.locator('#reading-order').input_value()=='vertical-rtl'
        page.locator('#run').click()
        page.wait_for_function("() => __lwOcrTest.structuredResult()?.document.status === 'complete'",timeout=180_000)
        assert page.evaluate('__lwOcrTest.orientationDiagnostics().orientation.rotation')==90
        print('PP-OCR reading order no longer suppresses page orientation')
        assert not network,network
        assert not errors,errors
        browser.close()


if __name__=='__main__':main()
