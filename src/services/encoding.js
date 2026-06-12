import JSZip from 'jszip';

export function toBase64(text) {
  const bytes = new TextEncoder().encode(text || '');
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  let binary = '';
  new Uint8Array(buffer).forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export async function fileToText(file) {
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.docx') || file?.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return await extractDocxText(file);
  }
  return normalizeText(await file.text());
}

export function safeFileName(name, fallback = 'upload.bin') {
  const raw = String(name || fallback).split(/[\\/]/).pop() || fallback;
  return raw.replace(/[^\w.\- ()]/g, '_');
}

export function uniquePortalRunId(packageName) {
  const base = safeFileName(packageName || 'qa-package').replace(/\.[^.]+$/, '');
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `${base}-${stamp}`;
}

async function extractDocxText(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) return normalizeText(await file.text());

  if (typeof DOMParser !== 'undefined') {
    try {
      const xml = new DOMParser().parseFromString(documentXml, 'application/xml');
      const paragraphs = Array.from(xml.getElementsByTagNameNS('*', 'p'))
        .map((paragraph) => Array.from(paragraph.getElementsByTagNameNS('*', 't'))
          .map((node) => node.textContent || '')
          .join(''))
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      const text = paragraphs.join('\n');
      if (text.trim()) return normalizeText(text);
    } catch (_) {
      // Fall back to the raw XML cleanup below.
    }
  }

  const fallbackText = documentXml
    .replace(/<\/w:t>\s*<w:t[^>]*>/g, '')
    .replace(/<w:p\b[^>]*>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'');
  return normalizeText(fallbackText);
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
