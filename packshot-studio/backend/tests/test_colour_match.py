import numpy as np
from PIL import Image

from app import colour_match as cm

PAIRS = [((138, 90, 161), (130, 95, 171)), ((0, 155, 136), (0, 168, 146))]


def test_anchors_hit_neutrals_and_other_colours_stay():
    lut = cm.build_lut(PAIRS)
    colours = [(138, 90, 161), (0, 155, 136), (255, 255, 255), (0, 0, 0), (128, 128, 128), (220, 0, 30)]
    out = np.asarray(cm.apply(Image.fromarray(np.array(colours, np.uint8).reshape(1, -1, 3)), lut))[0].astype(int)
    assert np.abs(out[0] - [130, 95, 171]).max() <= 1
    assert np.abs(out[1] - [0, 168, 146]).max() <= 1
    for got, want in zip(out[2:], colours[2:]):
        assert np.abs(got - want).max() <= 1


def test_positions_unchanged():
    rng = np.random.default_rng(1)
    img = np.full((60, 80, 3), (138, 90, 161), np.uint8)
    img[rng.random((60, 80)) > 0.7] = (255, 255, 255)  # white text-like pixels
    out = np.asarray(cm.apply(Image.fromarray(img), cm.build_lut(PAIRS)))
    assert ((img == 255).all(-1) == (out >= 254).all(-1)).all()
