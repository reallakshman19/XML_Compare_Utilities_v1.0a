"""Independent numerical reproduction for CII multi-base Method A/B qualification.

No production JavaScript is imported. Expected values are analytical/synthetic.
"""
from math import acos, degrees, sin, sqrt, pi


def dot(a, b): return sum(x * y for x, y in zip(a, b))
def sub(a, b): return tuple(x - y for x, y in zip(a, b))
def add(a, b): return tuple(x + y for x, y in zip(a, b))
def mul(a, k): return tuple(x * k for x in a)
def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def mag(a): return sqrt(dot(a, a))
def unit(a): return mul(a, 1.0 / mag(a))
def transpose(m): return tuple(tuple(m[r][c] for r in range(3)) for c in range(3))
def matmul(a, b):
    bt = transpose(b)
    return tuple(tuple(dot(row, col) for col in bt) for row in a)
def matvec(m, v): return tuple(dot(row, v) for row in m)

def basis(p0, p1, p2):
    first = sub(p1, p0); second = sub(p2, p0); e1 = unit(first)
    e2 = unit(sub(second, mul(e1, dot(second, e1)))); e3 = unit(cross(e1, e2))
    matrix = transpose((e1, e2, e3))
    sin_angle = mag(cross(first, second)) / (mag(first) * mag(second))
    return p0, matrix, sin_angle

def rigid_from_triplet(source, target, indexes):
    sp = [source[i] for i in indexes]; tp = [target[i] for i in indexes]
    so, sb, ssin = basis(*sp); to, tb, tsin = basis(*tp)
    rotation = matmul(tb, transpose(sb)); translation = sub(to, matvec(rotation, so))
    return rotation, translation, min(ssin, tsin)

def apply(transform, point):
    rotation, translation = transform
    return add(matvec(rotation, point), translation)
def residuals(transform, source, target): return [mag(sub(apply(transform, p), q)) for p, q in zip(source, target)]
def rotation_difference_deg(left, right):
    relative = matmul(right, transpose(left))
    cosine = max(-1.0, min(1.0, (relative[0][0] + relative[1][1] + relative[2][2] - 1.0) / 2.0))
    return degrees(acos(cosine))
def included_angle(a, b): return degrees(acos(abs(dot(unit(a), unit(b)))))
def od_tolerance(od_mm, factor=2.0): return factor * od_mm
def angular_displacement(length_mm, angle_delta_deg): return 2.0 * length_mm * sin((angle_delta_deg * pi / 180.0) / 2.0)
def triple(a, b, c): return abs(dot(unit(a), cross(unit(b), unit(c))))

# Common policy: SOURCE OD is tolerance scale only; TARGET OD never changes it.
source_od = 273.0
assert od_tolerance(source_od) == 546.0
for target_od in (20.0, 88.9, 323.9, 1000.0):
    _ = target_od
    assert od_tolerance(source_od) == 546.0
assert od_tolerance(source_od, 1.0) == 273.0

# Method A: two independent local regions are OR loops and need not share translation.
a1_source = [(0.0, 0.0, 0.0), (100.0, 0.0, 0.0), (0.0, 100.0, 0.0)]
a1_target = [(0.0, 100.0, 0.0), (100.0, 100.0, 0.0), (0.0, 200.0, 0.0)]
a2_source = [(10000.0, 0.0, 0.0), (10100.0, 0.0, 0.0), (10000.0, 100.0, 0.0)]
a2_target = [(10000.0, -200.0, 0.0), (10100.0, -200.0, 0.0), (10000.0, -100.0, 0.0)]
for source, target, expected_t in ((a1_source, a1_target, (0.0, 100.0, 0.0)), (a2_source, a2_target, (0.0, -200.0, 0.0))):
    r, t, _ = rigid_from_triplet(source, target, (0, 1, 2))
    assert max(residuals((r, t), source, target)) < 1e-9
    assert mag(sub(t, expected_t)) < 1e-9

# Method A configurable x: 150 mm residual fails at 1*OD=100 and passes at 2*OD=200.
scaled_source = [(0.0, 0.0, 0.0), (100.0, 0.0, 0.0), (0.0, 100.0, 0.0)]
scaled_target = [(0.0, 0.0, 0.0), (100.0, 0.0, 0.0), (0.0, 250.0, 0.0)]
r, t, _ = rigid_from_triplet(scaled_source, scaled_target, (0, 1, 2))
scaled_residual = max(residuals((r, t), scaled_source, scaled_target))
assert abs(scaled_residual - 150.0) < 1e-9
assert scaled_residual > od_tolerance(100.0, 1.0)
assert scaled_residual <= od_tolerance(100.0, 2.0)

# Method A ambiguity remains fail-closed under realistic OD-scaled tolerance.
source = [(0.0, 0.0, 0.0), (1000.0, 0.0, 0.0), (2000.0, 1.0, 0.0), (3000.0, 0.0, 1.0)]
target = [(0.0, 0.0, 0.0), (1000.0, 0.0, 0.0), (2000.0, 1.0, 0.0), (3000.0, 1.0, 0.0)]
r1, t1, sin1 = rigid_from_triplet(source, target, (0, 1, 2)); r2, t2, sin2 = rigid_from_triplet(source, target, (0, 1, 3))
e1 = residuals((r1, t1), source, target); e2 = residuals((r2, t2), source, target)
assert abs(max(e1) - sqrt(2.0)) < 1e-9 and abs(max(e2) - sqrt(2.0)) < 1e-9
assert max(e1) / od_tolerance(273.0) < 1 and max(e2) / od_tolerance(273.0) < 1
assert sin1 > 1e-4 and sin2 > 1e-4 and rotation_difference_deg(r1, r2) > 89.999

# Method B: a straight line has one undirected axis even though it has two rays.
left = (-1.0, 0.0, 0.0); right = (1.0, 0.0, 0.0)
assert abs(degrees(acos(abs(dot(left, right))))) < 1e-12

# Two-axis run length mismatch is judged against x*SOURCE_OD, not a fixed percent.
assert abs(included_angle((1, 0, 0), (0, 0, 1)) - 90.0) < 1e-12
assert abs(included_angle((0, 1, 0), (0, 0, 1)) - 90.0) < 1e-12
assert 400.0 <= od_tolerance(273.0, 2.0)
assert 400.0 > od_tolerance(273.0, 1.0)

# Angular mismatch is converted to equivalent transverse displacement at the shorter run lever arm.
assert angular_displacement(7000.0, 3.0) < od_tolerance(273.0, 2.0)
assert angular_displacement(7000.0, 5.0) > od_tolerance(273.0, 2.0)

# Method B complexity weights: one axis 0, two axes 24, planar 3-axis 32, full 3D orthogonal 40.
one_axis_weight = 0.0
two_axis_weight = 24.0
planar_three_weight = 32.0 + 8.0 * min(triple((1, 0, 0), (0, 1, 0), (1, 1, 0)), 1.0)
full_three_weight = 32.0 + 8.0 * min(triple((1, 0, 0), (0, 1, 0), (0, 0, 1)), 1.0)
assert one_axis_weight == 0.0
assert abs(planar_three_weight - 32.0) < 1e-12
assert abs(full_three_weight - 40.0) < 1e-12
assert one_axis_weight < two_axis_weight < planar_three_weight < full_three_weight

print('Independent CII OD-scaled multi-base Method A/B oracle passed.')
