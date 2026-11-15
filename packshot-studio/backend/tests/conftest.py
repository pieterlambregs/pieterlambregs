import sys
import warnings
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "samples"))
warnings.filterwarnings("ignore", category=FutureWarning)


@pytest.fixture(scope="session")
def samples(tmp_path_factory):
    import make_sample

    d = tmp_path_factory.mktemp("samples")
    return {
        "layered": make_sample.make("layered", d / "01-26 EG-Ferropti FORTE 1085x695x695mm 90comp DD 3.pdf"),
        "flat": make_sample.make("flat", d / "flat 1085x695x695mm.pdf"),
        "rotated": make_sample.make("rotated", d / "rot 1085x695x695mm.pdf"),
    }


@pytest.fixture()
def data_dir(tmp_path, monkeypatch):
    from app import project

    monkeypatch.setattr(project, "PROJECTS", tmp_path / "projects")
    return tmp_path
