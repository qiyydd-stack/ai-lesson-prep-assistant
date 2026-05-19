import json
import sys


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "image path is required"}, ensure_ascii=False))
        return 2

    image_path = sys.argv[1]

    try:
        from rapidocr_onnxruntime import RapidOCR
    except Exception as exc:
        print(
            json.dumps(
                {
                    "error": (
                        "RapidOCR is not installed. Run: "
                        "python -m pip install rapidocr-onnxruntime"
                    ),
                    "detail": str(exc),
                },
                ensure_ascii=False,
            )
        )
        return 3

    try:
        engine = RapidOCR()
        result, _elapsed = engine(image_path)
        lines = []
        for item in result or []:
            if len(item) >= 2 and item[1]:
                lines.append(str(item[1]).strip())
        text = "\n".join(line for line in lines if line)
        print(json.dumps({"text": text, "engine": "rapidocr"}, ensure_ascii=False))
        return 0 if text else 4
    except Exception as exc:
        print(json.dumps({"error": "OCR failed", "detail": str(exc)}, ensure_ascii=False))
        return 5


if __name__ == "__main__":
    raise SystemExit(main())
