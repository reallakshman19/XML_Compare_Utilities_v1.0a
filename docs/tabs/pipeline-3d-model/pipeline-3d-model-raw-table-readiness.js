function text(value) {
  return String(value ?? '');
}

function lineEnd(source, index) {
  return index > 0 && source.charCodeAt(index - 1) === 13 ? index - 1 : index;
}

export function scanPipelineRawTableReadiness(value) {
  const source = text(value);
  let lineStart = 0;
  let nonEmptyLineCount = 0;
  let scannedLineCount = 0;
  for (let index = 0; index <= source.length; index += 1) {
    if (index < source.length && source.charCodeAt(index) !== 10) continue;
    const line = source.slice(lineStart, lineEnd(source, index));
    lineStart = index + 1;
    scannedLineCount += 1;
    if (!line.trim()) continue;
    nonEmptyLineCount += 1;
    if (nonEmptyLineCount > 1 && /\d/.test(line)) {
      return Object.freeze({ hasContent: true, hasDataRow: true, scannedLineCount });
    }
  }
  return Object.freeze({
    hasContent: nonEmptyLineCount > 0,
    hasDataRow: false,
    scannedLineCount,
  });
}
