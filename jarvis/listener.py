import io
import queue
import threading
import numpy as np
import sounddevice as sd
import whisper

from config import SILENCE_TIMEOUT

_model = None
_audio_queue: queue.Queue = queue.Queue()
_SAMPLE_RATE = 16000
_CHUNK = 1024


def _load_model():
    global _model
    if _model is None:
        _model = whisper.load_model("base")


def _audio_callback(indata, frames, time, status):
    _audio_queue.put(indata.copy())


def _is_silent(chunk: np.ndarray, threshold=0.01) -> bool:
    return np.abs(chunk).mean() < threshold


def listen_once() -> str:
    _load_model()

    frames = []
    silent_chunks = 0
    silence_limit = int(SILENCE_TIMEOUT * _SAMPLE_RATE / _CHUNK)

    with sd.InputStream(samplerate=_SAMPLE_RATE, channels=1, dtype="float32",
                        blocksize=_CHUNK, callback=_audio_callback):
        while True:
            chunk = _audio_queue.get()
            if _is_silent(chunk):
                silent_chunks += 1
                if frames and silent_chunks >= silence_limit:
                    break
            else:
                silent_chunks = 0
                frames.append(chunk)

    if not frames:
        return ""

    audio = np.concatenate(frames, axis=0).flatten()
    result = _model.transcribe(audio, fp16=False, language="en")
    return result["text"].strip()
