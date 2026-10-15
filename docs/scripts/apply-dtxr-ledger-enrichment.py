from pathlib import Path
import re

PATH = Path('tabs/model-converters/converters/xmltocii2019_helper/enrichment-core.js')


def replace_once(source, old, new, label):
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one exact match, found {count}')
    return source.replace(old, new, 1)


def regex_once(source, pattern, replacement, label):
    output, count = re.subn(pattern, lambda _: replacement, source, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label}: expected one regex match, found {count}')
    return output


source = PATH.read_text()
source = replace_once(
    source,
    "} from '../../../../converters/xml-cii2019-core/support-mapping.js';\n\nexport {",
    "} from '../../../../converters/xml-cii2019-core/support-mapping.js';\nimport {\n  applyXmlCiiDtxrResolutionLedger,\n  buildXmlCiiDtxrResolutionLedger,\n  xmlCiiDtxrLedgerDiagnostics,\n  xmlCiiDtxrLedgerEntryForNode,\n} from '../../../../converters/xml-cii2019-core/dtxr-resolution-ledger.js';\n\nexport {",
    'ledger import',
)

ledger_setup = '''  const dtxrResolutionLedger = buildXmlCiiDtxrResolutionLedger({
    document,
    stagedDtxrPositionIndex,
    stagedDtxrRefIndex,
    stagedSupportIndex,
    config,
  });
  const dtxrLedgerWriteStats = applyXmlCiiDtxrResolutionLedger(document, dtxrResolutionLedger);
  stats.dtxrPosAnnotations += dtxrLedgerWriteStats.dtxrPosAnnotations;
  stats.dtxrPsAnnotations += dtxrLedgerWriteStats.dtxrPsAnnotations;
  stats.dtxrSourceAnnotations = dtxrLedgerWriteStats.dtxrSourceAnnotations;
  stats.dtxrResolutionLedger = dtxrResolutionLedger.summary;
  diagnostics.push(...xmlCiiDtxrLedgerDiagnostics(dtxrResolutionLedger));

'''
marker = "  }\n\n  for (const node of [...document.getElementsByTagName('Node')]) {\n    const componentType = xmlText(node, 'ComponentType').toUpperCase();"
source = replace_once(
    source,
    marker,
    "  }\n\n" + ledger_setup + "  for (const node of [...document.getElementsByTagName('Node')]) {\n    const componentType = xmlText(node, 'ComponentType').toUpperCase();",
    'ledger setup',
)

node_loop = '''  for (const node of [...document.getElementsByTagName('Node')]) {
    const componentType = xmlText(node, 'ComponentType').toUpperCase();
    const ledgerEntry = xmlCiiDtxrLedgerEntryForNode(dtxrResolutionLedger, node);
    const ledgerResolved = ledgerEntry?.status === 'RESOLVED';
    const positionKey = xmlPositionKey(xmlText(node, 'Position'), tolerance);
    const legacyCoordMatches = positionKey ? (stagedSupportIndex.byCoord.get(positionKey) || []) : [];
    const supportTags = xmlNodeSupportTags(node);
    const tagMatches = supportTags.flatMap((tag) => stagedSupportIndex.byTag.get(tag) || []);
    const relaxedTagMatches = tagMatches.length ? [] : relaxedSameDtxrPosSupportMatches(supportTags, legacyCoordMatches);
    const ledgerMatches = ledgerEntry?.effectiveAuthority === 'DTXR_POS_PRIMARY'
      ? (ledgerEntry.supportMatches || [])
      : [];
    const stagedMatches = ledgerMatches.length
      ? ledgerMatches
      : (legacyCoordMatches.length > 0
        ? legacyCoordMatches
        : (tagMatches.length > 0 ? tagMatches : relaxedTagMatches));
    const supportMatchMethod = ledgerMatches.length
      ? 'dtxr-ledger-position-group'
      : (legacyCoordMatches.length > 0
        ? 'dtxr-pos-coordinate'
        : (tagMatches.length > 0
          ? 'dtxr-ps-tag-fallback'
          : (relaxedTagMatches.length > 0 ? 'dtxr-ps-tag-relaxed-fallback' : 'unmatched')));
    const staged = stagedMatches[0] || null;
    const restraints = xmlChildrenByName(node, 'Restraint');
    const combinedTypes = dedupeXmlCiiRestraintEntries(
      stagedMatches.flatMap((match) => xmlCiiRestraintEntriesFromSupportMatch(match, node, config)),
    );

    if (!ledgerResolved) {
      const dtxrPs = xmlCiiDtxrPsForNode(node, stagedComponentIndex);
      if (dtxrPs.text) {
        xmlSetText(document, node, 'DTXR_PS', dtxrPs.text);
        stats.dtxrPsAnnotations += 1;
        diagnostics.push({ type: 'dtxr-ps', nodeNumber: xmlText(node, 'NodeNumber'), nodeName: xmlText(node, 'NodeName'), componentType, tags: dtxrPs.tags.join('|'), count: dtxrPs.values.length, matchedBy: 'DTXR_PS', matchedKey: dtxrPs.tags.join('|'), finalValue: dtxrPs.text, status: 'applied', authority: 'legacy-unresolved-fallback' });
      }
      const dtxrPos = xmlCiiDtxrPosForNode(node, stagedDtxrPositionIndex, config);
      if (dtxrPos.text) {
        xmlSetText(document, node, 'DTXR_POS', dtxrPos.text);
        stats.dtxrPosAnnotations += 1;
        diagnostics.push({ type: 'dtxr-pos', nodeNumber: xmlText(node, 'NodeNumber'), nodeName: xmlText(node, 'NodeName'), componentType, position: xmlText(node, 'Position'), count: dtxrPos.values.length, matchedBy: 'DTXR_POS', matchedKey: xmlText(node, 'Position'), sourcePath: dtxrPos.matchedPath || '', method: 'DTXR_POS exact or within trace tolerance', finalValue: dtxrPos.text, status: 'applied', authority: 'legacy-unresolved-fallback' });
      } else if (!xmlText(node, 'DTXR_POS')) {
        const dtxrRef = resolveXmlCiiNodeDtxr(node, stagedDtxrRefIndex, config);
        if (dtxrRef?.value && dtxrRef.matchedBy === 'component-refno') {
          xmlSetText(document, node, 'DTXR_POS', dtxrRef.value);
          stats.dtxrPosAnnotations += 1;
          diagnostics.push({ type: 'dtxr-pos', nodeNumber: xmlText(node, 'NodeNumber'), nodeName: xmlText(node, 'NodeName'), componentType, matchedBy: 'component-refno', matchedKey: dtxrRef.matchedKey || '', sourcePath: dtxrRef.sourcePath || dtxrRef.matchedKey || '', jsonNodeNo: '', method: `component-refno: ${dtxrRef.matchedKey || ''}`, finalValue: dtxrRef.value, status: 'applied', authority: 'legacy-component-ref-fallback' });
        }
      }
    }

    if (staged) {
      const allKinds = Array.from(new Set(stagedMatches.map((match) => match.kind).filter(Boolean)));
      const xmlTypes = restraints.map((restraint) => xmlText(restraint, 'Type')).filter(Boolean).join('+');
      diagnostics.push({
        type: 'support-match',
        nodeNumber: xmlText(node, 'NodeNumber'),
        nodeName: xmlText(node, 'NodeName'),
        componentType,
        method: supportMatchMethod,
        matchedBy: supportMatchMethod,
        matchedKey: ledgerMatches.length
          ? (ledgerEntry.dtxrPositionPaths || []).join('|')
          : (legacyCoordMatches.length > 0 ? positionKey : supportTags.join('|')),
        kind: allKinds.join('+'),
        xmlRestraintTypes: xmlTypes,
        restraintTypes: combinedTypes.join('+'),
        finalValue: combinedTypes.join('+'),
        stagedName: staged.component?.name || staged.attrs?.NAME || '',
        tags: supportTags,
        dtxrAuthority: ledgerEntry?.effectiveAuthority || 'LEGACY',
        branchRelationship: ledgerEntry?.branchRelationship || '',
        status: 'applied',
      });
    }

    let targetEntries = [];
    if (staged) {
      targetEntries = combinedTypes.length > 0
        ? combinedTypes
        : [config.defaultXmlSupportType || 'Y'];
    } else if (restraints.length) {
      targetEntries = restraints
        .map((restraint) => xmlCiiTypeEntryFromExistingRestraint(restraint, config))
        .filter((entry) => !!entry.type);
    }

    if (componentType === 'ATTA' && targetEntries.length > 0) {
      applyXmlRestraints(document, node, targetEntries, config);
      if (staged) stats.stagedSupportsMapped += 1;
      stats.normalizedRestraints += targetEntries.length;
    } else if (restraints.length) {
      applyXmlRestraints(document, node, targetEntries, config);
      stats.normalizedRestraints += targetEntries.length;
    }
    if (staged) {
      const rating = deriveRatingText(staged.attrs, config, xmlText(node, 'PipingClass'));
      const weight = deriveWeightText(staged.attrs, config);
      const manualRigidWeight = xmlCiiRigidWeightOverrideForNode(
        xmlCiiAncestorBranchName(node),
        node,
        config,
      );
      if (rating) {
        xmlSetText(document, node, 'Rating', rating);
        stats.ratingAnnotations += 1;
      }
      if (weight && manualRigidWeight === null) {
        xmlSetText(document, node, 'Weight', weight);
        stats.weightAnnotations += 1;
      }
    }
  }
'''
source = regex_once(
    source,
    r"  for \(const node of \[\.\.\.document\.getElementsByTagName\('Node'\)\]\) \{\n    const componentType = xmlText\(node, 'ComponentType'\)\.toUpperCase\(\);.*?\n  \}\n\n  const xmlOut =",
    node_loop + "\n  const xmlOut =",
    'authoritative node loop',
)
source = replace_once(
    source,
    "  const diagnosticText = JSON.stringify({ generatedAt: new Date().toISOString(), stats, diagnostics }, null, 2);\n  if (Array.isArray(options._diagOut)) options._diagOut.push(...diagnostics);\n  return { xmlText: xmlOut, stats, config, diagnostics, diagnosticRows: diagnosticRowsForTable(diagnostics), diagnosticText };",
    "  const dtxrResolutionLedgerAudit = {\n    schema: dtxrResolutionLedger.schema,\n    summary: dtxrResolutionLedger.summary,\n    entries: dtxrResolutionLedger.entries.map(({ nodeElement: _node, supportMatches = [], ...entry }) => ({ ...entry, supportMatchCount: supportMatches.length })),\n  };\n  const diagnosticText = JSON.stringify({ generatedAt: new Date().toISOString(), stats, diagnostics, dtxrResolutionLedger: dtxrResolutionLedgerAudit }, null, 2);\n  if (Array.isArray(options._diagOut)) options._diagOut.push(...diagnostics);\n  return { xmlText: xmlOut, stats, config, diagnostics, diagnosticRows: diagnosticRowsForTable(diagnostics), diagnosticText, dtxrResolutionLedger: dtxrResolutionLedgerAudit };",
    'ledger result export',
)
PATH.write_text(source)
print(f'patched {PATH}')
