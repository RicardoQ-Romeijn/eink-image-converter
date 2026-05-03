// ----- BMP encoders
function buildBmp1(bits) {
  const rowBytes = Math.ceil(W / 8);
  const rowStride = Math.ceil(rowBytes / 4) * 4;
  const pixelSize = rowStride * H;
  const headerSize = 62;
  const total = headerSize + pixelSize;
  const buf = new ArrayBuffer(total);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  bytes[0] = 0x42; bytes[1] = 0x4D;
  view.setUint32(2, total, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, headerSize, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, W, true);
  view.setInt32(22, H, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 1, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, pixelSize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  view.setUint32(46, 2, true);
  view.setUint32(50, 0, true);
  bytes[54] = 0x00; bytes[55] = 0x00; bytes[56] = 0x00; bytes[57] = 0x00;
  bytes[58] = 0xFF; bytes[59] = 0xFF; bytes[60] = 0xFF; bytes[61] = 0x00;
  for (let y = 0; y < H; y++) {
    const bmpRow = H - 1 - y;
    const rowOffset = headerSize + bmpRow * rowStride;
    for (let byteX = 0; byteX < rowBytes; byteX++) {
      let b = 0;
      const base = byteX * 8;
      for (let bit = 0; bit < 8; bit++) {
        const px = base + bit;
        if (px < W && bits[y * W + px]) b |= (1 << (7 - bit));
      }
      bytes[rowOffset + byteX] = b;
    }
  }
  return new Blob([buf], { type: 'image/bmp' });
}

// 4-bit indexed BMP. 16-entry palette in BGRA (only the first
// `palette.length` slots populated; the rest are zeroed). Two pixels per
// byte, high nibble first, rows padded to a 4-byte boundary, bottom-up.
function buildBmp4(indices, palette) {
  const colorCount = 16;
  const headerSize = 14 + 40 + colorCount * 4;
  const rowBytes = Math.ceil(W / 2);
  const rowStride = Math.ceil(rowBytes / 4) * 4;
  const pixelSize = rowStride * H;
  const total = headerSize + pixelSize;
  const buf = new ArrayBuffer(total);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  bytes[0] = 0x42; bytes[1] = 0x4D;
  view.setUint32(2, total, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, headerSize, true);

  view.setUint32(14, 40, true);
  view.setInt32(18, W, true);
  view.setInt32(22, H, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 4, true);                  // 4 bits per pixel
  view.setUint32(30, 0, true);                  // BI_RGB
  view.setUint32(34, pixelSize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  view.setUint32(46, palette.length, true);     // colours used
  view.setUint32(50, palette.length, true);     // important colours

  for (let i = 0; i < colorCount; i++) {
    const off = 54 + i * 4;
    const p = palette[i];
    if (p) {
      bytes[off]     = p.b;
      bytes[off + 1] = p.g;
      bytes[off + 2] = p.r;
      bytes[off + 3] = 0;
    }
  }

  for (let y = 0; y < H; y++) {
    const bmpRow = H - 1 - y;
    const rowOffset = headerSize + bmpRow * rowStride;
    for (let x = 0; x < W; x++) {
      const idx = indices[y * W + x] & 0x0F;
      const byteX = rowOffset + (x >> 1);
      if ((x & 1) === 0) {
        bytes[byteX] = idx << 4;                // first pixel = high nibble
      } else {
        bytes[byteX] |= idx;                    // second pixel = low nibble
      }
    }
  }

  return new Blob([buf], { type: 'image/bmp' });
}

function buildBmp24(rgb) {
  const rowStride = Math.ceil(W * 3 / 4) * 4;
  const pixelSize = rowStride * H;
  const headerSize = 54;
  const total = headerSize + pixelSize;
  const buf = new ArrayBuffer(total);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  bytes[0] = 0x42; bytes[1] = 0x4D;
  view.setUint32(2, total, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, headerSize, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, W, true);
  view.setInt32(22, H, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, pixelSize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  view.setUint32(46, 0, true);
  view.setUint32(50, 0, true);
  for (let y = 0; y < H; y++) {
    const srcRow = y * W * 3;
    const dstRow = headerSize + (H - 1 - y) * rowStride;
    for (let x = 0; x < W; x++) {
      bytes[dstRow + x * 3]     = rgb[srcRow + x * 3 + 2];
      bytes[dstRow + x * 3 + 1] = rgb[srcRow + x * 3 + 1];
      bytes[dstRow + x * 3 + 2] = rgb[srcRow + x * 3];
    }
  }
  return new Blob([buf], { type: 'image/bmp' });
}
