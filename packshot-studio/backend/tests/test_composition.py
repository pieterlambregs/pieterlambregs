import pytest

from app import tasks


def box(depth, x=0.0, y=0.0, z=0.0, rot=(0, 0, 0)):
    return {"dims": {"width": 118.85, "depth": depth, "height": 64.5}, "position": [x, y], "z": z, "rotation": list(rot)}


def test_stacked_boxes_touch_but_do_not_overlap():
    tasks.check_no_overlap([box(41.15), box(32.15, z=64.5), box(21.15, z=129.0, rot=(0, 0, 3))])


def test_overlapping_boxes_are_refused():
    with pytest.raises(ValueError):
        tasks.check_no_overlap([box(41.15), box(32.15, x=50)])
    with pytest.raises(ValueError):
        tasks.check_no_overlap([box(41.15), box(32.15, z=60)])  # sinks into the box below


def test_standing_box_next_to_lying_box():
    upright = box(32.15, x=95, rot=(0, -90, 0))  # 64.5 wide when standing
    tasks.check_no_overlap([box(41.15), upright])
    corners = tasks._box_corners(upright)
    zs = [c[2] for c in corners]
    assert min(zs) == pytest.approx(0) and max(zs) == pytest.approx(118.85)
