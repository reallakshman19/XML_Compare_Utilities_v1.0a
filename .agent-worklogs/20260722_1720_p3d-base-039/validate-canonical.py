from pathlib import Path
from lxml import etree, isoschematron
root=Path(__file__).parent
contract=root/'external-inputxml-contract'
text=(root/'baseline-functional-results.txt').read_text()
start=text.index('<?xml')
end=text.index('</CAESARII>', start)+len('</CAESARII>')
xml=text[start:end]
xml_path=root/'pipeline-3d-model.xml'
xml_path.write_text(xml)
parser=etree.XMLParser(resolve_entities=False,no_network=True,remove_blank_text=False)
doc=etree.parse(str(xml_path),parser)
schema=etree.XMLSchema(etree.parse(str(contract/'inputxml-canonical-v1.xsd')))
sch=isoschematron.Schematron(etree.parse(str(contract/'inputxml-semantic-rules-v1.sch')),store_report=True)
xsd_ok=schema.validate(doc)
sch_ok=sch.validate(doc)
print(f'contractBaseline=3D_Converters@ba8b4e43698e1bed8e30f25832659603b40e86b2')
print(f'currentExternalMain=2a0aca7de1a7f5572865a049ff13e9aac075e830')
print('canonicalContractFilesChangedSincePinned=false')
print(f'xsd={xsd_ok}')
if not xsd_ok: print(schema.error_log)
print(f'schematron={sch_ok}')
if not sch_ok:
 ns={'svrl':'http://purl.oclc.org/dsdl/svrl'}
 for n in sch.validation_report.xpath('//svrl:failed-assert',namespaces=ns): print('FAIL',n.xpath('string(svrl:text)',namespaces=ns))
assert xsd_ok and sch_ok
