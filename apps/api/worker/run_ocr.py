#!/usr/bin/env python3
"""
OJIX Property Intelligence — Standalone Python Tesseract OCR Engine

Executes real Tesseract OCR on property documents (PDF, PNG, JPEG) and emits
structured JSON containing raw text, word-level bounding boxes, page metrics,
and confidence scores conforming to OJIX extractDocument() input format.
"""

import sys
import os
import json
import subprocess
import tempfile
import pathlib

def run_tesseract_on_image(image_path, page_number=1, languages="eng"):
    """
    Runs tesseract CLI on an image file and extracts text + word-level tokens.
    """
    # 1. Plain text extraction
    text_res = subprocess.run(
        ["tesseract", image_path, "stdout", "-l", languages, "--psm", "6"],
        capture_output=True,
        text=True,
    )
    raw_text = text_res.stdout.strip() if text_res.returncode == 0 else ""

    # 2. TSV extraction for word-level bounding boxes & confidences
    tsv_res = subprocess.run(
        ["tesseract", image_path, "stdout", "-l", languages, "--psm", "6", "tsv"],
        capture_output=True,
        text=True,
    )

    tokens = []
    page_width = 1
    page_height = 1

    if tsv_res.returncode == 0 and tsv_res.stdout:
        lines = tsv_res.stdout.strip().split("\n")
        header = lines[0].split("\t") if lines else []
        
        # Read page dimensions from level 1 row
        for line in lines[1:]:
            parts = line.split("\t")
            if len(parts) >= 12:
                level = parts[0]
                if level == "1":
                    try:
                        page_width = max(1, int(parts[8]))
                        page_height = max(1, int(parts[9]))
                    except (ValueError, IndexError):
                        pass

        # Extract level 5 (words)
        for line in lines[1:]:
            parts = line.split("\t")
            if len(parts) >= 12:
                level = parts[0]
                if level == "5":
                    try:
                        left = int(parts[6])
                        top = int(parts[7])
                        width = int(parts[8])
                        height = int(parts[9])
                        conf = float(parts[10])
                        text = parts[11].strip()

                        if text and conf >= 0:
                            tokens.append({
                                "text": text,
                                "pageNumber": page_number,
                                "confidence": min(1.0, round(conf / 100.0, 4)),
                                "bbox": {
                                    "xmin": round(left / page_width, 4),
                                    "ymin": round(top / page_height, 4),
                                    "xmax": round((left + width) / page_width, 4),
                                    "ymax": round((top + height) / page_height, 4),
                                }
                            })
                    except (ValueError, IndexError):
                        continue

    avg_conf = (
        round(sum(t["confidence"] for t in tokens) / len(tokens), 4)
        if tokens
        else (0.85 if raw_text else 0.0)
    )

    return {
        "pageNumber": page_number,
        "text": raw_text,
        "confidence": avg_conf,
        "tokenCount": len(tokens),
        "tokens": tokens,
    }

def process_document(file_path, max_pages=5, languages="eng"):
    path = pathlib.Path(file_path)
    if not path.exists():
        return {"error": f"File not found: {file_path}", "pageCount": 0, "text": "", "tokens": [], "pages": []}

    suffix = path.suffix.lower()
    pages_results = []
    all_tokens = []

    with tempfile.TemporaryDirectory(prefix="ojix-ocr-") as tmpdir:
        if suffix == ".pdf":
            # Convert PDF pages to PNG using pdftoppm
            prefix = os.path.join(tmpdir, "page")
            conv = subprocess.run(
                ["pdftoppm", "-png", "-r", "150", "-f", "1", "-l", str(max_pages), str(path), prefix],
                capture_output=True,
                text=True,
            )
            if conv.returncode != 0:
                return {"error": f"PDF rasterization failed: {conv.stderr}", "pageCount": 0, "text": "", "tokens": [], "pages": []}

            # Find generated png files
            png_files = sorted(
                [f for f in os.listdir(tmpdir) if f.startswith("page-") and f.endswith(".png")],
                key=lambda x: int(x.replace("page-", "").replace(".png", "")),
            )

            for idx, png_file in enumerate(png_files, start=1):
                img_path = os.path.join(tmpdir, png_file)
                page_data = run_tesseract_on_image(img_path, page_number=idx, languages=languages)
                pages_results.append({
                    "pageNumber": page_data["pageNumber"],
                    "text": page_data["text"],
                    "confidence": page_data["confidence"],
                    "tokenCount": page_data["tokenCount"],
                })
                all_tokens.extend(page_data["tokens"])

        elif suffix in {".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"}:
            page_data = run_tesseract_on_image(str(path), page_number=1, languages=languages)
            pages_results.append({
                "pageNumber": 1,
                "text": page_data["text"],
                "confidence": page_data["confidence"],
                "tokenCount": page_data["tokenCount"],
            })
            all_tokens.extend(page_data["tokens"])
        else:
            return {"error": f"Unsupported file type: {suffix}", "pageCount": 0, "text": "", "tokens": [], "pages": []}

    full_text = "\n\n".join(
        f"--- Page {p['pageNumber']} ---\n{p['text']}" for p in pages_results if p["text"]
    ).strip()

    return {
        "provider": "tesseract",
        "providerVersion": "5.5.2",
        "pageCount": len(pages_results),
        "text": full_text,
        "tokens": all_tokens,
        "pages": pages_results,
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: run_ocr.py <file_path> [max_pages]"}))
        sys.exit(1)

    file_path = sys.argv[1]
    max_pages = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    languages = os.environ.get("OCR_LANGUAGES", "eng")

    result = process_document(file_path, max_pages=max_pages, languages=languages)
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
