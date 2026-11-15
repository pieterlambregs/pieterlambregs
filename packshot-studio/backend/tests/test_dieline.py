import pymupdf
import pytest

from app import content_filter, dieline as dl, pdf_inspect as pi
from app.filename_parser import parse_filename

EXPECTED = {  # role -> (x0, y0, x1, y1) in mm on the upright sheet of make_sample
    "front": (38.0, 109.5, 107.5, 218.0),
    "right": (107.5, 109.5, 177.0, 218.0),
    "back": (177.0, 109.5, 246.5, 218.0),
    "left": (246.5, 109.5, 316.0, 218.0),
    "glue_flap": (25.0, 109.5, 38.0, 218.0),
    "top": (177.0, 40.0, 246.5, 109.5),
    "bottom": (38.0, 218.0, 107.5, 287.5),
}


def _layout(path):
    info = pi.inspect(str(path))
    page = pymupdf.open(path)[0]
    return info, dl.build_layout([s.to_list() for s in info.segments], info.page_w_mm, info.page_h_mm, pi.text_lines(page))


def _by_role(layout):
    out = {}
    for p in layout["panels"]:
        out.setdefault(p["role"], []).append(p)
    return out


def test_name_classification():
    assert pi.classify_name("Dieline") == "dieline"
    assert pi.classify_name("Stans") == "dieline"
    assert pi.classify_name("CutContour") == "cut"
    assert pi.classify_name("Rillijn") == "crease"
    assert pi.classify_name("Crease") == "crease"
    assert pi.classify_name("PANTONE 485 C") == "artwork"
    assert pi.classify_name("Varnish free") == "technical"
    assert pi.classify_name("Spot UV") == "finish"
    assert pi.classify_name("White") == "ask"


def test_spot_colour_dieline(samples):
    info, layout = _layout(samples["layered"])
    assert info.method == "spot"
    roles = {s.name: s.role for s in info.sources}
    assert roles == {"Dieline": "dieline", "Stans": "dieline", "Rillijn": "crease"}
    kinds = {s.kind for s in info.segments}
    assert kinds == {"cut", "crease"}
    got = _by_role(layout)
    for role, rect in EXPECTED.items():
        assert len(got[role]) == 1, role
        assert dl.panel_rect(layout, got[role][0]) == pytest.approx(rect, abs=0.05), role
    assert len(got["dust_flap"]) == 4
    assert len(got["tuck_flap_top"]) == 1 and len(got["tuck_flap_bottom"]) == 1


def test_orientation_of_flaps(samples):
    _info, layout = _layout(samples["layered"])
    got = _by_role(layout)
    assert got["top"][0]["rotation"] == 180  # printed upside down on the sheet
    assert got["bottom"][0]["rotation"] == 0
    assert all(p["rotation"] == 0 for r in ("front", "back", "left", "right") for p in got[r])
    assert layout["orientation_source"] == "text"


def test_front_is_only_proposed(samples):
    _info, layout = _layout(samples["layered"])
    assert layout["front_confirmed"] is False
    assert _by_role(layout)["front"][0]["id"] == "body0"


def test_flattened_file_colour_detection(samples):
    info, layout = _layout(samples["flat"])
    assert info.method == "color"
    assert info.notes  # tells the user to check
    got = _by_role(layout)
    for role, rect in EXPECTED.items():
        assert dl.panel_rect(layout, got[role][0]) == pytest.approx(rect, abs=0.3), role


def test_sheet_drawn_rotated(samples):
    _info, layout = _layout(samples["rotated"])
    assert layout["sheet_rotation"] == 1
    got = _by_role(layout)
    assert all(p["rotation"] == 90 for r in ("front", "back", "left", "right") for p in got[r])
    assert got["top"][0]["rotation"] == 270
    m = dl.measure(layout)
    assert m["box"] == pytest.approx({"width": 69.5, "depth": 69.5, "height": 108.5}, abs=0.05)


def test_scale_check_against_file_name(samples):
    _info, layout = _layout(samples["layered"])
    m = dl.measure(layout)
    d = parse_filename("x 1085x695x695mm.pdf").to_dict()["dimensions"]
    c = dl.compare_dimensions(m["box"], d)
    assert c["status"] == "match" and c["reading"] == "tenths of a mm"
    wrong = parse_filename("x 1100x695x695mm.pdf").to_dict()["dimensions"]
    assert dl.compare_dimensions(m["box"], wrong)["status"] == "mismatch"


def test_clean_pdf_removes_only_dieline(samples, tmp_path):
    info = pi.inspect(str(samples["layered"]))
    out = tmp_path / "clean.pdf"
    rep = pi.build_clean_pdf(str(samples["layered"]), str(out), info)
    assert rep["failed_streams"] == 0 and rep["ops_removed"] > 30
    again = pi.inspect(str(out))
    assert again.segments == []  # no spot-coloured dieline left
    # artwork text is untouched
    orig = pymupdf.open(samples["layered"])[0].get_text()
    clean = pymupdf.open(out)[0].get_text()
    assert "Ferropti" in clean and clean.replace("108.5 x 69.5 x 69.5 mm", "").split() == \
        orig.replace("108.5 x 69.5 x 69.5 mm", "").split()


def test_content_filter_keeps_other_paint():
    stream = b"q /CS0 CS 1 SCN 0 0 m 10 0 l S Q 1 0 0 RG 0 0 m 5 5 l S /CS0 cs 1 scn 0 0 10 10 re f 0 g 0 0 5 5 re f"
    out, n = content_filter.filter_stream(stream, {"CS0"})
    assert n == 2
    assert out.count(b"\nS") + out.count(b" S\n") >= 1  # the RGB stroke stays
    assert b"\ng\n" in out and out.rstrip().endswith(b"f")


def test_no_false_residue_on_magenta_logo(samples, data_dir):
    from app import project as P

    p = P.create(samples["layered"].name, samples["layered"].read_bytes())
    P.analyse(p["id"])
    p = P.extract_panels(p["id"])
    for pid, r in p["panels"].items():
        if "residue" in r:
            assert r["residue"]["status"] == "pass", pid
    # the artwork defect built into the sample (flap colour over the fold) is reported, not repaired
    assert any("right" in w and "lighter strip" in w for w in p["panel_warnings"])
    assert not any(w.startswith("front") for w in p["panel_warnings"])


def test_residue_detected_when_dieline_left_in_panel(samples, data_dir):
    import numpy as np
    from app import checks

    panel = np.full((400, 300, 3), (0, 153, 98), np.uint8)
    panel[100:400, 150:152] = (230, 0, 126)  # a cut line left inside the panel
    panel[20:80, 20:80] = (230, 0, 126)  # a magenta logo blob: must not count
    r = checks.residue_check(panel, np.array([230, 0, 126]), 600 / 25.4)
    assert r["status"] == "fail"
    assert 140 <= r["bbox_px"][0] <= 152
    panel[100:400, 150:152] = (0, 153, 98)
    assert checks.residue_check(panel, np.array([230, 0, 126]), 600 / 25.4)["status"] == "pass"
