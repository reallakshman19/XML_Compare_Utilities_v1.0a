import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "docx_to_markdown.py"

DOCUMENT = '''<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>
<w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" name="Picture 1" descr="Pump curve"/><a:graphic><a:graphicData><a:blip r:embed="rId5"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Caption"/></w:pPr><w:r><w:t>Figure 1 - Pump curve</w:t></w:r></w:p>
</w:body></w:document>'''
RELS = '''<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>'''
CONTENT_TYPES = '''<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>'''
IMAGE = b"PNGDATA"


def build_docx(path: Path, extension="png", image=IMAGE):
    document = DOCUMENT.replace("image1.png", f"image1.{extension}")
    relationships = RELS.replace("image1.png", f"image1.{extension}")
    content_types = CONTENT_TYPES.replace('Extension="png" ContentType="image/png"', f'Extension="{extension}" ContentType="image/{extension}"')
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as package:
        package.writestr("[Content_Types].xml", content_types)
        package.writestr("word/document.xml", document)
        package.writestr("word/_rels/document.xml.rels", relationships)
        package.writestr(f"word/media/image1.{extension}", image)


class DocxAssetsIntegrationTest(unittest.TestCase):
    def run_converter(self, extension="png", *args):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "source.docx"
            output = root / "output.md"
            evidence = root / "evidence.json"
            assets = root / "materialized"
            build_docx(source, extension=extension, image=b"EMFDATA" if extension == "emf" else IMAGE)
            command = [
                sys.executable, str(SCRIPT), str(source), "-o", str(output),
                "--evidence", str(evidence), "--assets", str(assets), *args,
            ]
            subprocess.run(command, check=True, capture_output=True, text=True)
            files = {path.name: path.read_bytes() for path in assets.iterdir()} if assets.exists() else {}
            return output.read_text(), json.loads(evidence.read_text()), files

    def test_png_is_hash_named_materialized_and_captioned_in_evidence(self):
        markdown, evidence, files = self.run_converter("png")
        digest = hashlib.sha256(IMAGE).hexdigest()
        filename = f"asset-{digest[:24]}.png"
        self.assertIn(f"![Pump curve](assets/{filename})", markdown)
        self.assertEqual(files[filename], IMAGE)
        self.assertEqual(evidence["assets"][0]["sha256"], digest)
        image = next(item for item in evidence["blocks"][0]["inlines"] if item["kind"] == "image")
        self.assertEqual(image["caption"], "Figure 1 - Pump curve")

    def test_emf_is_extracted_but_not_silently_rendered(self):
        markdown, evidence, files = self.run_converter("emf")
        self.assertIn("⟦IMAGE_UNSUPPORTED:", markdown)
        self.assertEqual(list(files.values()), [b"EMFDATA"])
        self.assertIn("DOCX_IMAGE_FORMAT_UNSUPPORTED", [item["code"] for item in evidence["diagnostics"]])

    def test_skip_policy_emits_marker_and_does_not_materialize_assets(self):
        markdown, evidence, files = self.run_converter("png", "--images", "skip")
        self.assertIn("⟦IMAGE_SKIPPED:", markdown)
        self.assertEqual(files, {})
        self.assertIn("DOCX_IMAGE_SKIPPED_BY_POLICY", [item["code"] for item in evidence["diagnostics"]])


if __name__ == "__main__":
    unittest.main()
