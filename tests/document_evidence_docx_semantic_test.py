from io import BytesIO
import unittest
from zipfile import ZIP_STORED, ZipFile, ZipInfo

from document_evidence_docx_semantic import DocxSemanticError, semantic_docx_content

DOC = '''<w:document xmlns:w="urn:w" xmlns:w14="urn:w14"><w:body><w:p w:rsidR="AAA" w14:paraId="111"><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>'''
CORE = '''<cp:coreProperties xmlns:cp="urn:cp" xmlns:dcterms="urn:dcterms"><cp:title>Example</cp:title><cp:revision>{revision}</cp:revision><dcterms:modified>{modified}</dcterms:modified></cp:coreProperties>'''
APP = '''<Properties><Application>Word</Application><Pages>{pages}</Pages><Words>{words}</Words></Properties>'''
CUSTOM = '''<Properties><property name="Pressure"><value>{custom}</value></property></Properties>'''


def package(*, text="10.0 MPa", revision="1", modified="2026-01-01", pages="1", words="2", custom="A", timestamp=(2020, 1, 1, 0, 0, 0), reverse=False):
    entries = [
        ("word/document.xml", DOC.format(text=text).encode()),
        ("docProps/core.xml", CORE.format(revision=revision, modified=modified).encode()),
        ("docProps/app.xml", APP.format(pages=pages, words=words).encode()),
        ("docProps/custom.xml", CUSTOM.format(custom=custom).encode()),
        ("word/media/image1.bin", b"image-bytes"),
    ]
    if reverse:
        entries.reverse()
    stream = BytesIO()
    with ZipFile(stream, "w", compression=ZIP_STORED) as archive:
        for name, data in entries:
            info = ZipInfo(name, date_time=timestamp)
            archive.writestr(info, data)
    return stream.getvalue()


class DocxSemanticHashTest(unittest.TestCase):
    def test_zip_order_timestamp_and_editing_noise_do_not_change_semantic_hash(self):
        one = semantic_docx_content(package())
        two = semantic_docx_content(package(revision="99", modified="2030-12-31", pages="9", words="999", timestamp=(2031, 2, 3, 4, 5, 6), reverse=True))
        self.assertEqual(one["semanticContentHash"], two["semanticContentHash"])

    def test_document_text_change_changes_semantic_hash(self):
        self.assertNotEqual(semantic_docx_content(package())["semanticContentHash"], semantic_docx_content(package(text="100 MPa"))["semanticContentHash"])

    def test_custom_property_change_changes_semantic_hash(self):
        self.assertNotEqual(semantic_docx_content(package())["semanticContentHash"], semantic_docx_content(package(custom="B"))["semanticContentHash"])

    def test_missing_document_part_fails_closed(self):
        stream = BytesIO()
        with ZipFile(stream, "w") as archive:
            archive.writestr("docProps/core.xml", b"<x/>")
        with self.assertRaises(DocxSemanticError) as caught:
            semantic_docx_content(stream.getvalue())
        self.assertEqual(caught.exception.code, "DOCX_DOCUMENT_PART_MISSING")


if __name__ == "__main__":
    unittest.main()
