// --- GAME CANVAS & ENGINE CONFIG ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameState = 'MENU'; // 'MENU', 'PLAYING', 'GAMEOVER'
let isMultiplayer = false;
let isHost = false;
let score = 0;
let p2Score = 0;
let highScore = localStorage.getItem('bonda_highscore') || 0;

// Dynamic Canvas Auto-Resizing to match style.css bounds
function resizeCanvas() {
  const container = document.getElementById('game-container');
  if (container) {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Load Sprite Assets (Gracefully falls back to glow shape if image fails/missing)
const bondaImg = new Image();
bondaImg.src = 'images/bonda.png';

// --- GAME OBJECTS ---
const bonda = {
  x: 80,
  y: 250,
  radius: 18,
  velocity: 0,
  gravity: 0.35,
  jump: -6.5,
  hasShield: false,
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    let angle = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, this.velocity * 0.1));
    ctx.rotate(angle);

    if (bondaImg.complete && bondaImg.naturalWidth !== 0) {
      ctx.drawImage(bondaImg, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
    } else {
      // Glow Fallback Circle
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.closePath();
    }

    // Shield FX Overlay
    if (this.hasShield) {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  },
  update() {
    this.velocity += this.gravity;
    this.y += this.velocity;
    if (this.y + this.radius > canvas.height) endGame();
    if (this.y - this.radius < 0) this.y = this.radius;
  }
};

// Ghost Player Structure for WebRTC P2P
const ghostPlayer = {
  x: 80,
  y: 250,
  active: false,
  draw() {
    if (!this.active) return;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, bonda.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ff0080';
    ctx.fill();
    ctx.restore();
  }
};

// Pipes, Powerups, and Particles
let pipes = [];
let particles = [];
let powerups = [];
let frameCount = 0;

class Pipe {
  constructor(x) {
    this.x = x;
    this.width = 52;
    this.gap = 130;
    this.topHeight = Math.floor(Math.random() * (canvas.height - this.gap - 120)) + 40;
    this.bottomY = this.topHeight + this.gap;
    this.passed = false;
  }
  draw() {
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 2;

    // Top Pipe
    ctx.fillRect(this.x, 0, this.width, this.topHeight);
    ctx.strokeRect(this.x, 0, this.width, this.topHeight);

    // Bottom Pipe
    ctx.fillRect(this.x, this.bottomY, this.width, canvas.height - this.bottomY);
    ctx.strokeRect(this.x, this.bottomY, this.width, canvas.height - this.bottomY);
  }
  update() {
    this.x -= 2.5;
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = (Math.random() - 0.5) * 3;
    this.vy = (Math.random() - 0.5) * 3;
    this.alpha = 1;
  }
  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, 4, 4);
    ctx.restore();
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 0.03;
  }
}

class Powerup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'shield'
    this.radius = 12;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.type === 'shield' ? '#00f2fe' : '#a855f7';
    ctx.fill();
    ctx.closePath();
  }
  update() {
    this.x -= 2.5;
  }
}

// --- SERVERLESS WEBRTC MULTIPLAYER CLASS ---
class ServerlessMultiplayer {
  constructor() {
    this.pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.dc = null;
    this.setupListeners();
  }

  setupListeners() {
    this.pc.ondatachannel = (e) => {
      this.dc = e.channel;
      this.bindDataChannelEvents();
    };
  }

  bindDataChannelEvents() {
    this.dc.onopen = () => console.log('P2P Channel Connection Established!');
    this.dc.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.y !== undefined) ghostPlayer.y = data.y;
        if (data.score !== undefined) {
          p2Score = data.score;
          const elem = document.getElementById('p2-score');
          if (elem) elem.innerText = p2Score;
        }
      } catch (err) {
        console.error('Data parsing error:', err);
      }
    };
  }

  async createHostOffer() {
    this.dc = this.pc.createDataChannel('gameSync');
    this.bindDataChannelEvents();
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    return new Promise((resolve) => {
      this.pc.onicecandidate = (e) => {
        if (!e.candidate) {
          resolve(btoa(JSON.stringify(this.pc.localDescription)));
        }
      };
    });
  }

  async processHostOffer(offerBase64) {
    const offer = JSON.parse(atob(offerBase64));
    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    return new Promise((resolve) => {
      this.pc.onicecandidate = (e) => {
        if (!e.candidate) {
          resolve(btoa(JSON.stringify(this.pc.localDescription)));
        }
      };
    });
  }

  async completeConnection(answerBase64) {
    const answer = JSON.parse(atob(answerBase64));
    await this.pc.setRemoteDescription(answer);
  }

  sendState(state) {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(JSON.stringify(state));
    }
  }
}

const p2p = new ServerlessMultiplayer();

// --- GAME LOOP & LOGIC ---
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameState === 'PLAYING') {
    frameCount++;

    // Spawn Pipes
    if (frameCount % 90 === 0) {
      const p = new Pipe(canvas.width);
      pipes.push(p);

      // Random Power-up Spawn
      if (Math.random() < 0.3) {
        powerups.push(new Powerup(canvas.width + 20, p.topHeight + p.gap / 2, 'shield'));
      }
    }

    // Update & Draw Pipes
    for (let i = pipes.length - 1; i >= 0; i--) {
      pipes[i].update();
      pipes[i].draw();

      // Check Point Score
      if (!pipes[i].passed && bonda.x > pipes[i].x + pipes[i].width) {
        pipes[i].passed = true;
        score++;
        document.getElementById('current-score').innerText = score;
      }

      // Check Collisions
      if (
        bonda.x + bonda.radius > pipes[i].x &&
        bonda.x - bonda.radius < pipes[i].x + pipes[i].width &&
        (bonda.y - bonda.radius < pipes[i].topHeight || bonda.y + bonda.radius > pipes[i].bottomY)
      ) {
        if (bonda.hasShield) {
          bonda.hasShield = false;
          pipes.splice(i, 1);
          continue;
        } else {
          endGame();
        }
      }

      if (pipes[i] && pipes[i].x < -pipes[i].width) pipes.splice(i, 1);
    }

    // Power-up Collisions
    for (let i = powerups.length - 1; i >= 0; i--) {
      powerups[i].update();
      powerups[i].draw();

      let dist = Math.hypot(bonda.x - powerups[i].x, bonda.y - powerups[i].y);
      if (dist < bonda.radius + powerups[i].radius) {
        if (powerups[i].type === 'shield') bonda.hasShield = true;
        powerups.splice(i, 1);
      }
    }

    // Bonda Updates & Particles
    bonda.update();
    particles.push(new Particle(bonda.x - 10, bonda.y, '#00f2fe'));

    // Emit WebRTC P2P Data
    if (isMultiplayer) {
      p2p.sendState({ y: bonda.y, score: score });
    }
  }

  // Draw Particles & Players
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].draw();
    if (particles[i].alpha <= 0) particles.splice(i, 1);
  }

  ghostPlayer.draw();
  bonda.draw();

  requestAnimationFrame(gameLoop);
}

function startGame() {
  gameState = 'PLAYING';
  score = 0;
  p2Score = 0;
  pipes = [];
  particles = [];
  powerups = [];
  bonda.y = canvas.height / 2;
  bonda.velocity = 0;
  bonda.hasShield = false;

  document.getElementById('current-score').innerText = '0';
  document.getElementById('p2-score').innerText = '0';
  document.querySelectorAll('.menu-screen').forEach((el) => el.classList.remove('active'));
  document.getElementById('hud-panel').classList.remove('hidden');
}

function endGame() {
  gameState = 'GAMEOVER';
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('bonda_highscore', highScore);
  }

  document.getElementById('final-score').innerText = score;
  document.getElementById('high-score').innerText = highScore;
  document.getElementById('hud-panel').classList.add('hidden');
  document.getElementById('game-over-menu').classList.add('active');
}

// --- USER INPUT & CONTROLS ---
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (gameState === 'PLAYING') bonda.velocity = bonda.jump;
  }
});

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (gameState === 'PLAYING') bonda.velocity = bonda.jump;
});

// UI Navigation Handlers
document.getElementById('btn-singleplayer').onclick = () => {
  isMultiplayer = false;
  ghostPlayer.active = false;
  document.getElementById('p2-score-tag').classList.add('hidden');
  startGame();
};

document.getElementById('btn-multiplayer').onclick = () => {
  showMenu('multiplayer-menu');
};

document.getElementById('btn-back-mp').onclick = () => {
  showMenu('main-menu');
};

document.getElementById('btn-restart').onclick = () => {
  startGame();
};

function showMenu(id) {
  document.querySelectorAll('.menu-screen').forEach((el) => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Host P2P Setup
document.getElementById('btn-host-room').onclick = async () => {
  isHost = true;
  isMultiplayer = true;
  ghostPlayer.active = true;
  document.getElementById('host-panel').classList.remove('hidden');
  document.getElementById('join-panel').classList.add('hidden');

  const offerCode = await p2p.createHostOffer();
  document.getElementById('share-link-input').value = offerCode;

  // Render QR Code safely
  const qrContainer = document.getElementById('qrcode-container');
  qrContainer.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    new QRCode(qrContainer, {
      text: offerCode,
      width: 120,
      height: 120
    });
  }
};

document.getElementById('btn-connect-host').onclick = async () => {
  const ans = document.getElementById('host-answer-input').value.trim();
  if (ans) {
    await p2p.completeConnection(ans);
    document.getElementById('p2-score-tag').classList.remove('hidden');
    startGame();
  }
};

// Join P2P Setup
document.getElementById('btn-join-room').onclick = () => {
  isHost = false;
  isMultiplayer = true;
  ghostPlayer.active = true;
  document.getElementById('join-panel').classList.remove('hidden');
  document.getElementById('host-panel').classList.add('hidden');
};

document.getElementById('btn-generate-answer').onclick = async () => {
  const offer = document.getElementById('join-offer-input').value.trim();
  if (offer) {
    const ansCode = await p2p.processHostOffer(offer);
    document.getElementById('join-answer-output').value = ansCode;
    document.getElementById('join-answer-container').classList.remove('hidden');
    document.getElementById('p2-score-tag').classList.remove('hidden');
    startGame();
  }
};

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((reg) => console.log('Service Worker Registered:', reg.scope))
      .catch((err) => console.log('Service Worker Registration Failed:', err));
  });
}

// Start Main Game Loop
requestAnimationFrame(gameLoop);
