'use strict';

const fs = require('fs');

/**
 * Content-based image type detection (Security Hardening Phase 2B, TR-MED-3).
 *
 * Upload validation used to consist of a regex over `file.originalname`'s
 * extension. The extension is chosen by the caller and says nothing about what
 * the bytes actually are, so any file renamed to `.png` was accepted and stored.
 * The stored file is later streamed back with a Content-Type inferred from that
 * same extension, so a mismatch is precisely the condition that turns a stored
 * file into a content-confusion vector.
 *
 * Deliberately implemented here rather than by adding the `file-type` package:
 * the check needed is a handful of fixed byte signatures, and current versions
 * of that package are ESM-only, which this CommonJS backend cannot require.
 *
 * @typedef {'jpeg'|'png'|'gif'|'webp'} ImageKind
 */

// Longest signature we need to inspect (WebP needs bytes 0-3 and 8-11).
const HEADER_BYTES = 12;

const startsWith = (buf, bytes, offset = 0) =>
  buf.length >= offset + bytes.length &&
  bytes.every((b, i) => buf[offset + i] === b);

const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

/**
 * Identify an image from its leading bytes.
 *
 * @param {Buffer} buf first bytes of the file
 * @returns {ImageKind|null} null when the bytes are not a supported image
 */
const sniffImageKind = (buf) => {
  if (!Buffer.isBuffer(buf)) return null;
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(buf, ascii('GIF87a')) || startsWith(buf, ascii('GIF89a'))) return 'gif';
  if (startsWith(buf, ascii('RIFF')) && startsWith(buf, ascii('WEBP'), 8)) return 'webp';
  return null;
};

/** Extensions this application stores, mapped to the content they must contain. */
const EXTENSION_KIND = {
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.png': 'png',
  '.gif': 'gif',
  '.webp': 'webp',
};

/**
 * Read a stored file's header and confirm it really is the image its extension
 * claims. Both halves matter: the bytes must be a supported image, AND they
 * must agree with the extension the file is served under.
 *
 * @param {string} absolutePath
 * @param {string} extension lower-case, including the dot
 * @returns {{ok: true, kind: ImageKind} | {ok: false, reason: string}}
 */
const verifyStoredImage = (absolutePath, extension) => {
  const expected = EXTENSION_KIND[extension];
  if (!expected) return { ok: false, reason: 'unsupported extension' };

  let fd;
  try {
    fd = fs.openSync(absolutePath, 'r');
    const buf = Buffer.alloc(HEADER_BYTES);
    const read = fs.readSync(fd, buf, 0, HEADER_BYTES, 0);
    const kind = sniffImageKind(buf.subarray(0, read));

    if (!kind) return { ok: false, reason: 'file content is not a supported image' };
    if (kind !== expected) {
      return { ok: false, reason: `file content (${kind}) does not match extension (${extension})` };
    }
    return { ok: true, kind };
  } catch (e) {
    return { ok: false, reason: 'file could not be read for validation' };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
};

module.exports = { sniffImageKind, verifyStoredImage, EXTENSION_KIND };
