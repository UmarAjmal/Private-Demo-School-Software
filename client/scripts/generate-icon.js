/**
 * generate-icon.js
 * Reads scripts/appicon.png and generates all Android launcher icons + PWA icons.
 * Zero external dependencies — uses only Node.js built-ins (fs, path, zlib).
 *
 * Usage:
 *   node scripts/generate-icon.js
 *   npm run generate-icons
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ─── PNG Decoder ─────────────────────────────────────────────────────────────

function readPng(filePath) {
  const buf = fs.readFileSync(filePath);

  // Verify PNG signature
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== SIG[i]) throw new Error(`Not a valid PNG: ${filePath}`);
  }

  let offset = 8;
  let width, height, bitDepth, colorType;
  const idatBuffers = [];

  while (offset < buf.length) {
    const chunkLen = buf.readUInt32BE(offset); offset += 4;
    const chunkType = buf.slice(offset, offset + 4).toString('ascii'); offset += 4;
    const chunkData = buf.slice(offset, offset + chunkLen); offset += chunkLen;
    offset += 4; // skip CRC

    if (chunkType === 'IHDR') {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8];
      colorType = chunkData[9];
      if (bitDepth !== 8) throw new Error(`Only 8-bit PNG supported (got ${bitDepth}-bit)`);
    } else if (chunkType === 'IDAT') {
      idatBuffers.push(chunkData);
    } else if (chunkType === 'IEND') {
      break;
    }
  }

  if (!width || !height) throw new Error('PNG IHDR chunk missing or corrupt');

  // channels per colorType: 0=Gray,2=RGB,3=Indexed,4=Gray+A,6=RGBA
  const channelMap = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelMap[colorType];
  if (!channels) throw new Error(`Unsupported PNG colorType: ${colorType}`);

  // Decompress IDAT
  const raw = zlib.inflateSync(Buffer.concat(idatBuffers));

  // Paeth predictor (PNG filter type 4)
  function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return (pa <= pb && pa <= pc) ? a : pb <= pc ? b : c;
  }

  const rowBytes = width * channels;
  const pixelBuf = Buffer.alloc(height * rowBytes);
  let rawOffset = 0;

  for (let y = 0; y < height; y++) {
    const filter = raw[rawOffset++];
    const rowStart = y * rowBytes;

    for (let i = 0; i < rowBytes; i++) {
      const x = raw[rawOffset++];
      const ch = i % channels;
      const left = i >= channels ? pixelBuf[rowStart + i - channels] : 0;
      const up = y > 0 ? pixelBuf[rowStart - rowBytes + i] : 0;
      const upLeft = (y > 0 && i >= channels) ? pixelBuf[rowStart - rowBytes + i - channels] : 0;

      let v;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = (x + left) & 0xff; break;
        case 2: v = (x + up) & 0xff; break;
        case 3: v = (x + Math.floor((left + up) / 2)) & 0xff; break;
        case 4: v = (x + paeth(left, up, upLeft)) & 0xff; break;
        default: throw new Error(`Unknown PNG filter type: ${filter}`);
      }
      pixelBuf[rowStart + i] = v;
    }
  }

  // Convert to RGBA
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * rowBytes) + x * channels;
      const dst = (y * width + x) * 4;
      if (colorType === 6) {                                    // RGBA
        rgba[dst] = pixelBuf[src]; rgba[dst + 1] = pixelBuf[src + 1];
        rgba[dst + 2] = pixelBuf[src + 2]; rgba[dst + 3] = pixelBuf[src + 3];
      } else if (colorType === 2) {                             // RGB
        rgba[dst] = pixelBuf[src]; rgba[dst + 1] = pixelBuf[src + 1];
        rgba[dst + 2] = pixelBuf[src + 2]; rgba[dst + 3] = 255;
      } else if (colorType === 0 || colorType === 3) {         // Gray / Indexed
        const v = pixelBuf[src];
        rgba[dst] = rgba[dst + 1] = rgba[dst + 2] = v; rgba[dst + 3] = 255;
      } else if (colorType === 4) {                             // Gray + Alpha
        const v = pixelBuf[src];
        rgba[dst] = rgba[dst + 1] = rgba[dst + 2] = v; rgba[dst + 3] = pixelBuf[src + 1];
      }
    }
  }

  return { width, height, rgba };
}

// ─── Bilinear Resize ──────────────────────────────────────────────────────────

function resizeRgba(src, srcW, srcH, dstW, dstH) {
  const dst = Buffer.alloc(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const sx = (x + 0.5) * xRatio - 0.5;
      const sy = (y + 0.5) * yRatio - 0.5;
      const x0 = Math.max(0, Math.floor(sx));
      const y0 = Math.max(0, Math.floor(sy));
      const x1 = Math.min(srcW - 1, x0 + 1);
      const y1 = Math.min(srcH - 1, y0 + 1);
      const xf = sx - x0;
      const yf = sy - y0;
      const out = (y * dstW + x) * 4;

      for (let c = 0; c < 4; c++) {
        const tl = src[(y0 * srcW + x0) * 4 + c];
        const tr = src[(y0 * srcW + x1) * 4 + c];
        const bl = src[(y1 * srcW + x0) * 4 + c];
        const br = src[(y1 * srcW + x1) * 4 + c];
        dst[out + c] = Math.round(tl + (tr - tl) * xf + (bl - tl) * yf + (br - bl - tr + tl) * xf * yf);
      }
    }
  }
  return dst;
}

// ─── Circle Mask (for ic_launcher_round) ─────────────────────────────────────

function applyCircleMask(rgba, size) {
  const result = Buffer.from(rgba);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 0.5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist > r) {
        const off = (y * size + x) * 4;
        result[off + 3] = dist > r + 1 ? 0 : Math.round((r + 1 - dist) * 255); // anti-alias
      }
    }
  }
  return result;
}

// ─── PNG Encoder ─────────────────────────────────────────────────────────────

function writePng(rgba, width, height) {
  // Build raw scanline data (filter type 0 = None for each row)
  const rowSize = width * 4 + 1;
  const raw = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // filter = None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * rowSize + 1 + x * 4;
      raw[dst] = rgba[src]; raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2]; raw[dst + 3] = rgba[src + 3];
    }
  }

  // CRC32
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function mkChunk(type, data) {
    const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const body = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([lenBuf, body, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    mkChunk('IHDR', ihdr),
    mkChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    mkChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const SOURCE = path.join(__dirname, 'appicon.png');

const candidateResDirs = [
  path.join(__dirname, '../android [D_P_School]/app/src/main/res'),
  path.join(__dirname, '../android/app/src/main/res')
];

const resDirs = candidateResDirs.filter(d => fs.existsSync(path.dirname(d)));

if (!fs.existsSync(SOURCE)) {
  console.error('❌  appicon.png not found in scripts/ folder.');
  console.error('   Place a square PNG (ideally 1024x1024) at: scripts/appicon.png');
  process.exit(1);
}

const mipmaps = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

console.log('📷  Reading source: scripts/appicon.png');
const { width: srcW, height: srcH, rgba: srcRgba } = readPng(SOURCE);
console.log(`   Dimensions: ${srcW} × ${srcH} px`);
if (srcW !== srcH) {
  console.warn('⚠️   Warning: appicon.png is not square — icons may appear stretched.');
}
console.log('');
console.log('🤖  Generating Android launcher icons for target res directories...');

for (const targetResDir of resDirs) {
  console.log(`   ➔ Output target: ${targetResDir}`);
  for (const { dir, size } of mipmaps) {
    const folder = path.join(targetResDir, dir);
    fs.mkdirSync(folder, { recursive: true });

    const scaled = resizeRgba(srcRgba, srcW, srcH, size, size);
    const rounded = applyCircleMask(Buffer.from(scaled), size);

    fs.writeFileSync(path.join(folder, 'ic_launcher.png'), writePng(scaled, size, size));
    fs.writeFileSync(path.join(folder, 'ic_launcher_round.png'), writePng(rounded, size, size));
    fs.writeFileSync(path.join(folder, 'ic_launcher_foreground.png'), writePng(scaled, size, size));

    console.log(`      ✓  ${dir} — ${size}×${size}px`);
  }
}

// ─── PWA / Web icons ──────────────────────────────────────────────────────────

const PUBLIC_DIR = path.join(__dirname, '../public');
fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const pwa512 = resizeRgba(srcRgba, srcW, srcH, 512, 512);
const fav64 = resizeRgba(srcRgba, srcW, srcH, 64, 64);

fs.writeFileSync(path.join(PUBLIC_DIR, 'icon.png'), writePng(pwa512, 512, 512));
fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), writePng(fav64, 64, 64));

console.log('');
console.log('🌐  Web PWA icons:');
console.log('   ✓  public/icon.png    — 512×512px');
console.log('   ✓  public/favicon.ico — 64×64px');
console.log('');
console.log('✅  All icons generated from scripts/appicon.png!');
console.log('   Run "npx cap sync android" to apply icons to the Android build.');
