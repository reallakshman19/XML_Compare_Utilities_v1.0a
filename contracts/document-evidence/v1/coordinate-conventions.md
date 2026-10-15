# Coordinate conventions — Document Evidence v1

This file is normative for v1 geometry and `SurfaceTransform` interpretation.

## Matrix convention

Coordinates are homogeneous **column vectors**:

```text
p = [x, y, 1]^T
p_B = M_(B<-A) p_A
M_(C<-A) = M_(C<-B) M_(B<-A)
```

Matrices are serialized row-major as nine numbers. Implementations must use the persisted inverse matrix or a numerically verified inverse of the persisted forward matrix; consumers must not re-derive ad-hoc inverse coordinate formulas.

## Named spaces

### P — original PDF default user space

- unit: PDF point
- origin: the PDF user-space origin
- +x: right
- +y: up
- CropBox and `/Rotate` have not yet been normalized

For CropBox `[x0,y0,x1,y1]`, define `W=x1-x0` and `H=y1-y0`.

CropBox-local translation:

```text
C = [ 1  0 -x0
      0  1 -y0
      0  0   1 ]
```

### D — canonical displayed PDF page

- unit: point
- origin: displayed CropBox top-left
- +x: right
- +y: down
- CropBox offset and PDF `/Rotate` are already applied

For PDF `/Rotate` values 0/90/180/270 degrees clockwise, the CropBox-local to canonical-page matrices are:

```text
O0   = [ 1  0  0
         0 -1  H
         0  0  1 ]

O90  = [ 0  1  0
         1  0  0
         0  0  1 ]

O180 = [-1  0  W
         0  1  0
         0  0  1 ]

O270 = [ 0 -1  H
        -1  0  W
         0  0  1 ]
```

Canonical page dimensions are `W x H` for 0/180 and `H x W` for 90/270.

Thus:

```text
d = O_r C p
```

### R — explicit document region

A governed extraction region is expressed in D coordinates as `(rx, ry, rw, rh)`.

```text
T_R = [ 1  0 -rx
        0  1 -ry
        0  0   1 ]
```

Region selection is explicit evidence. A later governed table-extraction API must require the source hash and explicit source page(s); discovery may suggest pages/regions but may not silently select them for governed extraction.

### I — continuous rendered raster

Raster coordinates use continuous **pixel-edge** coordinates:

```text
outer top-left image edge = (0,0)
pixel (i,j) occupies [i,i+1] x [j,j+1]
pixel center = (i+0.5,j+0.5)
```

For `sx=dpiX/72`, `sy=dpiY/72`:

```text
S = [ sx  0  0
       0 sy  0
       0  0  1 ]
```

Continuous raster mapping before preprocessing is:

```text
i = S T_R O_r C p
```

Integer image allocation (`ceil`, padding, etc.) is recorded separately and must not silently redefine the continuous transform.

### O — OCR/preprocessed raster

Geometry-changing preprocessing operations each create a `SurfaceTransform`:

- crop: translation
- arbitrary rotation / deskew: affine rotation plus required translation/padding
- padding: translation
- resampling: scale

Non-geometric image operations (contrast, threshold, gamma) remain in preprocessing lineage but do not change coordinates.

Let `K` be the composed deskew/rotation/padding affine and `A` the resampling affine. Then:

```text
M_(O<-P) = A K S T_R O_r C
M_(P<-O) = C^-1 O_r^-1 T_R^-1 S^-1 K^-1 A^-1
```

The exact `K` and `A` matrices, not merely an angle or scale factor, are evidence.

### B — browser display

Browser zoom/pan/device-pixel-ratio are display transforms only. Stored overlays remain in their document surface coordinates.

```text
css    = M_(CSS<-D) d
canvas = DPR M_(CSS<-D) d
```

Changing browser zoom never changes evidence geometry or evidence hashes.

## OCR bbox back-projection

If an OCR provider reports an axis-aligned box `(u0,v0,u1,v1)` in O, construct its ordered four corners and transform **all four** with `M_(P<-O)` or the required target-surface transform.

After rotation/deskew the authoritative result is an ordered `Quad`/`Polygon`. An axis-aligned bounding box may be cached for spatial indexing but is derived and non-authoritative.

## Provider coordinate convention

A provider must declare whether reported raster geometry uses continuous pixel edges, pixel centers, or another explicitly adapted convention. Unknown convention emits `PROVIDER_PIXEL_CONVENTION_UNKNOWN` and blocks trusted coordinate use.

## Numerical gates

### Continuous transform inversion

Test source/target corners, edge midpoints, center, region corners, and at least 16 deterministic asymmetric interior points.

For continuous coordinates before provider quantization:

```text
max infinity-norm round-trip error <= 0.01 pt in document space
max infinity-norm round-trip error <= 0.25 px in floating raster space
```

The affine 2x2 determinant must be non-zero. Implementations should record a condition number and fail closed for numerically unstable transforms according to the provider profile.

### Quantized observation back-projection

Integer-provider OCR geometry is a different gate. It is not required to recover PDF coordinates within 0.01 pt after quantization.

For provider quantization bound `qPx`:

```text
allowedDocumentError = transformNumericError
                     + qPx * documentUnitsPerPixel
                     + declaredNumericalMargin
```

For ordinary nearest-edge integer quantization, `qPx` is normally 0.5 px. The provider profile must record the actual convention and bound.

## Required failure test

A conformance fixture must include an off-origin CropBox, `/Rotate`, off-origin region crop, non-integer render scale, arbitrary deskew and resampling. Asymmetric fiducials must expose wrong rotation sign, missing crop translation, swapped y-origin, pixel-center/edge mistakes, and incorrect inverse order.
