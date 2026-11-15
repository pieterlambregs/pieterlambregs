"""Parse a print-file name into editable metadata.

Example: "01-26 EG-Ferropti FORTE 1085x695x695mm 90comp DD 3.pdf"
  -> date_code "01-26", brand "EG", product "Ferropti FORTE",
     dimensions "1085x695x695mm", pack_size "90comp", tags ["DD"], version "3"

Nothing here is trusted blindly: every field is editable in the UI and the
dimensions are always compared with the measured dieline.
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field

DIM_RE = re.compile(
    r"(?<![\w.,])(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm)?(?![\w])",
)
DATE_RE = re.compile(r"^(\d{2}[-./]\d{2}([-./]\d{2,4})?|\d{4}[-./]\d{2}|\d{6}|\d{8})$")
PACK_UNITS = (
    "comp", "compr", "comprimes", "comprimés", "tabl", "tab", "tabs", "tabletten", "tablets",
    "caps", "cap", "capsules", "gel", "gelules", "gélules", "st", "stuks", "pcs", "pc",
    "ml", "cl", "l", "g", "gr", "mg", "kg", "sach", "sachets", "zakjes", "amp", "ampoules",
    "drag", "dragees", "dragées", "softgels", "sticks", "stick", "doses", "dos",
)
PACK_RE = re.compile(
    r"^(\d+(?:[.,]\d+)?(?:\s*[xX×]\s*\d+(?:[.,]\d+)?)?)\s*(" + "|".join(sorted(PACK_UNITS, key=len, reverse=True)) + r")\.?$",
    re.IGNORECASE,
)
VERSION_RE = re.compile(r"^(?:v|ver|versie|version|rev|r)?[\s._-]?(\d{1,3}[a-z]?)$", re.IGNORECASE)


@dataclass
class Dimensions:
    raw: str  # exactly as written in the file name
    values: list[float]  # numbers as written
    unit: str | None  # "mm", "cm" or None if not written
    # Both readings of the numbers, in millimetres. Which one is right is decided by
    # comparing with the measured dieline, never by the file name alone.
    as_written_mm: list[float] = field(default_factory=list)
    as_tenths_mm: list[float] = field(default_factory=list)


@dataclass
class ParsedName:
    source_name: str  # file name without extension
    extension: str
    date_code: str = ""
    brand: str = ""
    product: str = ""
    dimensions: Dimensions | None = None
    pack_size: str = ""
    version: str = ""
    tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def _num(s: str) -> float:
    return float(s.replace(",", "."))


def parse_filename(filename: str) -> ParsedName:
    base = filename.replace("\\", "/").rsplit("/", 1)[-1]
    stem, ext = (base.rsplit(".", 1) + [""])[:2] if "." in base else (base, "")
    if ext and (len(ext) > 5 or not ext.isalnum()):  # a dot inside the name, not an extension
        stem, ext = base, ""
    out = ParsedName(source_name=stem, extension=ext.lower())

    work = stem.replace("_", " ")

    # 1. Dimensions: found anywhere, may contain spaces ("108,5 x 69,5 x 69,5 mm").
    after_dims = ""
    m = DIM_RE.search(work)
    if m:
        vals = [_num(m.group(i)) for i in (1, 2, 3)]
        unit = (m.group(4) or "").lower() or None
        factor = 10.0 if unit == "cm" else 1.0
        out.dimensions = Dimensions(
            raw=m.group(0).strip(),
            values=vals,
            unit=unit,
            as_written_mm=[round(v * factor, 3) for v in vals],
            as_tenths_mm=[round(v * factor / 10.0, 3) for v in vals],
        )
        before_dims, after_dims = work[: m.start()], work[m.end():]
    else:
        before_dims = work

    head = before_dims.split()
    tail = after_dims.split()

    # 2. Date code: leading token.
    if head and DATE_RE.match(head[0]):
        out.date_code = head.pop(0)

    # Without dimensions there is no natural split; treat trailing recognisable tokens as tail.
    if not m:
        while head and (PACK_RE.match(head[-1]) or VERSION_RE.match(head[-1])) and len(head) > 1:
            tail.insert(0, head.pop())

    # 3. Version: the last tail token if it looks like one.
    if tail and VERSION_RE.match(tail[-1]):
        out.version = VERSION_RE.match(tail.pop()).group(1)

    # 4. Pack size; everything else after the dimensions is kept as a free tag.
    for tok in tail:
        if not out.pack_size and PACK_RE.match(tok):
            out.pack_size = tok
        else:
            out.tags.append(tok)

    # A pack size written before the dimensions ("... 90comp 1085x695x695mm").
    if not out.pack_size:
        for i, tok in enumerate(head):
            if PACK_RE.match(tok) and i > 0:
                out.pack_size = head.pop(i)
                break

    # 5. Brand and product: "EG-Ferropti FORTE" -> brand "EG", product "Ferropti FORTE".
    name = " ".join(head).strip(" -")
    bm = re.match(r"^([A-Za-z0-9&+.]{1,12})\s*-\s*(\S.*)$", name)
    if bm:
        out.brand, out.product = bm.group(1), bm.group(2).strip()
    else:
        out.product = name
    return out


def output_basename(source_name: str, view: str, size: str) -> str:
    """"<source name>_<view>_<size>" (extension added by the exporter)."""
    safe_view = re.sub(r"[^A-Za-z0-9-]+", "-", view).strip("-")
    return f"{source_name}_{safe_view}_{size}"
