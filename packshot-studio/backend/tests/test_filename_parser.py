from app.filename_parser import output_basename, parse_filename


def test_example_from_brief():
    p = parse_filename("01-26 EG-Ferropti FORTE 1085x695x695mm 90comp DD 3.pdf")
    assert p.date_code == "01-26"
    assert p.brand == "EG"
    assert p.product == "Ferropti FORTE"
    assert p.dimensions.raw == "1085x695x695mm"
    assert p.pack_size == "90comp"
    assert p.version == "3"
    assert p.tags == ["DD"]
    assert p.extension == "pdf"
    assert p.source_name == "01-26 EG-Ferropti FORTE 1085x695x695mm 90comp DD 3"


def test_dimensions_keep_both_readings():
    d = parse_filename("01-26 EG-Ferropti FORTE 1085x695x695mm 90comp DD 3.pdf").dimensions
    assert d.unit == "mm"
    assert d.as_written_mm == [1085.0, 695.0, 695.0]
    assert d.as_tenths_mm == [108.5, 69.5, 69.5]


def test_decimal_dimensions_with_spaces_and_cm():
    p = parse_filename("BRAND-Product 10,85 x 6,95 x 6,95 cm 30caps v2.pdf")
    assert p.dimensions.unit == "cm"
    assert p.dimensions.as_written_mm == [108.5, 69.5, 69.5]
    assert p.pack_size == "30caps"
    assert p.version == "2"
    assert p.brand == "BRAND" and p.product == "Product"


def test_unknown_tokens_become_tags():
    p = parse_filename("03-25 EG-Magnesium 120x40x40 60tabl XYZ NL-FR 7.pdf")
    assert p.tags == ["XYZ", "NL-FR"]
    assert p.version == "7"
    assert p.pack_size == "60tabl"


def test_no_dimensions_no_crash():
    p = parse_filename("Some artwork final.ai")
    assert p.dimensions is None
    assert p.product == "Some artwork final"
    assert p.extension == "ai"


def test_dots_in_name():
    p = parse_filename("01.26 EG-Vit. D3 100x50x30mm 30caps 2.pdf")
    assert p.date_code == "01.26"
    assert p.product == "Vit. D3"
    assert p.extension == "pdf"


def test_output_name():
    assert output_basename("01-26 EG-Ferropti FORTE 1085x695x695mm 90comp DD 3", "34-left", "4000px") == \
        "01-26 EG-Ferropti FORTE 1085x695x695mm 90comp DD 3_34-left_4000px"
