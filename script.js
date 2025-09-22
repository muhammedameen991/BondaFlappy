const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Bird
let birdX = 80;
let birdY = 300;
let birdRadius = 15;
let velocity = 0;

// Load Bird Image
const birdImg = new Image();
birdImg.src = "images/bonda.png";

// Load sounds
const jumpSound = new Audio("sounds/jump.mp3");
const hitSound = new Audio("sounds/hit.mp3");
const pointSound = new Audio("sounds/point.mp3");

// Pipes
let pipes = [];
let pipeWidth = 50;

// Score and game state
let score = 0;
let gameOver = false;

// Difficulty levels
const difficulty = {
  easy:   { gravity: 0.4, lift: -7, pipeGap: 180, pipeSpeed: 2 },
  medium: { gravity: 0.5, lift: -8, pipeGap: 140, pipeSpeed: 3 },
  hard:   { gravity: 0.6, lift: -9, pipeGap: 110, pipeSpeed: 4 }
};

// Current difficulty
let level = "easy"; // "easy", "medium", "hard"
let gravity = difficulty[level].gravity;
let lift = difficulty[level].lift;
let pipeGap = difficulty[level].pipeGap;
let pipeSpeed = difficulty[level].pipeSpeed;

// Draw Bird
function drawBird() {
  ctx.drawImage(
    birdImg,
    birdX - birdRadius,
    birdY - birdRadius,
    birdRadius * 6,
    birdRadius * 6
  );
}

// Draw Pipes
function drawPipes() {
  ctx.fillStyle = "green";
  for (let pipe of pipes) {
    ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top);
    ctx.fillRect(pipe.x, pipe.bottom, pipeWidth, canvas.height - pipe.bottom);
  }
}

// Update Pipes
function updatePipes() {
  for (let pipe of pipes) {
    pipe.x -= pipeSpeed;

    // Collision detection
    if (
      birdX + birdRadius > pipe.x &&
      birdX - birdRadius < pipe.x + pipeWidth &&
      (birdY - birdRadius < pipe.top || birdY + birdRadius > pipe.bottom)
    ) {
      if (!gameOver) {
        gameOver = true;
        hitSound.currentTime = 0;
        hitSound.play();
      }
    }

    // Scoring
    if (!pipe.scored && pipe.x + pipeWidth < birdX) {
      score++;
      pipe.scored = true;
      pointSound.currentTime = 0;
      pointSound.play();
    }
  }

  // Remove off-screen pipes
  if (pipes.length > 0 && pipes[0].x < -pipeWidth) {
    pipes.shift();
  }

  // Add new pipes
  if (pipes.length === 0 || pipes[pipes.length - 1].x < canvas.width - 200) {
    let pipeTop = Math.random() * (canvas.height - pipeGap - 100) + 50;
    let pipeBottom = pipeTop + pipeGap;
    pipes.push({
      x: canvas.width,
      top: pipeTop,
      bottom: pipeBottom,
      scored: false,
    });
  }
}

// Update Bird
function updateBird() {
  velocity += gravity;
  birdY += velocity;

  if (birdY + birdRadius > canvas.height || birdY - birdRadius < 0) {
    if (!gameOver) {
      gameOver = true;
      hitSound.currentTime = 0;
      hitSound.play();
    }
  }
}

// Draw Score
function drawScore() {
  ctx.fillStyle = "#ffcc00"; // yellow
  ctx.font = "bold 24px 'Comic Sans MS', Arial";
  ctx.textAlign = "left";
  ctx.fillText("Score: " + score, 20, 40);
}

// Restart Game
function restartGame() {
  birdY = 300;
  velocity = 0;
  pipes = [];
  score = 0;
  gameOver = false;
  pipes.push({ x: canvas.width, top: 150, bottom: 150 + pipeGap, scored: false });
  canvas.removeEventListener("click", restartClick);
  gameLoop();
}

// Handle click for restart button
function restartClick(e) {
  let rect = canvas.getBoundingClientRect();
  let mouseX = e.clientX - rect.left;
  let mouseY = e.clientY - rect.top;

  if (
    mouseX > canvas.width / 2 - 70 &&
    mouseX < canvas.width / 2 + 70 &&
    mouseY > canvas.height / 2 + 40 &&
    mouseY < canvas.height / 2 + 90
  ) {
    restartGame();
  }
}

// Hover effect for restart button
canvas.addEventListener("mousemove", function(e) {
  let rect = canvas.getBoundingClientRect();
  let mouseX = e.clientX - rect.left;
  let mouseY = e.clientY - rect.top;

  if (
    gameOver &&
    mouseX > canvas.width / 2 - 70 &&
    mouseX < canvas.width / 2 + 70 &&
    mouseY > canvas.height / 2 + 40 &&
    mouseY < canvas.height / 2 + 90
  ) {
    canvas.style.cursor = "pointer";
  } else {
    canvas.style.cursor = "default";
  }
});

// Difficulty switch
function setDifficulty(newLevel) {
  level = newLevel;
  gravity = difficulty[level].gravity;
  lift = difficulty[level].lift;
  pipeGap = difficulty[level].pipeGap;
  pipeSpeed = difficulty[level].pipeSpeed;
}



// Game Loop
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameOver) {
    // Background overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Game Over text
    ctx.fillStyle = "#ff4444";
    ctx.font = "bold 50px 'Comic Sans MS', Arial";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 40);

    // Final Score
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 25px Arial";
    ctx.fillText("Final Score: " + score, canvas.width / 2, canvas.height / 2 + 5);

    // Restart Button
    ctx.fillStyle = "#00ccff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.fillRect(canvas.width / 2 - 70, canvas.height / 2 + 40, 140, 50);
    ctx.strokeRect(canvas.width / 2 - 70, canvas.height / 2 + 40, 140, 50);

    // Restart text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Restart", canvas.width / 2, canvas.height / 2 + 75);

    canvas.addEventListener("click", restartClick);
    return;
  }

  drawBird();
  drawPipes();
  updatePipes();
  updateBird();
  drawScore();

  requestAnimationFrame(gameLoop);
}

// Controls
window.addEventListener("keydown", function(e) {
  if (e.code === "Space" && !gameOver) {
    velocity = lift;
    jumpSound.currentTime = 0;
    jumpSound.play();
  }
});
// Mobile touch control
window.addEventListener("touchstart", function(e) {
    if (!gameOver) {
        velocity = lift;           // make the bird jump
        jumpSound.currentTime = 0;
        jumpSound.play();
    } else {
        restartGame();             // tap to restart if game over
    }
}, { passive: false });



// Start the game
pipes.push({ x: canvas.width, top: 150, bottom: 150 + pipeGap, scored: false });
gameLoop();
