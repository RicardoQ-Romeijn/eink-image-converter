// Standard 7-color e-paper palette (Waveshare / PhotoPainter). Verified
// against waveshareteam/PhotoPainter convert.py output.
const PALETTE_7 = [
  { r: 0,   g: 0,   b: 0   },
  { r: 255, g: 255, b: 255 },
  { r: 255, g: 0,   b: 0   },
  { r: 0,   g: 255, b: 0   },
  { r: 0,   g: 0,   b: 255 },
  { r: 255, g: 255, b: 0   },
  { r: 255, g: 128, b: 0   },
];

// Smaller palettes for the 2-bit modes (encoded as 4-bit BMP, see
// buildBmp4). Order matters — index 0 is what unused / clean pixels become.
const PALETTE_1BIT = [
  { r: 0,   g: 0,   b: 0   },
  { r: 255, g: 255, b: 255 },
];
const PALETTE_4GRAY = [
  { r: 0,   g: 0,   b: 0   },
  { r: 85,  g: 85,  b: 85  },
  { r: 170, g: 170, b: 170 },
  { r: 255, g: 255, b: 255 },
];
const PALETTE_BW_RED = [
  { r: 0,   g: 0,   b: 0   },
  { r: 255, g: 255, b: 255 },
  { r: 255, g: 0,   b: 0   },
];
const PALETTE_BW_YELLOW = [
  { r: 0,   g: 0,   b: 0   },
  { r: 255, g: 255, b: 255 },
  { r: 255, g: 255, b: 0   },
];

// Lookup-table for the Output dropdown. `chromatic` controls whether the
// saturation slider is meaningful; `encoder` picks the BMP path.
const OUTPUT_MODES = {
  '1bit':           { name: '1-bit B&W',    palette: PALETTE_1BIT,      encoder: 'bmp1',  chromatic: false },
  '4gray':          { name: '4-gray',       palette: PALETTE_4GRAY,     encoder: 'bmp4',  chromatic: false },
  '2bit-bw-red':    { name: 'B+W+Red',      palette: PALETTE_BW_RED,    encoder: 'bmp4',  chromatic: true  },
  '2bit-bw-yellow': { name: 'B+W+Yellow',   palette: PALETTE_BW_YELLOW, encoder: 'bmp4',  chromatic: true  },
  '7color':         { name: '7-color',      palette: PALETTE_7,         encoder: 'bmp24', chromatic: true  },
};
