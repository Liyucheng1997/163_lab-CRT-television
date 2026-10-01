// 电视测试卡（仿 PM5544 风格），既用于屏幕画面，也作为视频亮度信号源。

const W = 640;
const H = 480;
const FONT = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';

export function createTestCard() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  ctx.fillStyle = '#5c5c5c';
  ctx.fillRect(0, 0, W, H);

  // 方格
  ctx.strokeStyle = '#e6e6e6';
  ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += 40) line(ctx, x, 0, x, H);
  for (let y = 0; y <= H; y += 40) line(ctx, 0, y, W, y);

  // 边缘黑白城垛
  for (let i = 0; i < W / 40; i += 1) {
    ctx.fillStyle = i % 2 ? '#f2f2f2' : '#0a0a0a';
    ctx.fillRect(i * 40, 0, 40, 18);
    ctx.fillStyle = i % 2 ? '#0a0a0a' : '#f2f2f2';
    ctx.fillRect(i * 40, H - 18, 40, 18);
  }
  for (let i = 0; i < H / 40; i += 1) {
    ctx.fillStyle = i % 2 ? '#f2f2f2' : '#0a0a0a';
    ctx.fillRect(0, i * 40, 18, 40);
    ctx.fillStyle = i % 2 ? '#0a0a0a' : '#f2f2f2';
    ctx.fillRect(W - 18, i * 40, 18, 40);
  }

  // 四角小圆（检查几何失真）
  for (const [x, y] of [
    [80, 80],
    [560, 80],
    [80, 400],
    [560, 400],
  ]) {
    ctx.fillStyle = '#0d0d0d';
    ctx.beginPath();
    ctx.arc(x, y, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.lineWidth = 2;
    line(ctx, x - 22, y, x + 22, y);
    line(ctx, x, y - 22, x, y + 22);
  }

  // 中央大圆
  const cx = W / 2;
  const cy = H / 2;
  const R = 198;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#0b0b0b';
  ctx.fillRect(0, 0, W, H);
  // 顶部黑白块
  for (let i = 0; i < 12; i += 1) {
    ctx.fillStyle = i % 2 ? '#f0f0f0' : '#101010';
    ctx.fillRect(80 + i * 40, 40, 40, 54);
  }
  // 灰度阶梯
  for (let i = 0; i < 8; i += 1) {
    const v = Math.round(240 - (i / 7) * 225);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(124 + i * 49, 94, 49, 74);
  }
  // 多波群（频率光栅）
  const periods = [16, 11, 8, 5.5, 4];
  for (let b = 0; b < periods.length; b += 1) {
    const x0 = 138 + b * 73;
    for (let x = 0; x < 73; x += 1) {
      const v = Math.sin(((x * 2) / periods[b]) * Math.PI) > 0 ? 235 : 20;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x0 + x, 182, 1, 112);
    }
  }
  // 中心十字
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(110, cy - 2, W - 220, 4);
  ctx.fillRect(cx - 2, 170, 4, 136);
  // 文字块
  ctx.fillStyle = '#050505';
  ctx.fillRect(170, 306, 300, 50);
  ctx.fillStyle = '#f2f2f2';
  ctx.font = `bold 30px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TV-14B 测试图', cx, 332);
  // 阶跃响应
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(0, 356, cx, 90);
  ctx.fillStyle = '#0b0b0b';
  ctx.fillRect(cx, 356, cx, 90);
  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(cx - 60, 380, 120, 30);
  ctx.restore();

  ctx.strokeStyle = '#f2f2f2';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  const data = ctx.getImageData(0, 0, W, H).data;
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i += 1) {
    lum[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255;
  }

  return {
    canvas,
    width: W,
    height: H,
    sample(u, v) {
      const x = Math.min(W - 1, Math.max(0, Math.floor(u * W)));
      const y = Math.min(H - 1, Math.max(0, Math.floor(v * H)));
      return lum[y * W + x];
    },
  };
}

function line(ctx, x0, y0, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
