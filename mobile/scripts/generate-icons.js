const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function writePng(filePath, width, height, pixels) {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  const png = Buffer.concat([
    signature,
    writeChunk('IHDR', ihdr),
    writeChunk('IDAT', compressed),
    writeChunk('IEND', Buffer.alloc(0)),
  ]);

  fs.writeFileSync(filePath, png);
}

function clamp(v) {
  return Math.max(0, Math.min(255, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function drawCircleStroke(pixels, size, cx, cy, r, strokeWidth, rgba) {
  const rOuter = r + strokeWidth / 2;
  const rInner = Math.max(0, r - strokeWidth / 2);
  const rOuter2 = rOuter * rOuter;
  const rInner2 = rInner * rInner;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= rOuter2 && d2 >= rInner2) {
        const i = (y * size + x) * 4;
        pixels[i] = rgba[0];
        pixels[i + 1] = rgba[1];
        pixels[i + 2] = rgba[2];
        pixels[i + 3] = rgba[3];
      }
    }
  }
}

function drawLine(pixels, size, x1, y1, x2, y2, thickness, rgba) {
  const minX = Math.floor(Math.min(x1, x2) - thickness);
  const maxX = Math.ceil(Math.max(x1, x2) + thickness);
  const minY = Math.floor(Math.min(y1, y2) - thickness);
  const maxY = Math.ceil(Math.max(y1, y2) + thickness);

  const vx = x2 - x1;
  const vy = y2 - y1;
  const len2 = vx * vx + vy * vy;

  for (let y = Math.max(0, minY); y < Math.min(size, maxY); y += 1) {
    for (let x = Math.max(0, minX); x < Math.min(size, maxX); x += 1) {
      const wx = x - x1;
      const wy = y - y1;
      let t = len2 === 0 ? 0 : (wx * vx + wy * vy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = x1 + t * vx;
      const py = y1 + t * vy;
      const dx = x - px;
      const dy = y - py;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= thickness / 2) {
        const i = (y * size + x) * 4;
        pixels[i] = rgba[0];
        pixels[i + 1] = rgba[1];
        pixels[i + 2] = rgba[2];
        pixels[i + 3] = rgba[3];
      }
    }
  }
}

function fillBackgroundGradient(pixels, size) {
  const top = [17, 52, 102];
  const bottom = [9, 24, 48];

  for (let y = 0; y < size; y += 1) {
    const t = y / (size - 1);
    for (let x = 0; x < size; x += 1) {
      const nx = x / (size - 1);
      const glow = Math.max(0, 1 - Math.hypot(nx - 0.5, t - 0.35) * 1.6);
      const i = (y * size + x) * 4;
      pixels[i] = clamp(lerp(top[0], bottom[0], t) + glow * 28);
      pixels[i + 1] = clamp(lerp(top[1], bottom[1], t) + glow * 20);
      pixels[i + 2] = clamp(lerp(top[2], bottom[2], t) + glow * 10);
      pixels[i + 3] = 255;
    }
  }
}

function addVignette(pixels, size) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / (size - 1) - 0.5;
      const ny = y / (size - 1) - 0.5;
      const d = Math.sqrt(nx * nx + ny * ny);
      const shade = Math.max(0, (d - 0.3) / 0.4);
      const factor = 1 - shade * 0.35;
      const i = (y * size + x) * 4;
      pixels[i] = clamp(pixels[i] * factor);
      pixels[i + 1] = clamp(pixels[i + 1] * factor);
      pixels[i + 2] = clamp(pixels[i + 2] * factor);
    }
  }
}

function drawMainSymbol(pixels, size, alpha = 255) {
  const cx = size * 0.5;
  const cy = size * 0.5;
  const stroke = Math.max(10, Math.round(size * 0.04));

  const gold = [236, 193, 103, alpha];
  const softGold = [251, 228, 174, alpha];

  drawCircleStroke(pixels, size, cx, cy, size * 0.32, stroke, gold);
  drawCircleStroke(pixels, size, cx, cy, size * 0.23, stroke, softGold);

  // Vertical and horizontal crossbar to evoke faith/reason intersection.
  drawLine(pixels, size, cx, size * 0.28, cx, size * 0.72, stroke, softGold);
  drawLine(pixels, size, size * 0.36, cy, size * 0.64, cy, stroke, softGold);

  // Subtle center dot.
  drawCircleStroke(pixels, size, cx, cy, size * 0.045, stroke, gold);
}

function createIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  fillBackgroundGradient(pixels, size);
  addVignette(pixels, size);
  drawMainSymbol(pixels, size, 255);
  return pixels;
}

function createAdaptiveForeground(size) {
  const pixels = Buffer.alloc(size * size * 4);
  drawMainSymbol(pixels, size, 255);
  return pixels;
}

function createFavicon(size) {
  const pixels = createIcon(size);
  return pixels;
}

function main() {
  const assetsDir = path.resolve(__dirname, '..', 'assets');
  writePng(path.join(assetsDir, 'icon.png'), 1024, 1024, createIcon(1024));
  writePng(
    path.join(assetsDir, 'adaptive-icon.png'),
    1024,
    1024,
    createAdaptiveForeground(1024),
  );
  writePng(path.join(assetsDir, 'favicon.png'), 48, 48, createFavicon(48));

  console.log('Generated icon assets in', assetsDir);
}

main();
