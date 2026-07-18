/**
 * ゲーム全体の制御、ズーム・パン、初期化、統括
 */
const App = {
  state: {
    selectedPiecesCount: 30,
    uploadedImageSrc: null,
    imageWidth: 0,
    imageHeight: 0,
    rows: 0,
    cols: 0,
    pieces: [], 
    selectedPieceId: null, 
    activeDragId: null, 
    timerInterval: null,
    startTime: 0,
    elapsedSeconds: 0,
    remainingCount: 0,
    totalPieces: 0,
    completed: false,
    
    // ズーム・パン用の状態
    zoomScale: 1.0,
    panX: 0,
    panY: 0
  },

  BOARD_MAX_WIDTH: 720,
  BOARD_MAX_HEIGHT: 480,
  SNAP_TOLERANCE: 20,

  init() {
    this.cacheElements();
    this.bindEvents();
    this.bindPanEvents();
    this.checkSavedData();
    PuzzleAudio.init(); 
  },

  cacheElements() {
    this.el = {
      titleScreen: document.getElementById('title-screen'),
      gameScreen: document.getElementById('game-screen'),
      btnSelects: document.querySelectorAll('.btn-select'),
      imageInput: document.getElementById('image-input'),
      uploadTrigger: document.getElementById('upload-trigger'),
      fileName: document.getElementById('file-name'),
      imagePreviewContainer: document.getElementById('image-preview-container'),
      imagePreview: document.getElementById('image-preview'),
      btnStart: document.getElementById('btn-start'),
      btnLoad: document.getElementById('btn-load'),
      btnBackToTitle: document.getElementById('btn-back-to-title'),
      timerVal: document.getElementById('timer-val'),
      remainingVal: document.getElementById('remaining-val'),
      totalVal: document.getElementById('total-val'),
      btnSave: document.getElementById('btn-save'),
      
      gameMain: document.getElementById('game-main'),
      puzzleBoard: document.getElementById('puzzle-board'),
      boardGuideImg: document.getElementById('board-guide-img'),
      canvasContainer: document.getElementById('canvas-container'),
      
      btnRotateRight: document.getElementById('btn-rotate-right'),
      pieceTray: document.getElementById('piece-tray'),
      
      btnZoomIn: document.getElementById('btn-zoom-in'),
      btnZoomOut: document.getElementById('btn-zoom-out'),
      
      clearModal: document.getElementById('clear-modal'),
      modalTimeVal: document.getElementById('modal-time-val'),
      btnModalTitle: document.getElementById('btn-modal-title')
    };
  },

  bindEvents() {
    this.el.btnSelects.forEach(btn => {
      btn.addEventListener('click', () => {
        this.el.btnSelects.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.selectedPiecesCount = parseInt(btn.dataset.pieces, 10);
      });
    });

    this.el.uploadTrigger.addEventListener('click', () => {
      this.el.imageInput.click();
    });

    this.el.imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.el.fileName.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (event) => {
          this.state.uploadedImageSrc = event.target.result;
          this.el.imagePreview.src = event.target.result;
          this.el.imagePreviewContainer.classList.remove('hidden');
          this.el.btnStart.disabled = false;
        };
        reader.readAsDataURL(file);
      }
    });

    this.el.btnStart.addEventListener('click', () => this.startGame(false));
    this.el.btnLoad.addEventListener('click', () => this.startGame(true));
    this.el.btnSave.addEventListener('click', () => this.saveGame());

    this.el.btnBackToTitle.addEventListener('click', () => {
      if (confirm('タイトル画面に戻りますか？（セーブしていない進捗は失われます）')) {
        this.backToTitle();
      }
    });

    this.el.btnRotateRight.addEventListener('click', () => {
      this.rotateBoardPiece();
    });

    this.el.btnModalTitle.addEventListener('click', () => {
      this.el.clearModal.classList.add('hidden');
      this.backToTitle();
    });

    // ズームコントロール
    this.el.btnZoomIn.addEventListener('click', () => this.setZoom(this.state.zoomScale + 0.2));
    this.el.btnZoomOut.addEventListener('click', () => this.setZoom(this.state.zoomScale - 0.2));

    // iPad/iOS Safari 等でのダブルタップによるブラウザズームを防止
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 350) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });

    // iPad/iOS Safari 等での2本指ピンチによるブラウザズームを防止
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });
  },

  // ボードの背景をドラッグ（スワイプ）して画面をパン（移動）させる処理
  bindPanEvents() {
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let initialPanX = 0;
    let initialPanY = 0;

    const onPointerDown = (e) => {
      // ピースをドラッグした場合はパンさせない
      if (e.target.closest('.puzzle-piece-canvas')) return;
      
      isPanning = true;
      startX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
      startY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
      initialPanX = this.state.panX;
      initialPanY = this.state.panY;
      
      this.el.puzzleBoard.style.transition = 'none'; // ドラッグ中は即時追従
    };

    const onPointerMove = (e) => {
      if (!isPanning) return;
      e.preventDefault();

      const currentX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
      const currentY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;

      const dx = currentX - startX;
      const dy = currentY - startY;

      this.state.panX = initialPanX + dx;
      this.state.panY = initialPanY + dy;
      this.applyTransform();
    };

    const onPointerUp = () => {
      if (isPanning) {
        isPanning = false;
        this.el.puzzleBoard.style.transition = 'transform 0.1s ease-out';
      }
    };

    this.el.gameMain.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp);
  },

  setZoom(scale) {
    // 0.5倍 ～ 3.0倍 に制限
    this.state.zoomScale = Math.max(0.5, Math.min(scale, 3.0));
    
    // 1倍以下の時はパンのオフセットをリセットして中央に戻す
    if (this.state.zoomScale <= 1.0) {
      this.state.panX = 0;
      this.state.panY = 0;
    }
    
    this.applyTransform();
  },

  applyTransform() {
    this.el.puzzleBoard.style.transform = `translate(${this.state.panX}px, ${this.state.panY}px) scale(${this.state.zoomScale})`;
  },

  checkSavedData() {
    const saved = localStorage.getItem('jigsaw_puzzle_save');
    if (saved) {
      this.el.btnLoad.classList.remove('hidden');
    } else {
      this.el.btnLoad.classList.add('hidden');
    }
  },

  startGame(loadSaved = false) {
    // 状態のリセット
    this.setZoom(1.0);

    if (loadSaved) {
      const savedData = JSON.parse(localStorage.getItem('jigsaw_puzzle_save'));
      if (!savedData) return;
      this.state.selectedPiecesCount = savedData.selectedPiecesCount;
      this.state.uploadedImageSrc = savedData.uploadedImageSrc;
      this.state.elapsedSeconds = savedData.elapsedSeconds;
      
      const img = new Image();
      img.onload = () => {
        this.setupBoardSize(img);
        this.generatePieces(img, savedData.pieces);
        this.startTimer(true);
        this.showGameScreen();
      };
      img.src = this.state.uploadedImageSrc;
    } else {
      this.state.elapsedSeconds = 0;
      const img = new Image();
      img.onload = () => {
        this.setupBoardSize(img);
        this.generatePieces(img);
        this.startTimer(false);
        this.showGameScreen();
      };
      img.src = this.state.uploadedImageSrc;
    }
  },

  showGameScreen() {
    this.el.titleScreen.classList.add('hidden');
    this.el.gameScreen.classList.remove('hidden');
    this.updateStatus();
  },

  backToTitle() {
    this.stopTimer();
    this.state.selectedPieceId = null;
    this.el.gameScreen.classList.add('hidden');
    this.el.titleScreen.classList.remove('hidden');
    this.checkSavedData();
  },

  setupBoardSize(img) {
    let width = img.naturalWidth || 600;
    let height = img.naturalHeight || 400;

    const ratio = width / height;
    if (width > this.BOARD_MAX_WIDTH) {
      width = this.BOARD_MAX_WIDTH;
      height = width / ratio;
    }
    if (height > this.BOARD_MAX_HEIGHT) {
      height = this.BOARD_MAX_HEIGHT;
      width = height * ratio;
    }

    this.state.imageWidth = Math.floor(width);
    this.state.imageHeight = Math.floor(height);

    this.el.puzzleBoard.style.width = `${this.state.imageWidth}px`;
    this.el.puzzleBoard.style.height = `${this.state.imageHeight}px`;
    this.el.boardGuideImg.src = this.state.uploadedImageSrc;

    this.calculateGrid();
  },

  calculateGrid() {
    const totalGoal = this.state.selectedPiecesCount;
    const aspect = this.state.imageWidth / this.state.imageHeight;

    let rows = Math.round(Math.sqrt(totalGoal / aspect));
    rows = Math.max(1, rows);
    let cols = Math.round(rows * aspect);
    cols = Math.max(1, cols);

    this.state.rows = rows;
    this.state.cols = cols;
    this.state.totalPieces = rows * cols;
  },

  generatePieces(img, savedPieces = null) {
    const cols = this.state.cols;
    const rows = this.state.rows;
    const w = this.state.imageWidth / cols;
    const h = this.state.imageHeight / rows;

    const edges = [];
    for (let r = 0; r < rows; r++) {
      edges[r] = [];
      for (let c = 0; c < cols; c++) {
        edges[r][c] = { right: 0, bottom: 0, left: 0, top: 0 };
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c < cols - 1) {
          const type = Math.random() < 0.5 ? 1 : -1;
          edges[r][c].right = type;
          edges[r][c + 1].left = -type;
        }
        if (r < rows - 1) {
          const type = Math.random() < 0.5 ? 1 : -1;
          edges[r][c].bottom = type;
          edges[r + 1][c].top = -type;
        }
      }
    }

    this.state.pieces = [];
    let id = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const correctX = c * w;
        const correctY = r * h;

        let pieceData = {
          id: id,
          r: r,
          c: c,
          correctX: correctX,
          correctY: correctY,
          width: w,
          height: h,
          edges: edges[r][c],
          x: 0,
          y: 0,
          rotation: 0,
          isLocked: false,
          inTray: true
        };

        if (savedPieces) {
          const saved = savedPieces.find(p => p.id === id);
          if (saved) {
            pieceData.x = saved.x;
            pieceData.y = saved.y;
            pieceData.rotation = saved.rotation;
            pieceData.isLocked = saved.isLocked;
            pieceData.inTray = saved.inTray;
          }
        } else {
          // 初期生成時、トレイ内の向きをランダムにばらけさせる
          pieceData.rotation = Math.floor(Math.random() * 4) * 90;
        }

        pieceData.canvas = PuzzleBoard.createPieceCanvas(img, pieceData, this.state.imageWidth, this.state.imageHeight);
        this.state.pieces.push(pieceData);
        id++;
      }
    }

    // 初回生成時はピースの配列をシャッフルし、トレイに並ぶ順番をランダムにする
    if (!savedPieces) {
      this.shufflePieces();
    }

    this.renderTray();
    this.renderBoardPieces();
    this.updateStatus();
  },

  // Fisher-Yatesアルゴリズムで配列をシャッフル
  shufflePieces() {
    for (let i = this.state.pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.state.pieces[i], this.state.pieces[j]] = [this.state.pieces[j], this.state.pieces[i]];
    }
  },

  selectPiece(id) {
    this.state.selectedPieceId = id;
    
    const trayItems = this.el.pieceTray.querySelectorAll('.tray-item');
    trayItems.forEach(it => {
      if (parseInt(it.dataset.id, 10) === id) {
        it.classList.add('selected');
      } else {
        it.classList.remove('selected');
      }
    });

    const boardEls = this.el.canvasContainer.querySelectorAll('.puzzle-piece-canvas');
    boardEls.forEach(el => {
      if (parseInt(el.dataset.id, 10) === id) {
        el.classList.add('selected-on-board');
      } else {
        el.classList.remove('selected-on-board');
      }
    });

    const activePiece = this.state.pieces.find(p => p.id === id);
    if (activePiece && !activePiece.isLocked) {
      this.el.btnRotateRight.disabled = false;
    } else {
      this.el.btnRotateRight.disabled = true;
    }
  },

  rotateBoardPiece() {
    if (this.state.selectedPieceId === null) return;
    const piece = this.state.pieces.find(p => p.id === this.state.selectedPieceId);
    if (!piece || piece.isLocked) return;

    piece.rotation = (piece.rotation + 90) % 360;
    PuzzleAudio.play('snap');

    if (piece.inTray) {
      this.renderTray();
    } else {
      this.renderBoardPieces();
      this.selectPiece(piece.id);
    }
  },

  renderTray() {
    this.el.pieceTray.innerHTML = '';
    const trayPieces = this.state.pieces.filter(p => p.inTray && !p.isLocked);
    
    trayPieces.forEach(p => {
      const container = document.createElement('div');
      container.classList.add('tray-item');
      container.dataset.id = p.id;
      
      if (this.state.selectedPieceId === p.id) {
        container.classList.add('selected');
      }

      const thumbCanvas = document.createElement('canvas');
      const pad = parseFloat(p.canvas.dataset.pad);
      thumbCanvas.width = p.width + pad * 2;
      thumbCanvas.height = p.height + pad * 2;
      
      const tctx = thumbCanvas.getContext('2d');
      tctx.translate(thumbCanvas.width / 2, thumbCanvas.height / 2);
      tctx.rotate((p.rotation * Math.PI) / 180);
      tctx.drawImage(p.canvas, -thumbCanvas.width / 2, -thumbCanvas.height / 2);

      container.appendChild(thumbCanvas);
      this.el.pieceTray.appendChild(container);

      PuzzleDragDrop.makeTrayItemDraggable(container, p);
    });

    this.checkControlAccessibility();
  },

  renderBoardPieces() {
    this.el.canvasContainer.innerHTML = '';
    const boardPieces = this.state.pieces.filter(p => !p.inTray);

    boardPieces.forEach(p => {
      const pad = parseFloat(p.canvas.dataset.pad);
      const el = document.createElement('div');
      el.classList.add('puzzle-piece-canvas');
      el.style.left = `${p.x - pad}px`;
      el.style.top = `${p.y - pad}px`;
      el.style.width = `${p.canvas.width}px`;
      el.style.height = `${p.canvas.height}px`;
      el.style.zIndex = p.isLocked ? 1 : 10;
      el.dataset.id = p.id;

      if (this.state.selectedPieceId === p.id) {
        el.classList.add('selected-on-board');
      }

      const pieceCanvas = document.createElement('canvas');
      pieceCanvas.width = p.canvas.width;
      pieceCanvas.height = p.canvas.height;
      const pctx = pieceCanvas.getContext('2d');

      pctx.translate(pieceCanvas.width / 2, pieceCanvas.height / 2);
      pctx.rotate((p.rotation * Math.PI) / 180);
      pctx.drawImage(p.canvas, -pieceCanvas.width / 2, -pieceCanvas.height / 2);

      el.appendChild(pieceCanvas);
      this.el.canvasContainer.appendChild(el);

      if (!p.isLocked) {
        PuzzleDragDrop.makeBoardPieceDraggable(el, p);
      }
    });

    this.checkControlAccessibility();
  },

  checkControlAccessibility() {
    const selectedPiece = this.state.pieces.find(p => p.id === this.state.selectedPieceId);
    if (selectedPiece && !selectedPiece.isLocked) {
      this.el.btnRotateRight.disabled = false;
    } else {
      this.el.btnRotateRight.disabled = true;
    }
  },

  updateStatus() {
    const total = this.state.totalPieces;
    const lockedCount = this.state.pieces.filter(p => p.isLocked).length;
    this.state.remainingCount = total - lockedCount;

    this.el.remainingVal.textContent = this.state.remainingCount;
    this.el.totalVal.textContent = total;
  },

  checkGameCompletion() {
    if (this.state.remainingCount === 0 && !this.state.completed) {
      this.state.completed = true;
      this.stopTimer();
      
      setTimeout(() => {
        localStorage.removeItem('jigsaw_puzzle_save');
        this.el.modalTimeVal.textContent = this.el.timerVal.textContent;
        this.el.clearModal.classList.remove('hidden');
        this.shootConfetti();
      }, 600);
    }
  },

  shootConfetti() {
    const colors = ['#ff6584', '#fbcbc9', '#ffe66d', '#4ecdc4', '#a8e6cf'];
    for (let i = 0; i < 150; i++) {
      const piece = document.createElement('div');
      piece.classList.add('confetti');
      
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.left = `${Math.random() * 100}vw`;
      
      piece.style.animationDuration = `${Math.random() * 3 + 2}s`;
      piece.style.animationDelay = `${Math.random() * 0.5}s`;
      
      if (Math.random() > 0.5) {
        piece.style.borderRadius = '50%';
      }
      
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 5500);
    }
  },

  startTimer(resume = false) {
    if (!resume) {
      this.state.elapsedSeconds = 0;
    }
    this.state.completed = false;
    this.state.startTime = Date.now() - (this.state.elapsedSeconds * 1000);
    
    this.el.timerVal.textContent = this.formatTime(this.state.elapsedSeconds);

    clearInterval(this.state.timerInterval);
    this.state.timerInterval = setInterval(() => {
      this.state.elapsedSeconds = Math.floor((Date.now() - this.state.startTime) / 1000);
      this.el.timerVal.textContent = this.formatTime(this.state.elapsedSeconds);
    }, 1000);
  },

  stopTimer() {
    clearInterval(this.state.timerInterval);
  },

  formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  },

  saveGame() {
    const serializedPieces = this.state.pieces.map(p => ({
      id: p.id,
      x: p.x,
      y: p.y,
      rotation: p.rotation,
      isLocked: p.isLocked,
      inTray: p.inTray
    }));

    const saveData = {
      selectedPiecesCount: this.state.selectedPiecesCount,
      uploadedImageSrc: this.state.uploadedImageSrc,
      elapsedSeconds: this.state.elapsedSeconds,
      pieces: serializedPieces
    };

    try {
      localStorage.setItem('jigsaw_puzzle_save', JSON.stringify(saveData));
      alert('進行状況をセーブしました。');
    } catch (e) {
      alert('セーブに失敗しました。画像データが大きすぎる可能性があります。');
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});