"""Reviewable deterministic PDF/DOCX qualification fixtures."""
from __future__ import annotations
from io import BytesIO
from zipfile import ZIP_STORED, ZipFile, ZipInfo
import xml.etree.ElementTree as ET

W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PR='http://schemas.openxmlformats.org/package/2006/relationships'
CT='http://schemas.openxmlformats.org/package/2006/content-types'
for prefix,uri in [('w',W),('r',R),('',PR)]: ET.register_namespace(prefix,uri)
def q(ns,name): return f'{{{ns}}}{name}'
def child(parent,ns,name,**attrs): return ET.SubElement(parent,q(ns,name),{q(ns,k):str(v) for k,v in attrs.items()})
def text_run(parent,text,tag='t'):
    r=child(parent,W,'r'); t=child(r,W,tag); t.text=text; return r

def controlled_pdf_bytes():
    stream=b'BT\n/F1 12 Tf\n20 95 Td\n(T3-1) Tj\n0 -18 Td\n(10.0 MPa) Tj\nET\n0.5 w\n20 20 m\n50 90 120 10 180 60 c\nS\n20 15 160 65 re S\n'
    objects=(b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 120] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',b'<< /Length %d >>\nstream\n%s\nendstream'%(len(stream),stream),b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    data=bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'); offsets=[]
    for i,obj in enumerate(objects,1): offsets.append(len(data)); data.extend(f'{i} 0 obj\n'.encode()+obj+b'\nendobj\n')
    xref=len(data); data.extend(f'xref\n0 {len(objects)+1}\n'.encode()+b'0000000000 65535 f \n')
    for offset in offsets: data.extend(f'{offset:010d} 00000 n \n'.encode())
    data.extend(f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()); return bytes(data)

def controlled_docx_bytes():
    parts=_docx_parts(); output=BytesIO()
    with ZipFile(output,'w',ZIP_STORED) as archive:
        for name in sorted(parts): archive.writestr(_zip_info(name),parts[name])
    return output.getvalue()

def _docx_parts():
    return {'[Content_Types].xml':_content_types(),'_rels/.rels':_root_rels(),'word/_rels/document.xml.rels':_document_rels(),'word/document.xml':_document_xml(),'word/styles.xml':_styles_xml(),'word/numbering.xml':_numbering_xml(),'word/header1.xml':_story_xml('hdr','Fixture Header'),'word/footer1.xml':_story_xml('ftr','Fixture Footer'),'word/media/image1.png':_png_1x1()}

def _document_xml():
    root=ET.Element(q(W,'document')); body=child(root,W,'body')
    p=child(body,W,'p'); ppr=child(p,W,'pPr'); child(ppr,W,'pStyle',val='Heading1'); text_run(p,'Controlled Evidence Fixture')
    p=child(body,W,'p'); ppr=child(p,W,'pPr'); num=child(ppr,W,'numPr'); child(num,W,'ilvl',val=0); child(num,W,'numId',val=1); text_run(p,'T3-1 = 10.0 MPa')
    link=child(p,W,'hyperlink'); link.set(q(R,'id'),'rId2'); text_run(link,' reference')
    tbl=child(body,W,'tbl'); grid=child(tbl,W,'tblGrid'); child(grid,W,'gridCol',w=2400); child(grid,W,'gridCol',w=2400)
    tr=child(tbl,W,'tr'); tc=child(tr,W,'tc'); tcpr=child(tc,W,'tcPr'); child(tcpr,W,'gridSpan',val=2); text_run(child(tc,W,'p'),'Merged header')
    tr=child(tbl,W,'tr'); tc=child(tr,W,'tc'); tcpr=child(tc,W,'tcPr'); child(tcpr,W,'vMerge',val='restart'); text_run(child(tc,W,'p'),'10.0 MPa'); tc=child(tr,W,'tc'); text_run(child(tc,W,'p'),'Cell B')
    tr=child(tbl,W,'tr'); tc=child(tr,W,'tc'); tcpr=child(tc,W,'tcPr'); child(tcpr,W,'vMerge'); child(tc,W,'p'); tc=child(tr,W,'tc'); p=child(tc,W,'p'); ins=child(p,W,'ins',id=7,author='fixture'); text_run(ins,'Inserted'); dele=child(p,W,'del',id=8,author='fixture'); text_run(dele,'Deleted','delText')
    text_run(child(body,W,'p'),'Image relationship rId3')
    sect=child(body,W,'sectPr'); h=child(sect,W,'headerReference',type='default'); h.set(q(R,'id'),'rId4'); f=child(sect,W,'footerReference',type='default'); f.set(q(R,'id'),'rId5'); child(sect,W,'pgSz',w=12240,h=15840)
    return ET.tostring(root,encoding='utf-8',xml_declaration=True)

def _styles_xml():
    root=ET.Element(q(W,'styles')); normal=child(root,W,'style',type='paragraph',styleId='Normal'); child(normal,W,'name',val='Normal'); h=child(root,W,'style',type='paragraph',styleId='Heading1'); child(h,W,'name',val='heading 1'); child(h,W,'basedOn',val='Normal'); ppr=child(h,W,'pPr'); child(ppr,W,'outlineLvl',val=0); return ET.tostring(root,encoding='utf-8',xml_declaration=True)
def _numbering_xml():
    root=ET.Element(q(W,'numbering')); a=child(root,W,'abstractNum',abstractNumId=0); lvl=child(a,W,'lvl',ilvl=0); child(lvl,W,'start',val=1); child(lvl,W,'numFmt',val='decimal'); child(lvl,W,'lvlText',val='%1.'); n=child(root,W,'num',numId=1); child(n,W,'abstractNumId',val=0); return ET.tostring(root,encoding='utf-8',xml_declaration=True)
def _story_xml(kind,text): root=ET.Element(q(W,kind)); text_run(child(root,W,'p'),text); return ET.tostring(root,encoding='utf-8',xml_declaration=True)
def _root_rels(): return _rels([(1,'officeDocument','word/document.xml',None)])
def _document_rels(): return _rels([(1,'styles','styles.xml',None),(2,'hyperlink','https://example.invalid/evidence','External'),(3,'image','media/image1.png',None),(4,'header','header1.xml',None),(5,'footer','footer1.xml',None),(6,'numbering','numbering.xml',None)])
def _rels(items):
    root=ET.Element(q(PR,'Relationships'))
    for i,kind,target,mode in items:
        attrs={'Id':f'rId{i}','Type':f'http://schemas.openxmlformats.org/officeDocument/2006/relationships/{kind}','Target':target}
        if mode: attrs['TargetMode']=mode
        ET.SubElement(root,q(PR,'Relationship'),attrs)
    return ET.tostring(root,encoding='utf-8',xml_declaration=True)
def _content_types():
    root=ET.Element(q(CT,'Types')); ET.SubElement(root,q(CT,'Default'),{'Extension':'rels','ContentType':'application/vnd.openxmlformats-package.relationships+xml'}); ET.SubElement(root,q(CT,'Default'),{'Extension':'xml','ContentType':'application/xml'}); ET.SubElement(root,q(CT,'Default'),{'Extension':'png','ContentType':'image/png'})
    for part,ctype in [('document','application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'),('styles','application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml'),('numbering','application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml'),('header1','application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml'),('footer1','application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml')]: ET.SubElement(root,q(CT,'Override'),{'PartName':f'/word/{part}.xml','ContentType':ctype})
    return ET.tostring(root,encoding='utf-8',xml_declaration=True)
def _png_1x1(): return bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082')
def _zip_info(name): value=ZipInfo(name,(1980,1,1,0,0,0)); value.compress_type=ZIP_STORED; value.external_attr=0o600<<16; return value
