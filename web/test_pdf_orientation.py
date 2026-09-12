"""Offline quarter-turn preview/OCR test using synthetic fixtures only."""
import argparse
import tempfile
from pathlib import Path
from PIL import Image
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
        options={'headless':True}
        if args.browser_executable:options['executable_path']=str(args.browser_executable.resolve())
        browser=p.chromium.launch(**options);context=browser.new_context(offline=True);page=context.new_page()
        network=[];errors=[]
        context.on('request',lambda r:network.append(r.url) if r.url.startswith(('http:','https:')) else None)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(args.html.resolve().as_uri());page.evaluate('lwPpocrDemo.ready()')
        page.evaluate('''() => { const original=LwPdfOrientation; window.__directions=0;
          window.LwPdfOrientation={...original,detect:async(...args)=>{window.__directions++;return original.detect(...args);}}; }''')
        page.locator('#ocr-language').select_option('tha+eng')
        for filename,term,method in [('text-directions.pdf','Orientation text 12345','text-layer'),('scan-directions.pdf','สัญญาเช่า','ocr-probe')]:
            page.locator('#search-queries').fill(term)
            page.locator('#file').set_input_files(str(temp/filename))
            page.wait_for_function("() => !document.getElementById('run').disabled",timeout=180_000)
            assert page.evaluate("document.getElementById('canvas').width > document.getElementById('canvas').height")
            page.evaluate('__lwOcrTest.runOcr()')
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
        assert not network,network
        assert not errors,errors
        browser.close()


if __name__=='__main__':main()
