"""Pinned-Pillow scanned PDF qualification fixture."""
from __future__ import annotations


def scanned_pdf_bytes() -> bytes:
    from PIL import Image, ImageDraw, ImageFont

    image = Image.new("L", (600, 180), 235)
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=72)
    draw.text((45, 45), "10.0 MPa", font=font, fill=165)
    image = image.rotate(2.75, resample=Image.Resampling.BICUBIC, expand=False, fillcolor=235)
    raw = image.tobytes()
    content = b"q\n600 0 0 180 10 10 cm\n/Im0 Do\nQ\n"
    objects = (
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 620 200] /CropBox [10 10 610 190] /Rotate 90 /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length %d >>\nstream\n%s\nendstream" % (len(content), content),
        b"<< /Type /XObject /Subtype /Image /Width 600 /Height 180 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length %d >>\nstream\n" % len(raw) + raw + b"\nendstream",
    )
    data = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for index, value in enumerate(objects, 1):
        offsets.append(len(data))
        data.extend(f"{index} 0 obj\n".encode("ascii") + value + b"\nendobj\n")
    xref = len(data)
    data.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii") + b"0000000000 65535 f \n")
    for offset in offsets:
        data.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    data.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode("ascii"))
    return bytes(data)
