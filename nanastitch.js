// === NanaStitch App ===
let app;
class App {
  constructor(){
    app = this; window.app = this;
    this.tool='pencil'; this.color=DMC_COLORS[0]; this.bgColor=DMC_COLORS[1]; this.zoom=1; this.brushSize=1;
    this.brushShape='square'; this.fillTolerance=0; this.replaceMode = 'local';
    this.organizerSort = 'count';
    this.showGrid=true; this.showSymbols=false; this.showCenterLines = false; this.theme='dark';
    this.renderMode='cross';
    this.highlightedColor = null;
    this.bannerImg = new Image();
    this.bannerImg.src = 'banner.jpg';
    this.editor=new Editor(80,80);
    this.init();
    this.imgEditor = new ImageEditor();
    this.initResizers();
  }
  init(){
    this.initUI(); this.initModals(); this.initKeys(); this.initStorage(); this.initAIEvents();
    lucide.createIcons();
    setTimeout(()=>this.zoomToFit(), 300);
    this.toast('NanaStitch готовий до роботи!','info');
  }
  centerView(){
    const w = document.getElementById('canvas-wrapper');
    const c = document.getElementById('canvas-container');
    if(w && c) {
      // 2000 is the size of the spacers in CSS.
      // We center based on the layout size because transform-origin is center.
      w.scrollLeft = 2000 + (c.offsetWidth / 2) - (w.clientWidth / 2);
      w.scrollTop = 2000 + (c.offsetHeight / 2) - (w.clientHeight / 2);
    }
  }
  // --- UI ---
  initUI(){
    // palette
    this.renderPalette('');
    document.getElementById('palette-search').oninput=e=>this.renderPalette(e.target.value);
    // tools
    document.querySelectorAll('.tool-btn').forEach(b=>{
      b.onclick=(e)=>{e.preventDefault();this.setTool(b.dataset.tool);};
    });
    // brush sizes
    document.querySelectorAll('.brush-btn').forEach(b=>{
      b.onclick=(e)=>{
        e.preventDefault();
        this.brushSize=parseInt(b.dataset.size);
        document.querySelectorAll('.brush-btn').forEach(t=>t.classList.remove('active'));
        b.classList.add('active');
      };
    });
    // brush shapes
    document.querySelectorAll('.shape-btn').forEach(b=>{
      b.onclick=(e)=>{
        e.preventDefault();
        this.brushShape=b.dataset.shape;
        document.querySelectorAll('.shape-btn').forEach(t=>t.classList.remove('active'));
        b.classList.add('active');
      };
    });
    // replacement mode
    document.querySelectorAll('#prop-group-replace .toggle-btn').forEach(b=>{
      b.onclick=(e)=>{
        e.preventDefault();
        this.replaceMode = b.dataset.mode;
        document.querySelectorAll('#prop-group-replace .toggle-btn').forEach(t=>t.classList.remove('active'));
        b.classList.add('active');
        const hint = document.getElementById('replace-hint');
        if(hint) {
          if (this.tool === 'magic_eraser') {
            hint.textContent = this.replaceMode === 'local' ? 'Видаляє тільки суміжні хрестики.' : 'Видаляє цей колір на всьому полотні.';
          } else {
            hint.textContent = this.replaceMode === 'local' ? 'Замінює тільки суміжні хрестики.' : 'Замінює колір на всьому полотні.';
          }
        }
      };
    });
    // organizer sorting
    document.querySelectorAll('.organizer-controls .toggle-btn').forEach(b=>{
      b.onclick=()=>{
        this.organizerSort = b.dataset.sort;
        document.querySelectorAll('.organizer-controls .toggle-btn').forEach(t=>t.classList.remove('active'));
        b.classList.add('active');
        this.renderOrganizer();
      };
    });
    // fill tolerance
    const tolSlider = document.getElementById('fill-tolerance');
    const tolVal = document.getElementById('prop-tol-val');
    if (tolSlider && tolVal) {
      tolSlider.oninput = (e) => {
        this.fillTolerance = parseInt(e.target.value);
        tolVal.textContent = this.fillTolerance;
      };
    }
    
    // color swatch swapping
    const btnSwap = document.getElementById('btn-swap-colors');
    if (btnSwap) {
      btnSwap.onclick = () => this.swapColors();
    }
    // palette tabs
    document.querySelectorAll('.pal-tab').forEach(b=>{
      b.onclick=()=>{
        document.querySelectorAll('.pal-tab').forEach(t=>t.classList.remove('active'));b.classList.add('active');
        document.querySelectorAll('.palette-content').forEach(t=>t.classList.remove('active'));
        document.getElementById(b.dataset.target).classList.add('active');
      };
    });
    // zoom
    const zs=document.getElementById('zoom-slider');
    zs.oninput=()=>this.setZoom(zs.value/100);
    document.getElementById('btn-zoom-in').onclick=()=>this.setZoom(this.zoom+0.15);
    document.getElementById('btn-zoom-out').onclick=()=>this.setZoom(this.zoom-0.15);
    document.getElementById('workspace').addEventListener('wheel',e=>{
      if(e.ctrlKey){e.preventDefault();this.setZoom(this.zoom+(e.deltaY<0?0.1:-0.1));}
    },{passive:false});
    
    // sidebar tabs
    document.querySelectorAll('.tab-btn-side').forEach(b => {
      b.onclick = () => {
        document.querySelectorAll('.tab-btn-side').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-side-content').forEach(c => c.classList.remove('active'));
        b.classList.add('active');
        document.getElementById(b.dataset.tab).classList.add('active');
      };
    });


    // aida count change
    document.getElementById('canvas-count').onchange=()=>this.editor.updateStats();
    
    // confetti removal
    document.getElementById('btn-remove-confetti').onclick=()=>this.removeConfetti();
    document.getElementById('btn-remove-rare').onclick=()=>this.removeRareColors();

    // canvas color (15 colors)
    document.querySelectorAll('.c-color').forEach(el => {
      el.onclick = () => {
        document.querySelectorAll('.c-color').forEach(c => c.classList.remove('active'));
        el.classList.add('active');
        this.editor.setCanvasColor(el.dataset.color);
      };
    });
    const customColor = document.getElementById('custom-canvas-color');
    if(customColor) {
      customColor.oninput = (e) => {
        document.querySelectorAll('.c-color').forEach(c => c.classList.remove('active'));
        this.editor.setCanvasColor(e.target.value);
      };
    }
    
    const gcPicker = document.getElementById('grid-color-picker');
    if(gcPicker) {
      gcPicker.oninput = (e) => {
        this.editor.gridColor = e.target.value;
        this.editor.drawGrid();
        this.editor.render();
      };
    }
    
    // underlay
    const btnUploadUnderlay = document.getElementById('btn-upload-underlay');
    const inpUnderlayUpload = document.getElementById('underlay-upload');
    const btnClearUnderlay = document.getElementById('btn-clear-underlay');
    const slUnderlayOpacity = document.getElementById('underlay-opacity');
    const valUnderlayOpacity = document.getElementById('underlay-opacity-val');

    if (btnUploadUnderlay && inpUnderlayUpload) {
      btnUploadUnderlay.onclick = () => inpUnderlayUpload.click();
      inpUnderlayUpload.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (re) => {
            this.editor.setUnderlay(re.target.result);
            this.toast('Підкладку завантажено', 'success');
          };
          reader.readAsDataURL(file);
        }
      };
    }
    if (btnClearUnderlay) {
      btnClearUnderlay.onclick = () => {
        this.editor.setUnderlay(null);
        if (inpUnderlayUpload) inpUnderlayUpload.value = '';
        this.toast('Підкладку прибрано', 'info');
      };
    }
    if (slUnderlayOpacity && valUnderlayOpacity) {
      slUnderlayOpacity.oninput = (e) => {
        const opacity = parseInt(e.target.value);
        valUnderlayOpacity.textContent = opacity;
        this.editor.underlayOpacity = opacity / 100;
        this.editor.render();
      };
    }

    // footer toggles
    const tg = document.getElementById('toggle-grid');
    if(tg) tg.onchange=e=>{
      this.showGrid=e.target.checked;
      this.editor.drawGrid();
      this.editor.render();
    };
    
    const ts = document.getElementById('toggle-symbols');
    if(ts) ts.onchange=e=>{this.showSymbols=e.target.checked;this.editor.render();};
    
    const tcl = document.getElementById('toggle-center-lines');
    if(tcl) tcl.onchange=e=>{this.showCenterLines=e.target.checked;this.editor.drawGrid();};
    
    // render mode (cross/pixel) in footer
    document.querySelectorAll('.render-modes-footer input[name="render-mode"]').forEach(radio => {
      radio.onchange=e=>{
        if(e.target.checked){
          this.renderMode=e.target.value;
          this.editor.render();
        }
      };
    });
    
    // undo/redo
    document.getElementById('btn-undo-side').onclick=()=>this.editor.undo();
    document.getElementById('btn-redo-side').onclick=()=>this.editor.redo();
    // theme
    document.getElementById('btn-theme').onclick=()=>{
      this.theme=this.theme==='dark'?'light':'dark';
      document.body.className=this.theme+'-theme';
    };
    // resize & padding
    const btnLock = document.getElementById('btn-lock-ratio');
    let ratioLocked = true;
    let aspectRatio = this.editor.w / this.editor.h || 1;
    
    if(btnLock) {
      btnLock.onclick = () => {
        ratioLocked = !ratioLocked;
        btnLock.classList.toggle('active', ratioLocked);
        if(ratioLocked) aspectRatio = this.editor.w / this.editor.h || 1;
      };
    }
    
    const inpW = document.getElementById('grid-width');
    const inpH = document.getElementById('grid-height');
    
    if(inpW) inpW.addEventListener('input', () => {
      if(ratioLocked && inpH) inpH.value = Math.round(inpW.value / aspectRatio);
    });
    if(inpH) inpH.addEventListener('input', () => {
      if(ratioLocked && inpW) inpW.value = Math.round(inpH.value * aspectRatio);
    });

    document.getElementById('btn-resize').onclick=()=>{
      const w=parseInt(inpW.value);
      const h=parseInt(inpH.value);
      if(w>0&&h>0){
        this.editor.resample(w,h);
        this.zoomToFit();
        aspectRatio = w / h;
        this.toast('Масштаб змінено','success');
      }
    };

    // Pad buttons
    const padAmount = () => parseInt(document.getElementById('pad-amount').value) || 10;
    const bindPad = (id, dir) => {
      const el = document.getElementById(id);
      if(el) el.onclick = () => {
        this.editor.expandCanvas(dir, padAmount());
        this.zoomToFit();
        this.toast('Полотно розширено', 'success');
      };
    };
    bindPad('btn-pad-top', 'top');
    bindPad('btn-pad-bottom', 'bottom');
    bindPad('btn-pad-left', 'left');
    bindPad('btn-pad-right', 'right');
    // save/download/open
    document.getElementById('btn-save').onclick=()=>this.saveToIDB();
    document.getElementById('btn-download').onclick=()=>this.downloadFile();
    document.getElementById('btn-export-img').onclick=()=>{
      document.getElementById('modal-export').classList.add('active');
      lucide.createIcons();
      this._exportType = 'stitches';
      document.querySelectorAll('.export-type-btn').forEach(b=>b.classList.toggle('active', b.dataset.type==='stitches'));
      setTimeout(() => this.updateExportPreview(), 50);
    };

    document.querySelectorAll('.export-type-btn').forEach(b=>{
      b.onclick=()=>{
        document.querySelectorAll('.export-type-btn').forEach(t=>t.classList.remove('active'));
        b.classList.add('active');
        this._exportType = b.dataset.type;
        this.updateExportPreview();
      };
    });
    
    document.getElementById('btn-export-download').onclick=async (e)=>{
      e.stopPropagation();
      if(!this._exportCanvas) return;
      const fileName = `nanastitch-${this._exportType}.png`;
      
      try {
        // Try modern File System Access API (native save dialog)
        if (window.showSaveFilePicker) {
          const blob = await new Promise(resolve => 
            this._exportCanvas.toBlob(resolve, 'image/png')
          );
          const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{
              description: 'PNG Image',
              accept: {'image/png': ['.png']}
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          this.toast('Зображення збережено!', 'success');
          return;
        }
      } catch(err) {
        if (err.name === 'AbortError') return; // user cancelled
        console.warn('showSaveFilePicker failed:', err);
      }
      
      // Fallback: blob download
      try {
        this._exportCanvas.toBlob((blob) => {
          if (!blob) return;
          const link = document.createElement('a');
          link.download = fileName;
          link.href = URL.createObjectURL(blob);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(link.href), 500);
          this.toast('Якщо файл завантажився без розширення — перейменуйте його в .png', 'info');
        }, 'image/png');
      } catch(err2) {
        this.toast('Натисніть правою кнопкою на зображення → "Зберегти зображення як..."', 'info');
      }
    };
    
    const btnPdfBatch = document.getElementById('btn-export-pdf-batch');
    if(btnPdfBatch) btnPdfBatch.onclick = () => this.generatePDFBundle();

    document.querySelectorAll('.btn-preview-pdf').forEach(b => {
      b.onclick = () => this.renderPDFPreviewList(b.dataset.pdf);
    });

    document.getElementById('btn-open').onclick=()=>{
      const inp=document.createElement('input');inp.type='file';inp.accept='.xstitch,.json';
      inp.onchange=e=>this.openFile(e.target.files[0]);inp.click();
    };
    // pdf cell size label
    const cs=document.getElementById('pdf-cell-size');
    if(cs)cs.oninput=()=>{document.getElementById('pdf-cell-label').textContent=cs.value+' мм';};
    document.getElementById('btn-export-pdf').onclick=()=>{
      document.getElementById('modal-pdf').classList.add('active');
      document.getElementById('pdf-bundle-title').value=document.getElementById('project-name').value;
      this.renderPDFPreviewList('one-color'); // Default view
    };

    const pdfZoom = document.getElementById('pdf-preview-zoom');
    if(pdfZoom) pdfZoom.oninput = (e) => {
      const val = e.target.value;
      document.querySelectorAll('#pdf-preview-list canvas').forEach(cv => {
        cv.style.width = val + '%';
      });
    };

    // photo import
    const pinp=document.getElementById('input-image');
    if(pinp){
      document.getElementById('drop-zone').onclick=()=>pinp.click();
      pinp.onchange=e=>{
        if(e.target.files[0]) this.imgEditor.load(e.target.files[0]);
      };
    }
    document.getElementById('btn-edit-crop').onclick=()=>this.imgEditor.toggleMode('crop');
    document.getElementById('btn-edit-circle').onclick=()=>this.imgEditor.applyCircle();
    document.getElementById('btn-edit-bg').onclick=()=>this.imgEditor.toggleMode('bg');
    document.getElementById('btn-edit-reset').onclick=()=>this.imgEditor.reset();
    
    document.getElementById('btn-convert').onclick=()=>this.convertImage();

    this.editor.updateStats();
    
    // Setup initial tool
    this.setTool(this.tool);
  }

  getSlug(str) {
    if (!str) return 'Pattern';
    let s = str.replace(/[^a-z0-9]/gi, '_').replace(/_{2,}/g, '_').replace(/^_|_$/g, '');
    return s || 'Pattern';
  }

  async generatePDFBundle() {
    if (!window.jspdf) {
      this.toast('Бібліотека PDF ще завантажується...', 'info');
      return;
    }
    const toastId = this.toast('Генерація PDF... зачекайте', 'info', 0);
    const titleInput = document.getElementById('pdf-bundle-title');
    const slug = this.getSlug(titleInput.value || document.getElementById('project-name').value || 'Pattern');
    let downloaded = false;
    try {
      if (document.getElementById('pdf-one-color').checked) {
        await this.downloadSinglePDF(`${slug}-TabletColor`, { type: 'color', showCenter: true });
        downloaded = true;
      }
      if (document.getElementById('pdf-one-bw').checked) {
        await this.downloadSinglePDF(`${slug}-TabletBW`, { type: 'bw', showCenter: true });
        downloaded = true;
      }
      if (document.getElementById('pdf-pk').checked) {
        await this.downloadPatternKeeperPDF(`${slug}-PatternKeeper`);
        downloaded = true;
      }
      if (document.getElementById('pdf-multi-color').checked) {
        await this.downloadMultiPagePDF(`${slug}-PrintColor`, { type: 'color', showCenter: true });
        downloaded = true;
      }
      if (document.getElementById('pdf-multi-bw').checked) {
        await this.downloadMultiPagePDF(`${slug}-PrintBW`, { type: 'bw', showCenter: true });
        downloaded = true;
      }
      
      if (downloaded) {
        this.toast('Експорт PDF завершено!', 'success');
      } else {
        this.toast('Будь ласка, оберіть хоча б один тип файлу', 'warning');
      }
    } catch (e) {
      console.error(e);
      alert('Помилка при створенні PDF: ' + e.message + '\n' + e.stack);
      this.toast('Помилка при створенні PDF', 'danger');
    }
  }

  async downloadSinglePDF(name, options) {
    const { jsPDF } = window.jspdf;
    const title = document.getElementById('pdf-bundle-title').value || "Untitled Pattern";
    const author = document.getElementById('pdf-bundle-author').value || "";
    
    const pdf = new jsPDF('p', 'pt', 'a4');
    
    // 1. Title Page (Vector)
    this.renderVectorTitlePage(pdf, title, author);
    
    // 2. Key Page (Single page for Tablet)
    this.renderVectorKeyPage(pdf, true);

    // 3. Scheme Page (Vector) — Tablet: one big page fitting the whole pattern
    this.renderVectorSchemePage(pdf, { ...options, showCenter: true, isPK: true });
    await this.savePDF(pdf, `${name}.pdf`);
  }

  async savePDF(pdf, fileName) {
    const safeName = fileName.replace(/[^a-z0-9._-]/gi, '_');
    
    // Try modern File System Access API first (native save dialog)
    try {
      if (window.showSaveFilePicker) {
        const blob = pdf.output('blob');
        const handle = await window.showSaveFilePicker({
          suggestedName: safeName,
          types: [{
            description: 'PDF Document',
            accept: {'application/pdf': ['.pdf']}
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        this.toast('PDF збережено!', 'success');
        return;
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('showSaveFilePicker for PDF failed:', err);
    }
    
    // Fallback: jsPDF built-in save
    try {
      pdf.save(safeName);
      this.toast('Файл збережено!', 'success');
    } catch (e) {
      console.error("Standard Save failed, trying Blob fallback:", e);
      try {
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1000);
      } catch (e2) {
        alert("Критична помилка при збереженні: " + e2.message);
      }
    }
  }

  async downloadMultiPagePDF(name, options) {
    const { jsPDF } = window.jspdf;
    const title = document.getElementById('pdf-bundle-title').value || "Untitled Pattern";
    const author = document.getElementById('pdf-bundle-author').value || "";
    
    const pdf = new jsPDF('p', 'pt', 'a4');

    // 1. Title Page (Vector)
    this.renderVectorTitlePage(pdf, title, author);
    
    // 2. Key Page (Multi-page for Print)
    this.renderVectorKeyPage(pdf, false);

    // 3. Scheme Pages (50x75 stitches at 3.5mm on A4)
    const chunkW = 50;
    const chunkH = 75;
    
    // Find actual bounds of the pattern to avoid empty grid
    let maxW = 0, maxH = 0;
    for(let i=0; i<this.editor.data.length; i++) {
      if(this.editor.data[i]) {
        maxW = Math.max(maxW, (i % this.editor.w) + 1);
        maxH = Math.max(maxH, Math.floor(i / this.editor.w) + 1);
      }
    }
    if (maxW === 0) { maxW = this.editor.w; maxH = this.editor.h; }

    const pagesX = Math.ceil(maxW / chunkW);
    const pagesY = Math.ceil(maxH / chunkH);

    for(let py = 0; py < pagesY; py++) {
      for(let px = 0; px < pagesX; px++) {
        this.renderVectorSchemePage(pdf, {
          ...options,
          showCenter: true,
          startX: px * chunkW,
          startY: py * chunkH,
          cropW: Math.min(chunkW, maxW - px * chunkW),
          cropH: Math.min(chunkH, maxH - py * chunkH),
          totalMaxW: maxW,
          totalMaxH: maxH,
          pageInfo: `Grid: ${px*chunkW+1}-${Math.min((px+1)*chunkW, maxW)} / ${py*chunkH+1}-${Math.min((py+1)*chunkH, maxH)}`
        });
      }
    }
    await this.savePDF(pdf, `${name}.pdf`);
  }

  renderVectorTitlePage(pdf, title, author) {
    const pageWidth = 595.28;
    const pageHeight = 841.89;

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');

    // Banner image at top
    let bannerEndY = 10;
    if (this.bannerImg && this.bannerImg.complete && this.bannerImg.naturalWidth > 0) {
      try {
        const bc = document.createElement('canvas');
        const bAspect = this.bannerImg.naturalWidth / this.bannerImg.naturalHeight;
        const bw = Math.round(pageWidth * 2);
        const bh = Math.round(bw / bAspect);
        bc.width = bw; bc.height = bh;
        bc.getContext('2d').drawImage(this.bannerImg, 0, 0, bw, bh);
        const bannerData = bc.toDataURL('image/jpeg', 0.85);
        const bannerPtH = pageWidth / bAspect;
        pdf.addImage(bannerData, 'JPEG', 0, 0, pageWidth, bannerPtH);
        bannerEndY = bannerPtH + 10;
      } catch(e) {
        pdf.setFillColor(79, 70, 229);
        pdf.rect(0, 0, pageWidth, 80, 'F');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(28); pdf.setTextColor(255);
        pdf.text('NanaStitch', pageWidth / 2, 45, { align: 'center' });
        bannerEndY = 90;
      }
    } else {
      pdf.setFillColor(79, 70, 229);
      pdf.rect(0, 0, pageWidth, 80, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(28); pdf.setTextColor(255);
      pdf.text('NanaStitch', pageWidth / 2, 45, { align: 'center' });
      bannerEndY = 90;
    }

    // Title
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(28); pdf.setTextColor(30, 41, 59);
    pdf.text(title, pageWidth / 2, bannerEndY + 25, { align: 'center' });
    if (author) {
      pdf.setFont('helvetica', 'italic'); pdf.setFontSize(14); pdf.setTextColor(100, 116, 139);
      pdf.text(`by ${author}`, pageWidth / 2, bannerEndY + 45, { align: 'center' });
    }

    // Realistic cross-stitch miniature with correct aspect ratio
    const miniY = bannerEndY + 70;
    const maxMiniW = 300, maxMiniH = 250;
    const aspect = this.editor.w / this.editor.h;
    let miniW, miniH;
    if (aspect > maxMiniW / maxMiniH) { miniW = maxMiniW; miniH = maxMiniW / aspect; }
    else { miniH = maxMiniH; miniW = maxMiniH * aspect; }
    const miniX = (pageWidth - miniW) / 2;

    try {
      const previewCanvas = this.editor.generateExportCanvas({ type: 'realistic', cellSize: 4, showGrid: false, showCenter: false, showRulers: false });
      const pcData = previewCanvas.toDataURL('image/jpeg', 0.85);
      pdf.addImage(pcData, 'JPEG', miniX, miniY, miniW, miniH);
    } catch(e) {
      const pxW = miniW / this.editor.w, pxH = miniH / this.editor.h;
      for (let i = 0; i < this.editor.data.length; i++) {
        const color = this.editor.data[i];
        if (!color) continue;
        pdf.setFillColor(color.r, color.g, color.b);
        pdf.rect(miniX + (i % this.editor.w) * pxW, miniY + Math.floor(i / this.editor.w) * pxH, pxW + 0.3, pxH + 0.3, 'F');
      }
    }
    pdf.setDrawColor(200); pdf.setLineWidth(0.5);
    pdf.rect(miniX - 1, miniY - 1, miniW + 2, miniH + 2, 'S');

    // Stats
    const statsY = miniY + miniH + 30;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.setTextColor(30, 41, 59);
    pdf.text(`Pattern Size: ${this.editor.w} \u00D7 ${this.editor.h} stitches`, pageWidth / 2, statsY, { align: 'center' });
    const used = this.editor.getUsedColors();
    pdf.text(`Colors: ${used.length}`, pageWidth / 2, statsY + 22, { align: 'center' });

    // Fabric Size Guide
    const guideY = statsY + 50;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.setTextColor(79, 70, 229);
    pdf.text('Fabric Size Guide:', pageWidth / 2, guideY, { align: 'center' });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11); pdf.setTextColor(71, 85, 105);
    [14,16,18,20,25].forEach((ct, i) => {
      const cw = (this.editor.w / ct * 2.54).toFixed(1), ch = (this.editor.h / ct * 2.54).toFixed(1);
      const iw = (this.editor.w / ct).toFixed(1), ih = (this.editor.h / ct).toFixed(1);
      pdf.text(`Aida ${ct} ct: ${cw} \u00D7 ${ch} cm (${iw} \u00D7 ${ih} inches)`, pageWidth / 2, guideY + 20 + i * 18, { align: 'center' });
    });

    pdf.setFontSize(10); pdf.setTextColor(150);
    pdf.text('Generated by NanaStitch Professional', pageWidth / 2, pageHeight - 30, { align: 'center' });
  }

  getSafeSymbol(sym, index) {
    // Standard PDF fonts (Helvetica) only support WinAnsiEncoding (0-255).
    // Unicode symbols like geometric shapes will corrupt the PDF or show as '?'.
    if (!sym || sym.charCodeAt(0) > 255) {
      // Excluded 'O' and '0' to avoid confusion
      const safePool = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789abcdefghijklmnopqrstuvwxyz#@$&%*+=-";
      return safePool[index % safePool.length];
    }
    return sym;
  }

  renderVectorKeyPage(pdf, isSinglePage = false, hideFooter = false) {
    const used = this.editor.getUsedColors();
    const totalStitches = used.reduce((a, b) => a + b.count, 0);
    const itemH = 18;
    const kMargin = 40;
    const pageWidth = 595.28; // A4 pt
    const pageHeight = 841.89; // A4 pt
    
    if (isSinglePage) {
      // Calculate total height needed
      const totalH = Math.max(pageHeight, 120 + used.length * itemH + 50);
      pdf.addPage([pageWidth, totalH], 'portrait');
      
      this._renderKeyPageContent(pdf, used, 0, used.length, kMargin, totalStitches, itemH);

      if (!hideFooter) {
        pdf.setFontSize(10);
        pdf.setTextColor(150);
        pdf.text(`NanaStitch Designer | Key Page`, pageWidth / 2, totalH - 20, { align: 'center' });
      }
    } else {
      const itemsPerPage = 35;
      const totalPages = Math.ceil(used.length / itemsPerPage) || 1;
      for (let p = 0; p < totalPages; p++) {
        pdf.addPage([pageWidth, pageHeight], 'portrait');
        this._renderKeyPageContent(pdf, used, p * itemsPerPage, (p + 1) * itemsPerPage, kMargin, totalStitches, itemH, p === 0);
        
        if (!hideFooter) {
          pdf.setFontSize(10);
          pdf.setTextColor(150);
          pdf.text(`Page ${pdf.internal.getNumberOfPages()}`, pageWidth / 2, pageHeight - 30, { align: 'center' });
        }
      }
    }
  }

  _renderKeyPageContent(pdf, used, start, end, kMargin, totalStitches, itemH, showHeader = true) {
    const pageWidth = 595.28;
    // Header
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(0);
    pdf.text('Thread Palette Key', kMargin, 50);

    if (showHeader) {
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80);
      pdf.text(`Total Colors: ${used.length}`, kMargin, 65);
      pdf.text(`Total Stitches: ${totalStitches.toLocaleString()} crosses`, kMargin, 77);
    }

    let ky = 100;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(120);
    pdf.text('KEY', kMargin, ky);
    pdf.text('DMC', kMargin + 40, ky);
    pdf.text('Color Name', kMargin + 85, ky);
    pdf.text('Stitches', kMargin + 400, ky, { align: 'right' });
    pdf.text('%', kMargin + 450, ky, { align: 'right' });

    pdf.setDrawColor(220); pdf.setLineWidth(0.5);
    pdf.line(kMargin, ky + 4, pageWidth - kMargin, ky + 4);
    ky += 20;

    const pageItems = used.slice(start, end);
    pageItems.forEach((u, i) => {
      this.renderKeyItem(pdf, u, start + i, kMargin, ky, itemH, totalStitches);
      ky += itemH;
    });
  }

  renderKeyItem(pdf, u, index, kMargin, ky, itemH, totalStitches) {
    const swatchSize = 12;
    const swatchX = kMargin;
    const swatchY = ky - 9;
    
    pdf.setFillColor(u.color.r, u.color.g, u.color.b);
    pdf.rect(swatchX, swatchY, swatchSize, swatchSize, 'F');
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.1);
    pdf.rect(swatchX, swatchY, swatchSize, swatchSize, 'S');

    let sym = this.editor.symbolMap[u.color.code];
    sym = this.getSafeSymbol(sym, index);
    
    const isL = this.editor.isLight(u.color);
    pdf.setTextColor(isL ? 0 : 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(sym, swatchX + swatchSize / 2, swatchY + swatchSize / 2 + 3.5, { align: 'center' });

    pdf.setTextColor(0);
    pdf.text(sym, kMargin + 20, ky);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.text(u.color.code, kMargin + 40, ky);
    pdf.text(u.color.name || '', kMargin + 85, ky);
    
    pdf.setFontSize(10);
    pdf.text(u.count.toLocaleString(), kMargin + 400, ky, { align: 'right' });
    
    const percent = ((u.count / totalStitches) * 100).toFixed(1) + '%';
    pdf.setTextColor(150);
    pdf.setFontSize(8);
    pdf.text(percent, kMargin + 450, ky, { align: 'right' });
    pdf.setTextColor(0);
  }

  renderVectorSchemePage(pdf, opts) {
    const { type = 'color', startX = 0, startY = 0, cropW = this.editor.w, cropH = this.editor.h, showCenter = false, pageInfo = "", isPK = false, totalMaxW = this.editor.w, totalMaxH = this.editor.h } = opts;
    
    const margin = 30;
    const rulerSpace = 18; // space for ruler numbers
    const mmToPt = 72 / 25.4;
    let cellSize = 12; // Default for PK
    let pageWidth, pageHeight;

    if (isPK) {
      pageWidth = cropW * cellSize + margin * 2;
      pageHeight = cropH * cellSize + margin * 2;
    } else {
      pageWidth = 595.28;
      pageHeight = 841.89;
      cellSize = 3.5 * mmToPt; // 3.5mm
    }
    
    pdf.addPage([pageWidth, pageHeight], pageWidth > pageHeight ? 'landscape' : 'portrait');
    
    // Pre-calculate color indices
    const usedColors = this.editor.getUsedColors();
    const colorIndexMap = new Map();
    usedColors.forEach((u, i) => colorIndexMap.set(u.color.code, i));

    // Grid offsets with space for rulers on all sides
    const gridXOff = isPK ? margin : margin + rulerSpace;
    const gridYOff = isPK ? margin : margin + rulerSpace;
    
    const lastXOnPage = Math.min(cropW, totalMaxW - startX);
    const lastYOnPage = Math.min(cropH, totalMaxH - startY);

    // 1. Draw Cells & Symbols FIRST (so grid draws on top)
    for (let y = 0; y < lastYOnPage; y++) {
      for (let x = 0; x < lastXOnPage; x++) {
        const color = this.editor.data[(startY + y) * this.editor.w + (startX + x)];
        if (color) {
          const xPos = gridXOff + x * cellSize;
          const yPos = gridYOff + y * cellSize;
          
          if (type === 'color') {
            pdf.setFillColor(color.r, color.g, color.b);
            pdf.rect(xPos, yPos, cellSize, cellSize, 'F');
          }
          
          let sym = this.editor.symbolMap[color.code];
          const colorIdx = colorIndexMap.get(color.code);
          sym = this.getSafeSymbol(sym, colorIdx !== undefined ? colorIdx : 0);

          if (sym) {
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(cellSize * 0.75);
            const isL = this.editor.isLight(color);
            pdf.setTextColor(type === 'color' ? (isL ? 0 : 255) : 0);
            pdf.text(sym, xPos + cellSize / 2, yPos + cellSize / 2 + (isPK ? 3.5 : 2.5), { align: 'center' });
          }
        }
      }
    }

    // 2. Draw Grid ON TOP of cells
    pdf.setDrawColor(0);
    for (let x = 0; x <= lastXOnPage; x++) {
      const xPos = gridXOff + x * cellSize;
      const globalX = startX + x;
      pdf.setLineWidth(globalX % 10 === 0 ? (isPK ? 1.5 : 0.8) : 0.2);
      pdf.line(xPos, gridYOff, xPos, gridYOff + lastYOnPage * cellSize);
    }
    for (let y = 0; y <= lastYOnPage; y++) {
      const yPos = gridYOff + y * cellSize;
      const globalY = startY + y;
      pdf.setLineWidth(globalY % 10 === 0 ? (isPK ? 1.5 : 0.8) : 0.2);
      pdf.line(gridXOff, yPos, gridXOff + lastXOnPage * cellSize, yPos);
    }

    // 3. Ruler numbers on ALL 4 sides (skip for PK)
    if (!isPK) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6);
      pdf.setTextColor(0);
      const gridRight = gridXOff + lastXOnPage * cellSize;
      const gridBottom = gridYOff + lastYOnPage * cellSize;

      for (let x = 0; x < lastXOnPage; x++) {
        const globalX = startX + x;
        if (globalX % 10 === 0) {
          const xPos = gridXOff + x * cellSize;
          // Top ruler
          pdf.text(globalX.toString(), xPos, gridYOff - 4, { align: 'center' });
          // Bottom ruler
          pdf.text(globalX.toString(), xPos, gridBottom + 10, { align: 'center' });
        }
      }
      for (let y = 0; y < lastYOnPage; y++) {
        const globalY = startY + y;
        if (globalY % 10 === 0) {
          const yPos = gridYOff + y * cellSize + 2;
          // Left ruler
          pdf.text(globalY.toString(), gridXOff - 4, yPos, { align: 'right' });
          // Right ruler
          pdf.text(globalY.toString(), gridRight + 4, yPos, { align: 'left' });
        }
      }
    } else {
      // PK rulers (top + left only, original behavior)
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(0);
      for (let x = 0; x < lastXOnPage; x++) {
        const globalX = startX + x;
        if (globalX % 10 === 0) {
          pdf.text(globalX.toString(), gridXOff + x * cellSize, gridYOff - 5, { align: 'center' });
        }
      }
      for (let y = 0; y < lastYOnPage; y++) {
        const globalY = startY + y;
        if (globalY % 10 === 0) {
          pdf.text(globalY.toString(), gridXOff - 5, gridYOff + y * cellSize + 2.5, { align: 'right' });
        }
      }
    }
    
    // 4. Page footer — below grid, not overlapping
    if (!isPK) {
      const footerY = Math.min(gridYOff + lastYOnPage * cellSize + 25, pageHeight - 15);
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      const pNum = pdf.internal.getNumberOfPages();
      const pLabel = pageInfo ? `${pageInfo} | Page ${pNum}` : `Page ${pNum}`;
      pdf.text(`NanaStitch Designer | ${pLabel}`, pageWidth / 2, footerY, { align: 'center' });
    }

    // 5. Draw Backstitch
    if (this.editor.backstitch && this.editor.backstitch.length > 0) {
      this.editor.backstitch.forEach(line => {
        const x1p = gridXOff + (line.x1 - startX) * cellSize;
        const y1p = gridYOff + (line.y1 - startY) * cellSize;
        const x2p = gridXOff + (line.x2 - startX) * cellSize;
        const y2p = gridYOff + (line.y2 - startY) * cellSize;
        
        pdf.setDrawColor(line.color.r, line.color.g, line.color.b);
        pdf.setLineWidth(cellSize / 10);
        pdf.line(x1p, y1p, x2p, y2p);
      });
    }
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  isDark(hex) {
    const rgb = this.hexToRgb(hex);
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness < 128;
  }

  async downloadPatternKeeperPDF(name) {
    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'pt', 'a4');
      
      this.renderVectorSchemePage(pdf, { type: 'bw', showCenter: true, pageInfo: '1/1', isPK: true });
      this.renderVectorKeyPage(pdf, true, true); // Single page, hide footer for PK
      
      if (pdf.internal.getNumberOfPages() > 1) {
        pdf.deletePage(1);
      }
      
      this.savePDF(pdf, `${name}.pdf`);
    } catch (err) {
      console.error("PDF Export Error:", err);
      alert('Помилка PDF: ' + err.message);
      this.toast('Помилка PDF: ' + err.message, 'danger');
    }
  }

  renderPDFPreviewList(pdfType) {
    const list = document.getElementById('pdf-preview-list');
    if(!list) return;
    list.innerHTML = '<p style="color:var(--accent); text-align:center;">Генеруємо попередній перегляд...</p>';
    list.style.display = 'flex';
    document.getElementById('export-preview-canvas').style.display = 'none';

    setTimeout(() => {
      try {
        list.innerHTML = '';
        const canvases = [];
        const title = document.getElementById('pdf-bundle-title').value || "Untitled Pattern";
        const author = document.getElementById('pdf-bundle-author').value || "";

        if (pdfType === 'one-color' || pdfType === 'one-bw') {
          const type = pdfType === 'one-color' ? 'color' : 'bw';
          canvases.push(this._previewTitlePage(title, author));
          canvases.push(...this.editor.generateKeyCanvas(true));
          canvases.push(this.editor.generateExportCanvas({ type: type, showCenter: true }));
        } else if (pdfType === 'pk') {
          canvases.push(this.editor.generateExportCanvas({ type: 'pk', showCenter: true, showRulers: true, showGrid: true }));
          canvases.push(...this.editor.generateKeyCanvas(true));
        } else if (pdfType === 'multi-color' || pdfType === 'multi-bw') {
          canvases.push(this._previewTitlePage(title, author));
          canvases.push(...this.editor.generateKeyCanvas(false));
          const type = pdfType === 'multi-color' ? 'color' : 'bw';
          const chunkW = 50;
          const chunkH = 75;

          let maxW = 0, maxH = 0;
          for(let i=0; i<this.editor.data.length; i++) {
            if(this.editor.data[i]) {
              maxW = Math.max(maxW, (i % this.editor.w) + 1);
              maxH = Math.max(maxH, Math.floor(i / this.editor.w) + 1);
            }
          }
          if (maxW === 0) { maxW = this.editor.w; maxH = this.editor.h; }

          const pagesX = Math.ceil(maxW / chunkW);
          const pagesY = Math.ceil(maxH / chunkH);
          let count = 0;
          for(let py = 0; py < pagesY; py++) {
            for(let px = 0; px < pagesX; px++) {
              canvases.push(this._previewSchemePage({
                type, startX: px * chunkW, startY: py * chunkH,
                cropW: Math.min(chunkW, maxW - px * chunkW),
                cropH: Math.min(chunkH, maxH - py * chunkH),
                totalMaxW: maxW, totalMaxH: maxH,
                pageNum: count + 1
              }));
              count++;
              if (count > 15) break;
            }
            if (count > 15) break;
          }
        }

        canvases.forEach((c, idx) => {
          const wrapper = document.createElement('div');
          wrapper.style.marginBottom = '20px';
          wrapper.style.display = 'flex';
          wrapper.style.flexDirection = 'column';
          wrapper.style.alignItems = 'center';
          
          const label = document.createElement('p');
          label.style.color = 'var(--text-secondary)';
          label.style.marginBottom = '8px';
          label.textContent = `Сторінка ${idx + 1}`;
          wrapper.appendChild(label);
          
          const zoomVal = document.getElementById('pdf-preview-zoom')?.value || 80;
          c.style.width = zoomVal + '%';
          c.style.height = 'auto';
          c.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
          c.style.borderRadius = '8px';
          c.style.background = '#fff';
          wrapper.appendChild(c);
          list.appendChild(wrapper);
        });
        
        if (canvases.length > 10) {
          const msg = document.createElement('p');
          msg.style.color = 'var(--text-muted)';
          msg.style.fontSize = '12px';
          msg.textContent = '...показано перші сторінки';
          list.appendChild(msg);
        }
      } catch(e) {
        console.error("Preview error:", e);
        list.innerHTML = `<p style="color:red; text-align:center;">Помилка: ${e.message}</p>`;
      }
    }, 100);
  }

  // Preview title page matching renderVectorTitlePage
  _previewTitlePage(title, author) {
    const w = 595, h = 842;
    const c = document.createElement('canvas');
    c.width = w * 2; c.height = h * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';

    // Banner
    let bannerEndY = 10;
    if (this.bannerImg && this.bannerImg.complete && this.bannerImg.naturalWidth > 0) {
      try {
        const bAspect = this.bannerImg.naturalWidth / this.bannerImg.naturalHeight;
        const bH = w / bAspect;
        ctx.drawImage(this.bannerImg, 0, 0, w, bH);
        bannerEndY = bH + 10;
      } catch(e) {
        ctx.fillStyle = '#4f46e5'; ctx.fillRect(0, 0, w, 80);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Inter, sans-serif';
        ctx.fillText('NanaStitch', w/2, 45);
        bannerEndY = 90;
      }
    } else {
      ctx.fillStyle = '#4f46e5'; ctx.fillRect(0, 0, w, 80);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Inter, sans-serif';
      ctx.fillText('NanaStitch', w/2, 45);
      bannerEndY = 90;
    }

    // Title
    ctx.fillStyle = '#1e293b'; ctx.font = 'bold 28px Inter, sans-serif';
    ctx.fillText(title, w/2, bannerEndY + 25);
    if (author) {
      ctx.fillStyle = '#64748b'; ctx.font = 'italic 14px Inter, sans-serif';
      ctx.fillText(`by ${author}`, w/2, bannerEndY + 45);
    }

    // Realistic miniature with correct aspect ratio
    const miniY = bannerEndY + 70;
    const maxMiniW = 300, maxMiniH = 250;
    const aspect = this.editor.w / this.editor.h;
    let miniW, miniH;
    if (aspect > maxMiniW / maxMiniH) { miniW = maxMiniW; miniH = maxMiniW / aspect; }
    else { miniH = maxMiniH; miniW = maxMiniH * aspect; }
    const miniX = (w - miniW) / 2;

    try {
      const previewCanvas = this.editor.generateExportCanvas({ type: 'realistic', cellSize: 4, showGrid: false, showCenter: false, showRulers: false });
      ctx.drawImage(previewCanvas, miniX, miniY, miniW, miniH);
    } catch(e) {
      const pxW = miniW / this.editor.w, pxH = miniH / this.editor.h;
      for (let i = 0; i < this.editor.data.length; i++) {
        const color = this.editor.data[i];
        if (!color) continue;
        ctx.fillStyle = color.hex;
        ctx.fillRect(miniX + (i % this.editor.w) * pxW, miniY + Math.floor(i / this.editor.w) * pxH, Math.ceil(pxW), Math.ceil(pxH));
      }
    }
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.5;
    ctx.strokeRect(miniX-1, miniY-1, miniW+2, miniH+2);

    // Stats
    const statsY = miniY + miniH + 30;
    ctx.fillStyle = '#1e293b'; ctx.font = 'bold 16px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`Pattern Size: ${this.editor.w} \u00D7 ${this.editor.h} stitches`, w/2, statsY);
    const used = this.editor.getUsedColors();
    ctx.fillText(`Colors: ${used.length}`, w/2, statsY + 22);

    // Fabric guide
    const guideY = statsY + 50;
    ctx.fillStyle = '#4f46e5'; ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText('Fabric Size Guide:', w/2, guideY);
    ctx.fillStyle = '#475569'; ctx.font = '11px Inter, sans-serif';
    [14,16,18,20,25].forEach((ct, i) => {
      const cw = (this.editor.w / ct * 2.54).toFixed(1), ch = (this.editor.h / ct * 2.54).toFixed(1);
      const iw = (this.editor.w / ct).toFixed(1), ih = (this.editor.h / ct).toFixed(1);
      ctx.fillText(`Aida ${ct} ct: ${cw} \u00D7 ${ch} cm (${iw} \u00D7 ${ih} inches)`, w/2, guideY + 20 + i * 18);
    });

    ctx.fillStyle = '#999'; ctx.font = '10px Inter, sans-serif';
    ctx.fillText('Generated by NanaStitch Professional', w/2, h - 30);
    return c;
  }

  // Preview scheme page matching renderVectorSchemePage for A4 print
  _previewSchemePage(opts) {
    const { type='color', startX=0, startY=0, cropW, cropH, totalMaxW, totalMaxH, pageNum=1 } = opts;
    const w = 595, h = 842;
    const c = document.createElement('canvas');
    c.width = w * 2; c.height = h * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);

    const margin = 30;
    const rulerSpace = 18;
    const cellSize = 3.5 * (72 / 25.4);
    const gridXOff = margin + rulerSpace;
    const gridYOff = margin + rulerSpace;
    const lastX = Math.min(cropW, totalMaxW - startX);
    const lastY = Math.min(cropH, totalMaxH - startY);

    // 1. Cells & Symbols FIRST
    const usedColors = this.editor.getUsedColors();
    const colorIndexMap = new Map();
    usedColors.forEach((u, i) => colorIndexMap.set(u.color.code, i));
    const safePool = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789abcdefghijklmnopqrstuvwxyz#@$&%*+=-";

    for (let y = 0; y < lastY; y++) {
      for (let x = 0; x < lastX; x++) {
        const color = this.editor.data[(startY + y) * this.editor.w + (startX + x)];
        if (color) {
          const xPos = gridXOff + x * cellSize;
          const yPos = gridYOff + y * cellSize;
          if (type === 'color') {
            ctx.fillStyle = color.hex;
            ctx.fillRect(xPos, yPos, cellSize, cellSize);
          }
          let sym = this.editor.symbolMap[color.code];
          const idx = colorIndexMap.get(color.code);
          if (!sym || sym.charCodeAt(0) > 255) sym = safePool[(idx !== undefined ? idx : 0) % safePool.length];
          ctx.font = `bold ${cellSize * 0.75}px Inter, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const isL = this.editor.isLight(color);
          ctx.fillStyle = type === 'color' ? (isL ? '#000' : '#fff') : '#000';
          ctx.fillText(sym, xPos + cellSize/2, yPos + cellSize/2 + 1);
        }
      }
    }

    // 2. Grid ON TOP
    ctx.strokeStyle = '#000';
    for (let x = 0; x <= lastX; x++) {
      const xPos = gridXOff + x * cellSize;
      ctx.lineWidth = (startX + x) % 10 === 0 ? 0.8 : 0.2;
      ctx.beginPath(); ctx.moveTo(xPos, gridYOff); ctx.lineTo(xPos, gridYOff + lastY * cellSize); ctx.stroke();
    }
    for (let y = 0; y <= lastY; y++) {
      const yPos = gridYOff + y * cellSize;
      ctx.lineWidth = (startY + y) % 10 === 0 ? 0.8 : 0.2;
      ctx.beginPath(); ctx.moveTo(gridXOff, yPos); ctx.lineTo(gridXOff + lastX * cellSize, yPos); ctx.stroke();
    }

    // 2.5 Draw Backstitch
    if (this.editor.backstitch && this.editor.backstitch.length > 0) {
      ctx.lineCap = 'round';
      this.editor.backstitch.forEach(line => {
        const x1p = gridXOff + (line.x1 - startX) * cellSize;
        const y1p = gridYOff + (line.y1 - startY) * cellSize;
        const x2p = gridXOff + (line.x2 - startX) * cellSize;
        const y2p = gridYOff + (line.y2 - startY) * cellSize;
        ctx.strokeStyle = line.color.hex;
        ctx.lineWidth = cellSize / 10;
        ctx.beginPath();
        ctx.moveTo(x1p, y1p);
        ctx.lineTo(x2p, y2p);
        ctx.stroke();
      });
    }

    // 3. Ruler numbers on ALL 4 sides
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000'; ctx.font = 'bold 6px Inter, sans-serif';
    const gridRight = gridXOff + lastX * cellSize;
    const gridBottom = gridYOff + lastY * cellSize;

    for (let x = 0; x < lastX; x++) {
      const gx = startX + x;
      if (gx % 10 === 0) {
        const xPos = gridXOff + x * cellSize;
        ctx.textAlign = 'center';
        ctx.fillText(gx.toString(), xPos, gridYOff - 4); // Top
        ctx.fillText(gx.toString(), xPos, gridBottom + 10); // Bottom
      }
    }
    for (let y = 0; y < lastY; y++) {
      const gy = startY + y;
      if (gy % 10 === 0) {
        const yPos = gridYOff + y * cellSize + 2;
        ctx.textAlign = 'right';
        ctx.fillText(gy.toString(), gridXOff - 4, yPos); // Left
        ctx.textAlign = 'left';
        ctx.fillText(gy.toString(), gridRight + 4, yPos); // Right
      }
    }

    // 4. Footer below grid
    const footerY = Math.min(gridBottom + 25, h - 15);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#999'; ctx.font = '8px Inter, sans-serif';
    ctx.fillText(`NanaStitch Designer | Page ${pageNum}`, w/2, footerY);
    return c;
  }

  updateExportPreview(){
    const type = this._exportType;
    const btnDown = document.getElementById('btn-export-download');
    const cv = document.getElementById('export-preview-canvas');
    if(btnDown) btnDown.style.display = 'block';

    if(!cv) return;
    let res = null;
    if(type==='stitches') res = this.editor.generateStitches();
    else if(type==='scheme') res = this.editor.generateScheme();
    else if(type.startsWith('mockup-')) res = this.editor.generateMockup(type.split('-')[1]);
    
    if(res){
      this._exportCanvas = res;
      cv.width = res.width; cv.height = res.height;
      const ctx = cv.getContext('2d');
      ctx.drawImage(res, 0, 0);

      const img = document.getElementById('export-preview-img');
      if(img) {
        img.src = res.toDataURL('image/png');
      }
    }
  }
  renderPalette(q){
    const pal=document.getElementById('catalog-palette');pal.innerHTML='';
    const ql=q.toLowerCase();
    const filtered=DMC_COLORS.filter(c=>!q||c.code.toLowerCase().includes(ql)||c.name.toLowerCase().includes(ql));
    filtered.forEach(c=>{
      const el=document.createElement('div');el.className='palette-item'+(this.color&&this.color.code===c.code?' active':'');
      el.dataset.code = c.code;
      el.innerHTML=`<div class="palette-item-left"><div class="color-swatch" style="background:${c.hex}"></div><div class="color-info"><span class="color-code">${c.code}</span><span class="color-name">${c.name}</span></div></div><button class="palette-add-btn" title="Обрати колір DMC ${c.code}">+</button>`;
      el.querySelector('.palette-add-btn').onclick=(e)=>{
        e.stopPropagation();
        this.editor.addToPalette(c.code);
        this.selectColor(c, true);
        this.renderProjectPalette();
        this.toast(`DMC ${c.code} — ${c.name} додано до палітри`, 'success');
      };
      el.onclick=()=>this.selectColor(c, true);
      pal.appendChild(el);
    });
  }

  renderSymbolPicker(colorCode) {
    const grid = document.getElementById('symbol-picker-grid');
    const info = document.getElementById('symbol-picker-target-info');
    if (!grid || !info) return;

    const color = DMC_COLORS.find(x => x.code === colorCode);
    info.innerHTML = `Зміна символу для <span style="color:var(--accent); font-weight:700;">DMC ${colorCode} (${color.name})</span>`;
    
    grid.innerHTML = '';
    const currentSym = this.editor.symbolMap[colorCode];

    this.editor.SYMBOLS_POOL.forEach(sym => {
      const item = document.createElement('div');
      item.className = 'symbol-picker-item';
      if (sym === currentSym) item.classList.add('active');
      item.textContent = sym;
      
      item.onclick = () => {
        const oldSym = this.editor.symbolMap[colorCode];
        const conflictingColorCode = Object.keys(this.editor.symbolMap).find(code => code !== colorCode && this.editor.symbolMap[code] === sym);
        if (conflictingColorCode) {
          this.editor.symbolMap[conflictingColorCode] = oldSym;
        }
        this.editor.symbolMap[colorCode] = sym;
        
        this.renderOrganizer();
        this.renderProjectPalette();
        this.editor.render();
        document.getElementById('modal-symbol-picker').classList.remove('active');
        this.toast('Символ змінено', 'success');
      };
      
      grid.appendChild(item);
    });

    document.getElementById('modal-symbol-picker').style.zIndex = '150';
    document.getElementById('modal-symbol-picker').classList.add('active');
  }
  renderProjectPalette(){
    const pal=document.getElementById('project-palette');pal.innerHTML='';
    const used=this.editor.getUsedColors();
    used.forEach(u=>{
      const c=u.color;
      const el=document.createElement('div');
      el.className='palette-item';
      if(this.color && this.color.code === c.code) el.classList.add('active');
      if(this.highlightedColor && this.highlightedColor.code === c.code) el.classList.add('highlighted');
      
      el.dataset.code = c.code;
      el.draggable = true;

      const sym = this.editor.symbolMap[c.code] || '';
      const isLocked = this.editor.lockedColors.has(c.code);
      el.innerHTML=`
        <div class="palette-item-left">
          <div class="color-swatch" style="background:${c.hex}">${sym ? `<span style="font-size:16px;font-weight:900;color:${this.editor.isLight(c)?'#000':'#fff'};display:flex;align-items:center;justify-content:center;width:100%;height:100%">${sym}</span>` : ''}</div>
          <div class="color-info"><span class="color-code">${c.code}</span><span class="color-name">${c.name}</span></div>
        </div>
        <div class="palette-item-right" style="display:flex; align-items:center; gap: 8px;">
          <div class="palette-item-count">${u.count}</div>
          <button class="palette-item-lock" title="${isLocked ? 'Розблокувати колір' : 'Заблокувати колір'}" style="background:transparent; border:none; cursor:pointer; font-size:14px; padding:2px; display:flex; align-items:center; justify-content:center; color:${isLocked ? '#f59e0b' : '#64748b'};">${isLocked ? '🔒' : '🔓'}</button>
        </div>`;
      
      el.onclick=()=>this.selectColor(c, true);

      const btnLock = el.querySelector('.palette-item-lock');
      btnLock.onclick = (e) => {
        e.stopPropagation(); // prevent selecting the color
        if (this.editor.lockedColors.has(c.code)) {
          this.editor.lockedColors.delete(c.code);
          this.toast(`Колір DMC ${c.code} розблоковано`, 'info');
        } else {
          this.editor.lockedColors.add(c.code);
          this.toast(`Колір DMC ${c.code} заблоковано`, 'success');
        }
        this.renderProjectPalette();
      };

      // Drag and Drop for merging
      el.ondragstart = (e) => {
        e.dataTransfer.setData('colorCode', c.code);
        el.style.opacity = '0.5';
      };
      el.ondragend = () => el.style.opacity = '1';
      el.ondragover = (e) => e.preventDefault();
      el.ondrop = (e) => {
        e.preventDefault();
        const draggedCode = e.dataTransfer.getData('colorCode');
        if (draggedCode && draggedCode !== c.code) {
          if (confirm(`Замінити всі хрестики DMC ${draggedCode} на DMC ${c.code}?`)) {
            const oldCol = DMC_COLORS.find(x => x.code === draggedCode);
            this.editor.replaceColor(oldCol, c);
            this.renderProjectPalette();
            this.toast(`Кольори об'єднано`, 'success');
          }
        }
      };

      pal.appendChild(el);
    });
    
    // Organizer button
    const btnOrg = document.getElementById('btn-open-organizer');
    if(btnOrg) {
      btnOrg.onclick = () => {
        this.renderOrganizer();
        document.getElementById('modal-organizer').classList.add('active');
      };
    }
  }

  renderOrganizer(){
    const grid = document.getElementById('organizer-grid');
    if(!grid) return;
    grid.innerHTML = '';
    
    let used = this.editor.getUsedColors();
    
    if (this.organizerSort === 'count') {
      used.sort((a,b) => b.count - a.count);
    } else if (this.organizerSort === 'hue') {
      const getHue = (c) => {
        const r = c.r / 255, g = c.g / 255, b = c.b / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h;
        if (max === min) h = 0;
        else if (max === r) h = (g - b) / (max - min);
        else if (max === g) h = 2 + (b - r) / (max - min);
        else h = 4 + (r - g) / (max - min);
        return h < 0 ? h + 6 : h;
      };
      used.sort((a,b) => getHue(a.color) - getHue(b.color));
    }

    used.forEach(u => {
      const c = u.color;
      const el = document.createElement('div');
      el.className = 'organizer-item';
      el.draggable = true;
      el.dataset.code = c.code;
      
      const sym = this.editor.symbolMap[c.code] || '';
      const isLight = this.editor.isLight(c);
      
      el.innerHTML = `
        <div class="organizer-swatch" style="background:${c.hex}" title="Натисніть, щоб змінити символ">
          <span style="color:${isLight?'#000':'#fff'}">${sym}</span>
        </div>
        <div class="organizer-info">
          <div class="organizer-code">DMC ${c.code}</div>
          <div class="organizer-name">${c.name}</div>
        </div>
        <div class="organizer-count">${u.count} хрестиків</div>
      `;

      const swatch = el.querySelector('.organizer-swatch');
      swatch.onclick = (e) => {
        e.stopPropagation();
        this.renderSymbolPicker(c.code);
      };
      
      el.ondragstart = (e) => {
        e.dataTransfer.setData('mergeFrom', c.code);
        el.style.opacity = '0.4';
        el.style.transform = 'scale(0.95)';
      };
      
      el.ondragend = () => {
        el.style.opacity = '1';
        el.style.transform = '';
        document.querySelectorAll('.organizer-item').forEach(i => i.classList.remove('drag-over'));
      };
      
      el.ondragover = (e) => {
        e.preventDefault();
        el.classList.add('drag-over');
      };
      
      el.ondragleave = () => el.classList.remove('drag-over');
      
      el.ondrop = (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        const fromCode = e.dataTransfer.getData('mergeFrom');
        if (fromCode && fromCode !== c.code) {
          if (confirm(`Ви впевнені, що хочете об'єднати DMC ${fromCode} з DMC ${c.code}? Всі хрестики кольору ${fromCode} стануть кольором ${c.code}.`)) {
            const oldCol = DMC_COLORS.find(x => x.code === fromCode);
            this.editor.replaceColor(oldCol, c);
            this.renderOrganizer();
            this.renderProjectPalette();
            this.toast(`Кольори об'єднано успішно`, 'success');
          }
        }
      };
      
      grid.appendChild(el);
    });
  }
  selectColor(c, fromPalette = false){
    if (fromPalette && this.highlightedColor && this.highlightedColor.code === c.code) {
      this.highlightedColor = null;
    } else if (fromPalette) {
      this.highlightedColor = c;
    }

    this.color=c;
    document.querySelectorAll('.palette-item').forEach(el=>{
      el.classList.toggle('active',el.dataset.code === c.code);
      el.classList.toggle('highlighted', this.highlightedColor && el.dataset.code === this.highlightedColor.code);
    });
    document.getElementById('status-color').textContent=`DMC ${c.code}`;
    
    // Update color info panel
    this.updateSwatch();
    document.getElementById('info-color-code').textContent=`DMC ${c.code}`;
    document.getElementById('info-color-name').textContent=c.name;
    const used=this.editor.getUsedColors().find(u=>u.color.code===c.code);
    document.getElementById('info-color-count').textContent=used?used.count:0;
    
    this.editor.render();

    if(this.tool==='picker'){this.setTool('pencil');}
  }

  updateSwatch() {
    const sfg = document.getElementById('swatch-fg');
    const sbg = document.getElementById('swatch-bg');
    if (sfg && this.color) sfg.style.backgroundColor = this.color.hex;
    if (sbg && this.bgColor) sbg.style.backgroundColor = this.bgColor.hex;
  }

  swapColors() {
    const temp = this.color;
    this.color = this.bgColor;
    this.bgColor = temp;
    this.selectColor(this.color, false);
    this.updateSwatch();
  }
  setZoom(v){
    this.zoom=Math.max(0.1,Math.min(3,v));
    document.getElementById('zoom-level').textContent=Math.round(this.zoom*100)+'%';
    document.getElementById('zoom-slider').value=Math.round(this.zoom*100);
    document.getElementById('canvas-container').style.transform=`scale(${this.zoom})`;
  }
  zoomToFit(){
    const w = document.getElementById('canvas-wrapper');
    const c = document.getElementById('canvas-container');
    if(!w || !c || c.offsetWidth === 0) return;
    
    const padding = 60;
    const availableW = w.clientWidth - padding;
    const availableH = w.clientHeight - padding;
    
    const scaleW = availableW / c.offsetWidth;
    const scaleH = availableH / c.offsetHeight;
    
    // Fit to screen, but don't zoom in more than 150% automatically
    let targetZoom = Math.min(scaleW, scaleH);
    targetZoom = Math.min(Math.max(targetZoom, 0.1), 1.5);
    
    this.setZoom(targetZoom);
    this.centerView();
  }
  // --- Modals ---
  initModals(){
    document.querySelectorAll('.modal-close').forEach(b=>{
      b.onclick=()=>document.getElementById(b.dataset.close).classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(b=>{
      b.onclick=()=>{
        const m=b.closest('.modal-content');
        m.querySelectorAll('.tab-btn').forEach(t=>t.classList.remove('active'));
        m.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
        b.classList.add('active');
        document.getElementById(b.dataset.tab).classList.add('active');
        if (b.dataset.tab === 'tab-photo') {
          m.classList.add('modal-xl');
        } else {
          m.classList.remove('modal-xl');
        }
      };
    });
    // close on backdrop — only close if no other modal is open on top
    document.querySelectorAll('.modal').forEach(m=>{
      m.onclick=e=>{
        if(e.target===m) {
          // Don't close organizer if symbol picker is active on top
          if(m.id === 'modal-organizer' && document.getElementById('modal-symbol-picker').classList.contains('active')) return;
          m.classList.remove('active');
        }
      };
    });
    // new project
    document.getElementById('btn-new').onclick=()=>document.getElementById('modal-new').classList.add('active');
    document.getElementById('btn-create-empty').onclick=()=>{
      const w=parseInt(document.getElementById('new-width').value);
      const h=parseInt(document.getElementById('new-height').value);
      this.editor.resize(w,h);this.editor.history=[];this.editor.future=[];
      document.getElementById('grid-width').value=w;document.getElementById('grid-height').value=h;
      document.getElementById('modal-new').classList.remove('active');
      setTimeout(()=>this.zoomToFit(), 50);
      this.toast('Новий проект створено','success');
    };
    // image import
    // image import
    const pinp=document.getElementById('input-image');
    document.getElementById('drop-zone').onclick=()=>pinp.click();
    pinp.onchange=e=>{
      if(e.target.files[0]) this.imgEditor.load(e.target.files[0]);
    };
    document.getElementById('btn-edit-crop').onclick=()=>this.imgEditor.toggleMode('crop');
    document.getElementById('btn-edit-circle').onclick=()=>this.imgEditor.applyCircle();
    document.getElementById('btn-edit-bg').onclick=()=>this.imgEditor.toggleMode('bg');
    document.getElementById('btn-edit-reset').onclick=()=>this.imgEditor.reset();
    document.getElementById('btn-convert').onclick=()=>this.convertImage();

    // pdf
    document.getElementById('btn-export-pdf').onclick=()=>{
      document.getElementById('modal-pdf').classList.add('active');
      document.getElementById('pdf-bundle-title').value=document.getElementById('project-name').value;
      this.renderPDFPreviewList('one-color'); // Default view
    };
    
    // Bind preview updates
    let pdfTimeout;
    const updatePdf = () => {
      clearTimeout(pdfTimeout);
      pdfTimeout = setTimeout(() => this.updatePDFPreview(), 600);
    };
    document.querySelectorAll('#modal-pdf input, #modal-pdf select, #modal-pdf textarea').forEach(el => {
        el.addEventListener('input', updatePdf);
        el.addEventListener('change', updatePdf);
    });
    
    // PDF Bundle batch button is handled in initUI
  }
  
  convertImage(){
    const img = this.imgEditor.getImage();
    if(!img) return this.toast('Спочатку виберіть фото','error');
    
    const w = parseInt(document.getElementById('import-width').value);
    const h = Math.round((img.height / img.width) * w);
    const maxColors = parseInt(document.getElementById('import-colors').value) || 30;
    
    this.toast('Конвертація...','info');
    
    // Очищаємо кеш кольорів для нової картинки, щоб не переповнювати пам'ять
    this.colorCache = new Map();
    
    const temp = document.createElement('canvas');
    temp.width = w; temp.height = h;
    const tctx = temp.getContext('2d');
    
    // Застосовуємо фільтри з UI
    const b = document.getElementById('import-bright').value;
    const c = document.getElementById('import-contrast').value;
    const s = document.getElementById('import-sat').value;
    tctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
    
    tctx.drawImage(img, 0, 0, w, h);
    
    const id = tctx.getImageData(0,0,w,h);
    const data = id.data;
    
    // 1. Show loading overlay
    document.getElementById('convert-loading').style.display = 'flex';
    document.getElementById('convert-progress-text').innerText = 'Підготовка...';
    
    const ditherStrength = parseInt(document.getElementById('import-dither').value) / 100;
    const optimizeBg = document.getElementById('import-optimize-bg')?.checked || false;
    
    const canvasW = this.imgEditor.canvas.width || 1;
    const canvasH = this.imgEditor.canvas.height || 1;
    const scaleX = w / canvasW;
    const scaleY = h / canvasH;
    const seeds = (this.imgEditor.foregroundSeeds || []).map(seed => ({
      x: Math.round(seed.x * scaleX),
      y: Math.round(seed.y * scaleY),
      r: seed.color.r,
      g: seed.color.g,
      b: seed.color.b
    }));
    
    const workerCode = `
      self.onmessage = function(e) {
        const { data, w, h, maxColors, ditherStrength, dmcColors, lockedCodes, optimizeBg, foregroundSeeds } = e.data;
        
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
          
          const deltL = L2 - L1;
          const deltC = C2p - C1p;
          const deltH = 2 * Math.sqrt(C1p * C2p) * Math.sin((delthp / 2) * Math.PI / 180);
          
          let avghp = h1p + h2p;
          if (C1p !== 0 && C2p !== 0) {
            if (Math.abs(h1p - h2p) <= 180) avghp = (h1p + h2p) / 2;
            else if (h1p + h2p < 360) avghp = (h1p + h2p + 360) / 2;
            else avghp = (h1p + h2p - 360) / 2;
          }
          
          const T = 1 - 0.17 * Math.cos((avghp - 30) * Math.PI / 180) + 0.24 * Math.cos(2 * avghp * Math.PI / 180) + 0.32 * Math.cos((3 * avghp + 6) * Math.PI / 180) - 0.20 * Math.cos((4 * avghp - 63) * Math.PI / 180);
          const sl = 1 + 0.015 * Math.pow(avgL - 50, 2) / Math.sqrt(20 + Math.pow(avgL - 50, 2));
          const sc = 1 + 0.045 * avgCp;
          const sh = 1 + 0.015 * avgCp * T;
          const deltTheta = 30 * Math.exp(-Math.pow((avghp - 275) / 25, 2));
          const Rc = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
          const RT = -Math.sin(2 * deltTheta * Math.PI / 180) * Rc;
          return Math.sqrt(Math.pow(deltL / sl, 2) + Math.pow(deltC / sc, 2) + Math.pow(deltH / sh, 2) + RT * (deltC / sc) * (deltH / sh));
        }

        self.postMessage({ type: 'progress', percent: 10, text: 'Аналіз кольорів...' });
        
        for (const c of dmcColors) {
          if (!c.lab) c.lab = rgbToLab(c.r, c.g, c.b);
        }
        
        // Prepare seeds
        const fgSeedsLab = [];
        if (optimizeBg && Array.isArray(foregroundSeeds)) {
          for (const s of foregroundSeeds) {
            fgSeedsLab.push(rgbToLab(s.r, s.g, s.b));
          }
        }
        
        // Prepare border sampling if optimizing background and no manual seeds are clicked
        const borderLab = [];
        if (optimizeBg && fgSeedsLab.length === 0) {
          const step = Math.max(1, Math.floor((w + h) / 100));
          for (let x = 0; x < w; x += step) {
            for (let y of [0, Math.floor(h * 0.05), h - 1, Math.floor(h * 0.95)]) {
              if (y >= 0 && y < h) {
                const idx = (y * w + x) * 4;
                if (data[idx+3] >= 128) borderLab.push(rgbToLab(data[idx], data[idx+1], data[idx+2]));
              }
            }
          }
          for (let y = 0; y < h; y += step) {
            for (let x of [0, Math.floor(w * 0.05), w - 1, Math.floor(w * 0.95)]) {
              if (x >= 0 && x < w) {
                const idx = (y * w + x) * 4;
                if (data[idx+3] >= 128) borderLab.push(rgbToLab(data[idx], data[idx+1], data[idx+2]));
              }
            }
          }
        }

        // 1. Initial rough map to count frequencies and segment foreground/background
        const isFgArray = new Uint8Array(w * h);
        const counts = {};
        const colorCache = new Map();
        
        for(let i=0; i<data.length; i+=4){
          if(data[i+3] < 128) continue;
          
          if (i % 40000 === 0) {
             const progress = 10 + Math.floor((i / data.length) * 20);
             self.postMessage({ type: 'progress', percent: progress, text: 'Аналіз кольорів...' });
          }
          
          const y = Math.floor((i / 4) / w);
          const x = (i / 4) % w;
          const cr = data[i] & 0xFE;
          const cg = data[i+1] & 0xFE;
          const cb = data[i+2] & 0xFE;
          const cacheKey = (cr << 16) | (cg << 8) | cb;
          
          let best;
          if (colorCache.has(cacheKey)) {
             best = colorCache.get(cacheKey);
          } else {
             const lab1 = rgbToLab(cr, cg, cb);
             let min = Infinity;
             best = dmcColors[0];
             for(let k=0; k<dmcColors.length; k++){
               const cDMC = dmcColors[k];
               const d = deltaE2000(lab1, cDMC.lab);
               if(d < min){ min = d; best = cDMC; }
             }
             colorCache.set(cacheKey, best);
          }
          counts[best.code] = (counts[best.code] || 0) + 1;
          
          // Classify pixel as Foreground or Background
          let isFg = true;
          if (optimizeBg) {
            const labP = rgbToLab(data[i], data[i+1], data[i+2]);
            if (fgSeedsLab.length > 0) {
              let minDist = Infinity;
              for (const seedLab of fgSeedsLab) {
                const d = deltaE2000(labP, seedLab);
                if (d < minDist) minDist = d;
              }
              isFg = (minDist < 18);
            } else {
              let closeToBorder = false;
              for (const bLab of borderLab) {
                if (deltaE2000(labP, bLab) < 15) {
                  closeToBorder = true;
                  break;
                }
              }
              isFg = !closeToBorder;
            }
          }
          isFgArray[y * w + x] = isFg ? 1 : 0;
        }
        
        self.postMessage({ type: 'progress', percent: 30, text: 'Підбір палітри...' });
        
        // Count frequencies of 5-bit colors for foreground and background separately
        const fgColorMap = new Map();
        const bgColorMap = new Map();
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] >= 128) {
            const y = Math.floor((i / 4) / w);
            const x = (i / 4) % w;
            const isFg = isFgArray[y * w + x] === 1;
            
            const r = data[i] & 0xF8;
            const g = data[i + 1] & 0xF8;
            const b = data[i + 2] & 0xF8;
            const key = (r << 16) | (g << 8) | b;
            
            if (isFg) {
              fgColorMap.set(key, (fgColorMap.get(key) || 0) + 1);
            } else {
              bgColorMap.set(key, (bgColorMap.get(key) || 0) + 1);
            }
          }
        }

        // Helper to extract centroids using k-means++ for better palette selection
        function extractCentroids(colorMap, targetK) {
          const uniqueColors = [];
          for (const [key, count] of colorMap.entries()) {
            const r = (key >> 16) & 0xFF;
            const g = (key >> 8) & 0xFF;
            const b = key & 0xFF;
            uniqueColors.push({
              lab: rgbToLab(r, g, b),
              count: count
            });
          }
          if (uniqueColors.length === 0) return [];
          
          const K = Math.min(targetK, uniqueColors.length);
          if (K <= 0) return [];
          if (K >= uniqueColors.length) return uniqueColors.map(c => c.lab);

          // k-means++ initialization (weighted by count)
          const totalCount = uniqueColors.reduce((a, b) => a + b.count, 0);
          const centroids = [];
          
          // First centroid: pick most frequent color
          uniqueColors.sort((a, b) => b.count - a.count);
          centroids.push({ l: uniqueColors[0].lab.l, a: uniqueColors[0].lab.a, b: uniqueColors[0].lab.b });
          
          // Remaining centroids: probability proportional to D(x)^2 * count
          for (let c = 1; c < K; c++) {
            let totalWeight = 0;
            const weights = [];
            for (const item of uniqueColors) {
              let minDist = Infinity;
              for (const cent of centroids) {
                const d = deltaE2000(item.lab, cent);
                if (d < minDist) minDist = d;
              }
              const w = minDist * minDist * item.count;
              weights.push(w);
              totalWeight += w;
            }
            // Weighted random selection
            let r = Math.random() * totalWeight;
            let chosen = 0;
            for (let i = 0; i < weights.length; i++) {
              r -= weights[i];
              if (r <= 0) { chosen = i; break; }
            }
            centroids.push({ l: uniqueColors[chosen].lab.l, a: uniqueColors[chosen].lab.a, b: uniqueColors[chosen].lab.b });
          }

          // Run 5 iterations of k-means refinement
          for (let iter = 0; iter < 5; iter++) {
            // Assign each color to nearest centroid
            const clusters = Array.from({ length: K }, () => ({ sumL: 0, sumA: 0, sumB: 0, totalCount: 0 }));
            for (const item of uniqueColors) {
              let minDist = Infinity;
              let bestC = 0;
              for (let c = 0; c < centroids.length; c++) {
                const d = deltaE2000(item.lab, centroids[c]);
                if (d < minDist) { minDist = d; bestC = c; }
              }
              clusters[bestC].sumL += item.lab.l * item.count;
              clusters[bestC].sumA += item.lab.a * item.count;
              clusters[bestC].sumB += item.lab.b * item.count;
              clusters[bestC].totalCount += item.count;
            }
            // Update centroids
            for (let c = 0; c < K; c++) {
              if (clusters[c].totalCount > 0) {
                centroids[c] = {
                  l: clusters[c].sumL / clusters[c].totalCount,
                  a: clusters[c].sumA / clusters[c].totalCount,
                  b: clusters[c].sumB / clusters[c].totalCount
                };
              }
            }
          }
          
          return centroids;
        }

        // Allocate color limits
        let bgMax = 0;
        let fgMax = maxColors;
        if (optimizeBg && bgColorMap.size > 0) {
          bgMax = Math.max(1, Math.min(3, maxColors - 2));
          fgMax = maxColors - bgMax;
        }

        const bgCentroids = extractCentroids(bgColorMap, bgMax);
        const fgCentroids = extractCentroids(fgColorMap, fgMax);

        // Map centroids to DMC colors
        const bgPalette = [];
        const fgPalette = [];
        const paletteCodes = new Set();

        // 1. Handle locked codes (always foreground)
        if (Array.isArray(lockedCodes)) {
          for (const code of lockedCodes) {
            const dmc = dmcColors.find(c => c.code === code);
            if (dmc && !paletteCodes.has(dmc.code)) {
              if (!dmc.lab) dmc.lab = rgbToLab(dmc.r, dmc.g, dmc.b);
              paletteCodes.add(dmc.code);
              fgPalette.push(dmc);
            }
          }
        }

        // 2. Map BG Centroids
        for (const cent of bgCentroids) {
          if (bgPalette.length >= bgMax) break;
          let minD = Infinity;
          let bestDMC = dmcColors[0];
          for (const dmc of dmcColors) {
            const d = deltaE2000(cent, dmc.lab);
            if (d < minD) { minD = d; bestDMC = dmc; }
          }
          if (!paletteCodes.has(bestDMC.code)) {
            paletteCodes.add(bestDMC.code);
            bgPalette.push(bestDMC);
          }
        }

        // 3. Map FG Centroids
        for (const cent of fgCentroids) {
          if (fgPalette.length >= fgMax) break;
          let minD = Infinity;
          let bestDMC = dmcColors[0];
          for (const dmc of dmcColors) {
            const d = deltaE2000(cent, dmc.lab);
            if (d < minD) { minD = d; bestDMC = dmc; }
          }
          if (!paletteCodes.has(bestDMC.code)) {
            paletteCodes.add(bestDMC.code);
            fgPalette.push(bestDMC);
          }
        }

        // Backfill palettes to reach maxColors
        const totalAllocated = bgPalette.length + fgPalette.length;
        if (totalAllocated < maxColors) {
          const sortedCodes = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
          for (const code of sortedCodes) {
            if (bgPalette.length + fgPalette.length >= maxColors) break;
            if (!paletteCodes.has(code)) {
              paletteCodes.add(code);
              fgPalette.push(dmcColors.find(c => c.code === code));
            }
          }
        }

        const result = new Array(w * h).fill(null);
        const rgbData = new Float32Array(w * h * 3);
        for(let i=0, j=0; i<data.length; i+=4, j+=3){
          rgbData[j] = data[i];
          rgbData[j+1] = data[i+1];
          rgbData[j+2] = data[i+2];
        }
        
        const paletteCache = new Map();
        
        for(let y=0; y<h; y++){
          if (y % 10 === 0) {
            const progress = 40 + Math.floor((y / h) * 60);
            self.postMessage({ type: 'progress', percent: progress, text: 'Малювання хрестиків...' });
          }
          for(let x=0; x<w; x++){
            const alpha = data[(y*w + x) * 4 + 3];
            if(alpha < 128) continue;
            
            const isFg = isFgArray[y * w + x] === 1;
            // Background pixels map to bgPalette, Foreground to fgPalette
            const localPalette = (optimizeBg && !isFg && bgPalette.length > 0) ? bgPalette : fgPalette;
            
            const idx = (y*w + x) * 3;
            let r = rgbData[idx], g = rgbData[idx+1], b = rgbData[idx+2];
            r = Math.max(0, Math.min(255, r));
            g = Math.max(0, Math.min(255, g));
            b = Math.max(0, Math.min(255, b));
            
            const cr = Math.round(r); 
            const cg = Math.round(g);
            const cb = Math.round(b);
            const cacheKey = (isFg ? 'fg_' : 'bg_') + ((cr << 16) | (cg << 8) | cb);
            
            let best;
            if (paletteCache.has(cacheKey)) {
               best = paletteCache.get(cacheKey);
            } else {
               const labC = rgbToLab(cr, cg, cb);
               let min = Infinity;
               best = localPalette[0] || fgPalette[0];
               for(let i=0; i<localPalette.length; i++){
                 const pc = localPalette[i];
                 const d = deltaE2000(labC, pc.lab);
                 if(d < min){ min = d; best = pc; }
               }
               paletteCache.set(cacheKey, best);
            }
            
            result[y*w + x] = best ? best.code : null;
            
            if (ditherStrength > 0 && best) {
              const rgbDist = Math.sqrt((r - best.r)*(r - best.r) + (g - best.g)*(g - best.g) + (b - best.b)*(b - best.b));
              const attenuation = Math.max(0, Math.min(1, 1.3 - rgbDist / 70));
              const errR = (r - best.r) * ditherStrength * attenuation;
              const errG = (g - best.g) * ditherStrength * attenuation;
              const errB = (b - best.b) * ditherStrength * attenuation;
              
              const distribute = (dx, dy, weight) => {
                if(x+dx >= 0 && x+dx < w && y+dy < h) {
                  const nidx = ((y+dy)*w + (x+dx)) * 3;
                  const neighborIsFg = isFgArray[(y+dy)*w + (x+dx)] === 1;
                  // Restrict dither leaking across foreground/background boundary
                  const factor = (neighborIsFg === isFg) ? 1.0 : 0.2;
                  rgbData[nidx] += errR * weight * factor;
                  rgbData[nidx+1] += errG * weight * factor;
                  rgbData[nidx+2] += errB * weight * factor;
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
    `;
    
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    
    worker.postMessage({
      data: data,
      w: w,
      h: h,
      maxColors: maxColors,
      ditherStrength: ditherStrength,
      dmcColors: DMC_COLORS,
      lockedCodes: Array.from(this.editor.lockedColors || []),
      optimizeBg: optimizeBg,
      foregroundSeeds: seeds
    });
    
    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        document.getElementById('convert-progress-text').innerText = `${msg.text} (${msg.percent}%)`;
      } else if (msg.type === 'done') {
        // Optimize mapping: Use a Map for O(1) lookups instead of .find() O(M)
        const dmcMap = new Map(DMC_COLORS.map(c => [c.code, c]));
        const resultObjs = msg.result.map(code => code ? dmcMap.get(code) : null);
        
        // Safety: for large patterns, reduce cell size and resolution to prevent GPU/Memory freeze
        if (msg.w > 400 || msg.h > 400) {
          this.editor.cell = Math.max(4, Math.floor(1600 / Math.max(msg.w, msg.h)));
          this.editor.resolution = 1; // Lower resolution for huge patterns
        } else {
          this.editor.cell = 15;
          this.editor.resolution = 2;
        }

        this.editor.resize(msg.w, msg.h);
        this.editor.data = resultObjs;
        
        // Delay slightly to let browser UI catch up before heavy rendering
        setTimeout(() => {
          this.editor.render();
          this.editor.updateStats();
          
          document.getElementById('convert-loading').style.display = 'none';
          document.getElementById('modal-new').classList.remove('active');
          
          this.zoomToFit();
          this.toast('Фото конвертовано!', 'success');
        }, 100);
        
        worker.terminate();
      }
    };
    
    worker.onerror = (err) => {
      console.error('Worker Error:', err);
      this.toast('Помилка конвертації. Див. консоль.', 'error');
      document.getElementById('convert-loading').style.display = 'none';
      worker.terminate();
    };
  }

  findClosestDMC(rgb){
    const cacheKey = `${rgb.r},${rgb.g},${rgb.b}`;
    if (!this.colorCache) this.colorCache = new Map();
    if (this.colorCache.has(cacheKey)) return this.colorCache.get(cacheKey);

    const lab1 = rgbToLab(rgb.r, rgb.g, rgb.b);
    let min = Infinity, best = DMC_COLORS[0];
    for(const c of DMC_COLORS){
      if(!c.lab) c.lab = rgbToLab(c.r, c.g, c.b);
      const d = deltaE2000(lab1, c.lab);
      if(d < min){ min = d; best = c; }
    }
    
    this.colorCache.set(cacheKey, best);
    return best;
  }

  updateExportPreview(){
    const type = this._exportType || 'stitches';
    let canvas;
    if(type === 'stitches'){
      canvas = this.editor.generateStitches();
    } else if(type === 'scheme'){
      canvas = this.editor.generateScheme();
    } else if(type.startsWith('mockup-')){
      const frame = type.replace('mockup-', '');
      canvas = this.editor.generateMockup(frame);
    }
    this._exportCanvas = canvas;
    
    // Show in preview
    const previewEl = document.getElementById('export-preview-canvas');
    if(canvas && previewEl){
      previewEl.width = canvas.width;
      previewEl.height = canvas.height;
      previewEl.style.width = Math.min(canvas.width / 2, 640) + 'px';
      const ctx = previewEl.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(canvas, 0, 0);
    }

    const img = document.getElementById('export-preview-img');
    if(canvas && img) {
      img.src = canvas.toDataURL('image/png');
    }
  }

  // --- Keys ---
  initKeys(){
    document.addEventListener('keydown',e=>{
      if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
      if(e.ctrlKey&&e.key==='z'){e.preventDefault();this.editor.undo();}
      else if(e.ctrlKey&&e.key==='y'){e.preventDefault();this.editor.redo();}
      else if(e.ctrlKey&&e.key==='s'){e.preventDefault();this.saveToIDB();}
      else if(e.ctrlKey&&e.key==='n'){e.preventDefault();document.getElementById('modal-new').classList.add('active');}
      else if(e.key.toLowerCase()==='p')this.setToolByKey('pencil');
      else if(e.key.toLowerCase()==='e')this.setToolByKey('eraser');
      else if(e.key.toLowerCase()==='f')this.setToolByKey('fill');
      else if(e.key.toLowerCase()==='i')this.setToolByKey('picker');
      else if(e.key.toLowerCase()==='h' || e.code === 'Space'){ e.preventDefault(); this.setToolByKey('pan'); }
      else if(e.key.toLowerCase()==='l')this.setToolByKey('line');
      else if(e.key.toLowerCase()==='r')this.setToolByKey('rect');
      else if(e.key.toLowerCase()==='c')this.setToolByKey('anticonfetti');
      else if(e.key.toLowerCase()==='m')this.setToolByKey('magic_eraser');
      else if(e.key.toLowerCase()==='g')this.setToolByKey('global_replace');
      else if(e.key.toLowerCase()==='b')this.setToolByKey('backstitch');
      else if(e.key.toLowerCase()==='x')this.swapColors();
    });
  }
  setToolByKey(t){
    this.setTool(t);
  }
  setTool(t){
    if (t === 'ai_enhance') {
      const mode = prompt(
        "Оберіть AI-покращення:\n1. Прибрати поодинокі хрестики (Конфеті)\n2. Згладжування шуму (Середнє)\n3. Агресивне згладжування\n4. Авто-додавання контурів бекстітчем (Outline)", 
        "2"
      );
      if (mode === "1") {
        this.editor.smartSmooth('light');
        this.toast("Легке згладжування виконано", "success");
      } else if (mode === "2") {
        this.editor.smartSmooth('medium');
        this.toast("Середнє згладжування виконано", "success");
      } else if (mode === "3") {
        this.editor.smartSmooth('aggressive');
        this.toast("Агресивне згладжування виконано", "success");
      } else if (mode === "4") {
        this.editor.enhanceContours();
        this.toast("Контури створено бекстітчем!", "success");
      }
      return;
    }

    if(this.tool === 'anticonfetti' && t !== 'anticonfetti'){
      if(this.editor.brushHighlights.size > 0){
        this.editor.brushHighlights.clear();
        this.editor.render();
      }
    }
    this.tool = t;
    document.querySelectorAll('.tool-btn').forEach(b=>{
      const isActive = b.dataset.tool === t;
      b.classList.toggle('active', isActive);
      if(isActive) {
        document.getElementById('status-tool').textContent=b.title.split('(')[0].trim();
        const toolNameSpan = document.getElementById('prop-tool-name');
        if (toolNameSpan) toolNameSpan.textContent = b.querySelector('span').textContent;
      }
    });

    // Update Properties Panel
    document.querySelectorAll('.prop-group').forEach(g => g.classList.remove('active'));
    if (['pencil', 'eraser', 'line', 'rect'].includes(t)) {
      document.getElementById('prop-group-brush')?.classList.add('active');
    } else if (t === 'fill') {
      document.getElementById('prop-group-fill')?.classList.add('active');
    } else if (t === 'magic_eraser') {
      document.getElementById('prop-group-fill')?.classList.add('active');
      document.getElementById('prop-group-replace')?.classList.add('active');
      const hint = document.getElementById('replace-hint');
      if(hint) hint.textContent = this.replaceMode === 'local' ? 'Видаляє тільки суміжні хрестики.' : 'Видаляє цей колір на всьому полотні.';
    } else if (t === 'global_replace') {
      document.getElementById('prop-group-replace')?.classList.add('active');
      const hint = document.getElementById('replace-hint');
      if(hint) hint.textContent = this.replaceMode === 'local' ? 'Замінює тільки суміжні хрестики.' : 'Замінює колір на всьому полотні.';
    } else {
      document.getElementById('prop-group-empty')?.classList.add('active');
    }
  }
  // --- Storage ---
  async initStorage(){
    try{
      const req=indexedDB.open('NanaStitchDB',1);
      req.onupgradeneeded=e=>e.target.result.createObjectStore('projects',{keyPath:'id',autoIncrement:true});
      this.db=await new Promise((res,rej)=>{req.onsuccess=e=>res(e.target.result);req.onerror=e=>rej(e);});
      this.loadRecent();
    }catch(e){console.warn('IndexedDB not available');}
  }
  async saveToIDB(){
    if(!this.db)return;
    const name=document.getElementById('project-name').value||'Без назви';
    const proj={name,data:this.editor.toJSON(),ts:Date.now()};
    const tx=this.db.transaction('projects','readwrite');
    tx.objectStore('projects').add(proj);
    await new Promise(r=>tx.oncomplete=r);
    this.toast('Збережено!','success');this.loadRecent();
  }
  async loadRecent(){
    if(!this.db)return;
    const tx=this.db.transaction('projects','readonly');
    const all=await new Promise(r=>{const req=tx.objectStore('projects').getAll();req.onsuccess=()=>r(req.result);});
    const list=document.getElementById('recent-list');list.innerHTML='';
    all.slice(-5).reverse().forEach(p=>{
      const el=document.createElement('div');el.className='recent-item';
      el.innerHTML=`<div><div class="name">${p.name}</div><div class="date">${new Date(p.ts).toLocaleString()}</div></div><div class="actions"><button title="Видалити" data-id="${p.id}">✕</button></div>`;
      el.querySelector('.name').onclick=()=>{
        this.editor.fromJSON(p.data);
        document.getElementById('project-name').value=p.name;
        document.getElementById('grid-width').value=p.data.w;document.getElementById('grid-height').value=p.data.h;
        this.editor.updateStats();this.toast('Проект завантажено','info');
      };
      el.querySelector('button').onclick=async(ev)=>{
        ev.stopPropagation();
        const dtx=this.db.transaction('projects','readwrite');dtx.objectStore('projects').delete(p.id);
        await new Promise(r=>dtx.oncomplete=r);this.loadRecent();
      };
      list.appendChild(el);
    });
  }
  async downloadFile(){
    const name=document.getElementById('project-name').value||'pattern';
    const fileName = name + '.xstitch';
    const jsonStr = JSON.stringify(this.editor.toJSON());
    const blob = new Blob([jsonStr], {type:'application/json'});
    
    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'NanaStitch Project',
            accept: {'application/json': ['.xstitch', '.json']}
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        this.toast('Файл збережено!', 'success');
        return;
      }
    } catch(err) {
      if (err.name === 'AbortError') return;
      console.warn('showSaveFilePicker failed:', err);
    }
    
    // Fallback: blob download
    const a=document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
    this.toast('Файл завантажено','success');
  }
  openFile(file){
    const r=new FileReader();
    r.onload=e=>{
      try{const j=JSON.parse(e.target.result);this.editor.fromJSON(j);
        document.getElementById('grid-width').value=j.w;document.getElementById('grid-height').value=j.h;
        this.editor.updateStats();
        setTimeout(()=>this.zoomToFit(), 50);
        this.toast('Проект відкрито','success');
      }catch(err){this.toast('Помилка відкриття файлу','error');}
    };r.readAsText(file);
  }
  // --- PDF ---
  generatePDF(){
    try{
      this.editor.assignSymbols(); // Ensure symbols are up-to-date
      const{jsPDF}=window.jspdf;
      const fmt=document.getElementById('pdf-format').value;
      const orient=document.getElementById('pdf-orient').value;
      const doc=new jsPDF({orientation:orient,unit:'mm',format:fmt});
      
      let customFont = false;
      if(window.ASSETS && ASSETS.font) {
        // Embed Arial to support Cyrillic characters
        doc.addFileToVFS('Arial.ttf', ASSETS.font);
        doc.addFont('Arial.ttf', 'Arial', 'normal');
        customFont = true;
      }

      const title=document.getElementById('pdf-title').value||'NanaStitch Pattern';
      const author=document.getElementById('pdf-author').value||'';
      const notes=document.getElementById('pdf-notes').value||'';
      const cellMM=parseFloat(document.getElementById('pdf-cell-size').value);
      const showColors=document.getElementById('pdf-show-colors').checked;
      const showSymbols=document.getElementById('pdf-show-symbols').checked;
      const showGrid=document.getElementById('pdf-show-grid').checked;
      const showKey=document.getElementById('pdf-show-key').checked;
      const showInfo=document.getElementById('pdf-show-info').checked;
      const pageNum=document.getElementById('pdf-page-numbers').checked;
      const pw=doc.internal.pageSize.getWidth(), ph=doc.internal.pageSize.getHeight();
      const margin=12;
      // Title page
      // Banner header
      let bannerH = 0;
      if(window.ASSETS && ASSETS.banner){
        // Banner image: full width at top
        const bannerW = pw;
        bannerH = bannerW * (260 / 1024); // aspect ratio of the banner
        doc.addImage(ASSETS.banner, 'JPEG', 0, 0, bannerW, bannerH);
      }
      
      // Reset for content below banner
      doc.setTextColor(0, 0, 0);
      doc.setFont(customFont ? 'Arial' : 'helvetica', 'normal');
      
      // Pattern mockup image
      let mockupBottom = bannerH + 5;
      try {
        const stitchCanvas = this.editor.generateStitches();
        const maxW = pw - margin * 2;
        const maxH = ph * 0.35; // max 35% of page height
        const scale = Math.min(maxW / stitchCanvas.width, maxH / stitchCanvas.height);
        const imgW = stitchCanvas.width * scale;
        const imgH = stitchCanvas.height * scale;
        const imgX = (pw - imgW) / 2;
        const imgY = mockupBottom + 3;
        
        // Image
        const imgData = stitchCanvas.toDataURL('image/jpeg', 0.92);
        doc.addImage(imgData, 'JPEG', imgX, imgY, imgW, imgH);
        
        // Thin border
        doc.setDrawColor(180);
        doc.setLineWidth(0.3);
        doc.roundedRect(imgX, imgY, imgW, imgH, 2, 2);
        
        mockupBottom = imgY + imgH + 8;
      } catch(e) { console.warn('Mockup in PDF skipped:', e); }
      
      const contentY = mockupBottom + 5;
      doc.setFontSize(24); doc.setFont(customFont ? 'Arial' : 'helvetica', 'bold');
      doc.text(title,pw/2,contentY,{align:'center'});
      
      if(author){
        doc.setFontSize(14); doc.setFont(customFont ? 'Arial' : 'helvetica', 'normal');
        doc.text(`Author: ${author}`,pw/2,contentY+12,{align:'center'});
      }
      if(notes){
        doc.setFontSize(11); doc.setFont(customFont ? 'Arial' : 'helvetica', 'italic');
        doc.text(notes,pw/2,contentY+22,{align:'center'});
      }
      
      if(showInfo){
        const used=this.editor.getUsedColors();
        doc.setFontSize(12); doc.setFont(customFont ? 'Arial' : 'helvetica', 'bold');
        const infoY = contentY + 38;
        doc.text(`Pattern Size: ${this.editor.w} \u00d7 ${this.editor.h} stitches`,pw/2,infoY,{align:'center'});
        doc.text(`Colors: ${used.length}`,pw/2,infoY+8,{align:'center'});
        
        // Fabric size table
        const fabrics = [11, 14, 16, 18, 22, 25];
        let tableY = infoY + 22;
        doc.setFontSize(10);
        doc.setFont(customFont ? 'Arial' : 'helvetica', 'bold');
        // Table Width calculation for centering
        const col1 = 30, col2 = 40, col3 = 40;
        const totalW = col1 + col2 + col3;
        const startX = (pw - totalW) / 2;
        
        doc.setTextColor(100);
        doc.text('Fabric', startX, tableY);
        doc.text('Size (cm)', startX + col1, tableY);
        doc.text('Size (inches)', startX + col1 + col2, tableY);
        tableY += 1.5;
        doc.setDrawColor(180); doc.setLineWidth(0.2);
        doc.line(startX, tableY, startX + totalW, tableY);
        tableY += 5.5;
        doc.setTextColor(0);
        doc.setFont(customFont ? 'Arial' : 'helvetica', 'normal');
        fabrics.forEach(fc => {
          const wCm = (this.editor.w / fc * 2.54).toFixed(1);
          const hCm = (this.editor.h / fc * 2.54).toFixed(1);
          const wIn = (this.editor.w / fc).toFixed(1);
          const hIn = (this.editor.h / fc).toFixed(1);
          doc.text(`Aida ${fc} ct`, startX, tableY);
          doc.text(`${wCm} \u00d7 ${hCm}`, startX + col1, tableY);
          doc.text(`${wIn} \u00d7 ${hIn}`, startX + col1 + col2, tableY);
          tableY += 5;
        });
      }
      // Chart pages (50x70 per A4 page as requested)
      const cW = (pw - margin * 2) / 50;
      const cH = (ph - margin * 2 - 15) / 70;
      const cellSize = Math.min(cW, cH);
      const colsPerPage = 50;
      const rowsPerPage = 70;

      for(let startY=0; startY<this.editor.h; startY+=rowsPerPage){
        for(let startX=0; startX<this.editor.w; startX+=colsPerPage){
          doc.addPage();
          const endX = Math.min(startX + colsPerPage, this.editor.w);
          const endY = Math.min(startY + rowsPerPage, this.editor.h);
          
          // Header info
          doc.setFontSize(9); doc.setTextColor(100);
          doc.text(`${title} | Page ${doc.internal.getNumberOfPages()}`, margin, margin - 4);
          doc.text(`Grid: ${startX+1}-${endX} / ${startY+1}-${endY}`, pw - margin, margin - 4, {align: 'right'});

          for(let y=startY; y<endY; y++){
            for(let x=startX; x<endX; x++){
              const c = this.editor.data[y*this.editor.w+x];
              const px = margin + (x-startX)*cellSize;
              const py = margin + (y-startY)*cellSize + 8;
              
              if(showGrid){
                doc.setDrawColor(200); doc.setLineWidth(0.1);
                doc.rect(px, py, cellSize, cellSize);
              }
              if(c){
                if(showColors){
                  doc.setFillColor(c.r, c.g, c.b);
                  doc.rect(px, py, cellSize, cellSize, 'F');
                }
                if(showSymbols){
                  const sym = this.editor.symbolMap[c.code];
                  if(sym){
                    const isL = this.editor.isLight(c);
                    doc.setTextColor(showColors ? (isL?0:255) : 0);
                    doc.setFontSize(cellSize * 2.8);
                    doc.text(sym, px + cellSize/2, py + cellSize/2 + 0.3, {align:'center', baseline:'middle'});
                  }
                }
              }
            }
          }
          // bold lines every 10
          doc.setDrawColor(0); doc.setLineWidth(0.3);
          for(let x=startX; x<=endX; x++){ if((x)%10===0){ const lx=margin+(x-startX)*cellSize; doc.line(lx,margin+8,lx,margin+8+(endY-startY)*cellSize); } }
          for(let y=startY; y<=endY; y++){ if((y)%10===0){ const ly=margin+(y-startY)*cellSize+8; doc.line(margin,ly,margin+(endX-startX)*cellSize,ly); } }
          
          if(pageNum){
            doc.setFontSize(8); doc.setTextColor(150);
            doc.text(`NanaStitch Designer | Page ${doc.internal.getNumberOfPages()}`, margin, ph - 5);
          }
        }
      }

      // Palette Key Page
      if(showKey){
        doc.addPage();
        doc.setFontSize(18); doc.setFont(customFont ? 'Arial' : 'helvetica', 'bold');
        doc.setTextColor(0); doc.text('Thread Palette Key', margin, 22);
        
        const usedColors = this.editor.getUsedColors();
        const totalStitches = usedColors.reduce((a, b) => a + b.count, 0);
        
        doc.setFontSize(11); doc.setFont(customFont ? 'Arial' : 'helvetica', 'normal');
        doc.setTextColor(80);
        doc.text(`Total Colors: ${usedColors.length}`, margin, 32);
        doc.text(`Total Stitches: ${totalStitches.toLocaleString()} crosses`, margin, 38);
        
        let ky = 50;
        doc.setFontSize(9); doc.setFont(customFont ? 'Arial' : 'helvetica', 'bold');
        doc.setTextColor(120);
        doc.text('KEY', margin, ky);
        doc.text('DMC', margin + 28, ky);
        doc.text('Color Name', margin + 48, ky);
        doc.text('Stitches', margin + 145, ky, {align: 'right'});
        
        doc.setDrawColor(220); doc.setLineWidth(0.3);
        doc.line(margin, ky + 2, pw - margin, ky + 2);
        
        ky += 10;
        doc.setFont(customFont ? 'Arial' : 'helvetica', 'normal');
        doc.setTextColor(0);
        
        usedColors.forEach(u => {
          if (ky > ph - 25) { doc.addPage(); ky = 25; }
          
          const sSize = 7;
          const sX = margin;
          const sY = ky - 5;
          
          // Color Swatch
          doc.setFillColor(u.color.r, u.color.g, u.color.b);
          doc.rect(sX, sY, sSize, sSize, 'F');
          doc.setDrawColor(0); doc.setLineWidth(0.1);
          doc.rect(sX, sY, sSize, sSize, 'S');
          
          // Symbol in swatch
          const sym = this.editor.symbolMap[u.color.code] || '•';
          const isL = this.editor.isLight(u.color);
          doc.setTextColor(isL ? 0 : 255);
          doc.setFontSize(11);
          doc.text(sym, sX + sSize/2, sY + sSize/2 + 0.3, { align: 'center', baseline: 'middle' });
          
          // Symbol on white
          doc.setTextColor(0);
          doc.setFontSize(11);
          doc.text(sym, margin + 12, ky);
          
          // Data
          doc.setFontSize(10);
          doc.text(u.color.code, margin + 28, ky);
          doc.text(u.color.name, margin + 48, ky);
          doc.text(u.count.toLocaleString(), margin + 145, ky, {align: 'right'});
          
          ky += 9;
        });
      }
      return doc;
    }catch(e){console.error(e); return null;}
  }



  updatePDFPreview(){
    const loading = document.getElementById('pdf-loading');
    const canvas = document.getElementById('pdf-preview-canvas');
    if(!loading || !canvas) return;
    
    loading.style.display = 'flex';
    setTimeout(() => {
      const doc = this.generatePDF();
      if(doc){
        this._pdfDoc = doc;
        this._pdfPage = 1;
        this._pdfTotalPages = doc.internal.getNumberOfPages();
        this.renderPDFPage();
      }
      loading.style.display = 'none';
    }, 50);
  }

  renderPDFPage(){
    if(!this._pdfDoc) return;
    const doc = this._pdfDoc;
    const page = this._pdfPage || 1;
    const total = this._pdfTotalPages || 1;

    // Update page info
    const info = document.getElementById('pdf-page-info');
    if(info) info.textContent = `${page} / ${total}`;

    // Generate a single-page PDF for preview
    const {jsPDF} = window.jspdf;
    const fmt = document.getElementById('pdf-format').value;
    const orient = document.getElementById('pdf-orient').value;

    // Use the full doc output and render via an img
    const arrayBuf = doc.output('arraybuffer');
    
    // Render using a temporary single-page approach
    const canvas = document.getElementById('pdf-preview-canvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');

    // Get page dimensions in points
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    
    // Scale for good quality preview
    const scale = 2;
    const cw = pw * scale * 2.83; // mm to px approx
    const ch = ph * scale * 2.83;
    canvas.width = cw;
    canvas.height = ch;
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    ctx.scale(scale * 2.83, scale * 2.83);

    // Re-render just this page's content
    const margin = 12;
    
    if(page === 1) {
      // Title page — draw banner
      let bannerH = 0;
      if(window.ASSETS && ASSETS.banner) {
        if(!this._bannerImg) {
          this._bannerImg = new Image();
          this._bannerImg.src = ASSETS.banner;
          this._bannerImg.onload = () => this.renderPDFPage();
          return; // wait for image to load
        }
        if(this._bannerImg.complete && this._bannerImg.naturalWidth > 0) {
          bannerH = pw * (260 / 1024);
          ctx.drawImage(this._bannerImg, 0, 0, pw, bannerH);
        }
      }
      
      // Pattern mockup
      let mockupBottom = bannerH + 5;
      try {
        const stitchCanvas = this.editor.generateStitches();
        const maxW = pw - margin * 2;
        const maxH = ph * 0.35;
        const sc = Math.min(maxW / stitchCanvas.width, maxH / stitchCanvas.height);
        const imgW = stitchCanvas.width * sc;
        const imgH = stitchCanvas.height * sc;
        const imgX = (pw - imgW) / 2;
        const imgY = mockupBottom + 3;
        
        // Image
        ctx.drawImage(stitchCanvas, imgX, imgY, imgW, imgH);
        
        // Border
        ctx.strokeStyle = '#b4b4b4';
        ctx.lineWidth = 0.3;
        ctx.strokeRect(imgX, imgY, imgW, imgH);
        
        mockupBottom = imgY + imgH + 8;
      } catch(e) {}
      
      const contentY = mockupBottom + 5;
      ctx.fillStyle = '#000';
      const title = document.getElementById('pdf-title').value || 'NanaStitch Pattern';
      ctx.font = 'bold 24px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, pw/2, contentY);
      
      const author = document.getElementById('pdf-author').value || '';
      if(author){
        ctx.font = '14px Arial, sans-serif';
        ctx.fillText(`Author: ${author}`, pw/2, contentY + 12);
      }
      
      const notes = document.getElementById('pdf-notes').value || '';
      if(notes){
        ctx.font = 'italic 11px Arial, sans-serif';
        ctx.fillText(notes, pw/2, contentY + 22);
      }
      
      const showInfo = document.getElementById('pdf-show-info').checked;
      if(showInfo){
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.textAlign = 'center';
        const infoY = contentY + 38;
        ctx.fillText(`Pattern Size: ${this.editor.w} \u00d7 ${this.editor.h} stitches`, pw/2, infoY);
        const used = this.editor.getUsedColors();
        ctx.fillText(`Colors: ${used.length}`, pw/2, infoY + 8);
        
        // Fabric size table
        const fabrics = [11, 14, 16, 18, 22, 25];
        let tableY = infoY + 22;
        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.fillStyle = '#646464';
        
        const col1 = 30, col2 = 40, col3 = 40;
        const totalW = col1 + col2 + col3;
        const startX = (pw - totalW) / 2;
        
        ctx.textAlign = 'left';
        ctx.fillText('Fabric', startX, tableY);
        ctx.fillText('Size (cm)', startX + col1, tableY);
        ctx.fillText('Size (inches)', startX + col1 + col2, tableY);
        tableY += 1.5;
        ctx.strokeStyle = '#b4b4b4'; ctx.lineWidth = 0.15;
        ctx.beginPath(); ctx.moveTo(startX, tableY); ctx.lineTo(startX + totalW, tableY); ctx.stroke();
        tableY += 5.5;
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial, sans-serif';
        fabrics.forEach(fc => {
          const wCm = (this.editor.w / fc * 2.54).toFixed(1);
          const hCm = (this.editor.h / fc * 2.54).toFixed(1);
          const wIn = (this.editor.w / fc).toFixed(1);
          const hIn = (this.editor.h / fc).toFixed(1);
          ctx.fillText(`Aida ${fc} ct`, startX, tableY);
          ctx.fillText(`${wCm} \u00d7 ${hCm}`, startX + col1, tableY);
          ctx.fillText(`${wIn} \u00d7 ${hIn}`, startX + col1 + col2, tableY);
          tableY += 5;
        });
      }
    } else {
      // Chart page or Key page — show placeholder info
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Page ${page} — Chart Section`, pw/2, ph/2 - 10);
      ctx.font = '10px Arial, sans-serif';
      ctx.fillText('(Download to see full details)', pw/2, ph/2 + 10);
    }
    
    ctx.restore();
  }
  // --- Toast ---
  toast(msg,type='info'){
    const c=document.getElementById('toast-container');
    const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=msg;
    c.appendChild(el);
    setTimeout(()=>{el.style.animation='toast-out 0.3s forwards';setTimeout(()=>el.remove(),300);},2500);
  }

  initResizers() {
    const initResize = (id, targetId, side) => {
      const resizer = document.getElementById(id);
      const target = document.getElementById(targetId);
      let startX, startWidth;

      resizer.onmousedown = (e) => {
        startX = e.clientX;
        startWidth = target.offsetWidth;
        resizer.classList.add('active');
        document.body.style.cursor = 'col-resize';
        document.onmousemove = (e) => {
          let width;
          if (side === 'left') width = startWidth + (e.clientX - startX);
          else width = startWidth - (e.clientX - startX);
          
          if (width > 200 && width < 500) {
            target.style.width = width + 'px';
          }
        };
        document.onmouseup = () => {
          resizer.classList.remove('active');
          document.body.style.cursor = '';
          document.onmousemove = null;
          document.onmouseup = null;
        };
      };
    };
    initResize('resizer-left', 'sidebar-left', 'left');
    initResize('resizer-right', 'sidebar-right', 'right');
  }

  removeConfetti() {
    const threshold = parseInt(document.getElementById('confetti-threshold').value) || 1;
    const distance = parseInt(document.getElementById('confetti-distance')?.value) || 3;
    this.editor.removeConfetti(threshold, distance);
    this.toast(`Одинокі хрестики видалено`, 'success');
  }

  removeRareColors() {
    const min = parseInt(document.getElementById('min-stitches-limit').value) || 5;
    this.editor.removeRareColors(min);
    this.toast(`Рідкісні кольори (менше ${min}) замінено`, 'success');
  }

  initAIEvents() {
    // 1. Settings button in header
    const btnAiSettings = document.getElementById('btn-ai-settings');
    if (btnAiSettings) {
      btnAiSettings.onclick = () => window.aiEngine.showSettings();
    }

    // Link in setup
    const linkAiSetup = document.getElementById('link-ai-setup');
    if (linkAiSetup) {
      linkAiSetup.onclick = (e) => {
        e.preventDefault();
        document.getElementById('modal-new')?.classList.remove('active');
        window.aiEngine.showSettings();
      };
    }

    // 2. Settings modal fields and buttons
    const apiKeyField = document.getElementById('ai-api-key');
    if (apiKeyField && window.aiEngine.apiKey) {
      apiKeyField.value = window.aiEngine.apiKey;
    }

    const btnAiSave = document.getElementById('btn-ai-save');
    if (btnAiSave) {
      btnAiSave.onclick = () => {
        const key = apiKeyField ? apiKeyField.value.trim() : '';
        window.aiEngine.saveSettings(key, 'gemini');
        window.aiEngine.hideSettings();
        this.toast('Налаштування AI збережено!', 'success');
      };
    }

    const btnAiTest = document.getElementById('btn-ai-test');
    if (btnAiTest) {
      btnAiTest.onclick = async () => {
        const key = apiKeyField ? apiKeyField.value.trim() : '';
        if (!key) return this.toast('Будь ласка, спочатку введіть API-ключ', 'warning');
        
        btnAiTest.disabled = true;
        btnAiTest.textContent = '🔌 Тестування...';
        
        // Temporarily set key for test
        const originalKey = window.aiEngine.apiKey;
        window.aiEngine.apiKey = key;
        
        try {
          await window.aiEngine.testConnection();
          this.toast("З'єднання встановлено успішно!", "success");
        } catch (err) {
          this.toast("Помилка з'єднання: " + err.message, "danger");
        } finally {
          window.aiEngine.apiKey = originalKey; // revert if not saved yet
          btnAiTest.disabled = false;
          btnAiTest.textContent = '🔌 Тест з\'єднання';
        }
      };
    }

    // Style buttons in style grid
    document.querySelectorAll('.ai-style-grid button').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        document.querySelectorAll('.ai-style-grid button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });

    // 3. AI text generation button
    const btnAiGenerate = document.getElementById('btn-ai-generate');
    if (btnAiGenerate) {
      btnAiGenerate.onclick = async () => {
        if (!window.aiEngine.isConfigured()) {
          this.toast('Будь ласка, налаштуйте API ключ для AI', 'warning');
          window.aiEngine.showSettings();
          return;
        }

        const promptVal = document.getElementById('ai-prompt').value.trim();
        if (!promptVal) {
          return this.toast('Опишіть, що ви хочете згенерувати', 'warning');
        }

        const activeStyleBtn = document.querySelector('.ai-style-grid button.active');
        const style = activeStyleBtn ? activeStyleBtn.dataset.style : 'realistic';
        const width = parseInt(document.getElementById('ai-gen-width').value) || 100;
        const maxColors = parseInt(document.getElementById('ai-gen-colors').value) || 25;

        // UI Loading state
        const loadingOverlay = document.getElementById('ai-gen-loading');
        const resultsGrid = document.getElementById('ai-gen-results');
        
        if (loadingOverlay) loadingOverlay.style.display = 'flex';
        if (resultsGrid) resultsGrid.style.display = 'none';
        btnAiGenerate.disabled = true;
        btnAiGenerate.classList.add('ai-generating');

        try {
          const result = await window.aiEngine.generatePatternFromText(promptVal, style, width, maxColors);
          
          if (loadingOverlay) loadingOverlay.style.display = 'none';
          if (resultsGrid) {
            resultsGrid.innerHTML = '';
            resultsGrid.style.display = 'grid';

            const resultItem = document.createElement('div');
            resultItem.className = 'ai-result-item';

            const img = document.createElement('img');
            img.src = URL.createObjectURL(result.imageBlob);

            const useBtn = document.createElement('button');
            useBtn.className = 'use-btn';
            useBtn.textContent = 'Використати';

            resultItem.appendChild(img);
            resultItem.appendChild(useBtn);
            resultsGrid.appendChild(resultItem);

            const selectImage = () => {
              this.imgEditor.load(result.imageBlob);
              document.getElementById('import-width').value = result.width;
              document.getElementById('import-colors').value = result.maxColors;
              
              // Switch project modal tab to tab-photo
              const tabPhotoBtn = document.querySelector('[data-tab="tab-photo"]');
              if (tabPhotoBtn) tabPhotoBtn.click();
            };

            useBtn.onclick = (e) => {
              e.stopPropagation();
              selectImage();
            };
            resultItem.onclick = selectImage;
          }
          this.toast('Зображення згенеровано успішно!', 'success');
        } catch (err) {
          this.toast('Помилка генерації: ' + err.message, 'danger');
          if (loadingOverlay) loadingOverlay.style.display = 'none';
        } finally {
          btnAiGenerate.disabled = false;
          btnAiGenerate.classList.remove('ai-generating');
        }
      };
    }

    // 4. AI Background Remover button
    const btnEditBgAi = document.getElementById('btn-edit-bg-ai');
    if (btnEditBgAi) {
      btnEditBgAi.onclick = async () => {
        const img = this.imgEditor.getImage();
        if (!img || !this.imgEditor.original) {
          return this.toast('Спочатку виберіть фото', 'warning');
        }

        btnEditBgAi.disabled = true;
        
        // Progress UI setup
        let progressEl = document.getElementById('ai-bg-progress');
        if (!progressEl) {
          progressEl = document.createElement('div');
          progressEl.id = 'ai-bg-progress';
          progressEl.style = 'position:absolute; bottom:10px; left:10px; right:10px; padding:12px; background:var(--bg-card); border:1px solid var(--border); border-radius:8px; z-index:100;';
          progressEl.innerHTML = `
              <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:4px; color:var(--text-primary);">
                  <span>AI видалення фону...</span>
                  <span class="progress-pct">0%</span>
              </div>
              <div class="ai-progress-bar"><div class="ai-progress-fill" style="width:0%"></div></div>
          `;
          const container = document.querySelector('.canvas-editor-container');
          if (container) {
            container.style.position = 'relative';
            container.appendChild(progressEl);
          }
        }
        progressEl.style.display = 'block';

        const onProgress = (evt) => {
          const pct = Math.round((evt.progress || 0) * 100);
          const fill = progressEl.querySelector('.ai-progress-fill');
          const txt = progressEl.querySelector('.progress-pct');
          if (fill) fill.style.width = pct + '%';
          if (txt) txt.textContent = pct + '%';
        };

        try {
          const noBgCanvas = await window.bgRemover.removeFromCanvas(this.imgEditor.canvas, onProgress);
          this.imgEditor.ctx.clearRect(0, 0, this.imgEditor.canvas.width, this.imgEditor.canvas.height);
          this.imgEditor.ctx.drawImage(noBgCanvas, 0, 0);
          this.imgEditor.saveCleanState();
          this.imgEditor.redrawCanvas();
          this.imgEditor.updateSeedButton();
          this.toast('Фон успішно видалено!', 'success');
        } catch (err) {
          this.toast('Не вдалося видалити фон: ' + err.message, 'danger');
        } finally {
          btnEditBgAi.disabled = false;
          progressEl.style.display = 'none';
        }
      };
    }

    // 5. AI Palette Optimization Button
    const btnAiOptimizePalette = document.getElementById('btn-ai-optimize-palette');
    if (btnAiOptimizePalette) {
      btnAiOptimizePalette.onclick = async () => {
        if (!window.aiEngine.isConfigured()) {
          this.toast('Будь ласка, налаштуйте AI API спочатку.', 'warning');
          window.aiEngine.showSettings();
          return;
        }

        const currentColors = this.editor.getUsedColors().map(u => ({
          code: u.color.code,
          hex: u.color.hex,
          name: u.color.name,
          count: u.count
        }));

        if (currentColors.length <= 2) {
          return this.toast('Занадто мало кольорів для оптимізації', 'warning');
        }

        const targetColors = parseInt(prompt("Введіть цільову кількість кольорів (наприклад, 15):", Math.max(2, Math.round(currentColors.length * 0.7))));
        if (isNaN(targetColors) || targetColors <= 1 || targetColors >= currentColors.length) {
          return;
        }

        btnAiOptimizePalette.disabled = true;
        const origText = btnAiOptimizePalette.innerHTML;
        btnAiOptimizePalette.innerHTML = '✨ Оптимізація AI...';

        try {
          let imageBlob;
          if (this.imgEditor.original) {
            imageBlob = await new Promise(resolve => this.imgEditor.canvas.toBlob(resolve, 'image/png'));
          } else {
            const tempCanvas = this.editor.generateStitches();
            imageBlob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png'));
          }

          const keepCodes = await window.aiEngine.suggestPaletteReduction(imageBlob, currentColors, targetColors);
          
          // Separate kept and discarded colors
          const common = currentColors.filter(c => keepCodes.includes(c.code));
          if (common.length === 0) {
            throw new Error('AI не вибрав жодного коліру для збереження. Спробуйте ще раз.');
          }

          const rare = currentColors.filter(c => !keepCodes.includes(c.code));
          
          if (rare.length === 0) {
            this.toast('Всі поточні кольори вже є оптимальними!', 'info');
            return;
          }

          // Build confirmation list and mapping
          let confirmMsg = `AI рекомендує залишити ${common.length} кольорів. Наступні кольори буде замінено на найбільш відповідні:\n\n`;
          const mapping = [];

          rare.forEach(r => {
            let bestDist = Infinity, bestColor = common[0];
            const rColorFull = DMC_COLORS.find(c => c.code === r.code);
            const rLabReal = rgbToLab(rColorFull.r, rColorFull.g, rColorFull.b);

            common.forEach(c => {
              const cColorFull = DMC_COLORS.find(x => x.code === c.code);
              const cLab = rgbToLab(cColorFull.r, cColorFull.g, cColorFull.b);
              const dist = deltaE2000(rLabReal, cLab);
              if (dist < bestDist) {
                bestDist = dist;
                bestColor = cColorFull;
              }
            });
            mapping.push({ old: rColorFull, new: bestColor });
            confirmMsg += `DMC ${r.code} → DMC ${bestColor.code}\n`;
          });

          if (confirm(confirmMsg + "\nПродовжити об'єднання?")) {
            this.editor.saveHistory();
            mapping.forEach(m => {
              this.editor.replaceColor(m.old, m.new);
            });
            this.renderProjectPalette();
            this.toast('Палітра оптимізована AI!', 'success');
          }
        } catch (err) {
          this.toast('Помилка оптимізації: ' + err.message, 'danger');
        } finally {
          btnAiOptimizePalette.disabled = false;
          btnAiOptimizePalette.innerHTML = origText;
        }
      };
    }

    // Call updateUI to set initial states
    window.aiEngine.updateUI();
  }
}
window.onload=()=>{app=new App();};

class ImageEditor {
  constructor() {
    this.canvas = document.getElementById('edit-canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.original = null;
    this.mode = null;
    this.isDrawing = false;
    this.start = { x: 0, y: 0 };
    this.cropRect = null;
    this.overlay = document.getElementById('crop-overlay');
    this.foregroundSeeds = [];
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    this.initEvents();
  }
  saveCleanState() {
    this.offscreenCanvas.width = this.canvas.width;
    this.offscreenCanvas.height = this.canvas.height;
    this.offscreenCtx.drawImage(this.canvas, 0, 0);
  }
  addForegroundSeed(x, y, color) {
    this.foregroundSeeds.push({ x, y, color });
    this.redrawCanvas();
    this.updateSeedButton();
  }
  clearSeeds() {
    this.foregroundSeeds = [];
    this.redrawCanvas();
    this.updateSeedButton();
  }
  updateSeedButton() {
    const btn = document.getElementById('btn-clear-seeds');
    if (btn) {
      const count = this.foregroundSeeds.length;
      btn.style.display = count > 0 ? 'inline-block' : 'none';
      btn.textContent = `Скинути точки (${count})`;
    }
  }
  redrawCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.offscreenCanvas, 0, 0);
    
    if (this.foregroundSeeds && document.getElementById('import-optimize-bg')?.checked) {
      this.foregroundSeeds.forEach((seed) => {
        // Outer white ring
        this.ctx.beginPath();
        this.ctx.arc(seed.x, seed.y, 8, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Inner black ring
        this.ctx.beginPath();
        this.ctx.arc(seed.x, seed.y, 6, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
        
        // Center dot
        this.ctx.beginPath();
        this.ctx.arc(seed.x, seed.y, 3, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgb(${seed.color.r},${seed.color.g},${seed.color.b})`;
        this.ctx.fill();
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      });
    }
  }
  load(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        this.original = img;
        this.reset();
        document.getElementById('drop-zone').style.display = 'none';
        document.getElementById('image-editor-area').style.display = 'block';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
  reset() {
    if (!this.original) return;
    this.canvas.width = this.original.width;
    this.canvas.height = this.original.height;
    this.ctx.drawImage(this.original, 0, 0);
    this.saveCleanState();
    this.foregroundSeeds = [];
    this.updateSeedButton();
    this.mode = null;
    this.cropRect = null;
    this.overlay.style.display = 'none';
    this.updateButtons();
  }
  toggleMode(m) {
    this.mode = this.mode === m ? null : m;
    this.updateButtons();
  }
  updateButtons() {
    document.querySelectorAll('.edit-tool').forEach(b => b.classList.remove('active'));
    if (this.mode === 'crop') document.getElementById('btn-edit-crop').classList.add('active');
    if (this.mode === 'bg') document.getElementById('btn-edit-bg').classList.add('active');
  }
  initEvents() {
    this.canvas.onmousedown = e => {
      if (document.getElementById('import-optimize-bg')?.checked) {
        const r = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - r.left) * (this.canvas.width / r.width));
        const y = Math.floor((e.clientY - r.top) * (this.canvas.height / r.height));
        const pxX = Math.max(0, Math.min(this.offscreenCanvas.width - 1, x));
        const pxY = Math.max(0, Math.min(this.offscreenCanvas.height - 1, y));
        const p = this.offscreenCtx.getImageData(pxX, pxY, 1, 1).data;
        const color = { r: p[0], g: p[1], b: p[2] };
        this.addForegroundSeed(x, y, color);
        return;
      }
      if (this.mode === 'crop') {
        const r = this.canvas.getBoundingClientRect();
        this.isDrawing = true;
        this.start = { x: (e.clientX - r.left) * (this.canvas.width / r.width), y: (e.clientY - r.top) * (this.canvas.height / r.height) };
      } else if (this.mode === 'bg') {
        const r = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - r.left) * (this.canvas.width / r.width));
        const y = Math.floor((e.clientY - r.top) * (this.canvas.height / r.height));
        this.removeColor(x, y);
      }
    };
    window.onmousemove = e => {
      if (this.isDrawing && this.mode === 'crop') {
        const r = this.canvas.getBoundingClientRect();
        const currX = (e.clientX - r.left) * (this.canvas.width / r.width);
        const currY = (e.clientY - r.top) * (this.canvas.height / r.height);
        
        const x = Math.min(this.start.x, currX);
        const y = Math.min(this.start.y, currY);
        const w = Math.abs(this.start.x - currX);
        const h = Math.abs(this.start.y - currY);
        
        this.cropRect = { x, y, w, h };
        this.updateOverlay();
      }
    };
    window.onmouseup = () => {
      if (this.isDrawing) {
        this.isDrawing = false;
        if (this.cropRect && this.cropRect.w > 5 && this.cropRect.h > 5) {
          this.applyCrop();
        }
      }
    };
    
    const updateFilter = () => {
      const b = document.getElementById('import-bright').value;
      const c = document.getElementById('import-contrast').value;
      const s = document.getElementById('import-sat').value;
      document.getElementById('val-bright').innerText = b + '%';
      document.getElementById('val-contrast').innerText = c + '%';
      document.getElementById('val-sat').innerText = s + '%';
      this.canvas.style.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
    };
    document.getElementById('import-bright').addEventListener('input', updateFilter);
    document.getElementById('import-contrast').addEventListener('input', updateFilter);
    document.getElementById('import-sat').addEventListener('input', updateFilter);
    
    document.getElementById('import-dither').addEventListener('input', e => {
      document.getElementById('val-dither').innerText = e.target.value + '%';
    });

    document.getElementById('import-optimize-bg')?.addEventListener('change', () => {
      this.redrawCanvas();
      this.updateSeedButton();
    });

    const btnClearSeeds = document.getElementById('btn-clear-seeds');
    if (btnClearSeeds) {
      btnClearSeeds.onclick = (e) => {
        e.stopPropagation();
        this.clearSeeds();
      };
    }
  }
  updateOverlay() {
    if (!this.cropRect) return;
    const r = this.canvas.getBoundingClientRect();
    const scale = r.width / this.canvas.width;
    this.overlay.style.display = 'block';
    this.overlay.style.left = (this.cropRect.x * scale) + 'px';
    this.overlay.style.top = (this.cropRect.y * scale) + 'px';
    this.overlay.style.width = (this.cropRect.w * scale) + 'px';
    this.overlay.style.height = (this.cropRect.h * scale) + 'px';
  }
  applyCrop() {
    const { x, y, w, h } = this.cropRect;
    const temp = this.ctx.getImageData(x, y, w, h);
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.putImageData(temp, 0, 0);
    this.saveCleanState();
    this.foregroundSeeds = [];
    this.updateSeedButton();
    this.cropRect = null;
    this.overlay.style.display = 'none';
    this.mode = null;
    this.updateButtons();
  }
  applyCircle() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
    
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-in';
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
    this.saveCleanState();
    this.foregroundSeeds = [];
    this.updateSeedButton();
  }
  removeColor(x, y) {
    const data = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const pixels = data.data;
    const idx = (y * this.canvas.width + x) * 4;
    const target = { r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2] };
    const tolerance = 30;

    for (let i = 0; i < pixels.length; i += 4) {
      const dr = Math.abs(pixels[i] - target.r);
      const dg = Math.abs(pixels[i + 1] - target.g);
      const db = Math.abs(pixels[i + 2] - target.b);
      if (dr < tolerance && dg < tolerance && db < tolerance) {
        pixels[i + 3] = 0;
      }
    }
    this.ctx.putImageData(data, 0, 0);
    this.saveCleanState();
    this.foregroundSeeds = [];
    this.updateSeedButton();
  }
  getImage() {
    return this.offscreenCanvas;
  }
}

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
