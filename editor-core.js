class Editor {
  constructor(w = 80, h = 80){
    this.mc = document.getElementById('main-canvas');
    this.ctx = this.mc.getContext('2d');
    this.gc = document.getElementById('grid-canvas');
    this.gctx = this.gc.getContext('2d');
    this.pc = document.getElementById('preview-canvas');
    this.pctx = this.pc ? this.pc.getContext('2d') : null;
    this.w = w; this.h = h; this.cell = 20;
    this.data = new Array(this.w * this.h).fill(null);
    this.canvasColor = '#ffffff';
    this.gridColor = '#94a3b8';
    this.history = []; this.future = [];
    this.brushHighlights = new Set();
    this.symbolMap = {}; // pattern-specific symbols
    this.lockedColors = new Set(); // colors that are locked/frozen in the palette
    this.resolution = 2; // 2x resolution for sharpness at zoom
    this.backstitch = [];
    this.extraPaletteColors = [];
    this.underlayImg = null;
    this.underlayOpacity = 0.5;
    this.SYMBOLS_POOL = [
      // Upper case letters first (high legibility)
      'A','B','C','D','E','F','G','H','I','J','K','L','M','N','P','Q','R','S','T','U','V','W','X','Y','Z',
      // Numbers
      '1','2','3','4','5','6','7','8','9',
      // Standard visual indicators / symbols
      '+','-','*','=','%','?','$','@','&','#','!','^','_','.',
      '¢','£','¤','¥','§','°','±','¶','¿','Ø','÷',
      // Bracket symbols
      ':',';','~','|','(',')','[',']','{','}','<','>'
    ];

    this.aidaImg = new Image();
    if(window.ASSETS) this.aidaImg.src = ASSETS.aida;
    else this.aidaImg.src = 'aida.jpg'; // fallback
    this.aidaImg.onload = () => { this.drawGrid(); this.render(); };
    this.stitchImg = new Image();
    if(window.ASSETS) this.stitchImg.src = ASSETS.stitch;
    else this.stitchImg.src = 'stitch.png'; // fallback
    this.stitchImg.onload = () => { this.render(); };

    this.mc.width = w * this.cell * this.resolution;
    this.mc.height = h * this.cell * this.resolution;
    this.mc.style.width = (w * this.cell) + 'px';
    this.mc.style.height = (h * this.cell) + 'px';
    this.ctx.scale(this.resolution, this.resolution);
    this.gc.width = (w * this.cell + 60) * this.resolution;
    this.gc.height = (h * this.cell + 60) * this.resolution;
    this.gc.style.width = (w * this.cell + 60) + 'px';
    this.gc.style.height = (h * this.cell + 60) + 'px';
    this.gctx.scale(this.resolution, this.resolution);

    this.initEvents();
  }

  // ─── Events ──────────────────────────────────────────────
  initEvents(){
    let isDrawing = false;
    let lastX = -1, lastY = -1;
    let startX = -1, startY = -1;
    let isPanning = false;
    let panStartX, panStartY, scrollStartX, scrollStartY;

    const getPos = e => {
      const rect = this.mc.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / rect.width * this.w);
      const y = Math.floor((e.clientY - rect.top) / rect.height * this.h);
      return {x, y};
    };

    const getIntersectionPos = e => {
      const rect = this.mc.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) / rect.width * this.w);
      const y = Math.round((e.clientY - rect.top) / rect.height * this.h);
      return {x, y};
    };

    const getLinePoints = (x0, y0, x1, y1) => {
      const points = [];
      let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
      let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
      let err = dx + dy, e2;
      while (true) {
        points.push({x: x0, y: y0});
        if (x0 === x1 && y0 === y1) break;
        e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
      return points;
    };

    const getRectPoints = (x0, y0, x1, y1) => {
      const points = [];
      const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
      const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
      for(let x=minX; x<=maxX; x++){ points.push({x, y:minY}); points.push({x, y:maxY}); }
      for(let y=minY+1; y<maxY; y++){ points.push({x:minX, y}); points.push({x:maxX, y}); }
      return points;
    };

    const isPointInBrush = (dx, dy, bs, shape) => {
      if (shape !== 'round' || bs <= 1) return true;
      const center = (bs - 1) / 2;
      const distSq = Math.pow(dx - center, 2) + Math.pow(dy - center, 2);
      return distSq <= Math.pow(bs / 2, 2);
    };

    const applyTool = (x, y) => {
      if(x < 0 || x >= this.w || y < 0 || y >= this.h) return;

      const a = window.app;
      if(!a) return;
      const bs = a.brushSize || 1;
      const shape = a.brushShape || 'square';
      const offset = Math.floor(bs / 2);
      if(a.tool === 'pencil'){
        for(let dy = 0; dy < bs; dy++)
          for(let dx = 0; dx < bs; dx++){
            if (!isPointInBrush(dx, dy, bs, shape)) continue;
            const cx = x + dx - offset, cy = y + dy - offset;
            if(cx >= 0 && cx < this.w && cy >= 0 && cy < this.h) {
              this.data[cy*this.w+cx] = a.color;
              this.updateCellView(cx, cy);
            }
          }
      } else if(a.tool === 'eraser'){
        for(let dy = 0; dy < bs; dy++)
          for(let dx = 0; dx < bs; dx++){
            if (!isPointInBrush(dx, dy, bs, shape)) continue;
            const cx = x + dx - offset, cy = y + dy - offset;
            if(cx >= 0 && cx < this.w && cy >= 0 && cy < this.h) {
              this.data[cy*this.w+cx] = null;
              this.updateCellView(cx, cy);
            }
          }
        // Also erase backstitch
        if(this.backstitch && this.backstitch.length > 0){
          const radius = bs / 2;
          const centerX = x + 0.5;
          const centerY = y + 0.5;
          const initialCount = this.backstitch.length;
          this.backstitch = this.backstitch.filter(line => {
            return this._distToSegment(centerX, centerY, line.x1, line.y1, line.x2, line.y2) > radius;
          });
          if(this.backstitch.length !== initialCount) this.render();
        }
      } else if(a.tool === 'picker'){
        const c = this.data[y*this.w + x];
        if(c) a.selectColor(c);
      } else if(a.tool === 'fill'){
        this.floodFill(x, y, a.color);
      } else if(a.tool === 'magic_eraser'){
        if (a.replaceMode === 'global') {
          const targetColor = this.data[y*this.w + x];
          if(targetColor) {
            for(let i=0; i<this.data.length; i++) {
              if(this.data[i] && this.data[i].code === targetColor.code) this.data[i] = null;
            }
            this.render(); this.updateStats();
          }
        } else {
          this.floodFill(x, y, null);
        }
      } else if(a.tool === 'global_replace'){
        if (a.replaceMode === 'global') {
          const targetColor = this.data[y*this.w + x];
          if(targetColor && (targetColor.code !== a.color.code)) {
            for(let i=0; i<this.data.length; i++) {
              if(this.data[i] && this.data[i].code === targetColor.code) this.data[i] = a.color;
            }
            this.render(); this.updateStats();
          }
        } else {
          this.floodFill(x, y, a.color);
        }
      } else if(a.tool === 'anticonfetti'){
        const threshold = parseInt(document.getElementById('confetti-threshold').value) || 1;
        const distance = parseInt(document.getElementById('confetti-distance')?.value) || 3;
        for(let dy = 0; dy < bs; dy++) {
          for(let dx = 0; dx < bs; dx++){
            const cx = x + dx - offset, cy = y + dy - offset;
            if(cx >= 0 && cx < this.w && cy >= 0 && cy < this.h) {
              this.removeSingleConfetti(cx, cy, threshold, distance);
              this.brushHighlights.add(`${cx},${cy}`);
              this.updateCellView(cx, cy);
            }
          }
        }
      }
    };

    this.mc.addEventListener('mousedown', e => {
      if(window.app && window.app.tool === 'pan') {
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        const w = document.getElementById('canvas-wrapper');
        if(w) {
            scrollStartX = w.scrollLeft;
            scrollStartY = w.scrollTop;
        }
        this.mc.style.cursor = 'grabbing';
        return;
      }

      if (window.app && window.app.tool === 'backstitch') {
        const {x, y} = getIntersectionPos(e);
        this.saveHistory();
        isDrawing = true;
        startX = x; startY = y;
        lastX = x; lastY = y;
        return;
      }

      this.saveHistory();
      isDrawing = true;
      const {x, y} = getPos(e);
      startX = x; startY = y;
      lastX = x; lastY = y;
      
      if (window.app && (window.app.tool !== 'line' && window.app.tool !== 'rect')) {
        applyTool(x, y);
      }
      // Update status coordinates
      if(window.app) {
        const sx = document.getElementById('status-x');
        const sy = document.getElementById('status-y');
        if(sx) sx.textContent = x;
        if(sy) sy.textContent = y;
      }
    });

    // Use addEventListener so it won't be overwritten by resizer's document.onmousemove
    document.addEventListener('mousemove', e => {
      if (isPanning) {
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        const w = document.getElementById('canvas-wrapper');
        if(w) {
          w.scrollLeft = scrollStartX - dx;
          w.scrollTop = scrollStartY - dy;
        }
        return;
      }

      const {x, y} = getPos(e);
      // Update coordinates in status bar
      if(window.app) {
        const sx = document.getElementById('status-x');
        const sy = document.getElementById('status-y');
        if(sx) sx.textContent = x;
        if(sy) sy.textContent = y;
      }
      if(!isDrawing) return;

      if (window.app && window.app.tool === 'backstitch') {
        const {x, y} = getIntersectionPos(e);
        lastX = x; lastY = y;
        if(this.pctx) {
          const s = this.cell;
          this.pctx.clearRect(0, 0, this.pc.width, this.pc.height);
          this.pctx.strokeStyle = window.app.color.hex;
          this.pctx.lineWidth = 4;
          this.pctx.lineCap = 'round';
          this.pctx.beginPath();
          this.pctx.moveTo(startX * s, startY * s);
          this.pctx.lineTo(x * s, y * s);
          this.pctx.stroke();
        }
        return;
      }
      
      if (window.app && (window.app.tool === 'line' || window.app.tool === 'rect')) {
         lastX = x; lastY = y;
         if(this.pctx) {
           this.pctx.clearRect(0, 0, this.pc.width, this.pc.height);
           const points = window.app.tool === 'line' ? getLinePoints(startX, startY, x, y) : getRectPoints(startX, startY, x, y);
           const bs = window.app.brushSize || 1;
           const shape = window.app.brushShape || 'square';
           const offset = Math.floor(bs/2);
           this.pctx.fillStyle = window.app.color ? window.app.color.hex : '#000';
           const s = this.cell;
           
           for(const p of points) {
             for(let dy=0; dy<bs; dy++) {
               for(let dx=0; dx<bs; dx++) {
                 if (!isPointInBrush(dx, dy, bs, shape)) continue;
                 const cx = p.x + dx - offset, cy = p.y + dy - offset;
                 if(cx >=0 && cx < this.w && cy>=0 && cy<this.h) {
                   this.pctx.fillRect(cx * s, cy * s, s, s);
                 }
               }
             }
           }
         }
         return;
      }

      const continuousTools = ['pencil', 'eraser', 'anticonfetti', 'picker'];
      if (window.app && continuousTools.includes(window.app.tool)) {
        // Interpolate for smooth drawing
        const dist = Math.max(Math.abs(x - lastX), Math.abs(y - lastY));
        if (dist > 1) {
          for (let i = 1; i <= dist; i++) {
            const ix = Math.round(lastX + (x - lastX) * (i / dist));
            const iy = Math.round(lastY + (y - lastY) * (i / dist));
            applyTool(ix, iy);
          }
        } else {
          applyTool(x, y);
        }
      }
      lastX = x; lastY = y;
    });

    document.addEventListener('mouseup', () => { 
      if(isDrawing) {
        if(window.app && (window.app.tool === 'line' || window.app.tool === 'rect')){
          if(this.pctx) this.pctx.clearRect(0,0,this.pc.width, this.pc.height);
          const points = window.app.tool === 'line' ? getLinePoints(startX, startY, lastX, lastY) : getRectPoints(startX, startY, lastX, lastY);
          const bs = window.app.brushSize || 1;
          const shape = window.app.brushShape || 'square';
          const offset = Math.floor(bs/2);
          for(const p of points){
             for(let dy=0; dy<bs; dy++){
               for(let dx=0; dx<bs; dx++){
                 if (!isPointInBrush(dx, dy, bs, shape)) continue;
                 const cx = p.x + dx - offset, cy = p.y + dy - offset;
                 if(cx >=0 && cx < this.w && cy>=0 && cy<this.h) this.data[cy*this.w+cx] = window.app.color;
               }
             }
          }
        } else if (window.app && window.app.tool === 'backstitch') {
          if (startX !== lastX || startY !== lastY) {
            this.backstitch.push({
              x1: startX, y1: startY,
              x2: lastX, y2: lastY,
              color: window.app.color
            });
          }
          if(this.pctx) this.pctx.clearRect(0, 0, this.pc.width, this.pc.height);
        }
        this.assignSymbols();
        this.render();
        this.updateStats();
      }
      isDrawing = false; 
      if (isPanning) {
        isPanning = false;
        this.mc.style.cursor = '';
      }
    });
  }

  // ─── Data Operations ──────────────────────────────────────
  setCell(x, y, color){
    const idx = y * this.w + x;
    if(this.data[idx] === color) return;
    this.data[idx] = color;
    this.render(); this.updateStats();
  }

  floodFill(x, y, color){
    if(x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const target = this.data[y*this.w + x];
    
    // If we're filling with the same color, do nothing
    if(target === color) return;
    if(target && color && target.code === color.code) return;

    const tolerance = window.app && window.app.fillTolerance !== undefined ? window.app.fillTolerance : 0;
    const maxDist = 441.67; // sqrt(255^2 * 3)
    const thresholdDist = (tolerance / 100) * maxDist;

    const isMatch = (c) => {
      if (target === null) return c === null;
      if (c === null) return false;
      if (tolerance === 0) return c.code === target.code;
      
      // Calculate RGB distance
      const dr = (c.r || 0) - (target.r || 0);
      const dg = (c.g || 0) - (target.g || 0);
      const db = (c.b || 0) - (target.b || 0);
      const dist = Math.sqrt(dr*dr + dg*dg + db*db);
      return dist <= thresholdDist;
    };


    const visited = new Uint8Array(this.w * this.h);
    const stack = [y * this.w + x];
    visited[y * this.w + x] = 1;

    let changed = false;
    while(stack.length > 0){
      const idx = stack.pop();
      const currentCell = this.data[idx];
      
      if(!isMatch(currentCell)) continue;
      
      this.data[idx] = color;
      changed = true;
      
      const px = idx % this.w;
      const py = Math.floor(idx / this.w);

      // Add neighbors
      if(px > 0 && !visited[idx - 1]) { visited[idx - 1] = 1; stack.push(idx - 1); }
      if(px < this.w - 1 && !visited[idx + 1]) { visited[idx + 1] = 1; stack.push(idx + 1); }
      if(py > 0 && !visited[idx - this.w]) { visited[idx - this.w] = 1; stack.push(idx - this.w); }
      if(py < this.h - 1 && !visited[idx + this.w]) { visited[idx + this.w] = 1; stack.push(idx + this.w); }
    }
    
    if (changed) {
      this.assignSymbols();
      this.render(); 
      this.updateStats();
    }
  }

  assignSymbols(){
    const used = this.getUsedColors();
    const currentCodes = used.map(u => u.color.code);
    
    // Remove symbols for colors no longer used
    for(const code in this.symbolMap) {
      if(!currentCodes.includes(code)) delete this.symbolMap[code];
    }

    // Resolve any duplicate symbols if present
    const seenSymbols = new Set();
    const duplicates = [];
    currentCodes.forEach(code => {
      const sym = this.symbolMap[code];
      if (sym) {
        if (seenSymbols.has(sym)) {
          duplicates.push(code);
        } else {
          seenSymbols.add(sym);
        }
      }
    });
    // Remove duplicate symbol mappings so they get assigned uniquely below
    duplicates.forEach(code => {
      delete this.symbolMap[code];
    });

    // Assign new symbols uniquely
    let poolIdx = 0;
    used.forEach(u => {
      if(!this.symbolMap[u.color.code]) {
        // Find a symbol not already in use in this pattern
        const usedSymbols = Object.values(this.symbolMap);
        while(poolIdx < this.SYMBOLS_POOL.length && usedSymbols.includes(this.SYMBOLS_POOL[poolIdx])) {
          poolIdx++;
        }
        this.symbolMap[u.color.code] = poolIdx < this.SYMBOLS_POOL.length ? this.SYMBOLS_POOL[poolIdx] : '?';
        poolIdx++;
      }
    });
  }

  resize(w, h, preserveData = false){
    const oldW = this.w;
    const oldH = this.h;
    const oldData = preserveData ? [...this.data] : [];

    this.w = w; this.h = h;
    this.data = new Array(w * h).fill(null);
    
    if (preserveData) {
      // Just copy directly up to the old dimensions (for crops without shifting)
      for(let y=0; y < Math.min(h, oldH); y++) {
        for(let x=0; x < Math.min(w, oldW); x++) {
          this.data[y * w + x] = oldData[y * oldW + x];
        }
      }
    } else {
      this.symbolMap = {};
    }

    this.mc.width = w * this.cell * this.resolution;
    this.mc.height = h * this.cell * this.resolution;
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.scale(this.resolution, this.resolution);
    this.drawGrid(); this.render(); this.updateStats();
  }

  resample(newW, newH) {
    if(!this.data || this.data.length === 0) return this.resize(newW, newH);
    this.saveHistory();
    
    // Draw current pixel data to offscreen canvas
    const oldC = document.createElement('canvas');
    oldC.width = this.w; oldC.height = this.h;
    const oldCtx = oldC.getContext('2d', { willReadFrequently: true });
    
    // Fill background so we can ignore transparent pixels later? 
    // No, keep them transparent so we preserve nulls.
    const id = oldCtx.createImageData(this.w, this.h);
    const d = id.data;
    for(let i=0; i < this.data.length; i++) {
      const c = this.data[i];
      if(c) {
        d[i*4] = c.r; d[i*4+1] = c.g; d[i*4+2] = c.b; d[i*4+3] = 255;
      }
    }
    oldCtx.putImageData(id, 0, 0);

    // Scale onto new canvas
    const newC = document.createElement('canvas');
    newC.width = newW; newC.height = newH;
    const newCtx = newC.getContext('2d', { willReadFrequently: true });
    newCtx.imageSmoothingEnabled = false;
    newCtx.drawImage(oldC, 0, 0, newW, newH);

    const newId = newCtx.getImageData(0, 0, newW, newH);
    const nd = newId.data;

    // Use current palette to snap pixels back to objects
    const used = this.getUsedColors().map(u => u.color);
    // If no colors used yet, just resize empty
    if(used.length === 0) return this.resize(newW, newH);

    this.w = newW; this.h = newH;
    this.data = new Array(newW * newH).fill(null);

    // Snap to nearest palette color using pure RGB distance since they are already from the same palette
    for(let i=0; i < newW * newH; i++) {
      if(nd[i*4+3] < 128) continue;
      const r = nd[i*4], g = nd[i*4+1], b = nd[i*4+2];
      let best = used[0];
      let min = Infinity;
      for(const pc of used) {
        const dist = (pc.r - r)**2 + (pc.g - g)**2 + (pc.b - b)**2;
        if(dist < min) { min = dist; best = pc; }
      }
      this.data[i] = best;
    }

    this.mc.width = newW * this.cell * this.resolution;
    this.mc.height = newH * this.cell * this.resolution;
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.scale(this.resolution, this.resolution);
    this.drawGrid(); this.render(); this.updateStats();
  }

  expandCanvas(direction, amount) {
    if(amount === 0) return;
    this.saveHistory();
    const oldW = this.w; const oldH = this.h;
    const oldData = [...this.data];
    
    let newW = oldW; let newH = oldH;
    let offsetX = 0; let offsetY = 0;

    switch(direction) {
      case 'top': newH += amount; offsetY = amount; break;
      case 'bottom': newH += amount; break;
      case 'left': newW += amount; offsetX = amount; break;
      case 'right': newW += amount; break;
    }

    // Crop support if amount < 0
    if (newW < 1) newW = 1;
    if (newH < 1) newH = 1;
    if (offsetX < 0) offsetX = 0;
    if (offsetY < 0) offsetY = 0;

    this.w = newW; this.h = newH;
    this.data = new Array(newW * newH).fill(null);

    // Copy shifted pixels
    for(let y=0; y < oldH; y++) {
      for(let x=0; x < oldW; x++) {
        const nx = x + (direction === 'left' ? amount : 0);
        const ny = y + (direction === 'top' ? amount : 0);
        
        if(nx >= 0 && nx < newW && ny >= 0 && ny < newH) {
          this.data[ny * newW + nx] = oldData[y * oldW + x];
        }
      }
    }

    this.mc.width = newW * this.cell * this.resolution;
    this.mc.height = newH * this.cell * this.resolution;
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.scale(this.resolution, this.resolution);
    this.drawGrid(); this.render(); this.updateStats();
  }

  // ─── Grid & Rulers ──────────────────────────────────────
  drawGrid(){
    if(!this.gctx) return;
    const g = this.gctx; const s = this.cell; const off = 30;
    const w = this.w * s + off*2; const h = this.h * s + off*2;
    
    this.gc.width = w * this.resolution; this.gc.height = h * this.resolution;
    this.gc.style.width = w + 'px'; this.gc.style.height = h + 'px';
    
    const targetMcW = this.w * s * this.resolution;
    const targetMcH = this.h * s * this.resolution;
    
    if (this.mc.width !== targetMcW || this.mc.height !== targetMcH) {
      this.mc.width = targetMcW;
      this.mc.height = targetMcH;
      this.ctx.setTransform(1,0,0,1,0,0);
      this.ctx.scale(this.resolution, this.resolution);
      if (this.pc) {
        this.pc.width = targetMcW;
        this.pc.height = targetMcH;
        this.pctx.setTransform(1,0,0,1,0,0);
        this.pctx.scale(this.resolution, this.resolution);
      }
    }
    
    this.mc.style.width = (this.w * s) + 'px'; 
    this.mc.style.height = (this.h * s) + 'px';
    if (this.pc) {
      this.pc.style.width = (this.w * s) + 'px';
      this.pc.style.height = (this.h * s) + 'px';
    }

    const container = document.getElementById('canvas-container');
    if(container) {
      container.style.width = w + 'px';
      container.style.height = h + 'px';
    }

    g.setTransform(1,0,0,1,0,0);
    g.scale(this.resolution, this.resolution);
    g.clearRect(0, 0, w, h);
    if(window.app && !window.app.showGrid) return;

    // ── Ruler Tick Marks ──
    g.strokeStyle = '#64748b'; g.lineWidth = 1;
    const len = 6;
    for(let x = 0; x <= this.w; x++){
      const xPos = Math.round(x*s + off);
      if(x % 10 === 0) continue;
      // Top ticks
      g.beginPath(); g.moveTo(xPos, off - len); g.lineTo(xPos, off); g.stroke();
      // Bottom ticks
      g.beginPath(); g.moveTo(xPos, h - off); g.lineTo(xPos, h - off + len); g.stroke();
    }
    for(let y = 0; y <= this.h; y++){
      const yPos = Math.round(y*s + off);
      if(y % 10 === 0) continue;
      // Left ticks
      g.beginPath(); g.moveTo(off - len, yPos); g.lineTo(off, yPos); g.stroke();
      // Right ticks
      g.beginPath(); g.moveTo(w - off, yPos); g.lineTo(w - off + len, yPos); g.stroke();
    }

    // ── Grid Lines ──
    g.strokeStyle = this.gridColor || '#94a3b8';
    for(let x = 0; x <= this.w; x++){
      const xPos = Math.round(x*s + off);
      g.lineWidth = (x % 10 === 0) ? 2 : 1;
      g.beginPath(); g.moveTo(xPos, off); g.lineTo(xPos, h - off); g.stroke();
    }
    for(let y = 0; y <= this.h; y++){
      const yPos = Math.round(y*s + off);
      g.lineWidth = (y % 10 === 0) ? 2 : 1;
      g.beginPath(); g.moveTo(off, yPos); g.lineTo(w - off, yPos); g.stroke();
    }

    // ── Numbers ──
    g.fillStyle = '#4f46e5'; g.font = 'bold 11px Inter, sans-serif'; g.textAlign = 'center';
    for(let x = 0; x <= this.w; x += 10){
      g.fillText(x, x*s + off, off - 12);          // Top
      g.fillText(x, x*s + off, h - off + 18);       // Bottom
    }
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for(let y = 0; y <= this.h; y += 10){
      g.fillText(y, off - 14, y*s + off);            // Left
    }
    g.textAlign = 'left';
    for(let y = 0; y <= this.h; y += 10){
      g.fillText(y, w - off + 14, y*s + off);        // Right
    }

    // ── Center Lines ──
    if(window.app && window.app.showCenterLines){
      g.strokeStyle = '#ef4444'; // Red
      g.lineWidth = 2.5;
      const centerX = Math.floor(this.w / 2) * s + off;
      const centerY = Math.floor(this.h / 2) * s + off;
      
      // Vertical center line
      g.beginPath(); g.moveTo(centerX, off); g.lineTo(centerX, h - off); g.stroke();
      // Horizontal center line
      g.beginPath(); g.moveTo(off, centerY); g.lineTo(w - off, centerY); g.stroke();
    }
  }

  // ─── Render ──────────────────────────────────────────────
  render(){
    if(!this.ctx) return;
    
    // Cancel any ongoing render
    if (this.renderTimer) cancelAnimationFrame(this.renderTimer);
    
    this.assignSymbols();
    const ctx = this.ctx; const s = this.cell;
    const w = this.w * s; const h = this.h * s;
    ctx.clearRect(0, 0, w, h);

    const container = document.getElementById('canvas-container');
    const viewport = {
      left: container ? container.scrollLeft : 0,
      top: container ? container.scrollTop : 0,
      width: container ? container.clientWidth : window.innerWidth,
      height: container ? container.clientHeight : window.innerHeight
    };

    const startX = Math.max(0, Math.floor(viewport.left / s) - 1);
    const endX = Math.min(this.w, Math.ceil((viewport.left + viewport.width) / s) + 1);
    const startY = Math.max(0, Math.floor(viewport.top / s) - 1);
    const endY = Math.min(this.h, Math.ceil((viewport.top + viewport.height) / s) + 1);

    // 0. Draw Underlay Image (Reference)
    if (this.underlayImg) {
      ctx.save();
      ctx.globalAlpha = this.underlayOpacity;
      ctx.drawImage(this.underlayImg, 0, 0, this.w * s, this.h * s);
      ctx.restore();
    }

    // 1. Draw fabric BEHIND stitches
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    if(this.aidaImg.complete && this.aidaImg.naturalWidth > 0){
      if (!this._aidaPattern || this._aidaLastCell !== s) {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = s; offCanvas.height = s;
        const offCtx = offCanvas.getContext('2d');
        offCtx.imageSmoothingEnabled = false;
        offCtx.drawImage(this.aidaImg, 0, 0, s, s);
        this._aidaPattern = ctx.createPattern(offCanvas, 'repeat');
        this._aidaLastCell = s;
      }
      
      if(this._aidaPattern){
        ctx.fillStyle = this._aidaPattern;
        ctx.globalAlpha = 0.5;
        // Only fill the visible area
        ctx.fillRect(startX * s, startY * s, (endX - startX) * s, (endY - startY) * s);
      }
    }

    // 2. Canvas color behind everything
    ctx.globalCompositeOperation = 'destination-over';
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = this.canvasColor;
    ctx.fillRect(startX * s, startY * s, (endX - startX) * s, (endY - startY) * s);
    ctx.restore();

    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over';
    
    // 3. Render stitches keeping UI responsive (time-sliced)
    let curY = startY;
    
    const drawChunk = () => {
      const startTime = performance.now();
      
      while(curY < endY) {
        for(let x = startX; x < endX; x++) {
          const color = this.data[curY * this.w + x];
          if(color){
            const highlighted = (window.app && window.app.highlightedColor)
              ? color.code === window.app.highlightedColor.code : true;
            
            // Hide symbols if zoomed out too much (performance + legibility)
            const hideSymbols = s < 8;
            this.drawCell(x, curY, color, highlighted, null, false, hideSymbols);
          }
        }
        curY++;
        
        // Yield to next frame if we've spent more than 12ms (target 60fps)
        if (performance.now() - startTime > 12) break;
      }
      
      if (curY < endY) {
        this.renderTimer = requestAnimationFrame(drawChunk);
      } else {
        // 4. Draw brush highlights at the end
        if(this.brushHighlights.size > 0){
          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
          this.brushHighlights.forEach(key => {
            const [hx, hy] = key.split(',').map(Number);
            if (hx >= startX && hx < endX && hy >= startY && hy < endY) {
              ctx.fillRect(hx * s, hy * s, s, s);
            }
          });
          ctx.restore();
        }
        // 5. Draw Backstitch
        if(this.backstitch && this.backstitch.length > 0){
          ctx.save();
          this.backstitch.forEach(line => {
            ctx.strokeStyle = line.color.hex;
            ctx.lineWidth = s / 10;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(line.x1 * s, line.y1 * s);
            ctx.lineTo(line.x2 * s, line.y2 * s);
            ctx.stroke();
          });
          ctx.restore();
        }
      }
    };
    
    drawChunk();
  }

  getTintedStitch(color) {
    if(!this._stitchCache) this._stitchCache = {};
    if(this._stitchCache[color.code]) return this._stitchCache[color.code];
    
    if (!this.stitchImg.complete || this.stitchImg.naturalWidth === 0) return null;

    const c = document.createElement('canvas');
    c.width = this.stitchImg.naturalWidth;
    c.height = this.stitchImg.naturalHeight;
    const tCtx = c.getContext('2d');
    
    tCtx.drawImage(this.stitchImg, 0, 0);
    tCtx.globalCompositeOperation = 'multiply';
    tCtx.fillStyle = color.hex;
    tCtx.fillRect(0, 0, c.width, c.height);
    tCtx.globalCompositeOperation = 'destination-in';
    tCtx.drawImage(this.stitchImg, 0, 0);
    
    this._stitchCache[color.code] = c;
    return c;
  }

  updateCellView(x, y) {
    if(!this.ctx || x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const s = this.cell;
    const px = x * s;
    const py = y * s;
    const ctx = this.ctx;
    
    // Clear rect
    ctx.clearRect(px, py, s, s);
    
    // Draw background (Aida + canvas color)
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    
    if(this.aidaImg.complete && this.aidaImg.naturalWidth > 0 && this._aidaPattern){
      ctx.fillStyle = this._aidaPattern;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(px, py, s, s);
    }
    
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = this.canvasColor;
    ctx.fillRect(px, py, s, s);
    ctx.restore();
    
    // Draw color
    const color = this.data[y * this.w + x];
    if(color){
      const highlighted = (window.app && window.app.highlightedColor)
        ? color.code === window.app.highlightedColor.code : true;
      const hideSymbols = s < 8;
      this.drawCell(x, y, color, highlighted, null, false, hideSymbols);
    }
  }

  drawCell(x, y, color, highlighted = true, targetCtx = null, forceCross = false, hideSymbols = false){
    const s = this.cell; 
    const px = x * s; 
    const py = y * s; 
    const ctx = targetCtx || this.ctx;
    
    ctx.globalAlpha = highlighted ? 1.0 : 0.15;

    const isPixel = !forceCross && (window.app && window.app.renderMode === 'pixel');

    if(isPixel){
      ctx.fillStyle = color.hex;
      ctx.fillRect(px, py, s, s);
    } else {
      const tinted = this.getTintedStitch(color);
      if(tinted){
        ctx.drawImage(tinted, px, py, s, s);
      } else {
        ctx.strokeStyle = color.hex; ctx.lineWidth = s / 5; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px+s*0.2, py+s*0.2); ctx.lineTo(px+s*0.8, py+s*0.8);
        ctx.moveTo(px+s*0.8, py+s*0.2); ctx.lineTo(px+s*0.2, py+s*0.8);
        ctx.stroke();
      }
    }

    const symbol = this.symbolMap[color.code];
    const showSym = !hideSymbols && (window.app && window.app.showSymbols && symbol);
    if(showSym){
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = this.isLight(color) ? '#000' : '#fff';
      if(!highlighted) ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.font = `900 ${s*0.75}px "Inter", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(symbol, px + s/2, py + s/2);
    }
    
    ctx.globalAlpha = 1.0;
  }

  // ─── Stats ───────────────────────────────────────────────
  setCanvasColor(c){ this.canvasColor = c; this.render(); }

  updateStats(){
    if(!window.app) return;
    try {
      const used = this.getUsedColors();
      const el1 = document.getElementById('stat-stitches');
      const el2 = document.getElementById('stat-colors');
      if(el1) el1.textContent = used.reduce((a,b) => a + b.count, 0);
      if(el2) el2.textContent = used.length;
      // Update size info
      const ct = parseInt(document.getElementById('canvas-count')?.value) || 16;
      const elSizeCm = document.getElementById('stat-size-cm');
      const elSizeIn = document.getElementById('stat-size-inch');
      if(elSizeCm) elSizeCm.textContent = `${(this.w/ct*2.54).toFixed(1)} × ${(this.h/ct*2.54).toFixed(1)} см`;
      if(elSizeIn) elSizeIn.textContent = `${(this.w/ct).toFixed(1)} × ${(this.h/ct).toFixed(1)} дюймів`;
      
      const inpW = document.getElementById('grid-width');
      const inpH = document.getElementById('grid-height');
      if (inpW && document.activeElement !== inpW) inpW.value = this.w;
      if (inpH && document.activeElement !== inpH) inpH.value = this.h;
      
      window.app.renderProjectPalette();
    } catch(e) { /* ignore during init */ }
  }

  getUsedColors(){
    const counts = {};
    this.data.forEach(c => { if(c) counts[c.code] = (counts[c.code]||0) + 1; });
    const result = Object.keys(counts).map(code => ({
      color: DMC_COLORS.find(x => x.code === code),
      count: counts[code]
    })).filter(u => u.color).sort((a,b) => b.count - a.count);
    // Add extra palette colors (added via "+" but not yet drawn)
    if(this.extraPaletteColors) {
      this.extraPaletteColors.forEach(code => {
        if(!counts[code]) {
          const c = DMC_COLORS.find(x => x.code === code);
          if(c) result.push({ color: c, count: 0 });
        }
      });
    }
    return result;
  }

  addToPalette(colorCode){
    if(!this.extraPaletteColors) this.extraPaletteColors = [];
    if(!this.extraPaletteColors.includes(colorCode)) {
      this.extraPaletteColors.push(colorCode);
    }
  }

  // ─── Color Operations ────────────────────────────────────
  replaceColor(oldCol, newCol){
    this.saveHistory();
    this.data = this.data.map(c => (c && c.code === oldCol.code) ? newCol : c);
    this.render(); this.updateStats();
  }

  removeConfetti(threshold = 1, searchRadius = 3){
    this.saveHistory();
    const newData = [...this.data];
    for(let y = 0; y < this.h; y++){
      for(let x = 0; x < this.w; x++){
        const idx = y*this.w + x;
        const c = this.data[idx];
        if(!c) continue;
        let neighbors = 0;
        for(let dy = -searchRadius; dy <= searchRadius; dy++){
          for(let dx = -searchRadius; dx <= searchRadius; dx++){
            if(dx === 0 && dy === 0) continue;
            const nx = x+dx, ny = y+dy;
            if(nx >= 0 && nx < this.w && ny >= 0 && ny < this.h){
              const nc = this.data[ny*this.w+nx];
              if(nc && nc.code === c.code) neighbors++;
            }
          }
        }
        if(neighbors < threshold) {
          // Find most frequent neighbor color to replace
          const neighborCounts = {};
          for(let dy = -1; dy <= 1; dy++){
            for(let dx = -1; dx <= 1; dx++){
              const nx = x+dx, ny = y+dy;
              if(nx >= 0 && nx < this.w && ny >= 0 && ny < this.h){
                const nc = this.data[ny*this.w+nx];
                if(nc) neighborCounts[nc.code] = (neighborCounts[nc.code] || 0) + 1;
              }
            }
          }
          let bestCode = null, maxCount = -1;
          for(const code in neighborCounts) {
            if(neighborCounts[code] > maxCount) {
              maxCount = neighborCounts[code];
              bestCode = code;
            }
          }
          if(bestCode) newData[idx] = DMC_COLORS.find(col => col.code === bestCode);
          else newData[idx] = null;
        }
      }
    }
    this.data = newData; this.render(); this.updateStats();
  }

  removeSingleConfetti(x, y, threshold = 1, searchRadius = 3) {
    const idx = y*this.w + x;
    const c = this.data[idx];
    if(!c) return;

    let neighbors = 0;
    for(let dy = -searchRadius; dy <= searchRadius; dy++){
      for(let dx = -searchRadius; dx <= searchRadius; dx++){
        if(dx === 0 && dy === 0) continue;
        const nx = x+dx, ny = y+dy;
        if(nx >= 0 && nx < this.w && ny >= 0 && ny < this.h){
          const nc = this.data[ny*this.w+nx];
          if(nc && nc.code === c.code) neighbors++;
        }
      }
    }

    if(neighbors < threshold) {
      // Find most frequent neighbor color to replace
      const neighborCounts = {};
      for(let dy = -1; dy <= 1; dy++){
        for(let dx = -1; dx <= 1; dx++){
          const nx = x+dx, ny = y+dy;
          if(nx >= 0 && nx < this.w && ny >= 0 && ny < this.h){
            const nc = this.data[ny*this.w+nx];
            if(nc) neighborCounts[nc.code] = (neighborCounts[nc.code] || 0) + 1;
          }
        }
      }
      let bestCode = null, maxCount = -1;
      for(const code in neighborCounts) {
        if(neighborCounts[code] > maxCount) {
          maxCount = neighborCounts[code];
          bestCode = code;
        }
      }
      if(bestCode) this.data[idx] = DMC_COLORS.find(col => col.code === bestCode);
      else this.data[idx] = null;
    }
  }

  removeRareColors(minCount = 5){
    this.saveHistory();
    const used = this.getUsedColors();
    const rare = used.filter(u => u.count < minCount && !this.lockedColors.has(u.color.code));
    const common = used.filter(u => u.count >= minCount || this.lockedColors.has(u.color.code));
    if(common.length === 0) return;

    rare.forEach(r => {
      // Find nearest color by perceptual deltaE2000 distance (CIE LAB)
      let bestDist = Infinity, bestColor = common[0].color;
      const rLab = rgbToLab(r.color.r, r.color.g, r.color.b);
      common.forEach(c => {
        const cLab = rgbToLab(c.color.r, c.color.g, c.color.b);
        const dist = deltaE2000(rLab, cLab);
        if(dist < bestDist){ bestDist = dist; bestColor = c.color; }
      });
      this.data = this.data.map(c => (c && c.code === r.color.code) ? bestColor : c);
    });
    this.render(); this.updateStats();
  }

  smartSmooth(level = 'medium') {
    this.saveHistory();
    let threshold = 3;
    let radius = 3;
    if (level === 'light') {
      threshold = 1;
      radius = 2;
    } else if (level === 'aggressive') {
      threshold = 4;
      radius = 3;
    }
    this.removeConfetti(threshold, radius);
    if (level === 'aggressive') {
      this.removeConfetti(2, 2);
    }
    this.render();
    this.updateStats();
  }

  enhanceContours() {
    this.saveHistory();
    const blackColor = DMC_COLORS.find(c => c.code === '310') || DMC_COLORS[0];
    this.backstitch = [];
    
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const idx = y * this.w + x;
        const c = this.data[idx];
        
        if (x < this.w - 1) {
          const rc = this.data[y * this.w + x + 1];
          const cCode = c ? c.code : null;
          const rcCode = rc ? rc.code : null;
          if (cCode !== rcCode) {
            this.backstitch.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1, color: blackColor });
          }
        }
        
        if (y < this.h - 1) {
          const bc = this.data[(y + 1) * this.w + x];
          const cCode = c ? c.code : null;
          const bcCode = bc ? bc.code : null;
          if (cCode !== bcCode) {
            this.backstitch.push({ x1: x, y1: y + 1, x2: x + 1, y2: y + 1, color: blackColor });
          }
        }
      }
    }
    this.render();
    this.updateStats();
  }

  // ─── History ─────────────────────────────────────────────
  saveHistory(){
    const state = {
      data: this.data.map(c => c ? c.code : null),
      backstitch: this.backstitch.map(l => ({x1:l.x1, y1:l.y1, x2:l.x2, y2:l.y2, color:l.color.code}))
    };
    this.history.push(JSON.stringify(state));
    if(this.history.length > 50) this.history.shift();
    this.future = [];
  }

  undo(){
    if(this.history.length === 0) return;
    const currentState = {
      data: this.data.map(c => c ? c.code : null),
      backstitch: this.backstitch.map(l => ({x1:l.x1, y1:l.y1, x2:l.x2, y2:l.y2, color:l.color.code}))
    };
    this.future.push(JSON.stringify(currentState));
    
    const state = JSON.parse(this.history.pop());
    this.data = state.data.map(code => code ? DMC_COLORS.find(c => c.code === code) : null);
    this.backstitch = (state.backstitch || []).map(l => ({
      x1:l.x1, y1:l.y1, x2:l.x2, y2:l.y2,
      color: DMC_COLORS.find(c => c.code === l.color) || DMC_COLORS[0]
    }));
    
    this.assignSymbols();
    this.render(); this.updateStats();
  }

  redo(){
    if(this.future.length === 0) return;
    const currentState = {
      data: this.data.map(c => c ? c.code : null),
      backstitch: this.backstitch.map(l => ({x1:l.x1, y1:l.y1, x2:l.x2, y2:l.y2, color:l.color.code}))
    };
    this.history.push(JSON.stringify(currentState));
    
    const state = JSON.parse(this.future.pop());
    this.data = state.data.map(code => code ? DMC_COLORS.find(c => c.code === code) : null);
    this.backstitch = (state.backstitch || []).map(l => ({
      x1:l.x1, y1:l.y1, x2:l.x2, y2:l.y2,
      color: DMC_COLORS.find(c => c.code === l.color) || DMC_COLORS[0]
    }));

    this.assignSymbols();
    this.render(); this.updateStats();
  }

  // ─── Serialization ──────────────────────────────────────
  toJSON(){
    return {
      w: this.w, h: this.h,
      canvasColor: this.canvasColor,
      data: this.data.map(c => c ? c.code : null),
      symbolMap: this.symbolMap,
      lockedColors: Array.from(this.lockedColors || []),
      backstitch: this.backstitch.map(l => ({x1:l.x1, y1:l.y1, x2:l.x2, y2:l.y2, color:l.color.code})),
      extraPaletteColors: this.extraPaletteColors || []
    };
  }

  fromJSON(json){
    this.w = json.w; this.h = json.h;
    this.canvasColor = json.canvasColor || '#ffffff';
    this.mc.width = this.w * this.cell * this.resolution;
    this.mc.height = this.h * this.cell * this.resolution;
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.scale(this.resolution, this.resolution);
    this.data = json.data.map(code => code ? DMC_COLORS.find(c => c.code === code) : null);
    this.symbolMap = json.symbolMap || {};
    this.lockedColors = new Set(json.lockedColors || []);
    this.backstitch = (json.backstitch || []).map(l => ({
        x1:l.x1, y1:l.y1, x2:l.x2, y2:l.y2, 
        color: DMC_COLORS.find(c => c.code === l.color) || DMC_COLORS[0]
    }));
    this.extraPaletteColors = json.extraPaletteColors || [];
    this.assignSymbols(); 
    document.getElementById('grid-width').value = this.w;
    document.getElementById('grid-height').value = this.h;
    this.drawGrid(); this.render();
  }

  setCanvasColor(c){ this.canvasColor = c; this.render(); }

  setUnderlay(url) {
    if(!url) {
      this.underlayImg = null;
      this.render();
      return;
    }
    const img = new Image();
    img.src = url;
    img.onload = () => {
      this.underlayImg = img;
      this.render();
    };
    img.onerror = () => {
        console.error("Failed to load underlay image");
    };
  }

  // ─── Stats ───────────────────────────────────────────────
  generateStitches(noTextures = false){
    const s = this.cell;
    const c = document.createElement('canvas');
    c.width = this.w * s; c.height = this.h * s;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    for(let i = 0; i < this.data.length; i++){
      const color = this.data[i];
      if(color){
        const x = i % this.w, y = Math.floor(i / this.w);
        const px = x * s, py = y * s;
        if(!noTextures && this.stitchImg.complete && this.stitchImg.naturalWidth > 0){
          ctx.drawImage(this.getTintedStitch(color), px, py, s, s);
        } else {
          // Draw X pattern for cross stitch look
          ctx.fillStyle = color.hex;
          ctx.fillRect(px, py, s, s);
          if(!noTextures){
            ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = s/8; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(px+s*0.15, py+s*0.15); ctx.lineTo(px+s*0.85, py+s*0.85);
            ctx.moveTo(px+s*0.85, py+s*0.15); ctx.lineTo(px+s*0.15, py+s*0.85);
            ctx.stroke();
          }
        }
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    if(!noTextures && this.aidaImg.complete && this.aidaImg.naturalWidth > 0){
      const offC = document.createElement('canvas');
      offC.width = s; offC.height = s;
      const offCtx = offC.getContext('2d');
      offCtx.imageSmoothingEnabled = false;
      offCtx.drawImage(this.aidaImg, 0, 0, s, s);
      const ptrn = ctx.createPattern(offC, 'repeat');
      if(ptrn){ ctx.fillStyle = ptrn; ctx.globalAlpha = 0.5; ctx.fillRect(0, 0, c.width, c.height); }
    }
    
    // Draw Backstitch
    if(this.backstitch && this.backstitch.length > 0){
      ctx.save();
      this.backstitch.forEach(line => {
        ctx.strokeStyle = line.color.hex;
        ctx.lineWidth = s / 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(line.x1 * s, line.y1 * s);
        ctx.lineTo(line.x2 * s, line.y2 * s);
        ctx.stroke();
      });
      ctx.restore();
    }

    ctx.globalCompositeOperation = 'destination-over';
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = this.canvasColor;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.restore();
    return c;
  }

  generateExportCanvas(options = {}) {
    this.assignSymbols(); // Ensure symbols are up-to-date
    const {
      type = 'color',
      showCenter = false,
      startX = 0, startY = 0,
      cropW = this.w, cropH = this.h,
      cellSize = this.cell,
      showGrid = true,
      showRulers = true,
      scale = 2
    } = options;

    const off = showRulers ? 50 : 0;
    
    // A4 Aspect Ratio Support for Previews
    const isA4 = options.isA4 || false;
    let cw = cropW * cellSize + off * 2;
    let ch = cropH * cellSize + off * 2;
    
    if (isA4) {
      // Scale to A4 ratio (approx 1:1.41)
      const a4Ratio = 841.89 / 595.28;
      if (ch / cw < a4Ratio) ch = cw * a4Ratio;
      else cw = ch / a4Ratio;
    }

    const c = document.createElement('canvas');
    c.width = cw * scale; c.height = ch * scale;
    const ctx = c.getContext('2d');
    ctx.scale(scale, scale);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);

    // 1. Cells & Symbols
    for(let y = 0; y < cropH; y++) {
      for(let x = 0; x < cropW; x++) {
        const gx = startX + x;
        const gy = startY + y;
        if (gx >= this.w || gy >= this.h) continue;
        const color = this.data[gy * this.w + gx];
        if(!color) continue;

        const px = x * cellSize + off, py = y * cellSize + off;

        if (type === 'realistic') {
          const tinted = this.getTintedStitch ? this.getTintedStitch(color) : null;
          if (tinted) {
            ctx.drawImage(tinted, px, py, cellSize, cellSize);
          } else {
            ctx.strokeStyle = color.hex; ctx.lineWidth = cellSize / 5; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(px+cellSize*0.2, py+cellSize*0.2); ctx.lineTo(px+cellSize*0.8, py+cellSize*0.8);
            ctx.moveTo(px+cellSize*0.8, py+cellSize*0.2); ctx.lineTo(px+cellSize*0.2, py+cellSize*0.8);
            ctx.stroke();
          }
        } else if (type === 'color') {
          ctx.fillStyle = color.hex;
          ctx.globalAlpha = 0.5;
          ctx.fillRect(px, py, cellSize, cellSize);
          ctx.globalAlpha = 1.0;
        } else if (type === 'bw' || type === 'pk') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(px, py, cellSize, cellSize);
        }

        const sym = this.symbolMap[color.code];
        if(sym && type !== 'realistic'){
          const isL = this.isLight(color);
          ctx.fillStyle = (type === 'color' && !isL) ? '#fff' : '#000';
          ctx.font = `bold ${cellSize * 0.7}px Inter, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(sym, px + cellSize/2, py + cellSize/2 + 1);
        }
      }
    }

    // 2. Grid
    if (showGrid) {
      ctx.strokeStyle = '#94a3b8';
      for(let x = 0; x <= cropW; x++){
        const xPos = x*cellSize + off;
        const gx = startX + x;
        ctx.lineWidth = (gx % 10 === 0) ? 1.5 : 0.5;
        ctx.beginPath(); ctx.moveTo(xPos, off); ctx.lineTo(xPos, ch - off); ctx.stroke();
      }
      for(let y = 0; y <= cropH; y++){
        const yPos = y*cellSize + off;
        const gy = startY + y;
        ctx.lineWidth = (gy % 10 === 0) ? 1.5 : 0.5;
        ctx.beginPath(); ctx.moveTo(off, yPos); ctx.lineTo(cw - off, yPos); ctx.stroke();
      }
    }

    // 3. Center Lines
    if (showCenter) {
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2.5;
      const cX = Math.floor(this.w / 2) - startX;
      const cY = Math.floor(this.h / 2) - startY;
      if (cX >= 0 && cX <= cropW) {
        const xPos = cX * cellSize + off;
        ctx.beginPath(); ctx.moveTo(xPos, off); ctx.lineTo(xPos, ch - off); ctx.stroke();
      }
      if (cY >= 0 && cY <= cropH) {
        const yPos = cY * cellSize + off;
        ctx.beginPath(); ctx.moveTo(off, yPos); ctx.lineTo(cw - off, yPos); ctx.stroke();
      }
    }

    // 4. Rulers
    if (showRulers) {
      ctx.fillStyle = '#4f46e5'; ctx.font = 'bold 12px Inter, sans-serif'; ctx.textAlign = 'center';
      for(let x = 0; x <= cropW; x += 10) {
        const xPos = x * cellSize + off;
        const label = startX + x;
        ctx.fillText(label, xPos, off - 15);
        ctx.fillText(label, xPos, ch - off + 20);
      }
      ctx.textBaseline = 'middle';
      for(let y = 0; y <= cropH; y += 10) {
        const yPos = y * cellSize + off;
        const label = startY + y;
        ctx.textAlign = 'right'; ctx.fillText(label, off - 15, yPos);
        ctx.textAlign = 'left'; ctx.fillText(label, cw - off + 15, yPos);
      }
    }
    return c;
  }

  generateKeyCanvas(isSinglePage = false) {
    const used = this.getUsedColors();
    const totalStitches = used.reduce((a, b) => a + b.count, 0);
    const itemH = 45;
    const w = 850;
    const a4H = 1202; // A4 height for 850 width
    
    if (isSinglePage) {
      const h = Math.max(a4H, 180 + used.length * itemH + 50);
      const c = document.createElement('canvas');
      c.width = w * 2; c.height = h * 2;
      const ctx = c.getContext('2d');
      ctx.scale(2, 2);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      
      this._drawKeyPage(ctx, used, 0, used.length, w, h, totalStitches, 1, 1, true);
      return [c];
    } else {
      const itemsPerPage = 20;
      const pagesCount = Math.ceil(used.length / itemsPerPage) || 1;
      const pages = [];
      for (let p = 0; p < pagesCount; p++) {
        const c = document.createElement('canvas');
        c.width = w * 2; c.height = a4H * 2;
        const ctx = c.getContext('2d');
        ctx.scale(2, 2);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, a4H);
        
        this._drawKeyPage(ctx, used, p * itemsPerPage, (p + 1) * itemsPerPage, w, a4H, totalStitches, p + 1, pagesCount, false);
        pages.push(c);
      }
      return pages;
    }
  }

  _drawKeyPage(ctx, used, start, end, w, h, totalStitches, pNum, pTotal, isSingle) {
    const itemH = 45;
    const kyStart = 180;

    // Header
    ctx.fillStyle = '#1e293b';
    ctx.font = '900 32px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Thread Palette Key', 50, 70);

    // Stats (Only on first or single page)
    if (pNum === 1) {
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`Total Colors: ${used.length}`, 50, 105);
      ctx.fillText(`Total Stitches: ${totalStitches.toLocaleString()} crosses`, 50, 130);
    }

    // Table Header
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('KEY', 50, kyStart);
    ctx.fillText('DMC', 120, kyStart);
    ctx.fillText('Color Name', 210, kyStart);
    ctx.textAlign = 'right';
    ctx.fillText('Stitches', 700, kyStart);
    ctx.fillText('%', 780, kyStart);
    
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(50, kyStart + 10); ctx.lineTo(w - 50, kyStart + 10); ctx.stroke();
    
    const pageItems = used.slice(start, end);
    pageItems.forEach((u, i) => {
      const y = kyStart + 50 + i * itemH;
      const sym = this.symbolMap[u.color.code] || '•';
      
      const sSize = 32;
      ctx.fillStyle = u.color.hex; ctx.fillRect(50, y - 24, sSize, sSize);
      ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1; ctx.strokeRect(50, y - 24, sSize, sSize);

      const isL = this.isLight(u.color);
      ctx.fillStyle = isL ? '#000' : '#fff';
      ctx.font = '900 18px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sym, 50 + sSize/2, y - 24 + sSize/2 + 1);

      ctx.fillStyle = '#000'; ctx.textAlign = 'center';
      ctx.fillText(sym, 100, y - 24 + sSize/2 + 1);

      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = 'bold 18px Inter, sans-serif'; ctx.fillStyle = '#1e293b';
      ctx.fillText(u.color.code, 120, y);
      
      ctx.font = '16px Inter, sans-serif'; ctx.fillStyle = '#475569';
      ctx.fillText(u.color.name, 210, y);

      ctx.textAlign = 'right'; ctx.font = 'bold 16px Inter, sans-serif'; ctx.fillStyle = '#1e293b';
      ctx.fillText(u.count.toLocaleString(), 700, y);

      const pct = ((u.count / totalStitches) * 100).toFixed(1) + '%';
      ctx.font = '14px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.fillText(pct, 780, y);
    });

    if (!isSingle) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`Page ${pNum} of ${pTotal}`, w / 2, h - 30);
    }
  }

  generateTitleCanvas(title = "Untitled Pattern", author = "", bannerImg = null) {
    const w = 800, h = 1100;
    const c = document.createElement('canvas');
    c.width = w * 2; c.height = h * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    
    ctx.textAlign = 'center';
    
    if (bannerImg) {
      // Draw banner as header
      const aspect = bannerImg.width / bannerImg.height;
      const bannerH = w / aspect;
      ctx.drawImage(bannerImg, 0, 0, w, bannerH);
    } else {
      // Fallback Logo
      ctx.fillStyle = '#4f46e5';
      ctx.font = 'bold 40px Inter, sans-serif';
      ctx.fillText('NanaStitch', w/2, 150);
      
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(100, 180); ctx.lineTo(w-100, 180); ctx.stroke();
    }
    
    // Title
    ctx.fillStyle = '#1e293b';
    ctx.font = '900 60px Inter, sans-serif';
    ctx.fillText(title, w/2, 300);
    
    if(author) {
      ctx.font = 'italic 24px Inter, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`by ${author}`, w/2, 340);
    }

    // Pattern Preview (Realistic Crosses)
    const previewCanvas = this.generateExportCanvas({ type: 'realistic', cellSize: 5, showGrid: false, showCenter: false, showRulers: false });
    const pW = 300;
    const pAspect = previewCanvas.width / previewCanvas.height;
    const pH = pW / pAspect;
    const pY = 380;
    
    ctx.drawImage(previewCanvas, w/2 - pW/2, pY, pW, pH);
    
    // Stats
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(`Pattern Size: ${this.w} × ${this.h} stitches`, w/2, pY + pH + 60);
    ctx.fillText(`Colors: ${this.getUsedColors().length}`, w/2, pY + pH + 100);
    
    // Fabric Sizes
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillStyle = '#4f46e5';
    ctx.fillText('Fabric Size Guide:', w/2, pY + pH + 170);
    
    ctx.font = '18px Inter, sans-serif';
    ctx.fillStyle = '#475569';
    const counts = [14, 16, 18, 20, 25];
    counts.forEach((ct, i) => {
      const cw = (this.w / ct * 2.54).toFixed(1);
      const ch = (this.h / ct * 2.54).toFixed(1);
      const iw = (this.w / ct).toFixed(1);
      const ih = (this.h / ct).toFixed(1);
      ctx.fillText(`Aida ${ct} ct: ${cw} × ${ch} cm (${iw} × ${ih} inches)`, w/2, pY + pH + 210 + i * 40);
    });
    
    return c;
  }

  generateScheme(){
    this.assignSymbols(); // Ensure symbols are up-to-date
    const s = this.cell; const off = 30;
    const w = this.w * s + off * 2;
    const h = this.h * s + off * 2;
    const c = document.createElement('canvas');
    c.width = w * 2; c.height = h * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    for(let i = 0; i < this.data.length; i++){
      const color = this.data[i];
      if(!color) continue;
      const x = i % this.w, y = Math.floor(i / this.w);
      const px = x * s + off, py = y * s + off;
      ctx.fillStyle = color.hex;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(px, py, s, s);
      ctx.globalAlpha = 1.0;
      const sym = this.symbolMap[color.code];
      if(sym){
        ctx.fillStyle = '#000';
        ctx.font = `900 ${s * 0.7}px "Inter", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(sym, px + s/2, py + s/2);
      }
    }

    ctx.strokeStyle = '#94a3b8';
    for(let x = 0; x <= this.w; x++){
      const xPos = Math.round(x*s + off);
      ctx.lineWidth = (x % 10 === 0) ? 1.5 : 0.5;
      ctx.beginPath(); ctx.moveTo(xPos, off); ctx.lineTo(xPos, h - off); ctx.stroke();
    }
    for(let y = 0; y <= this.h; y++){
      const yPos = Math.round(y*s + off);
      ctx.lineWidth = (y % 10 === 0) ? 1.5 : 0.5;
      ctx.beginPath(); ctx.moveTo(off, yPos); ctx.lineTo(w - off, yPos); ctx.stroke();
    }

    ctx.fillStyle = '#4f46e5'; ctx.font = 'bold 10px Inter, sans-serif'; ctx.textAlign = 'center';
    for(let x = 0; x <= this.w; x += 10) ctx.fillText(x, x*s + off, off - 8);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for(let y = 0; y <= this.h; y += 10) ctx.fillText(y, off - 8, y*s + off);

    return c;
  }

  generateMockup(frameType, noTextures = false){
    const s = this.cell;
    const stitchC = this.generateStitches(noTextures);

    const pad = 80;
    const frameW = 20;
    const imgW = Math.min(stitchC.width, 800);
    const scale = imgW / stitchC.width;
    const imgH = stitchC.height * scale;

    const mockW = imgW + pad * 2;
    const mockH = imgH + pad * 2;
    const mc = document.createElement('canvas');
    mc.width = mockW * 2; mc.height = mockH * 2;
    const mctx = mc.getContext('2d');
    mctx.scale(2, 2);

    if(frameType === 'hoop'){
      const cx = mockW / 2, cy = mockH / 2;
      const radius = Math.min(imgW, imgH) / 2 + 10;

      mctx.fillStyle = '#f5f0eb';
      mctx.fillRect(0, 0, mockW, mockH);

      mctx.save();
      mctx.beginPath(); mctx.arc(cx + 3, cy + 5, radius + 12, 0, Math.PI * 2);
      mctx.fillStyle = 'rgba(0,0,0,0.15)'; mctx.fill(); mctx.restore();

      mctx.save();
      mctx.beginPath(); mctx.arc(cx, cy, radius, 0, Math.PI * 2); mctx.clip();
      mctx.drawImage(stitchC, cx - imgW/2, cy - imgH/2, imgW, imgH);
      mctx.restore();

      mctx.strokeStyle = '#c8a86e'; mctx.lineWidth = 10;
      mctx.beginPath(); mctx.arc(cx, cy, radius, 0, Math.PI * 2); mctx.stroke();
      mctx.strokeStyle = '#b8944e'; mctx.lineWidth = 6;
      mctx.beginPath(); mctx.arc(cx, cy, radius + 5, 0, Math.PI * 2); mctx.stroke();

      mctx.fillStyle = '#a07830';
      mctx.fillRect(cx - 6, cy - radius - 14, 12, 16);
      mctx.fillStyle = '#8a6520';
      mctx.beginPath(); mctx.arc(cx, cy - radius - 14, 6, 0, Math.PI * 2); mctx.fill();
    } else {
      const isClassic = frameType === 'classic';

      mctx.fillStyle = isClassic ? '#f5f0eb' : '#ffffff';
      mctx.fillRect(0, 0, mockW, mockH);

      mctx.shadowColor = 'rgba(0,0,0,0.2)';
      mctx.shadowBlur = 20;
      mctx.shadowOffsetX = 5;
      mctx.shadowOffsetY = 5;

      const fx = pad - frameW, fy = pad - frameW;
      const fw = imgW + frameW * 2, fh = imgH + frameW * 2;

      if(isClassic){
        mctx.fillStyle = '#6b4226';
        mctx.fillRect(fx, fy, fw, fh);
        mctx.shadowColor = 'transparent';
        mctx.strokeStyle = '#c8a86e'; mctx.lineWidth = 3;
        mctx.strokeRect(fx + frameW - 4, fy + frameW - 4, imgW + 8, imgH + 8);
        mctx.strokeStyle = 'rgba(0,0,0,0.1)'; mctx.lineWidth = 1;
        for(let i = 0; i < frameW; i += 4){
          mctx.strokeRect(fx + i, fy + i, fw - i*2, fh - i*2);
        }
      } else {
        mctx.fillStyle = '#2d2d2d';
        mctx.fillRect(fx, fy, fw, fh);
        mctx.shadowColor = 'transparent';
      }

      mctx.fillStyle = isClassic ? '#f8f5f0' : '#ffffff';
      const matPad = 8;
      mctx.fillRect(pad - matPad, pad - matPad, imgW + matPad*2, imgH + matPad*2);

      mctx.drawImage(stitchC, pad, pad, imgW, imgH);
    }

    return mc;
  }

  exportStitches(){ this._download(this.generateStitches(), 'stitches.png'); }
  exportScheme(){ this._download(this.generateScheme(), 'scheme.png'); }
  exportMockup(frameType){ this._download(this.generateMockup(frameType), `mockup-${frameType}.png`); }

  async _download(canvas, filename){
    try {
      if (window.showSaveFilePicker) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'PNG Image',
            accept: {'image/png': ['.png']}
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      }
    } catch(err) {
      if (err.name === 'AbortError') return;
      console.warn('showSaveFilePicker failed:', err);
    }
    // Fallback
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportImage(){
    this._download(this.mc, 'scheme.png');
  }

  // ─── Helpers ─────────────────────────────────────────────
  isLight(color){
    if (color._isLight !== undefined) return color._isLight;
    const {r, g, b} = this.hexToRGB(color.hex);
    color._isLight = (0.2126*r + 0.7152*g + 0.0722*b) > 128;
    return color._isLight;
  }

  hexToRGB(hex){
    if (!this._rgbCache) this._rgbCache = {};
    if (this._rgbCache[hex]) return this._rgbCache[hex];
    const c = hex.substring(1);
    const n = parseInt(c, 16);
    this._rgbCache[hex] = { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
    return this._rgbCache[hex];
  }

  _distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
    if (l2 === 0) return Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2));
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt(Math.pow(px - (x1 + t * (x2 - x1)), 2) + Math.pow(py - (y1 + t * (y2 - y1)), 2));
  }
}
window.Editor = Editor;
