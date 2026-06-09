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
  return await file.text();
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
