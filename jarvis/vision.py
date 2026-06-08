import numpy as np
from PIL import ImageGrab
from surya.ocr import run_ocr
from surya.model.detection.model import load_model as load_det_model, load_processor as load_det_processor
from surya.model.recognition.model import load_model as load_rec_model
from surya.model.recognition.processor import load_processor as load_rec_processor

from config import CAPTURE_REGION
from decider import ScreenElement

_det_model = None
_det_processor = None
_rec_model = None
_rec_processor = None


def _load_models():
    global _det_model, _det_processor, _rec_model, _rec_processor
    if _det_model is None:
        _det_model, _det_processor = load_det_model(), load_det_processor()
        _rec_model, _rec_processor = load_rec_model(), load_rec_processor()


def capture_elements() -> list[ScreenElement]:
    _load_models()

    img = ImageGrab.grab(bbox=CAPTURE_REGION)
    img_np = np.array(img)

    results = run_ocr(
        [img],
        [["en"]],
        _det_model,
        _det_processor,
        _rec_model,
        _rec_processor,
    )

    elements = []
    for line in results[0].text_lines:
        text = line.text.strip()
        if not text:
            continue
        bbox = line.bbox  # [x1, y1, x2, y2]
        elements.append(ScreenElement(
            text=text,
            x=int(bbox[0]),
            y=int(bbox[1]),
            w=int(bbox[2] - bbox[0]),
            h=int(bbox[3] - bbox[1]),
        ))

    return elements
