import Phaser from 'phaser';

// Texturi generate procedural la pornire, ca jocul să nu depindă de asset-uri.
// Corpurile sunt desenate ALB cu contur negru: culoarea jucătorului vine din `tint`, iar negrul rămâne
// negru după tint. Așa toate caracterele folosesc aceeași textură și se desenează în același batch.
// Ca să înlocuiești cu sprite-uri reale: încarcă o imagine cu aceeași cheie în BootScene.preload().

export const TEX = {
  body: 'char-blob',
  bodyFlat: 'char-flat',
  ring: 'char-ring',
  digits: 'font-digits',
  pixel: 'pixel',
  spark: 'spark',
  glow: 'glow',
  skinGolden: 'char-golden',
  skinGalaxy: 'char-galaxy',
  skinLion: 'char-lion',
  monFast: 'mon-fast',
  monTank: 'mon-tank',
  monBoss: 'mon-boss',
  boss: 'boss',
  base: 'base',
  pvpBase: 'pvp-base',
  tower: 'td-tower',
  slot: 'td-slot',
} as const;

export const DIGIT_CHARS = '#0123456789';
const DIGIT_W = 13;
const DIGIT_H = 18;

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h)!;
  draw(tex.getContext());
  tex.refresh();
}

export function createTextures(scene: Phaser.Scene): void {
  // Caracterul de bază: corp rotund cu umbră, gradient (dă volum după tint), contur gros și ochi.
  canvasTexture(scene, TEX.body, 40, 44, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(20, 38, 13, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const g = ctx.createRadialGradient(15, 13, 2, 20, 20, 17);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#b8b8b8');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(20, 20, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(15, 18, 2.6, 3.6, 0, 0, Math.PI * 2);
    ctx.ellipse(25, 18, 2.6, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Silueta plină, folosită pentru urma dash-ului.
  canvasTexture(scene, TEX.bodyFlat, 40, 40, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(20, 20, 15, 0, Math.PI * 2);
    ctx.fill();
  });

  // Conturul alb de evidențiere (stă în spatele corpului, puțin mai mare).
  canvasTexture(scene, TEX.ring, 48, 48, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(24, 24, 21, 0, Math.PI * 2);
    ctx.fill();
  });

  canvasTexture(scene, TEX.pixel, 4, 4, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 4, 4);
  });

  createDigitFont(scene);
  createGameplayTextures(scene);
}

/** Corp de caracter colorat deja (pentru skin-urile care nu folosesc tint). */
function drawBlob(ctx: CanvasRenderingContext2D, light: string, dark: string, cx = 20, cy = 20, r = 15): void {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r + 3, r - 2, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(cx - 5, cy - 7, 2, cx, cy, r + 2);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx - 5, cy - 2, 2.6, 3.6, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 5, cy - 2, 2.6, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outer: number, inner: number): void {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / spikes - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function angryEyes(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(cx - 9 * s, cy - 4 * s);
  ctx.lineTo(cx - 2 * s, cy - 1 * s);
  ctx.lineTo(cx - 8 * s, cy + 3 * s);
  ctx.closePath();
  ctx.moveTo(cx + 9 * s, cy - 4 * s);
  ctx.lineTo(cx + 2 * s, cy - 1 * s);
  ctx.lineTo(cx + 8 * s, cy + 3 * s);
  ctx.closePath();
  ctx.fill();
}

function whiteGradient(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): CanvasGradient {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#a8a8a8');
  return g;
}

function createGameplayTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, TEX.spark, 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  });

  canvasTexture(scene, TEX.glow, 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });

  // Skin-uri (colorate deja, fără tint), cu aceeași geometrie ca corpul de bază (40x44, centru la 20,20).
  canvasTexture(scene, TEX.skinGolden, 40, 44, (ctx) => {
    drawBlob(ctx, '#fff3b0', '#e0a800');
    ctx.fillStyle = '#ffd60a';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(11, 9);
    ctx.lineTo(13, 0);
    ctx.lineTo(17, 6);
    ctx.lineTo(20, -1);
    ctx.lineTo(23, 6);
    ctx.lineTo(27, 0);
    ctx.lineTo(29, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  canvasTexture(scene, TEX.skinGalaxy, 40, 44, (ctx) => {
    drawBlob(ctx, '#c77dff', '#3c096c');
    ctx.fillStyle = '#ffffff';
    for (const [x, y, r] of [[12, 27, 1.4], [27, 26, 1.8], [20, 31, 1.1], [29, 12, 1.2], [10, 14, 1]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  canvasTexture(scene, TEX.skinLion, 40, 44, (ctx) => {
    ctx.fillStyle = '#c1121f';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    star(ctx, 20, 20, 12, 20, 15);
    ctx.fill();
    ctx.stroke();
    drawBlob(ctx, '#ffd166', '#f77f00', 20, 20, 13);
  });

  // Monștri: albi cu contur negru, colorați prin tint (culoarea e în config).
  canvasTexture(scene, TEX.monFast, 34, 34, (ctx) => {
    ctx.fillStyle = whiteGradient(ctx, 17, 17, 14);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    star(ctx, 17, 17, 6, 15, 9);
    ctx.fill();
    ctx.stroke();
    angryEyes(ctx, 17, 17, 0.8);
  });

  canvasTexture(scene, TEX.monTank, 48, 48, (ctx) => {
    ctx.fillStyle = whiteGradient(ctx, 24, 24, 20);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(4, 5, 40, 38, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(8, 9, 32, 6);
    angryEyes(ctx, 24, 25, 1.1);
  });

  canvasTexture(scene, TEX.monBoss, 104, 104, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(52 + dir * 22, 22);
      ctx.lineTo(52 + dir * 44, 2);
      ctx.lineTo(52 + dir * 36, 30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = whiteGradient(ctx, 52, 56, 42);
    ctx.beginPath();
    ctx.arc(52, 56, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    angryEyes(ctx, 52, 50, 2.2);
    ctx.fillStyle = '#000';
    ctx.fillRect(36, 72, 32, 6);
  });

  canvasTexture(scene, TEX.boss, 260, 260, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(130, 236, 92, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 7;
    ctx.fillStyle = '#ffffff';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(130 + dir * 50, 50);
      ctx.quadraticCurveTo(130 + dir * 120, 30, 130 + dir * 112, 4);
      ctx.quadraticCurveTo(130 + dir * 92, 52, 130 + dir * 84, 76);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = whiteGradient(ctx, 130, 136, 100);
    ctx.beginPath();
    ctx.arc(130, 136, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Ochi strălucitori (rămân luminoși după tint) cu pupile negre.
    ctx.fillStyle = '#fffbe0';
    ctx.lineWidth = 5;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(130 + dir * 14, 112);
      ctx.lineTo(130 + dir * 62, 92);
      ctx.lineTo(130 + dir * 54, 128);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(130 - 40, 112, 7, 0, Math.PI * 2);
    ctx.arc(130 + 40, 112, 7, 0, Math.PI * 2);
    ctx.fill();
    // Gura cu colți.
    ctx.beginPath();
    ctx.moveTo(80, 170);
    ctx.quadraticCurveTo(130, 210, 180, 170);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    for (const x of [95, 117, 143, 165]) {
      ctx.beginPath();
      ctx.moveTo(x - 7, 174);
      ctx.lineTo(x, 190);
      ctx.lineTo(x + 7, 176);
      ctx.closePath();
      ctx.fill();
    }
  });

  // Baza din centru (Survival): cristal pe un soclu de piatră.
  canvasTexture(scene, TEX.base, 160, 160, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(80, 132, 62, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a4e69';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(80, 112, 60, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const g = ctx.createLinearGradient(50, 20, 110, 120);
    g.addColorStop(0, '#caf0f8');
    g.addColorStop(0.5, '#48cae4');
    g.addColorStop(1, '#0077b6');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(80, 8);
    ctx.lineTo(112, 60);
    ctx.lineTo(80, 118);
    ctx.lineTo(48, 60);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(80, 18);
    ctx.lineTo(62, 60);
    ctx.stroke();
  });

  // Baza unei echipe (PvP): turn cu steag, desenat alb ca să primească culoarea echipei prin tint.
  canvasTexture(scene, TEX.pvpBase, 140, 170, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(70, 150, 58, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 5;
    ctx.fillStyle = '#9a9a9a';
    ctx.beginPath();
    ctx.ellipse(70, 136, 56, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const g = ctx.createLinearGradient(36, 0, 104, 0);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#a8a8a8');
    ctx.fillStyle = g;
    // Corpul turnului cu creneluri.
    ctx.beginPath();
    ctx.moveTo(38, 136);
    ctx.lineTo(38, 52);
    for (let i = 0; i < 3; i++) {
      const x = 38 + i * 24;
      ctx.lineTo(x, 38);
      ctx.lineTo(x + 14, 38);
      ctx.lineTo(x + 14, 52);
      ctx.lineTo(x + 24, 52);
    }
    ctx.lineTo(102, 38);
    ctx.lineTo(102, 136);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(70, 112, 13, Math.PI, 0);
    ctx.lineTo(83, 134);
    ctx.lineTo(57, 134);
    ctx.closePath();
    ctx.fill();
    // Steagul.
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(70, 38);
    ctx.lineTo(70, 4);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(72, 5);
    ctx.lineTo(104, 14);
    ctx.lineTo(72, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // Turn de apărare (Tower Defense): soclu rotund + corp, alb ca să ia culoarea tipului prin tint.
  canvasTexture(scene, TEX.tower, 80, 96, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(40, 84, 32, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.fillStyle = '#8a8a8a';
    ctx.beginPath();
    ctx.ellipse(40, 76, 30, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const g = ctx.createLinearGradient(20, 0, 60, 0);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#b0b0b0');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(24, 76);
    ctx.lineTo(28, 26);
    ctx.lineTo(52, 26);
    ctx.lineTo(56, 76);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(40, 24, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(40, 22, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Slot liber de lângă drum: cerc punctat cu „+”.
  canvasTexture(scene, TEX.slot, 72, 72, (ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.arc(36, 36, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(36, 24);
    ctx.lineTo(36, 48);
    ctx.moveTo(24, 36);
    ctx.lineTo(48, 36);
    ctx.stroke();
  });
}

/**
 * Font bitmap pentru numerele de pe caractere (#47), generat pe canvas și înregistrat ca RetroFont.
 * BitmapText se desenează batched; 500 de obiecte Text ar însemna 500 de texturi separate.
 */
function createDigitFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(TEX.digits)) return;
  canvasTexture(scene, TEX.digits, DIGIT_W * DIGIT_CHARS.length, DIGIT_H, (ctx) => {
    ctx.font = 'bold 15px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < DIGIT_CHARS.length; i++) {
      const x = i * DIGIT_W + DIGIT_W / 2;
      ctx.strokeText(DIGIT_CHARS[i], x, DIGIT_H / 2 + 1);
      ctx.fillText(DIGIT_CHARS[i], x, DIGIT_H / 2 + 1);
    }
  });
  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: TEX.digits,
    width: DIGIT_W,
    height: DIGIT_H,
    chars: DIGIT_CHARS,
    charsPerRow: DIGIT_CHARS.length,
    'offset.x': 0,
    'offset.y': 0,
    'spacing.x': 0,
    'spacing.y': 0,
    lineSpacing: 0,
  });
  scene.cache.bitmapFont.add(TEX.digits, data);
}
