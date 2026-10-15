import hashlib
import sys
import tempfile
import unittest
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from document_model import DocumentModel, InlineImage, InlineText, ParagraphBlock, SourceRef
from docx_assets import enrich_document_assets, materialize_assets, prepare_package_for_assets

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
DOC = '''<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>
<w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" name="Picture 1" descr="Pump curve"/><a:graphic><a:graphicData><a:blip r:embed="rId5"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Caption"/></w:pPr><w:r><w:t>Figure 1 - Pump curve</w:t></w:r></w:p>
</w:body></w:document>'''


@dataclass(frozen=True)
class Relationship:
    resolved_part: str | None
    is_external: bool = False


@dataclass(frozen=True)
class Package:
    parts: dict
    crc32: dict
    relationships_by_part: dict
    content_types: dict

    def xml(self, part):
        value = self.parts.get(part)
        return ET.fromstring(value) if value is not None else None

    def relationship(self, part, relationship_id):
        return self.relationships_by_part.get(part, {}).get(relationship_id)

    def part_bytes(self, part):
        return self.parts.get(part)

    def content_type(self, part):
        return self.content_types.get(part)


def package(extension="png", payload=b"PNGDATA", external=False):
    media = f"word/media/image1.{extension}"
    rel = Relationship(None if external else media, external)
    return Package(
        {"word/document.xml": DOC.encode(), media: payload},
        {"word/document.xml": 1},
        {"word/document.xml": {"rId5": rel}},
        {media: f"image/{extension}"},
    )


def parsed_document(prepared):
    root = prepared.xml("word/document.xml")
    paragraph = root.find(".//" + W + "p")
    inlines = tuple(InlineText(node.text or "") for node in paragraph.iter(W + "t"))
    text = "".join(value.text for value in inlines)
    block = ParagraphBlock(
        "p0", text, SourceRef("docx", "word/document.xml", paragraph_index=0),
        inlines=inlines,
    )
    return DocumentModel("docx", (block,))


class DocxAssetsTest(unittest.TestCase):
    def test_embedded_png_has_deterministic_identity_alt_and_caption(self):
        prepared, drawings, assets, payloads, diagnostics = prepare_package_for_assets(package())
        self.assertEqual(len(assets), 1)
        digest = hashlib.sha256(b"PNGDATA").hexdigest()
        self.assertEqual(assets[0].asset_id, f"sha256-{digest[:24]}")
        self.assertEqual(assets[0].filename, f"asset-{digest[:24]}.png")
        self.assertTrue(assets[0].render_supported)
        self.assertEqual(drawings[0]["altText"], "Pump curve")
        self.assertEqual(drawings[0]["caption"], "Figure 1 - Pump curve")
        self.assertEqual(payloads[assets[0].asset_id], b"PNGDATA")
        self.assertEqual(diagnostics, ())
        enriched = enrich_document_assets(parsed_document(prepared), drawings, assets, diagnostics)
        image = next(value for value in enriched.blocks[0].inlines if isinstance(value, InlineImage))
        self.assertEqual(image.filename, assets[0].filename)
        self.assertEqual(image.caption, "Figure 1 - Pump curve")

    def test_caption_does_not_cross_parent_container_boundary(self):
        doc = DOC.replace(
            '<w:p><w:r><w:drawing>',
            '<w:tbl><w:tr><w:tc><w:p><w:r><w:drawing>',
        ).replace(
            '</w:drawing></w:r></w:p>\n<w:p><w:pPr><w:pStyle w:val="Caption"',
            '</w:drawing></w:r></w:p></w:tc></w:tr></w:tbl>\n<w:p><w:pPr><w:pStyle w:val="Caption"',
            1,
        )
        pkg = package()
        pkg = Package(
            {**pkg.parts, "word/document.xml": doc.encode()},
            pkg.crc32, pkg.relationships_by_part, pkg.content_types,
        )
        _, drawings, _, _, _ = prepare_package_for_assets(pkg)
        self.assertIsNone(drawings[0]["caption"])

    def test_unreplaceable_drawing_emits_tokenization_diagnostic(self):
        doc = DOC.replace(
            '<w:r><w:drawing>', '<w:r><w:smartTag><w:drawing>', 1
        ).replace(
            '</w:drawing></w:r></w:p>', '</w:drawing></w:smartTag></w:r></w:p>', 1
        )
        pkg = package()
        pkg = Package(
            {**pkg.parts, "word/document.xml": doc.encode()},
            pkg.crc32, pkg.relationships_by_part, pkg.content_types,
        )
        _, _, _, _, diagnostics = prepare_package_for_assets(pkg)
        self.assertIn(
            "DOCX_DRAWING_TOKENIZATION_FAILED",
            [item["code"] for item in diagnostics],
        )

    def test_unsupported_emf_is_preserved_and_diagnosed(self):
        _, _, assets, payloads, diagnostics = prepare_package_for_assets(package("emf", b"EMFDATA"))
        self.assertFalse(assets[0].render_supported)
        self.assertIn("DOCX_IMAGE_FORMAT_UNSUPPORTED", [item["code"] for item in diagnostics])
        with tempfile.TemporaryDirectory() as tmp:
            written = materialize_assets(assets, payloads, Path(tmp))
            self.assertEqual(written[0].read_bytes(), b"EMFDATA")

    def test_external_image_is_not_fetched_or_invented(self):
        _, drawings, assets, payloads, diagnostics = prepare_package_for_assets(package(external=True))
        self.assertEqual(assets, ())
        self.assertEqual(payloads, {})
        self.assertIsNone(drawings[0]["assetId"])
        self.assertIn("DOCX_EXTERNAL_IMAGE_NOT_FETCHED", [item["code"] for item in diagnostics])

    def test_materialization_is_idempotent(self):
        _, _, assets, payloads, _ = prepare_package_for_assets(package())
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            first = materialize_assets(assets, payloads, root)
            second = materialize_assets(assets, payloads, root)
            self.assertEqual(first, second)
            self.assertEqual(first[0].read_bytes(), b"PNGDATA")


if __name__ == "__main__":
    unittest.main()
