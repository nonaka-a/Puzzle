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
      e.stopPropagation();

      // Pointer Capture を設定し、要素外へのドラッグ中もイベント追従を維持する
      if (e.pointerId !== undefined) {
        try {
          trayEl.setPointerCapture(e.pointerId);
        } catch (err) {}
      }

      startX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      startY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      isDraggingOut = false;

      App.selectPiece(piece.id);
      PuzzleAudio.play('snap');

      document.addEventListener('pointermove', onPointerMove, { passive: false });
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerCancel);
    };

    const onPointerMove = (e) => {
      const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

      const dx = clientX - startX;
      const dy = clientY - startY;

      if (!isDraggingOut) {
        // 横方向へのスワイプはトレイのスクロール動作として許容し、ドラッグを開始しない
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
          return;
        }
        // 縦方向（トレイから外に引き出す動き）の移動が一定値を超えた場合のみドラッグを開始
        if (Math.abs(dy) > 15 && Math.abs(dy) > Math.abs(dx)) {
          isDraggingOut = true;
          
          // ドラッグ元の要素を一時的に非表示にし、DOMからは削除しない（タッチ追従ロストを防止）
          trayEl.style.opacity = '0';
          trayEl.style.pointerEvents = 'none';

          // ズームを考慮した盤面上の座標計算
          const rect = App.el.puzzleBoard.getBoundingClientRect();
          const scale = App.state.zoomScale;
          piece.x = (clientX - rect.left) / scale - piece.width / 2;
          piece.y = (clientY - rect.top) / scale - piece.height / 2;

          // 盤面に表示するドラッグ用のクローンを動的に生成
          const pad = parseFloat(piece.canvas.dataset.pad);
          dragClone = document.createElement('div');
          dragClone.classList.add('puzzle-piece-canvas');
          dragClone.style.left = `${piece.x - pad}px`;
          dragClone.style.top = `${piece.y - pad}px`;
          dragClone.style.width = `${piece.canvas.width}px`;
          dragClone.style.height = `${piece.canvas.height}px`;
          dragClone.style.zIndex = '100';

          const pieceCanvas = document.createElement('canvas');
          pieceCanvas.width = piece.canvas.width;
          pieceCanvas.height = piece.canvas.height;
          const pctx = pieceCanvas.getContext('2d');
          pctx.translate(pieceCanvas.width / 2, pieceCanvas.height / 2);
          pctx.rotate((piece.rotation * Math.PI) / 180);
          pctx.drawImage(piece.canvas, -pieceCanvas.width / 2, -pieceCanvas.height / 2);

          dragClone.appendChild(pieceCanvas);
          App.el.canvasContainer.appendChild(dragClone);

          App.state.activeDragId = piece.id;
        }
      }

      if (isDraggingOut && dragClone) {
        e.preventDefault();
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
      document.removeEventListener('pointercancel', onPointerCancel);

      if (e && e.pointerId !== undefined) {
        try {
          trayEl.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }

      // 元の要素のスタイルを戻す
      trayEl.style.opacity = '';
      trayEl.style.pointerEvents = '';

      if (isDraggingOut) {
        App.state.activeDragId = null;

        // 動的クローンを削除（checkSnap内のrenderで正式に盤面描画されるため）
        if (dragClone && dragClone.parentNode) {
          dragClone.parentNode.removeChild(dragClone);
        }

        piece.inTray = false;
        this.checkSnap(piece, dragClone);
      }
    };

    const onPointerCancel = (e) => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerCancel);

      if (e && e.pointerId !== undefined) {
        try {
          trayEl.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }

      trayEl.style.opacity = '';
      trayEl.style.pointerEvents = '';

      if (isDraggingOut) {
        App.state.activeDragId = null;
        if (dragClone && dragClone.parentNode) {
          dragClone.parentNode.removeChild(dragClone);
        }
        piece.inTray = true;
        piece.x = 0;
        piece.y = 0;
        App.renderTray();
        App.renderBoardPieces();
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