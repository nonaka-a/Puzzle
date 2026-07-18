/**
 * ピースのドラッグ＆ドロップ、およびトレイ外回転制御モジュール
 */
const PuzzleDragDrop = {
  makeTrayItemDraggable(trayEl, piece, img) {
    let startX = 0;
    let startY = 0;
    let isDraggingOut = false;
    let dragClone = null;

    const onPointerDown = (e) => {
      if (piece.isLocked) return;
      e.preventDefault();
      e.stopPropagation();

      startX = e.clientX || e.touches[0].clientX;
      startY = e.clientY || e.touches[0].clientY;
      isDraggingOut = false;

      App.selectPiece(piece.id);
      PuzzleAudio.play('snap');

      document.addEventListener('pointermove', onPointerMove, { passive: false });
      document.addEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (e) => {
      e.preventDefault();
      const clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
      const clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;

      const dx = clientX - startX;
      const dy = clientY - startY;

      if (!isDraggingOut && (Math.abs(dx) > 15 || Math.abs(dy) > 15)) {
        isDraggingOut = true;
        piece.inTray = false;
        
        // ズームを考慮した盤面上の座標計算
        const rect = App.el.puzzleBoard.getBoundingClientRect();
        const scale = App.state.zoomScale;
        piece.x = (clientX - rect.left) / scale - piece.width / 2;
        piece.y = (clientY - rect.top) / scale - piece.height / 2;

        App.renderTray();
        App.renderBoardPieces();

        dragClone = App.el.canvasContainer.querySelector(`.puzzle-piece-canvas[data-id="${piece.id}"]`);
        if (dragClone) {
          dragClone.style.zIndex = 100;
          App.state.activeDragId = piece.id;
        }
      }

      if (isDraggingOut && dragClone) {
        const rect = App.el.puzzleBoard.getBoundingClientRect();
        const scale = App.state.zoomScale;
        piece.x = (clientX - rect.left) / scale - piece.width / 2;
        piece.y = (clientY - rect.top) / scale - piece.height / 2;

        const pad = parseFloat(piece.canvas.dataset.pad);
        dragClone.style.left = `${piece.x - pad}px`;
        dragClone.style.top = `${piece.y - pad}px`;
      }
    };

    const onPointerUp = (e) => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);

      if (isDraggingOut) {
        if (dragClone) {
          dragClone.style.zIndex = 10;
        }
        App.state.activeDragId = null;
        this.checkSnap(piece, dragClone);
      }
    };

    trayEl.addEventListener('pointerdown', onPointerDown);
  },

  makeBoardPieceDraggable(el, piece) {
    let startX = 0;
    let startY = 0;
    let originalPieceX = 0;
    let originalPieceY = 0;

    const onPointerDown = (e) => {
      if (piece.isLocked) return;
      e.preventDefault();
      e.stopPropagation();

      App.selectPiece(piece.id);
      PuzzleAudio.play('snap');

      el.style.zIndex = 100;
      App.state.activeDragId = piece.id;

      startX = e.clientX || e.touches[0].clientX;
      startY = e.clientY || e.touches[0].clientY;
      originalPieceX = piece.x;
      originalPieceY = piece.y;

      document.addEventListener('pointermove', onPointerMove, { passive: false });
      document.addEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (e) => {
      if (App.state.activeDragId !== piece.id) return;
      e.preventDefault();

      const clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
      const clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;

      // ズーム倍率で割ることで、ポインターの移動量とピースの移動量を一致させる
      const scale = App.state.zoomScale;
      const dx = (clientX - startX) / scale;
      const dy = (clientY - startY) / scale;

      piece.x = originalPieceX + dx;
      piece.y = originalPieceY + dy;

      const pad = parseFloat(piece.canvas.dataset.pad);
      el.style.left = `${piece.x - pad}px`;
      el.style.top = `${piece.y - pad}px`;
    };

    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);

      if (App.state.activeDragId === piece.id) {
        el.style.zIndex = 10;
        this.checkSnap(piece, el);
        App.state.activeDragId = null;
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
  },

  checkSnap(piece, el) {
    const diffX = Math.abs(piece.x - piece.correctX);
    const diffY = Math.abs(piece.y - piece.correctY);

    let isSnapped = false;

    if (diffX < App.SNAP_TOLERANCE && diffY < App.SNAP_TOLERANCE && piece.rotation === 0) {
      piece.x = piece.correctX;
      piece.y = piece.correctY;
      piece.isLocked = true;
      piece.inTray = false;
      if (App.state.selectedPieceId === piece.id) {
        App.state.selectedPieceId = null;
      }
      isSnapped = true;
    } else {
      const pad = parseFloat(piece.canvas.dataset.pad);
      // 実スケールに基づかない基本サイズ（App.state.imageWidth）で判定
      if (piece.x < -pad || piece.x > App.state.imageWidth + pad || piece.y < -pad || piece.y > App.state.imageHeight + pad) {
        piece.inTray = true;
        piece.x = 0;
        piece.y = 0;
        if (App.state.selectedPieceId === piece.id) {
          App.state.selectedPieceId = null;
        }
      }
    }

    App.renderTray();
    App.renderBoardPieces();

    if (isSnapped) {
      PuzzleAudio.play('sausage');
      this.playFlashEffect(piece);
    }

    App.updateStatus();
    App.checkGameCompletion();
  },

  playFlashEffect(piece) {
    const el = App.el.canvasContainer.querySelector(`.puzzle-piece-canvas[data-id="${piece.id}"]`);
    if (el) {
      el.style.transition = 'filter 0.1s ease-out';
      el.style.filter = 'brightness(2.5) contrast(1.2)';
      
      setTimeout(() => {
        el.style.transition = 'filter 0.6s ease-out';
        el.style.filter = 'brightness(1) contrast(1)';
        
        setTimeout(() => {
          el.style.transition = '';
          el.style.filter = '';
        }, 600);
      }, 100);
    }
  }
};