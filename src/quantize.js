function quantize7(imageData, s) {
  const n = W * H;
  const d = imageData.data;
  const cMul = ((s.contrast / 100) + 1) ** 2;
  const satMul = s.saturation / 100;
  const useGamma = s.gamma;
  const usePerceptual = s.perceptual;
  const palette = useGamma ? PALETTE_LIN : PALETTE_7;

  const rBuf = new Float32Array(n);
  const gBuf = new Float32Array(n);
  const bBuf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    r = (r - 128) * cMul + 128 + s.brightness;
    g = (g - 128) * cMul + 128 + s.brightness;
    b = (b - 128) * cMul + 128 + s.brightness;
    if (satMul !== 1) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      r = lum + (r - lum) * satMul;
      g = lum + (g - lum) * satMul;
      b = lum + (b - lum) * satMul;
    }
    if (s.invert) { r = 255 - r; g = 255 - g; b = 255 - b; }
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    if (useGamma) {
      rBuf[i] = SRGB_TO_LIN[Math.round(r)];
      gBuf[i] = SRGB_TO_LIN[Math.round(g)];
      bBuf[i] = SRGB_TO_LIN[Math.round(b)];
    } else {
      rBuf[i] = r; gBuf[i] = g; bBuf[i] = b;
    }
  }

  let pickIdx;
  if (usePerceptual && useGamma) {
    pickIdx = (r, g, b) => nearestPaletteIndexLab(r, g, b);
  } else if (usePerceptual) {
    pickIdx = (r, g, b) => nearestPaletteIndexLab(
      SRGB_TO_LIN[Math.max(0, Math.min(255, Math.round(r)))],
      SRGB_TO_LIN[Math.max(0, Math.min(255, Math.round(g)))],
      SRGB_TO_LIN[Math.max(0, Math.min(255, Math.round(b)))],
    );
  } else {
    pickIdx = (r, g, b) => nearestPaletteIndexRGB(r, g, b, palette);
  }

  const out = new Uint8Array(n * 3);
  const writeOut = (idx, paletteIdx) => {
    const sp = PALETTE_7[paletteIdx];
    out[idx * 3]     = sp.r;
    out[idx * 3 + 1] = sp.g;
    out[idx * 3 + 2] = sp.b;
  };

  if (s.dither === 'none') {
    for (let i = 0; i < n; i++) {
      writeOut(i, pickIdx(rBuf[i], gBuf[i], bBuf[i]));
    }
    return out;
  }

  if (s.dither === 'bayer4' || s.dither === 'bayer8' || s.dither === 'blueNoise') {
    const scale = useGamma ? 0.15 * 255 : 0.4 * 255;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        let t;
        if (s.dither === 'bayer4')      t = BAYER4[y & 3][x & 3] / 255;
        else if (s.dither === 'bayer8') t = BAYER8[y & 7][x & 7] / 255;
        else                            t = ign(x, y);
        const bias = (t - 0.5) * scale;
        writeOut(idx, pickIdx(rBuf[idx] + bias, gBuf[idx] + bias, bBuf[idx] + bias));
      }
    }
    return out;
  }

  const kernel = KERNELS[s.dither];
  const strength = s.fsStrength / 100;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      const or = rBuf[idx], og = gBuf[idx], ob = bBuf[idx];
      const pi = pickIdx(or, og, ob);
      writeOut(idx, pi);
      const pal = palette[pi];
      const er = (or - pal.r) * strength;
      const eg = (og - pal.g) * strength;
      const eb = (ob - pal.b) * strength;
      for (const [dx, dy, wgt] of kernel.offsets) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny >= H) continue;
        const nIdx = ny * W + nx;
        const k = wgt / kernel.denom;
        rBuf[nIdx] += er * k;
        gBuf[nIdx] += eg * k;
        bBuf[nIdx] += eb * k;
      }
    }
  }
  return out;
}

// ----- Indexed quantisation (used by 4-gray and the 2-bit accent modes)
// Generalises quantize7 — same tone/gamma pre-pass and dither kernels, but
// returns a `Uint8Array` of palette indices instead of RGB bytes so the
// 4-bit BMP encoder can pack them directly.
function quantizeIndexed(imageData, palette, s) {
  const n = W * H;
  const d = imageData.data;
  const cMul = ((s.contrast / 100) + 1) ** 2;
  const satMul = s.saturation / 100;
  const useGamma = s.gamma;
  const usePerceptual = s.perceptual;

  const palLin = palette.map(p => ({ r: SRGB_TO_LIN[p.r], g: SRGB_TO_LIN[p.g], b: SRGB_TO_LIN[p.b] }));
  const palLab = palLin.map(p => rgbLinearToOklab(p.r, p.g, p.b));
  const palWork = useGamma ? palLin : palette;

  const rBuf = new Float32Array(n);
  const gBuf = new Float32Array(n);
  const bBuf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    r = (r - 128) * cMul + 128 + s.brightness;
    g = (g - 128) * cMul + 128 + s.brightness;
    b = (b - 128) * cMul + 128 + s.brightness;
    if (satMul !== 1) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      r = lum + (r - lum) * satMul;
      g = lum + (g - lum) * satMul;
      b = lum + (b - lum) * satMul;
    }
    if (s.invert) { r = 255 - r; g = 255 - g; b = 255 - b; }
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    if (useGamma) {
      rBuf[i] = SRGB_TO_LIN[Math.round(r)];
      gBuf[i] = SRGB_TO_LIN[Math.round(g)];
      bBuf[i] = SRGB_TO_LIN[Math.round(b)];
    } else {
      rBuf[i] = r; gBuf[i] = g; bBuf[i] = b;
    }
  }

  const nearestRGB = (r, g, b) => {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < palWork.length; i++) {
      const p = palWork[i];
      const dr = r - p.r, dg = g - p.g, db = b - p.b;
      const d2 = dr * dr + dg * dg + db * db;
      if (d2 < bestD) { bestD = d2; best = i; }
    }
    return best;
  };
  const nearestLab = (lr, lg, lb) => {
    const [L, a, B] = rgbLinearToOklab(lr, lg, lb);
    let best = 0, bestD = Infinity;
    for (let i = 0; i < palLab.length; i++) {
      const [pL, pa, pb] = palLab[i];
      const dL = L - pL, da = a - pa, db_ = B - pb;
      const d2 = dL * dL + da * da + db_ * db_;
      if (d2 < bestD) { bestD = d2; best = i; }
    }
    return best;
  };
  let pickIdx;
  if (usePerceptual && useGamma) {
    pickIdx = nearestLab;
  } else if (usePerceptual) {
    pickIdx = (r, g, b) => nearestLab(
      SRGB_TO_LIN[Math.max(0, Math.min(255, Math.round(r)))],
      SRGB_TO_LIN[Math.max(0, Math.min(255, Math.round(g)))],
      SRGB_TO_LIN[Math.max(0, Math.min(255, Math.round(b)))],
    );
  } else {
    pickIdx = nearestRGB;
  }

  const out = new Uint8Array(n);

  if (s.dither === 'none') {
    for (let i = 0; i < n; i++) out[i] = pickIdx(rBuf[i], gBuf[i], bBuf[i]);
    return out;
  }
  if (s.dither === 'bayer4' || s.dither === 'bayer8' || s.dither === 'blueNoise') {
    const scale = useGamma ? 0.15 * 255 : 0.4 * 255;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        let t;
        if (s.dither === 'bayer4')      t = BAYER4[y & 3][x & 3] / 255;
        else if (s.dither === 'bayer8') t = BAYER8[y & 7][x & 7] / 255;
        else                            t = ign(x, y);
        const bias = (t - 0.5) * scale;
        out[idx] = pickIdx(rBuf[idx] + bias, gBuf[idx] + bias, bBuf[idx] + bias);
      }
    }
    return out;
  }

  // Error diffusion against the supplied palette.
  const kernel = KERNELS[s.dither];
  const strength = s.fsStrength / 100;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      const or = rBuf[idx], og = gBuf[idx], ob = bBuf[idx];
      const pi = pickIdx(or, og, ob);
      out[idx] = pi;
      const pal = palWork[pi];
      const er = (or - pal.r) * strength;
      const eg = (og - pal.g) * strength;
      const eb = (ob - pal.b) * strength;
      for (const [dx, dy, wgt] of kernel.offsets) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny >= H) continue;
        const nIdx = ny * W + nx;
        const k = wgt / kernel.denom;
        rBuf[nIdx] += er * k;
        gBuf[nIdx] += eg * k;
        bBuf[nIdx] += eb * k;
      }
    }
  }
  return out;
}
