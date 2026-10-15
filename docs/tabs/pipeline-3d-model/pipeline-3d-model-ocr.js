// Browser OCR adapter for Pipeline 3D Model image imports.
// Input: an image Blob/File/data URL and explicit options with language and
// progress callback. Output: positioned OCR words in image pixel coordinates.
// Fallback: errors are raised when the runtime CDN script or OCR engine fails.

const TESSERACT_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';

let tesseractLoadPromise = null;

/**
 * @typedef {Object} RecognizedWord
 * @property {string} text
 * @property {number} x0
 * @property {number} y0
 * @property {number} x1
 * @property {number} y1
 * @property {number} confidence
 */

function normalizeConfidence(confidence) {
  const value = Number(confidence);
  if (!Number.isFinite(value)) return 0;
  const scaled = value >= 0 && value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, scaled));
}

function bboxValue(word, key) {
  return Number(word?.bbox?.[key] ?? word?.[key]);
}

function normalizeWord(word) {
  const x0 = bboxValue(word, 'x0');
  const y0 = bboxValue(word, 'y0');
  const x1 = bboxValue(word, 'x1');
  const y1 = bboxValue(word, 'y1');
  if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
  const text = String(word?.text ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return {
    ...word,
    text,
    x0,
    y0,
    x1,
    y1,
    confidence: normalizeConfidence(word?.confidence),
  };
}

function flattenNodes(nodes, key) {
  return (nodes || []).flatMap((node) => node?.[key] || []);
}

function collectTesseractWords(data) {
  if (Array.isArray(data?.words) && data.words.length) return data.words;
  const fromLines = flattenNodes(data?.lines, 'words');
  if (fromLines.length) return fromLines;
  const fromParagraphs = flattenNodes(data?.paragraphs, 'words');
  if (fromParagraphs.length) return fromParagraphs;
  const fromBlocks = flattenNodes(data?.blocks, 'words');
  if (fromBlocks.length) return fromBlocks;
  const wordsFromBlockLines = flattenNodes(flattenNodes(data?.blocks, 'lines'), 'words');
  if (wordsFromBlockLines.length) return wordsFromBlockLines;
  const wordsFromParagraphLines = flattenNodes(flattenNodes(data?.paragraphs, 'lines'), 'words');
  if (wordsFromParagraphLines.length) return wordsFromParagraphLines;
  return [];
}

function normalizeRotationDeg(rotationDeg) {
  const value = Number(rotationDeg || 0);
  if (!Number.isFinite(value)) return 0;
  const normalized = ((value % 360) + 360) % 360;
  if ([0, 90, 180, 270].includes(normalized)) return normalized;
  throw new Error(`Unsupported OCR image rotation: ${rotationDeg}. Use 0, 90, 180, or 270 degrees.`);
}

function loadImageElementFromSource(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let objectUrl = '';
    image.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load the image for OCR rotation preprocessing.'));
    };
    if (typeof source === 'string') image.src = source;
    else {
      objectUrl = URL.createObjectURL(source);
      image.src = objectUrl;
    }
  });
}

function canvasToBlob(canvas, mimeType) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create a rotated image blob for OCR.'));
    }, mimeType);
  });
}

function normalizeScale(scale) {
  const value = Number(scale || 1);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(5, Math.max(1, value));
}

function normalizeCanvasForOcr(canvas) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('OCR image preprocessing could not get a 2D canvas context.');
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let luminanceSum = 0;
  for (let index = 0; index < data.length; index += 4) {
    luminanceSum += (0.2126 * data[index]) + (0.7152 * data[index + 1]) + (0.0722 * data[index + 2]);
  }
  const averageLuminance = luminanceSum / (data.length / 4);
  const invert = averageLuminance < 128;
  for (let index = 0; index < data.length; index += 4) {
    let gray = (0.2126 * data[index]) + (0.7152 * data[index + 1]) + (0.0722 * data[index + 2]);
    if (invert) gray = 255 - gray;
    const normalized = gray > 160 ? 255 : 0;
    data[index] = normalized;
    data[index + 1] = normalized;
    data[index + 2] = normalized;
    data[index + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);
}

async function prepareImageSourceForOcr(imageSource, options) {
  const rotation = normalizeRotationDeg(options.rotationDeg);
  const scale = normalizeScale(options.scale);
  const normalizeImage = Boolean(options.normalizeImage);
  if (rotation === 0 && scale === 1 && !normalizeImage) return imageSource;
  if (!globalThis.document || typeof URL === 'undefined') {
    throw new Error('OCR image preprocessing requires a browser canvas runtime.');
  }

  const image = await loadImageElementFromSource(imageSource);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const sideways = rotation === 90 || rotation === 270;
  const targetWidth = sideways ? sourceHeight : sourceWidth;
  const targetHeight = sideways ? sourceWidth : sourceHeight;
  const canvas = globalThis.document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(targetWidth * scale));
  canvas.height = Math.max(1, Math.round(targetHeight * scale));

  const context = canvas.getContext('2d');
  if (!context) throw new Error('OCR image preprocessing could not get a 2D canvas context.');

  context.scale(scale, scale);
  if (rotation === 90) {
    context.translate(targetWidth, 0);
    context.rotate(Math.PI / 2);
  } else if (rotation === 180) {
    context.translate(targetWidth, targetHeight);
    context.rotate(Math.PI);
  } else if (rotation === 270) {
    context.translate(0, targetHeight);
    context.rotate((3 * Math.PI) / 2);
  }
  context.drawImage(image, 0, 0, sourceWidth, sourceHeight);
  if (normalizeImage) normalizeCanvasForOcr(canvas);
  return canvasToBlob(canvas, imageSource?.type || 'image/png');
}

function loadTesseractScript() {
  if (globalThis.Tesseract?.recognize) return Promise.resolve(globalThis.Tesseract);
  if (tesseractLoadPromise) return tesseractLoadPromise;
  if (!globalThis.document) {
    return Promise.reject(new Error('Tesseract.js OCR requires a browser document to load the runtime CDN script.'));
  }

  tesseractLoadPromise = new Promise((resolve, reject) => {
    const script = globalThis.document.createElement('script');
    script.src = TESSERACT_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (globalThis.Tesseract?.recognize) resolve(globalThis.Tesseract);
      else reject(new Error('Tesseract.js loaded, but the OCR API was not available on window.Tesseract.'));
    };
    script.onerror = () => reject(new Error(`Failed to load Tesseract.js from ${TESSERACT_SCRIPT_URL}. Check network/CDN access.`));
    globalThis.document.head.appendChild(script);
  });

  return tesseractLoadPromise;
}

function normalizeOptions(options) {
  const language = String(options?.language || 'eng').trim() || 'eng';
  const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
  const rotationDeg = normalizeRotationDeg(options?.rotationDeg);
  const scale = normalizeScale(options?.scale);
  const normalizeImage = Boolean(options?.normalizeImage);
  return { language, onProgress, rotationDeg, scale, normalizeImage };
}

/**
 * Recognizes words in a browser image source using a lazily loaded Tesseract.js
 * CDN runtime. The returned words preserve Tesseract fields and add direct
 * x0/y0/x1/y1/confidence values for downstream table parsers.
 * @param {Blob|string} imageBlobOrDataUrl
 * @param {{ language?: string, rotationDeg?: number, scale?: number, normalizeImage?: boolean, onProgress?: (progress: unknown) => void }} options
 * @returns {Promise<RecognizedWord[]>}
 */
export async function recognizeImageWords(imageBlobOrDataUrl, options) {
  const { language, onProgress, rotationDeg, scale, normalizeImage } = normalizeOptions(options);
  const tesseract = await loadTesseractScript();
  const imageSource = await prepareImageSourceForOcr(imageBlobOrDataUrl, { rotationDeg, scale, normalizeImage });
  const result = await tesseract.recognize(imageSource, language, {
    logger: (progress) => {
      if (onProgress) onProgress(progress);
    },
  });
  const rawWords = collectTesseractWords(result?.data);
  const normalizedWords = rawWords.map(normalizeWord).filter(Boolean);
  const debug = {
    keys: Object.keys(result?.data || {}).sort(),
    text: String(result?.data?.text || '').slice(0, 8000),
    rawWordCount: rawWords.length,
    normalizedWordCount: normalizedWords.length,
    firstRawWords: rawWords.slice(0, 10).map((word) => ({
      text: word?.text,
      confidence: word?.confidence,
      bbox: word?.bbox,
      keys: Object.keys(word || {}).sort(),
    })),
  };
  Object.defineProperty(normalizedWords, 'ocrDebug', { value: debug });
  return normalizedWords;
}
