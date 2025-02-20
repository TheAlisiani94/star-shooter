// Game State and Configuration
const KEY = { 
    LEFT: 37, 
    RIGHT: 39, 
    UP: 38, 
    DOWN: 40, 
    SPACE: 32 
};
let canvas, ctx, player, bullets = [], enemies = [];
let score = 0, isPaused = false, soundEnabled = true, gameActive = false;
const difficultySettings = {
    easy: { enemySpeed: 2, spawnRate: 2000 },
    medium: { enemySpeed: 3.5, spawnRate: 1500 },
    hard: { enemySpeed: 5, spawnRate: 1000 }
};

// Audio Setup
const sounds = {
    shoot: new Howl({
        src: ['Sounds/Gun Shots.mp3'],
        volume: 0.6,
        sprite: {
            shoot: [0, 300]
        }
    }),
    bgm: new Howl({
        src: ['Sounds/Battle in Space (Orchestral).wav'],
        loop: true,
        volume: 0.5
    }),
    explosion: new Howl({
        src: ['Sounds/Explosion.mp3'],
        volume: 0.7
    }),
    menuMusic: new Howl({
        src: ['Sounds/StudioKolomna - Main Track.mp3'],
        loop: true,
        volume: 0.4
    })
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    sounds.menuMusic.play();
    
    const shipPreviewCtx = document.getElementById('shipPreview').getContext('2d');
    let currentBackground = 'space';

    // Ship color preview
    function drawShipPreview(color) {
		const previewCtx = document.getElementById('shipPreview').getContext('2d');
		previewCtx.clearRect(0, 0, 100, 60);
		
		// Draw full ship preview
		previewCtx.save();
		previewCtx.translate(50, 30);
		
		// Main body
		previewCtx.fillStyle = color;
		previewCtx.beginPath();
		previewCtx.moveTo(-20, -10);
		previewCtx.lineTo(-15, 20);
		previewCtx.lineTo(15, 20);
		previewCtx.lineTo(20, -10);
		previewCtx.closePath();
		previewCtx.fill();

		// Cockpit
		previewCtx.fillStyle = '#87CEEB';
		previewCtx.beginPath();
		previewCtx.moveTo(-10, -5);
		previewCtx.lineTo(0, -15);
		previewCtx.lineTo(10, -5);
		previewCtx.closePath();
		previewCtx.fill();

		// Wings
		previewCtx.fillStyle = color;
		previewCtx.beginPath();
		previewCtx.moveTo(-25, 5);
		previewCtx.lineTo(-40, 15);
		previewCtx.lineTo(-25, 15);
		previewCtx.lineTo(-15, 10);
		previewCtx.lineTo(15, 10);
		previewCtx.lineTo(25, 15);
		previewCtx.lineTo(40, 15);
		previewCtx.lineTo(25, 5);
		previewCtx.closePath();
		previewCtx.fill();

		previewCtx.restore();
	}

    document.getElementById('shipColor').addEventListener('input', function(e) {
        drawShipPreview(e.target.value);
    });

    // Background change handler
    document.getElementById('background').addEventListener('change', function(e) {
		const gameContainer = document.querySelector('.game-container');
		gameContainer.className = `container-fluid position-relative vh-100 bg-${e.target.value}`;
		
		// Maintain black base for space background
		if(e.target.value === 'space') {
			gameContainer.style.backgroundColor = '#000';
		} else {
			gameContainer.style.backgroundColor = '';
		}
	});

    // Initialize game
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    new bootstrap.Modal(document.getElementById('settingsModal')).show();
    
    document.getElementById('startGame').addEventListener('click', () => {
        sounds.menuMusic.stop();
        sounds.bgm.play();
        initGame();
    });
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    drawShipPreview(document.getElementById('shipColor').value);
});

// Core Game Functions
function initGame() {
    const settings = {
        difficulty: document.getElementById('difficulty').value,
        color: document.getElementById('shipColor').value,
        angles: parseInt(document.getElementById('angles').value),
        country: document.getElementById('country').value
    };

    player = {
        x: canvas.width/2,
        y: canvas.height - 100,  // Start at bottom center
        width: 40,
        height: 60,
        color: settings.color,
        angles: settings.angles,
        speed: 8,
        lastShot: 0,
        fireRate: 250,
        hits: 0,
        maxHits: 3
    };

    resetGameState();
    setupEventListeners();
    startGameSystems(settings.difficulty);
}


function resetGameState() {
    score = 0;
    bullets = [];
    enemies = [];
    gameActive = true;
    player.hits = 0;
    document.getElementById('currentScore').textContent = '0';
    document.getElementById('hitCounter').textContent = '3';
}

function setupEventListeners() {
    document.addEventListener('keydown', handleControls);
    document.getElementById('pauseBtn').addEventListener('click', togglePause);
    document.getElementById('soundBtn').addEventListener('click', toggleSound);
}

function startGameSystems(difficulty) {
    sounds.bgm.play();
    gameLoop();
    startEnemySpawner(difficulty);
}

// Game Loop and Rendering
function gameLoop() {
    if(!gameActive || isPaused) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updatePlayer();
    updateBullets();
    updateEnemies();
    checkCollisions();
    requestAnimationFrame(gameLoop);
}

function updatePlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    
    // Main body (color customizable)
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.moveTo(-20, -10);
    ctx.lineTo(-15, 20);
    ctx.lineTo(15, 20);
    ctx.lineTo(20, -10);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = '#87CEEB';
    ctx.beginPath();
    ctx.moveTo(-10, -5);
    ctx.lineTo(0, -15);
    ctx.lineTo(10, -5);
    ctx.closePath();
    ctx.fill();

    // Wings
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.moveTo(-25, 5);
    ctx.lineTo(-40, 15);
    ctx.lineTo(-25, 15);
    ctx.lineTo(-15, 10);
    ctx.lineTo(15, 10);
    ctx.lineTo(25, 15);
    ctx.lineTo(40, 15);
    ctx.lineTo(25, 5);
    ctx.closePath();
    ctx.fill();

    // Afterburner
    ctx.fillStyle = '#FF4500';
    ctx.beginPath();
    ctx.moveTo(-15, 20);
    ctx.lineTo(0, 30);
    ctx.lineTo(15, 20);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

// Game Mechanics
function handleControls(e) {
    if(!gameActive) return;
    
    const moveStep = player.speed;
    switch(e.keyCode) {
        case KEY.LEFT: 
            player.x = Math.max(20, player.x - moveStep);
            break;
        case KEY.RIGHT: 
            player.x = Math.min(canvas.width - 20, player.x + moveStep);
            break;
        case KEY.UP:
            player.y = Math.max(20, player.y - moveStep);
            break;
        case KEY.DOWN:
            player.y = Math.min(canvas.height - 20, player.y + moveStep);
            break;
        case KEY.SPACE: 
            shoot(); 
            break;
    }
}


function shoot() {
    const now = Date.now();
    if(now - player.lastShot < player.fireRate) return;
    
    const angles = [];
    switch(player.angles) {
        case 1: angles.push(0); break;
        case 3: angles.push(-15, 0, 15); break;
        case 5: angles.push(-30, -15, 0, 15, 30); break;
    }

    angles.forEach(angle => {
        bullets.push({
            x: player.x,
            y: player.y,
            dx: Math.sin(angle * Math.PI/180),
            dy: -Math.cos(angle * Math.PI/180),
            speed: 12
        });
    });

    player.lastShot = now;
    if(soundEnabled) {
        sounds.shoot.stop();
        sounds.shoot.play('shoot');
    }
}

// Enemy System
function startEnemySpawner(difficulty) {
    const settings = difficultySettings[difficulty];
    setInterval(() => {
        if(!gameActive) return;
        enemies.push(createEnemy());
    }, settings.spawnRate);
}

function createEnemy() {
    return {
        x: Math.random() * (canvas.width - 50),
        y: -50,
        width: 40,
        height: 40,
        type: Math.random() < 0.2 ? 'special' : 'normal',
        speed: difficultySettings[document.getElementById('difficulty').value].enemySpeed * (Math.random() * 0.5 + 0.75)
    };
}

function updateEnemies() {
    enemies.forEach((enemy, index) => {
        enemy.y += enemy.speed;
        drawEnemy(enemy);
        if(enemy.y > canvas.height + 50) enemies.splice(index, 1);
    });
}

function drawEnemy(enemy) {
    ctx.fillStyle = enemy.type === 'special' ? '#ff00ff' : '#00ffff';
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, 20, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.fillText(getCountryFlag(), enemy.x - 8, enemy.y + 5);
}

// Utility Functions
function getCountryFlag() {
    const country = document.getElementById('country').value;
    const flags = { usa: '🇺🇸', uk: '🇬🇧', japan: '🇯🇵' };
    return flags[country] || '🚀';
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function togglePause() {
    isPaused = !isPaused;
    if(gameActive && !isPaused) gameLoop();
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    Howler.mute(!soundEnabled);
    document.getElementById('soundBtn').innerHTML = 
        `<i class="fas fa-volume-${soundEnabled ? 'up' : 'mute'}"></i>`;
}

// Collision and Game State Management
function checkCollisions() {
    // Bullet-enemy collisions
    bullets.forEach((bullet, bIndex) => {
        enemies.forEach((enemy, eIndex) => {
            if(checkCollision(bullet, enemy)) {
                handleCollision(bIndex, eIndex, enemy);
            }
        });
    });

    // Player-enemy collisions
    enemies.forEach((enemy, eIndex) => {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if(distance < 50) {
            handlePlayerHit(eIndex);
        }
    });
}

function checkCollision(bullet, enemy) {
    const dx = bullet.x - enemy.x;
    const dy = bullet.y - enemy.y;
    return Math.sqrt(dx*dx + dy*dy) < 25;
}

function handleCollision(bIndex, eIndex, enemy) {
    score += enemy.type === 'special' ? 150 : 100;
    document.getElementById('currentScore').textContent = score;
    createExplosion(enemy.x, enemy.y);
    bullets.splice(bIndex, 1);
    enemies.splice(eIndex, 1);
    if(soundEnabled) sounds.explosion.play();
}

function handlePlayerHit(enemyIndex) {
    enemies.splice(enemyIndex, 1);
    player.hits++;
    document.getElementById('hitCounter').textContent = 3 - player.hits;
    createExplosion(player.x, player.y);
    
    if(soundEnabled) sounds.explosion.play();
    
    if(player.hits >= player.maxHits) {
        gameOver();
    }
}

function gameOver() {
    gameActive = false;
    sounds.bgm.stop();
    Howler.stop();
    
    const highScore = Math.max(score, localStorage.getItem('highScore') || 0);
    localStorage.setItem('highScore', highScore);
    
    document.getElementById('finalScore').textContent = score;
    document.getElementById('highScore').textContent = highScore;
    new bootstrap.Modal(document.getElementById('gameOverModal')).show();
}

function createExplosion(x, y) {
    const explosion = document.createElement('div');
    explosion.className = 'explosion';
    explosion.style.left = `${x - 20}px`;
    explosion.style.top = `${y - 20}px`;
    document.body.appendChild(explosion);
    setTimeout(() => explosion.remove(), 500);
}

// Bullet Management
function updateBullets() {
    bullets.forEach((bullet, index) => {
        bullet.x += bullet.dx * bullet.speed;
        bullet.y += bullet.dy * bullet.speed;
        drawBullet(bullet);
        if(bullet.y < -10) bullets.splice(index, 1);
    });
}

function drawBullet(bullet) {
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(bullet.x - 2, bullet.y - 6, 4, 12);
}