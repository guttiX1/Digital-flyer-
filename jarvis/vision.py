import pytesseract
from PIL import ImageGrab

from config import CAPTURE_REGION
from decider import ScreenElement


def capture_elements() -> list[ScreenElement]:
    img = ImageGrab.grab(bbox=CAPTURE_REGION)
    data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)

    elements = []
    for i, text in enumerate(data["text"]):
        text = text.strip()
        if not text or int(data["conf"][i]) < 60:
            continue
        elements.append(ScreenElement(
            text=text,
            x=data["left"][i],
            y=data["top"][i],
            w=data["width"][i],
            h=data["height"][i],
        ))

    return elements
