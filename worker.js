importScripts('dmc-data.js');

// --- Color Science Utilities ---
function rgbToLab(r, g, b) {
  let r_ = r / 255, g_ = g / 255, b_ = b / 255;
  r_ = (r_ > 0.04045) ? Math.pow((r_ + 0.055) / 1.055, 2.4) : r_ / 12.92;
  g_ = (g_ > 0.04045) ? Math.pow((g_ + 0.055) / 1.055, 2.4) : g_ / 12.92;
  b_ = (b_ > 0.04045) ? Math.pow((b_ + 0.055) / 1.055, 2.4) : b_ / 12.92;

  let x = (r_ * 0.4124 + g_ * 0.3576 + b_ * 0.1805) / 0.95047;
  let y = (r_ * 0.2126 + g_ * 0.7152 + b_ * 0.0722) / 1.00000;
  let z = (r_ * 0.0193 + g_ * 0.1192 + b_ * 0.9505) / 1.08883;

  x = (x > 0.008856) ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
  y = (y > 0.008856) ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
  z = (z > 0.008856) ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;

  return { l: (116 * y) - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

function deltaE2000(lab1, lab2) {
  const L1 = lab1.l, a1 = lab1.a, b1 = lab1.b;
  const L2 = lab2.l, a2 = lab2.a, b2 = lab2.b;
  
  const avgL = (L1 + L2) / 2;
  const C1 = Math.sqrt(a1*a1 + b1*b1), C2 = Math.sqrt(a2*a2 + b2*b2);
  const avgC = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));
  
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.sqrt(a1p*a1p + b1*b1), C2p = Math.sqrt(a2p*a2p + b2*b2);
  const avgCp = (C1p + C2p) / 2;
  
  let h1p = (a1p === 0 && b1 === 0) ? 0 : Math.atan2(b1, a1p) * 180 / Math.PI;
  if (h1p < 0) h1p += 360;
  let h2p = (a2p === 0 && b2 === 0) ? 0 : Math.atan2(b2, a2p) * 180 / Math.PI;
  if (h2p < 0) h2p += 360;
  
  let delthp = 0;
  if (C1p !== 0 && C2p !== 0) {
    if (Math.abs(h2p - h1p) <= 180) delthp = h2p - h1p;
    else if (h2p - h1p > 180) delthp = h2p - h1p - 360;
    else delthp = h2p - h1p + 360;
  }
  
  const deltL = L2 - L1, deltC = C2p - C1p, deltH = 2 * Math.sqrt(C1p * C2p) * Math.sin((delthp / 2) * Math.PI / 180);
  
  let avghp = h1p + h2p;
  if (C1p !== 0 && C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) avghp = (h1p + h2p) / 2;
    else if (h1p + h2p < 360) avghp = (h1p + h2p + 360) / 2;
    else avghp = (h1p + h2p - 360) / 2;
  }
  
  const T = 1 - 0.17 * Math.cos((avghp - 30) * Math.PI / 180) + 0.24 * Math.cos(2 * avghp * Math.PI / 180) 
            + 0.32 * Math.cos((3 * avghp + 6) * Math.PI / 180) - 0.20 * Math.cos((4 * avghp - 63) * Math.PI / 180);
            
  const sl = 1 + (0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2));
  const sc = 1 + 0.045 * avgCp;
  const sh = 1 + 0.015 * avgCp * T;
  
  const deltTheta = 30 * Math.exp(-Math.pow((avghp - 275) / 25, 2));
  const Rc = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
  const RT = -Math.sin(2 * deltTheta * Math.PI / 180) * Rc;
  
  const dE = Math.sqrt(Math.pow(deltL / sl, 2) + Math.pow(deltC / sc, 2) + Math.pow(deltH / sh, 2) + RT * (deltC / sc) * (deltH / sh));
  return dE;
}

const colorCache = new Map();

// Pre-calculate LAB for all DMC colors once
for (const c of DMC_COLORS) {
  if (!c.lab) c.lab = rgbToLab(c.r, c.g, c.b);
}

function findClosestDMC(rgb) {
  // Quantize to multiples of 4 (drops bottom 2 bits) — finer than 8 for better dark color separation
  const cr = rgb.r & 0xFC;
  const cg = rgb.g & 0xFC;
  const cb = rgb.b & 0xFC;
  const cacheKey = (cr << 16) | (cg << 8) | cb;
  
  if (colorCache.has(cacheKey)) return colorCache.get(cacheKey);

  const lab1 = rgbToLab(cr, cg, cb);
  let min = Infinity, best = DMC_COLORS[0];
  
  for(let i = 0; i < DMC_COLORS.length; i++){
    const c = DMC_COLORS[i];
    const d = deltaE2000(lab1, c.lab);
    if(d < min){ min = d; best = c; }
  }
  
  colorCache.set(cacheKey, best);
  return best;
}

onmessage = function(e) {
  const { data, w, h, maxColors, ditherStrength } = e.data;
  
  self.postMessage({ type: 'progress', percent: 5, text: 'Аналіз кольорів...' });

  const initialDMC = [];
  const counts = {};
  
  // 1. Initial rough map to count frequencies
  for(let i=0; i<data.length; i+=4){
    if(data[i+3] < 128) { 
      initialDMC.push(null); 
    } else {
      const c = findClosestDMC({r:data[i], g:data[i+1], b:data[i+2]});
      initialDMC.push(c);
      counts[c.code] = (counts[c.code] || 0) + 1;
    }
  }
  
  self.postMessage({ type: 'progress', percent: 15, text: 'Підбір палітри...' });
  
  // 2. Lightness-Balanced Palette Selection
  // Split colors into lightness bands so dark shades don't get starved
  const sortedCodes = Object.keys(counts).sort((a,b) => counts[b] - counts[a]);
  
  // Ensure all candidates have LAB
  const codeToColor = new Map();
  for (const code of sortedCodes) {
    const c = DMC_COLORS.find(col => col.code === code);
    if (!c.lab) c.lab = rgbToLab(c.r, c.g, c.b);
    codeToColor.set(code, c);
  }
  
  // Group codes by lightness band and count total pixels per band
  const bands = [
    { name: 'dark',  maxL: 35, codes: [], pixels: 0, threshold: 2.0 },
    { name: 'mid',   maxL: 65, codes: [], pixels: 0, threshold: 3.0 },
    { name: 'light', maxL: 101, codes: [], pixels: 0, threshold: 4.0 }
  ];
  
  for (const code of sortedCodes) {
    const c = codeToColor.get(code);
    const L = c.lab.l;
    const band = bands.find(b => L < b.maxL);
    band.codes.push(code);
    band.pixels += counts[code];
  }
  
  const totalPixels = bands.reduce((s, b) => s + b.pixels, 0) || 1;
  
  // Allocate proportional slots per band (minimum 2 slots if band has any pixels)
  bands.forEach(b => {
    if (b.pixels > 0) {
      b.slots = Math.max(2, Math.round((b.pixels / totalPixels) * maxColors));
    } else {
      b.slots = 0;
    }
  });
  
  // Normalize so total slots = maxColors
  let totalSlots = bands.reduce((s, b) => s + b.slots, 0);
  while (totalSlots > maxColors) {
    // Remove from the band with the most slots
    const biggest = bands.reduce((a, b) => (a.slots > b.slots ? a : b));
    biggest.slots--;
    totalSlots--;
  }
  while (totalSlots < maxColors) {
    // Add to the band with the most pixels relative to its slots
    const neediest = bands.filter(b => b.pixels > 0)
      .reduce((a, b) => ((a.pixels / (a.slots || 1)) > (b.pixels / (b.slots || 1)) ? a : b));
    neediest.slots++;
    totalSlots++;
  }
  
  // Select diverse colors within each band
  const paletteCodes = [];
  
  for (const band of bands) {
    let picked = 0;
    for (const code of band.codes) {
      if (picked >= band.slots) break;
      const c = codeToColor.get(code);
      
      let tooSimilar = false;
      for (const existingCode of paletteCodes) {
        const pCol = codeToColor.get(existingCode) || DMC_COLORS.find(col => col.code === existingCode);
        if (!pCol.lab) pCol.lab = rgbToLab(pCol.r, pCol.g, pCol.b);
        if (deltaE2000(c.lab, pCol.lab) < band.threshold) {
          tooSimilar = true;
          break;
        }
      }
      if (!tooSimilar) {
        paletteCodes.push(code);
        picked++;
      }
    }
    // Backfill this band if threshold was too strict
    for (const code of band.codes) {
      if (picked >= band.slots) break;
      if (!paletteCodes.includes(code)) {
        paletteCodes.push(code);
        picked++;
      }
    }
  }
  
  const palette = paletteCodes.map(code => DMC_COLORS.find(c => c.code === code));
  
  self.postMessage({ type: 'progress', percent: 25, text: 'Малювання хрестиків...' });
  
  // 3. Re-map non-palette colors with Floyd-Steinberg Dithering
  const result = new Array(w * h).fill(null);
  const rgbData = new Float32Array(w * h * 3);
  for(let i=0, j=0; i<data.length; i+=4, j+=3){
    rgbData[j] = data[i];
    rgbData[j+1] = data[i+1];
    rgbData[j+2] = data[i+2];
  }
  
  // Custom cache for palette lookup
  const paletteCache = new Map();
  
  for(let y=0; y<h; y++){
    // Report progress every 10 rows
    if (y % 10 === 0) {
      const progress = 25 + Math.floor((y / h) * 75);
      self.postMessage({ type: 'progress', percent: progress, text: 'Малювання хрестиків...' });
    }
    
    for(let x=0; x<w; x++){
      const alpha = data[(y*w + x) * 4 + 3];
      if(alpha < 128) continue;
      
      const idx = (y*w + x) * 3;
      let r = rgbData[idx], g = rgbData[idx+1], b = rgbData[idx+2];
      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));
      
      // Quantize slightly for cache hit rates, but less aggressively than first pass
      const cr = Math.round(r) & 0xFC; // multiple of 4
      const cg = Math.round(g) & 0xFC;
      const cb = Math.round(b) & 0xFC;
      const cacheKey = (cr << 16) | (cg << 8) | cb;
      
      let best;
      
      if (paletteCache.has(cacheKey)) {
         best = paletteCache.get(cacheKey);
      } else {
         const labC = rgbToLab(cr, cg, cb);
         let min = Infinity;
         best = palette[0];
         for(let i=0; i<palette.length; i++){
           const pc = palette[i];
           const d = deltaE2000(labC, pc.lab);
           if(d < min){ min = d; best = pc; }
         }
         paletteCache.set(cacheKey, best);
      }
      
      result[y*w + x] = best;
      
      // Distribute error
      if (ditherStrength > 0) {
        const rgbDist = Math.sqrt((r - best.r)*(r - best.r) + (g - best.g)*(g - best.g) + (b - best.b)*(b - best.b));
        // Attenuate error diffusion if the match is poor to prevent black/dirty salt-and-pepper noise.
        // If the distance is > 65, the color is from an entirely different family (e.g. pink mapping to black/green).
        // Attenuation goes from 1.0 (perfect match) to 0.0 (poor match).
        const attenuation = Math.max(0, Math.min(1, 1.3 - rgbDist / 70));
        const errR = (r - best.r) * ditherStrength * attenuation;
        const errG = (g - best.g) * ditherStrength * attenuation;
        const errB = (b - best.b) * ditherStrength * attenuation;
        
        const distribute = (dx, dy, weight) => {
          if(x+dx >= 0 && x+dx < w && y+dy < h) {
            const nidx = ((y+dy)*w + (x+dx)) * 3;
            rgbData[nidx] += errR * weight;
            rgbData[nidx+1] += errG * weight;
            rgbData[nidx+2] += errB * weight;
          }
        };
        
        distribute(1, 0, 7/16);
        distribute(-1, 1, 3/16);
        distribute(0, 1, 5/16);
        distribute(1, 1, 1/16);
      }
    }
  }
  
  self.postMessage({ type: 'done', result: result, w: w, h: h });
};
