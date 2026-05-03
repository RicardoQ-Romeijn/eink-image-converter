// Current working resolution (mutated when the display preset or portrait
// toggle change).
let W = 800, H = 480;

// Terminus (TRMNL) 1-bit BMP has fixed size at 800×480.
const TRMNL_W = 800, TRMNL_H = 480;
const TRMNL_BMP_SIZE = 48062;

// Common Waveshare / TRMNL-ish e-paper sizes, given in landscape
// orientation. Portrait toggle just swaps W/H.
const DISPLAYS = [
  { name: '7.5" / 7.3" 7-color / 4.26" — 800 × 480 (TRMNL, PhotoPainter)', w: 800, h: 480 },
  { name: '7.5" HD — 880 × 528',                 w: 880,  h: 528  },
  { name: '6" HD — 800 × 600',                   w: 800,  h: 600  },
  { name: '5.83" — 648 × 480',                   w: 648,  h: 480  },
  { name: '5.65" 7-color — 600 × 448',           w: 600,  h: 448  },
  { name: '4.2" — 400 × 300',                    w: 400,  h: 300  },
  { name: '4.01" 7-color — 640 × 400',           w: 640,  h: 400  },
  { name: '2.9" — 296 × 128',                    w: 296,  h: 128  },
  { name: '2.7" — 264 × 176',                    w: 264,  h: 176  },
  { name: '2.13" — 250 × 122',                   w: 250,  h: 122  },
  { name: '1.54" — 200 × 200',                   w: 200,  h: 200  },
  { name: '9.7" — 1200 × 825',                   w: 1200, h: 825  },
  { name: '10.3" — 1872 × 1404',                 w: 1872, h: 1404 },
  { name: '13.3" Spectra 6 — 1600 × 1200',       w: 1600, h: 1200 },
];
