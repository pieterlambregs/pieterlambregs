"""Remove dieline marks from a PDF content stream without touching artwork.

The filter drops only paint operators whose current colour space is one of the given
(dieline) Separation resource names. Every other byte of the stream is passed through
token-for-token, so artwork is never redrawn or re-encoded.
"""
from __future__ import annotations

WS = b"\x00\t\n\x0c\r "
DELIMS = b"()<>[]{}/%"


class ParseError(Exception):
    pass


def tokenize(data: bytes):
    """Yield (kind, raw) tokens. kind: 'op' (keyword/number), 'name', 'str', 'open', 'close', 'inline'."""
    i, n = 0, len(data)
    while i < n:
        c = data[i:i + 1]
        if c in (b"\x00", b"\t", b"\n", b"\x0c", b"\r", b" "):
            i += 1
        elif c == b"%":
            while i < n and data[i:i + 1] not in (b"\n", b"\r"):
                i += 1
        elif c == b"(":
            depth, j = 1, i + 1
            while j < n and depth:
                ch = data[j:j + 1]
                if ch == b"\\":
                    j += 1
                elif ch == b"(":
                    depth += 1
                elif ch == b")":
                    depth -= 1
                j += 1
            if depth:
                raise ParseError("unterminated string")
            yield "str", data[i:j]
            i = j
        elif c == b"<":
            if data[i:i + 2] == b"<<":
                yield "open", b"<<"
                i += 2
            else:
                j = data.find(b">", i)
                if j < 0:
                    raise ParseError("unterminated hex string")
                yield "str", data[i:j + 1]
                i = j + 1
        elif c == b">":
            if data[i:i + 2] != b">>":
                raise ParseError("stray >")
            yield "close", b">>"
            i += 2
        elif c in (b"[", b"{"):
            yield "open", c
            i += 1
        elif c in (b"]", b"}"):
            yield "close", c
            i += 1
        elif c == b"/":
            j = i + 1
            while j < n and data[j] not in WS and data[j] not in DELIMS:
                j += 1
            yield "name", data[i:j]
            i = j
        else:
            j = i
            while j < n and data[j] not in WS and data[j] not in DELIMS:
                j += 1
            word = data[i:j]
            if word == b"BI":
                # Inline image: copy verbatim up to the EI that ends it.
                k = data.find(b"ID", j)
                if k < 0:
                    raise ParseError("inline image without ID")
                e = k + 2
                while True:
                    e = data.find(b"EI", e)
                    if e < 0:
                        raise ParseError("inline image without EI")
                    before_ok = data[e - 1] in WS
                    after_ok = e + 2 >= n or data[e + 2] in WS
                    if before_ok and after_ok:
                        break
                    e += 2
                yield "inline", data[i:e + 2]
                i = e + 2
            else:
                yield "op", word
                i = j


_NUM_START = b"+-.0123456789"

_STROKE_DEV = {b"G", b"RG", b"K"}
_FILL_DEV = {b"g", b"rg", b"k"}
_TEXT_SHOW = {b"Tj", b"TJ", b"'", b'"'}


def filter_stream(data: bytes, dieline_cs_names: set[str]) -> tuple[bytes, int]:
    """Return (new_stream, number_of_removed_paint_operations)."""
    names = {b"/" + n.encode("latin-1") for n in dieline_cs_names}
    out: list[bytes] = []
    operands: list[bytes] = []
    depth = 0
    stroke_die = fill_die = False
    stack: list[tuple[bool, bool]] = []
    removed = 0

    def emit(op: bytes | None, keep_operands: bool = True):
        if keep_operands and operands:
            out.append(b" ".join(operands))
        if op is not None:
            out.append(op)
        operands.clear()

    for kind, raw in tokenize(data):
        if kind == "open":
            depth += 1
            operands.append(raw)
            continue
        if kind == "close":
            depth -= 1
            operands.append(raw)
            continue
        if kind == "inline":
            emit(raw)
            continue
        if kind != "op" or depth > 0 or raw[:1] in _NUM_START or raw in (b"true", b"false", b"null"):
            operands.append(raw)
            continue

        op = raw
        if op == b"q":
            stack.append((stroke_die, fill_die))
        elif op == b"Q":
            if stack:
                stroke_die, fill_die = stack.pop()
        elif op == b"CS":
            stroke_die = bool(operands) and operands[-1] in names
        elif op == b"cs":
            fill_die = bool(operands) and operands[-1] in names
        elif op in _STROKE_DEV:
            stroke_die = False
        elif op in _FILL_DEV:
            fill_die = False
        elif op in (b"S", b"s"):
            if stroke_die:
                removed += 1
                emit(b"n")
                continue
        elif op in (b"f", b"F", b"f*"):
            if fill_die:
                removed += 1
                emit(b"n")
                continue
        elif op in (b"B", b"B*", b"b", b"b*"):
            star = b"*" if op.endswith(b"*") else b""
            closing = op[:1] == b"b"
            if stroke_die and fill_die:
                removed += 1
                emit(b"n")
                continue
            if stroke_die:  # keep the (artwork) fill, drop the dieline stroke
                removed += 1
                emit(b"f" + star)
                continue
            if fill_die:  # keep the (artwork) stroke, drop the dieline fill
                removed += 1
                emit(b"s" if closing else b"S")
                continue
        elif op in _TEXT_SHOW:
            if fill_die:
                removed += 1
                if op in (b"'", b'"'):
                    emit(b"T*", keep_operands=False)
                else:
                    emit(None, keep_operands=False)
                continue
        emit(op)

    if operands:
        out.append(b" ".join(operands))
    return b"\n".join(out) + b"\n", removed
