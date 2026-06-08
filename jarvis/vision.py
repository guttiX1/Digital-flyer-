from PIL import ImageGrab
from surya.detection import DetectionPredictor
from surya.recognition import RecognitionPredictor

from config import CAPTURE_REGION
from decider import ScreenElement

_det_predictor = None
_rec_predictor = None


def _load_models():
    global _det_predictor, _rec_predictor
    if _det_predictor is None:
        _det_predictor = DetectionPredictor()
        _rec_predictor = RecognitionPredictor()


def capture_elements() -> list[ScreenElement]:
    _load_models()

    img = ImageGrab.grab(bbox=CAPTURE_REGION)
    det_results = _det_predictor([img])
    results = _rec_predictor([img], det_results)

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
