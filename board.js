/**
 * パズル盤面生成および描画計算モジュール
 */
const PuzzleBoard = {
  drawEdge(ctx, x1, y1, x2, y2, type, tabSize) {
    if (type === 0) {
      ctx.lineTo(x2, y2);
      return;
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    const nx = -dy / len; 
    const ny = dx / len;

    const dir = type;

    const getP = (t, n) => ({
      x: x1 + dx * t + nx * tabSize * dir * n,
      y: y1 + dy * t + ny * tabSize * dir * n
    });

    const p1 = getP(0.35, 0);
    const p2 = getP(0.40, -0.15);
    const p3 = getP(0.20, 1.0);
    const p4 = getP(0.50, 1.0);
    const p5 = getP(0.80, 1.0);
    const p6 = getP(0.60, -0.15);
    const p7 = getP(0.65, 0);

    ctx.lineTo(p1.x, p1.y);
    ctx.bezierCurveTo(p2.x, p2.y, p3.x, p3.y, p4.x, p4.y);
    ctx.bezierCurveTo(p5.x, p5.y, p6.x, p6.y, p7.x, p7.y);
    ctx.lineTo(x2, y2);
  },

  createPieceCanvas(img, piece, totalWidth, totalHeight) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const w = piece.width;
    const h = piece.height;
    const tabSize = Math.min(w, h) * 0.25;

    const pad = tabSize * 2.0;
    canvas.width = w + pad * 2;
    canvas.height = h + pad * 2;

    ctx.save();
    ctx.translate(pad, pad);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    
    this.drawEdge(ctx, 0, 0, w, 0, piece.edges.top, tabSize);
    this.drawEdge(ctx, w, 0, w, h, piece.edges.right, tabSize);
    this.drawEdge(ctx, w, h, 0, h, piece.edges.bottom, tabSize);
    this.drawEdge(ctx, 0, h, 0, 0, piece.edges.left, tabSize);
    
    ctx.closePath();
    ctx.clip();

    const scaleX = (img.naturalWidth || img.width) / totalWidth;
    const scaleY = (img.naturalHeight || img.height) / totalHeight;

    const sx = (piece.correctX - pad) * scaleX;
    const sy = (piece.correctY - pad) * scaleY;
    const sw = (w + pad * 2) * scaleX;
    const sh = (h + pad * 2) * scaleY;

    ctx.drawImage(img, sx, sy, sw, sh, -pad, -pad, w + pad * 2, h + pad * 2);
    ctx.restore();

    ctx.save();
    ctx.translate(pad, pad);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    this.drawEdge(ctx, 0, 0, w, 0, piece.edges.top, tabSize);
    this.drawEdge(ctx, w, 0, w, h, piece.edges.right, tabSize);
    this.drawEdge(ctx, w, h, 0, h, piece.edges.bottom, tabSize);
    this.drawEdge(ctx, 0, h, 0, 0, piece.edges.left, tabSize);
    ctx.closePath();
    ctx.strokeStyle = '#4a2d34';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    canvas.dataset.pad = pad;
    canvas.dataset.width = w;
    canvas.dataset.height = h;

    return canvas;
  }
};