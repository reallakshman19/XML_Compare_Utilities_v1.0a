import { expect, test } from '@playwright/test';

test('CII Writer2 pinned native V14 target projects only qualified RESTRAINT delta', async ({ page }) => {
  await page.goto('/tests/browser/cii-writer2-bridge-fixture.html');
  await expect(page.locator('[data-cii-writer2-bridge-fixture="1"]')).toBeVisible();

  const result = await page.evaluate(async () => {
    const [{ decodeCiiNumericRow }, core, intake, topology, physical, restraintWriter, scope, bridge, converter] = await Promise.all([
      import('/parser/fixed-field.js'),
      import('/tabs/cii-workspace/cii-workspace-core.js'),
      import('/tabs/cii-workspace/cii-workspace-intake.js'),
      import('/tabs/cii-workspace/cii-workspace-topology-adapter.js'),
      import('/tabs/cii-workspace/cii-workspace-physical-file.js'),
      import('/tabs/cii-workspace/cii-workspace-writer2-composite-restraint.js'),
      import('/tabs/cii-workspace/cii-workspace-transfer-scope.js'),
      import('/tabs/cii-workspace/cii-workspace-writer-version-bridge.js'),
      import('/tabs/cii-workspace/cii-workspace-v11-v14-converter.js'),
    ]);

    const { applyCiiWorkspaceTargetWriter2 } = core;
    const { intakeCiiWorkspaceDocument } = intake;
    const { adaptCiiDocumentToTopologyGraph } = topology;
    const { ciiPhysicalSectionRows } = physical;
    const { applyCiiWriter2CompositeWithRestraintDelete } = restraintWriter;
    const {
      bindCiiTransferScopeToPreview,
      ciiTransferScopeCandidateOperations,
      createCiiTransferScopeSelection,
    } = scope;
    const {
      applyCiiWorkspaceTargetWriter2WithVersionBridge,
      createCiiWorkspacePreviewWithVersionBridge,
    } = bridge;
    const {
      ciiByteStringToBytes,
      ciiBytesEqual,
      ciiSha256,
      convertCiiNeutralVersionLossless,
      detectCiiNeutralVersion,
    } = converter;

    const UPSTREAM_COMMIT = 'ca8d391ac5f829f53bebb3c37adf0547c34a67b4';
    const ARCHIVE_URL = `https://raw.githubusercontent.com/reallaksh19/3D_Converters/${UPSTREAM_COMMIT}/Benchmarks/v11-v14.zip`;
    const ARCHIVE_GIT_BLOB_SHA1 = '8409e1c429665e34a83c2a464665ebf5d5f1b0a1';
    const NATIVE_MEMBER = 'SYS-0001-v14.CII';
    const NATIVE_V14_SHA256 = 'd2d4316309d9b1aa34b55ad72f89193fd0e437930db203fecd9ede00e69b2faf';
    const BLOCK_ROWS = 24;
    const SLOT_ROWS = 4;
    const SLOTS = 6;
    const SOURCE_SHA = '4'.repeat(64);
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8', { fatal: true });

    function hex(bytes) {
      return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
    }
    async function digestHex(algorithm, bytes) {
      return hex(new Uint8Array(await crypto.subtle.digest(algorithm, bytes)));
    }
    async function gitBlobSha1(bytes) {
      const header = encoder.encode(`blob ${bytes.byteLength}\0`);
      const payload = new Uint8Array(header.byteLength + bytes.byteLength);
      payload.set(header, 0);
      payload.set(bytes, header.byteLength);
      return digestHex('SHA-1', payload);
    }
    function u16(view, offset) {
      return view.getUint16(offset, true);
    }
    function u32(view, offset) {
      return view.getUint32(offset, true);
    }
    async function inflateZipMember(zipBytes, memberName) {
      const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
      const minimumEocd = Math.max(0, zipBytes.byteLength - 65_557);
      let eocd = -1;
      for (let offset = zipBytes.byteLength - 22; offset >= minimumEocd; offset -= 1) {
        if (u32(view, offset) === 0x06054b50) {
          eocd = offset;
          break;
        }
      }
      if (eocd < 0) throw new Error('W2_NATIVE_V14_ZIP_EOCD_REQUIRED');
      const entryCount = u16(view, eocd + 10);
      let cursor = u32(view, eocd + 16);
      for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
        if (u32(view, cursor) !== 0x02014b50) throw new Error(`W2_NATIVE_V14_ZIP_CENTRAL_HEADER_REQUIRED:${entryIndex}`);
        const method = u16(view, cursor + 10);
        const compressedSize = u32(view, cursor + 20);
        const uncompressedSize = u32(view, cursor + 24);
        const nameLength = u16(view, cursor + 28);
        const extraLength = u16(view, cursor + 30);
        const commentLength = u16(view, cursor + 32);
        const localOffset = u32(view, cursor + 42);
        const nameStart = cursor + 46;
        const name = decoder.decode(zipBytes.subarray(nameStart, nameStart + nameLength));
        if (name === memberName) {
          if (u32(view, localOffset) !== 0x04034b50) throw new Error('W2_NATIVE_V14_ZIP_LOCAL_HEADER_REQUIRED');
          const localMethod = u16(view, localOffset + 8);
          if (localMethod !== method) throw new Error(`W2_NATIVE_V14_ZIP_METHOD_MISMATCH:${localMethod}:${method}`);
          const localNameLength = u16(view, localOffset + 26);
          const localExtraLength = u16(view, localOffset + 28);
          const dataStart = localOffset + 30 + localNameLength + localExtraLength;
          const compressed = zipBytes.slice(dataStart, dataStart + compressedSize);
          let output;
          if (method === 0) {
            output = compressed;
          } else if (method === 8) {
            if (typeof DecompressionStream !== 'function') throw new Error('W2_NATIVE_V14_DEFLATE_RUNTIME_REQUIRED');
            const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
            output = new Uint8Array(await new Response(stream).arrayBuffer());
          } else {
            throw new Error(`W2_NATIVE_V14_ZIP_METHOD_UNSUPPORTED:${method}`);
          }
          if (output.byteLength !== uncompressedSize) {
            throw new Error(`W2_NATIVE_V14_ZIP_MEMBER_SIZE_MISMATCH:${output.byteLength}:${uncompressedSize}`);
          }
          return output;
        }
        cursor += 46 + nameLength + extraLength + commentLength;
      }
      throw new Error(`W2_NATIVE_V14_ZIP_MEMBER_REQUIRED:${memberName}`);
    }
    function parseV14Sections(bytes, label) {
      const text = decoder.decode(bytes);
      if (!text.endsWith('\r\n')) throw new Error(`W2_NATIVE_V14_${label}_FINAL_CRLF_REQUIRED`);
      const body = text.slice(0, -2);
      if (/(^|[^\r])\n|\r(?!\n)/.test(body)) throw new Error(`W2_NATIVE_V14_${label}_CRLF_ONLY_REQUIRED`);
      const sections = [];
      let current = null;
      for (const line of body ? body.split('\r\n') : []) {
        const match = /^#\$\s+([A-Z0-9_&]+)\s*$/.exec(line);
        if (match) {
          current = { name: match[1], header: line, rows: [] };
          sections.push(current);
          continue;
        }
        if (!current) throw new Error(`W2_NATIVE_V14_${label}_CONTENT_BEFORE_SECTION`);
        current.rows.push(line);
      }
      return sections;
    }
    function sectionByName(sections, name, label) {
      const section = sections.find((item) => item.name === name);
      if (!section) throw new Error(`W2_NATIVE_V14_${label}_SECTION_REQUIRED:${name}`);
      return section;
    }
    function fixedI13(row, fieldIndex, label) {
      const start = 2 + 13 * fieldIndex;
      if (row.length < start + 13) throw new Error(`W2_NATIVE_V14_${label}_I13_WIDTH_REQUIRED:${row.length}:${fieldIndex}`);
      return row.slice(start, start + 13);
    }
    function integerI13(cell, label) {
      const token = String(cell).trim();
      if (!/^[+-]?\d+$/.test(token)) throw new Error(`W2_NATIVE_V14_${label}_LEXICAL_I13_REQUIRED:${JSON.stringify(cell)}`);
      const value = Number(token);
      if (!Number.isSafeInteger(value) || value < 0) throw new Error(`W2_NATIVE_V14_${label}_NONNEGATIVE_I13_REQUIRED:${token}`);
      return value;
    }
    function assertUnrelatedNativeSectionsUntouched(beforeSections, afterSections) {
      if (beforeSections.length !== afterSections.length) throw new Error('W2_NATIVE_V14_SECTION_COUNT_CHANGED');
      const allowed = new Set(['CONTROL', 'ELEMENTS', 'RESTRANT']);
      for (let index = 0; index < beforeSections.length; index += 1) {
        const before = beforeSections[index];
        const after = afterSections[index];
        if (before.name !== after.name) throw new Error(`W2_NATIVE_V14_SECTION_ORDER_CHANGED:${index}:${before.name}:${after.name}`);
        if (allowed.has(before.name)) continue;
        if (before.header !== after.header || before.rows.length !== after.rows.length) {
          throw new Error(`W2_NATIVE_V14_UNRELATED_SECTION_SHAPE_CHANGED:${before.name}`);
        }
        for (let rowIndex = 0; rowIndex < before.rows.length; rowIndex += 1) {
          if (before.rows[rowIndex] !== after.rows[rowIndex]) {
            throw new Error(`W2_NATIVE_V14_UNRELATED_SECTION_BYTE_DRIFT:${before.name}:${rowIndex}`);
          }
        }
      }
    }
    function prefixedText(row) {
      const match = String(row ?? '').match(/^\s*(\d+)\s?(.*)$/);
      if (!match) return null;
      return String(match[2] || '').slice(0, Number(match[1]));
    }
    function slotState(rows, pointer, slot) {
      const base = (pointer - 1) * BLOCK_ROWS + (slot - 1) * SLOT_ROWS;
      if (base < 0 || base + 3 >= rows.length) return null;
      const first = decodeCiiNumericRow(rows[base].text);
      const second = decodeCiiNumericRow(rows[base + 1].text);
      if (!Array.isArray(first) || first.length < 6 || !Array.isArray(second) || second.length < 3) return null;
      const line1 = first.slice(0, 6).map(Number);
      const line2 = second.slice(0, 3).map(Number);
      if (![...line1, ...line2].every(Number.isFinite)) return null;
      const tag = prefixedText(rows[base + 2].text);
      const guid = prefixedText(rows[base + 3].text);
      if (tag == null || guid == null) return null;
      return Object.freeze({
        pointer,
        slot,
        line1: Object.freeze(line1),
        line2: Object.freeze(line2),
        tag,
        guid,
        occupied: !(Math.abs(line1[0]) <= 1e-12 && Math.abs(line1[1]) <= 1e-12),
      });
    }
    function ownersForPointer(document, pointer) {
      return Object.values(document?.auxiliaryEvidence?.elements || {})
        .filter((item) => Number(item?.pointers?.restraint || 0) === pointer)
        .sort((a, b) => Number(a.parsedElementIndex) - Number(b.parsedElementIndex));
    }
    function chooseRealDeleteCandidate(document) {
      const rows = ciiPhysicalSectionRows(document.physicalFile, 'RESTRANT');
      if (rows.length % BLOCK_ROWS !== 0) throw new Error('W2_NATIVE_V14_RESTRANT_BLOCK_SHAPE_REQUIRED');
      for (let pointer = 1; pointer <= rows.length / BLOCK_ROWS; pointer += 1) {
        const states = Array.from({ length: SLOTS }, (_, index) => slotState(rows, pointer, index + 1));
        if (states.some((item) => !item || item.tag || item.guid)) continue;
        const occupied = states.filter((item) => item.occupied);
        if (occupied.length !== 1) continue;
        const owners = ownersForPointer(document, pointer);
        if (owners.length !== 1) continue;
        const state = occupied[0];
        const node = String(Math.round(state.line1[0]));
        if (node !== String(owners[0].from) && node !== String(owners[0].to)) continue;
        const nodeRecords = document?.auxiliaryEvidence?.restraints?.byNode?.[node] || [];
        if (nodeRecords.length !== 1) continue;
        return Object.freeze({ pointer, slot: state.slot, targetNode: node, beforeSlot: state });
      }
      throw new Error('W2_NATIVE_V14_REAL_DELETE_CANDIDATE_REQUIRED');
    }
    function deleteOperation(candidate) {
      const mutation = Object.freeze({
        schema: 'CIIWorkspaceRestraintSlotMutation.v1',
        status: 'QUALIFIED',
        mode: 'CLEAR',
        authority: 'PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_EMPTY_SLOT_TEMPLATE',
        pointer: candidate.pointer,
        slot: candidate.slot,
        targetNode: candidate.targetNode,
        beforeSlot: candidate.beforeSlot,
      });
      return Object.freeze({
        operationId: `W2-V14-NATIVE-DELETE-P${candidate.pointer}-S${candidate.slot}`,
        family: 'RESTRAINT',
        property: 'Qualified restraint slot mutation',
        action: 'DELETE',
        status: 'PREVIEW_READY',
        scopeDecision: 'APPLY',
        policyAuthority: 'CII_WRITER_1B_EXISTING_BLOCK_FIXED_SLOT',
        matchAuthority: Object.freeze({ status: 'REVIEWED' }),
        sourceEvidence: Object.freeze({ value: mutation }),
        proposed: mutation,
      });
    }
    function boundSeedPlan(targetDocument, operation) {
      const id = operation.operationId;
      return Object.freeze({
        status: 'PREVIEW_READY',
        blockers: Object.freeze([]),
        sourceDocument: Object.freeze({ fileName: 'CONTROLLED_NATIVE_GATE_V11_SOURCE', contentSha256: SOURCE_SHA }),
        targetDocument: Object.freeze({ fileName: targetDocument.fileName, contentSha256: targetDocument.contentSha256 }),
        operations: Object.freeze([operation]),
        excludedOperations: Object.freeze([]),
        transferScope: Object.freeze({
          schema: 'CIIWorkspaceTransferScope.v1',
          mode: 'EXPLICIT_APPLY_EXCLUDE',
          status: 'BOUND',
          authority: 'USER_EXPLICIT_OPERATION_SCOPE',
          scopeId: `W2-V14-NATIVE-SEED:${id}`,
          sourceSha256: SOURCE_SHA,
          targetSha256: targetDocument.contentSha256,
          candidateOperationIds: Object.freeze([id]),
          appliedOperationIds: Object.freeze([id]),
          excludedOperationIds: Object.freeze([]),
          appliedOperationCount: 1,
          excludedOperationCount: 0,
        }),
      });
    }

    const archiveResponse = await fetch(ARCHIVE_URL, { cache: 'no-store', mode: 'cors' });
    if (!archiveResponse.ok) throw new Error(`W2_NATIVE_V14_ARCHIVE_HTTP:${archiveResponse.status}`);
    const archiveBytes = new Uint8Array(await archiveResponse.arrayBuffer());
    const archiveGitBlobSha1 = await gitBlobSha1(archiveBytes);
    if (archiveGitBlobSha1 !== ARCHIVE_GIT_BLOB_SHA1) {
      throw new Error(`W2_NATIVE_V14_ARCHIVE_GIT_BLOB_MISMATCH:${archiveGitBlobSha1}`);
    }
    const nativeV14Bytes = await inflateZipMember(archiveBytes, NATIVE_MEMBER);
    const nativeV14Sha256 = await digestHex('SHA-256', nativeV14Bytes);
    if (nativeV14Sha256 !== NATIVE_V14_SHA256) {
      throw new Error(`W2_NATIVE_V14_MEMBER_SHA256_MISMATCH:${nativeV14Sha256}`);
    }
    if (detectCiiNeutralVersion(nativeV14Bytes) !== 14) throw new Error('W2_NATIVE_V14_MEMBER_VERSION_REQUIRED');

    const normalizedTarget = await convertCiiNeutralVersionLossless(nativeV14Bytes, 11, {
      fileName: NATIVE_MEMBER,
      cryptoRef: crypto,
    });
    const normalizedDocument = await intakeCiiWorkspaceDocument(normalizedTarget.outputBytes, 'SYS-0001-v14.normalized-v11.CII', {
      side: 'TARGET', cryptoRef: crypto,
    });
    const normalizedGraph = adaptCiiDocumentToTopologyGraph(normalizedDocument);
    const candidate = chooseRealDeleteCandidate(normalizedDocument);
    const seed = applyCiiWriter2CompositeWithRestraintDelete({
      targetDocument: normalizedDocument,
      targetGraph: normalizedGraph,
      transferPlan: boundSeedPlan(normalizedDocument, deleteOperation(candidate)),
    });
    if (seed.status !== 'APPLIED') throw new Error(`W2_NATIVE_V14_SEED_NOT_APPLIED:${seed.status}`);

    const generatedSourceV14 = await convertCiiNeutralVersionLossless(seed.bytes, 14, {
      fileName: 'W2_NATIVE_GATE_SOURCE_V11.CII',
      cryptoRef: crypto,
    });
    const canonicalTargetV14 = await convertCiiNeutralVersionLossless(normalizedTarget.outputBytes, 14, {
      fileName: 'SYS-0001-v14.normalized-v11.CII',
      cryptoRef: crypto,
    });
    if (ciiBytesEqual(nativeV14Bytes, canonicalTargetV14.outputBytes)) {
      throw new Error('W2_NATIVE_V14_FIXTURE_MUST_RETAIN_NONCANONICAL_NATIVE_BYTES');
    }

    const policy = Object.freeze({
      writerVersion: '2',
      cryptoRef: crypto,
      spatialToleranceMm: 1,
      diameterToleranceRatio: 0.01,
      wallToleranceRatio: 0.01,
      identityWeight: 50,
      diameterWeight: 30,
      wallWeight: 30,
      winnerGap: 8,
    });
    const initialPreview = await createCiiWorkspacePreviewWithVersionBridge({
      sourceBytes: generatedSourceV14.outputBytes,
      sourceFileName: 'W2_NATIVE_GATE_SOURCE_GENERATED_V14.CII',
      targetBytes: nativeV14Bytes,
      targetFileName: NATIVE_MEMBER,
      anchorPairs: [{ sourceNodeId: candidate.targetNode, targetNodeId: candidate.targetNode }],
    }, policy);
    if (initialPreview.versionBridge?.source?.originalVersion !== 14
      || initialPreview.versionBridge?.target?.originalVersion !== 14) {
      throw new Error('W2_NATIVE_V14_BRIDGE_ORIGINAL_VERSION_EVIDENCE_REQUIRED');
    }
    if (initialPreview.versionBridge?.target?.originalSha256 !== NATIVE_V14_SHA256) {
      throw new Error(`W2_NATIVE_V14_PREVIEW_TARGET_SHA_MISMATCH:${initialPreview.versionBridge?.target?.originalSha256}`);
    }

    const productOperation = (initialPreview.transferPlan?.operations || []).find((operation) =>
      operation.family === 'RESTRAINT'
      && operation.property === 'Qualified restraint slot mutation'
      && operation.action === 'DELETE');
    if (!productOperation) throw new Error(`W2_NATIVE_V14_PRODUCT_DELETE_REQUIRED:${initialPreview.transferPlan?.blockers?.join('|') || ''}`);
    if (productOperation.status !== 'PREVIEW_READY') {
      throw new Error(`W2_NATIVE_V14_PRODUCT_DELETE_NOT_READY:${productOperation.blockers?.join('|') || ''}`);
    }

    const decisions = Object.fromEntries(
      ciiTransferScopeCandidateOperations(initialPreview.transferPlan)
        .filter((operation) => operation.action !== 'KEEP')
        .map((operation) => [operation.operationId, operation.operationId === productOperation.operationId ? 'APPLY' : 'EXCLUDE']),
    );
    const selection = createCiiTransferScopeSelection(initialPreview.transferPlan, decisions);
    const preview = bindCiiTransferScopeToPreview(initialPreview, selection);
    if (preview.transferScope?.status !== 'BOUND') throw new Error('W2_NATIVE_V14_BOUND_SCOPE_REQUIRED');
    if (preview.writerReadiness?.ready !== true) {
      throw new Error(`W2_NATIVE_V14_WRITER2_NOT_READY:${preview.writerReadiness?.blockers?.join('|') || ''}`);
    }

    const directV11 = await applyCiiWorkspaceTargetWriter2(preview, normalizedTarget.outputBytes, { cryptoRef: crypto });
    if (directV11.status !== 'PASS' || directV11.validation?.status !== 'PASS') {
      throw new Error('W2_NATIVE_V14_DIRECT_V11_PRODUCT_PASS_REQUIRED');
    }

    let staleNativeRejected = false;
    try {
      await applyCiiWorkspaceTargetWriter2WithVersionBridge(preview, canonicalTargetV14.outputBytes, { cryptoRef: crypto });
    } catch (error) {
      staleNativeRejected = /STALE_ORIGINAL_V14_TARGET_HASH/.test(String(error?.message || error));
    }
    if (!staleNativeRejected) throw new Error('W2_NATIVE_V14_STALE_CANONICAL_TARGET_MUST_REJECT');

    const appliedV14 = await applyCiiWorkspaceTargetWriter2WithVersionBridge(preview, nativeV14Bytes, { cryptoRef: crypto });
    if (appliedV14.status !== 'PASS') throw new Error(`W2_NATIVE_V14_BRIDGE_PRODUCT_NOT_PASS:${appliedV14.status}`);
    const bridgeValidation = appliedV14.versionBridgeValidation;
    if (bridgeValidation?.status !== 'PASS') throw new Error('W2_NATIVE_V14_BRIDGE_VALIDATION_PASS_REQUIRED');
    if (bridgeValidation?.path !== 'V14_CHANGE_ISOLATED_VIA_V11') {
      throw new Error(`W2_NATIVE_V14_BRIDGE_PATH_MISMATCH:${bridgeValidation?.path}`);
    }
    if (bridgeValidation?.projectedNormalizedPostimageExact !== true) {
      throw new Error('W2_NATIVE_V14_PROJECTED_NORMALIZED_POSTIMAGE_EXACT_REQUIRED');
    }
    if (bridgeValidation?.originalTargetSha256 !== NATIVE_V14_SHA256) {
      throw new Error(`W2_NATIVE_V14_APPLY_TARGET_SHA_MISMATCH:${bridgeValidation?.originalTargetSha256}`);
    }

    const appliedV14Bytes = ciiByteStringToBytes(appliedV14.byteString);
    if (detectCiiNeutralVersion(appliedV14Bytes) !== 14) throw new Error('W2_NATIVE_V14_OUTPUT_VERSION_14_REQUIRED');
    const beforeSections = parseV14Sections(nativeV14Bytes, 'ORIGINAL');
    const afterSections = parseV14Sections(appliedV14Bytes, 'FINAL');
    assertUnrelatedNativeSectionsUntouched(beforeSections, afterSections);

    const beforeControl = sectionByName(beforeSections, 'CONTROL', 'ORIGINAL');
    const afterControl = sectionByName(afterSections, 'CONTROL', 'FINAL');
    if (beforeControl.rows.length < 3 || afterControl.rows.length < 3) throw new Error('W2_NATIVE_V14_CONTROL_ROWS_REQUIRED');
    const beforeNonamRaw = fixedI13(beforeControl.rows[0], 3, 'ORIGINAL_NONAM');
    const afterNonamRaw = fixedI13(afterControl.rows[0], 3, 'FINAL_NONAM');
    if (beforeNonamRaw !== afterNonamRaw) throw new Error('W2_NATIVE_V14_1042_NONAM_RAW_I13_DRIFT');
    const beforeRestraintCount = integerI13(fixedI13(beforeControl.rows[1], 3, 'ORIGINAL_RESTRAINTS'), 'ORIGINAL_RESTRAINTS');
    const afterRestraintCount = integerI13(fixedI13(afterControl.rows[1], 3, 'FINAL_RESTRAINTS'), 'FINAL_RESTRAINTS');
    if (afterRestraintCount !== beforeRestraintCount - 1) {
      throw new Error(`W2_NATIVE_V14_RESTRAINT_COUNT_DELTA:${beforeRestraintCount}:${afterRestraintCount}`);
    }
    const beforeSifRaw = fixedI13(beforeControl.rows[2], 4, 'ORIGINAL_SIF');
    const afterSifRaw = fixedI13(afterControl.rows[2], 4, 'FINAL_SIF');
    if (beforeSifRaw !== afterSifRaw) throw new Error('W2_NATIVE_V14_SIF_CONTROL_RAW_I13_DRIFT');

    const beforeRestrant = sectionByName(beforeSections, 'RESTRANT', 'ORIGINAL');
    const afterRestrant = sectionByName(afterSections, 'RESTRANT', 'FINAL');
    if (beforeRestrant.rows.length - afterRestrant.rows.length !== BLOCK_ROWS) {
      throw new Error(`W2_NATIVE_V14_RESTRANT_ROW_DELTA:${beforeRestrant.rows.length}:${afterRestrant.rows.length}`);
    }

    const claims = bridgeValidation?.fixedFieldAuthority?.claims || [];
    const allowedClaimIdentities = new Set(['CONTROL_RESTRAINT_BLOCK_COUNT', 'ELEMENT_RESTRAINT_POINTER']);
    for (const claim of claims) {
      if (!allowedClaimIdentities.has(claim.fieldIdentity)) {
        throw new Error(`W2_NATIVE_V14_FIXED_FIELD_CLAIM_NOT_RESTRAINT_ONLY:${claim.fieldIdentity}`);
      }
    }
    const restraintControlClaims = claims.filter((claim) => claim.fieldIdentity === 'CONTROL_RESTRAINT_BLOCK_COUNT');
    const restraintPointerClaims = claims.filter((claim) => claim.fieldIdentity === 'ELEMENT_RESTRAINT_POINTER');
    if (restraintControlClaims.length !== 1) {
      throw new Error(`W2_NATIVE_V14_RESTRAINT_CONTROL_CLAIM_COUNT:${restraintControlClaims.length}`);
    }
    if (!restraintPointerClaims.length) throw new Error('W2_NATIVE_V14_RESTRAINT_POINTER_CLAIM_REQUIRED');
    const restraintControlClaim = restraintControlClaims[0];
    if (restraintControlClaim.before !== beforeRestraintCount || restraintControlClaim.after !== afterRestraintCount) {
      throw new Error('W2_NATIVE_V14_RESTRAINT_CONTROL_CLAIM_VALUE_MISMATCH');
    }

    const changedSections = [...(bridgeValidation?.changedV14Sections || [])].sort();
    if (JSON.stringify(changedSections) !== JSON.stringify(['CONTROL', 'ELEMENTS', 'RESTRANT'])) {
      throw new Error(`W2_NATIVE_V14_CHANGED_SECTION_SET_MISMATCH:${changedSections.join(',')}`);
    }

    const finalDowngrade = await convertCiiNeutralVersionLossless(appliedV14Bytes, 11, {
      fileName: appliedV14.fileName,
      cryptoRef: crypto,
    });
    const directV11Bytes = ciiByteStringToBytes(directV11.byteString);
    if (!ciiBytesEqual(finalDowngrade.outputBytes, directV11Bytes)) {
      throw new Error('W2_NATIVE_V14_FINAL_DOWNGRADE_NOT_EXACT_VALIDATED_V11_POSTIMAGE');
    }
    const finalDowngradeSha256 = await ciiSha256(finalDowngrade.outputBytes, crypto);
    const directV11Sha256 = await ciiSha256(directV11Bytes, crypto);
    if (finalDowngradeSha256 !== directV11Sha256) throw new Error('W2_NATIVE_V14_FINAL_DOWNGRADE_SHA_MISMATCH');

    return {
      fixtureClass: 'PINNED_NATIVE_V14_TARGET_WITH_VALIDATED_GENERATED_V14_SOURCE',
      upstreamCommit: UPSTREAM_COMMIT,
      archiveGitBlobSha1,
      nativeV14Sha256,
      nativeTargetRoundTripWasNonExact: true,
      staleNativeRejected,
      candidatePointer: candidate.pointer,
      bridgePath: bridgeValidation.path,
      bridgeStatus: bridgeValidation.status,
      projectedNormalizedPostimageExact: bridgeValidation.projectedNormalizedPostimageExact,
      nonamRawPreserved: beforeNonamRaw === afterNonamRaw,
      restraintCountBefore: beforeRestraintCount,
      restraintCountAfter: afterRestraintCount,
      restraintRowDelta: beforeRestrant.rows.length - afterRestrant.rows.length,
      restraintPointerClaimCount: restraintPointerClaims.length,
      changedSections,
      unrelatedNativeSectionsPreserved: true,
      finalDowngradeEqualsValidatedV11: true,
      finalDowngradeSha256,
      directV11Sha256,
      outputVersion: detectCiiNeutralVersion(appliedV14Bytes),
    };
  });

  expect(result.fixtureClass).toBe('PINNED_NATIVE_V14_TARGET_WITH_VALIDATED_GENERATED_V14_SOURCE');
  expect(result.upstreamCommit).toBe('ca8d391ac5f829f53bebb3c37adf0547c34a67b4');
  expect(result.archiveGitBlobSha1).toBe('8409e1c429665e34a83c2a464665ebf5d5f1b0a1');
  expect(result.nativeV14Sha256).toBe('d2d4316309d9b1aa34b55ad72f89193fd0e437930db203fecd9ede00e69b2faf');
  expect(result.nativeTargetRoundTripWasNonExact).toBe(true);
  expect(result.staleNativeRejected).toBe(true);
  expect(result.outputVersion).toBe(14);
  expect(result.bridgeStatus).toBe('PASS');
  expect(result.bridgePath).toBe('V14_CHANGE_ISOLATED_VIA_V11');
  expect(result.projectedNormalizedPostimageExact).toBe(true);
  expect(result.nonamRawPreserved).toBe(true);
  expect(result.restraintCountAfter).toBe(result.restraintCountBefore - 1);
  expect(result.restraintRowDelta).toBe(24);
  expect(result.restraintPointerClaimCount).toBeGreaterThan(0);
  expect(result.changedSections).toEqual(['CONTROL', 'ELEMENTS', 'RESTRANT']);
  expect(result.unrelatedNativeSectionsPreserved).toBe(true);
  expect(result.finalDowngradeEqualsValidatedV11).toBe(true);
  expect(result.finalDowngradeSha256).toBe(result.directV11Sha256);
});
