#!/usr/bin/env python3
"""
Generate the game's sound effects as small WAV files.

Godot ships no synth, so the sounds are baked here instead of being recorded or
downloaded. Everything is plain sine/square/noise with an exponential envelope.

Run:  python3 tools/make_audio.py
Out:  godot/assets/audio/*.wav
"""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

RATE = 22050
OUT = Path(__file__).resolve().parent.parent / "godot" / "assets" / "audio"


def envelope(i: int, total: int, attack: float = 0.01, release: float = 0.6) -> float:
    t = i / max(1, total - 1)
    if t < attack:
        return t / attack
    if t > 1.0 - release:
        return max(0.0, (1.0 - t) / release)
    return 1.0


def tone(
    freq: float,
    dur: float,
    wave_shape: str = "sine",
    gain: float = 0.5,
    to_freq: float | None = None,
    noise: float = 0.0,
) -> list[float]:
    total = int(RATE * dur)
    samples: list[float] = []
    phase = 0.0
    seed = 12345
    for i in range(total):
        t = i / total
        f = freq if to_freq is None else freq * (to_freq / freq) ** t
        phase += 2.0 * math.pi * f / RATE
        if wave_shape == "square":
            value = 1.0 if math.sin(phase) >= 0.0 else -1.0
        elif wave_shape == "saw":
            value = 2.0 * ((phase / (2.0 * math.pi)) % 1.0) - 1.0
        else:
            value = math.sin(phase)
        env = envelope(i, total)
        if noise > 0.0:
            seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
            value = value * (1.0 - noise) + ((seed / 0x7FFFFFFF) * 2.0 - 1.0) * noise
        samples.append(value * env * gain)
    return samples


def stack(*layers: list[float]) -> list[float]:
    length = max(len(layer) for layer in layers)
    out = [0.0] * length
    for layer in layers:
        for i, value in enumerate(layer):
            out[i] += value
    return out


def write(name: str, samples: list[float]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    peak = max(1e-6, max(abs(s) for s in samples))
    normalised = [s / peak * 0.85 for s in samples]
    with wave.open(str(OUT / f"{name}.wav"), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes(b"".join(struct.pack("<h", int(s * 32000)) for s in normalised))


def main() -> None:
    write("jump", tone(330, 0.16, "square", 0.35, to_freq=640))
    write("land", stack(tone(120, 0.1, "sine", 0.5, to_freq=70), tone(900, 0.08, "sine", 0.18, noise=1.0)))
    write("click", tone(520, 0.07, "square", 0.3))
    write("hit", stack(tone(240, 0.26, "saw", 0.5, to_freq=90), tone(200, 0.2, "sine", 0.3, noise=0.8)))
    write("die", stack(tone(420, 0.7, "square", 0.4, to_freq=60), tone(300, 0.5, "sine", 0.25, noise=0.4)))
    write("deny", tone(200, 0.16, "square", 0.4, to_freq=150))
    write(
        "clear",
        stack(
            tone(523, 0.4, "sine", 0.4),
            [0.0] * int(RATE * 0.13) + tone(659, 0.4, "sine", 0.4),
            [0.0] * int(RATE * 0.26) + tone(784, 0.45, "sine", 0.4),
            [0.0] * int(RATE * 0.39) + tone(1046, 0.5, "sine", 0.4),
        ),
    )
    total = sum(f.stat().st_size for f in OUT.glob("*.wav"))
    print(f"wrote {len(list(OUT.glob('*.wav')))} sounds ({total / 1024:.0f} KB) to {OUT}")


if __name__ == "__main__":
    main()
