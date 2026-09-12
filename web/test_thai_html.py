"""Real Thai PDF OCR in file:// Chromium, with network disabled from first load."""
from __future__ import annotations
import argparse
import json
import tempfile
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

FIXTURES = Path(__file__).resolve().parent.parent / "tests/fixtures/thai"
QUERIES = ["สัญญาเช่า", "จำนวนเงิน", "วันที่", "Contract", "ไม่มีคำนี้"]


def run_case(page, source: Path, count: int, expected_source: str, model="tha+eng"):
    page.locator("#file").set_input_files(str(source))
    page.wait_for_function("() => !document.getElementById('run').disabled")
    page.locator("#run").click()
    page.wait_for_function("() => __lwOcrTest.structuredResult()?.document.status === 'complete'", timeout=180_000)
    result = page.evaluate("__lwOcrTest.structuredResult()")
    assert result["document"]["processed_pages"] == count
    assert result["options"]["ocr_language"] == model
    assert result["search"]["complete"]
    matches = result["search"]["results"]
    assert [r["count"] for r in matches] == [2*count, count, count, count, 0], matches
    assert len(matches[0]["pages"]) == count
    for p in matches[0]["pages"]:
        assert p["count"] == 2 and len(p["confidences"]) == 2
    for p in result["pages"]:
        assert p["processing_source"] == expected_source
    for query in matches:
        for hit in query["matches"]:
            if expected_source == "ocr":
                assert 0 < hit["confidence"] <= 1
                assert hit["confidence_scope"] == "minimum-matched-line-score"
            else:
                assert hit["confidence"] is None
            assert hit["source"] == expected_source
            assert all(len(box) == 8 for box in hit["pdf_boxes"])
            assert all(box[2] > box[0] and box[5] > box[1] for box in hit["boxes"])
    page.locator(".query-hit").first.click()
    page.wait_for_function("() => __lwOcrTest.snapshot().pdfCurrentPage === 1")
    page.locator("#overlay .search-hit.active").wait_for(state="visible")
    assert page.locator("#overlay .search-hit.active").count() == 1
    box = matches[0]["matches"][0]["boxes"][0]
    actual = page.locator("#overlay .search-hit.active").get_attribute("points")
    canvas_size = page.evaluate("({width:document.getElementById('canvas').width,height:document.getElementById('canvas').height})")
    image_size = result["pages"][0]["image"]
    expected = [v*canvas_size["width" if i%2==0 else "height"]/image_size["width" if i%2==0 else "height"] for i,v in enumerate(box)]
    assert all(abs(a-b)<0.01 for a,b in zip([float(x) for x in actual.replace(",", " ").split()], expected))
    assert page.locator("#export-json").is_enabled()
    # Real PDF page and its overlay are moved together into the zoomable popup.
    page.evaluate("__lwOcrTest.openPreview()")
    page.locator("#zoom-in").click()
    assert page.locator("#preview-dialog #overlay .search-hit.active").count() == 1
    page.keyboard.press("Escape")
    print(json.dumps({"file": source.name, "pages": count, "counts": [r["count"] for r in matches],
        "scores": matches[0]["pages"]}, ensure_ascii=False))
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--html", type=Path, required=True)
    parser.add_argument("--browser-executable", type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="lw-thai-") as temp, sync_playwright() as p:
        scanned = Path(temp)/"thai-two-scanned-pages.pdf"
        with Image.open(FIXTURES/"scan.png") as original:
            image = original.convert("RGB")
            image.save(scanned, "PDF", resolution=180, save_all=True, append_images=[image])
        options = {"headless": True}
        if args.browser_executable:
            options["executable_path"] = str(args.browser_executable.resolve())
        browser = p.chromium.launch(**options)
        requests, errors = [], []
        try:
            # Both embedded LSTM cores must work without a server, cache or special file flags.
            for scalar in (False, True):
                context = browser.new_context(offline=True, viewport={"width":1180,"height":900})
                context.on("request", lambda r: requests.append(r.url) if r.url.startswith(("http:","https:")) else None)
                page = context.new_page()
                page.on("pageerror", lambda e: errors.append(str(e)))
                page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
                if scalar:
                    page.add_init_script("""const validate = WebAssembly.validate;
                      WebAssembly.validate = bytes => bytes.length === 29 ? false : validate(bytes);""")
                page.goto(args.html.resolve().as_uri(), timeout=180_000)
                page.evaluate("lwPpocrDemo.ready()")
                page.evaluate("""() => {
                  const original=LwThaiOcr; window.__thaiCreates=0;
                  window.LwThaiOcr={...original, create:async()=>{window.__thaiCreates++;return original.create();}};
                }""")
                page.locator("#ocr-language").select_option("tha+eng")
                assert page.locator("#use-cls").is_disabled()
                assert page.locator("#reading-order").is_disabled()
                page.locator("#search-queries").fill("\n".join(QUERIES))
                if not scalar:
                    run_case(page, FIXTURES/"text.pdf", 1, "text-layer")
                    assert page.evaluate("__thaiCreates") == 0
                run_case(page, scanned, 2, "ocr")
                assert page.evaluate("__thaiCreates") == 1
                # Changing the UI language and query reuses the recognized text and worker.
                page.evaluate("LwI18n.setLanguage('th')")
                page.locator("#search-queries").fill("จำนวนเงิน")
                page.evaluate("__lwOcrTest.refreshSearch()")
                assert page.evaluate("__lwOcrTest.structuredResult().search.results[0].count") == 2
                assert page.evaluate("__thaiCreates") == 1
                page.locator("#ocr-language").select_option("ppocr")
                # 切换设置会重绘原始预览；待渲染完成后恢复 PP-OCR 控件，不启动推理。
                page.wait_for_function("() => !document.getElementById('run').disabled")
                assert page.locator("#use-cls").is_enabled()
                context.close()
            assert requests == [], requests
            assert errors == [], errors
        finally:
            browser.close()
    print("Thai text/scanned PDF, scalar/SIMD, highlights, confidence and offline checks passed")


if __name__ == "__main__":
    main()
