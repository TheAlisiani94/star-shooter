// Game State and Configuration
const KEY = { 
    LEFT: 37, 
    RIGHT: 39, 
    UP: 38, 
    DOWN: 40, 
    SPACE: 32,
    SHIFT: 16 // NEW: Special ability key
};
let canvas, ctx, player, bullets = [], enemies = [], powerUps = [], particles = [];
let score = 0, isPaused = false, soundEnabled = true, gameActive = false;
let level = 1, highScore = { score: localStorage.getItem('highScore') || 0, player: localStorage.getItem('highScorePlayer') || 'Unknown' };
let enemiesDestroyed = 0, bossesDefeated = 0; // NEW: Stats tracking
const difficultySettings = {
    easy: { baseEnemySpeed: 2, baseSpawnRate: 2000 },
    medium: { baseEnemySpeed: 3.5, baseSpawnRate: 1500 },
    hard: { baseEnemySpeed: 5, baseSpawnRate: 1000 }
};

// Mobile detection and modal reference
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let settingsModal, enemySpawnInterval;

// Audio Setup
const sounds = {
    shoot: new Howl({ src: ['Sounds/Gun Shots.mp3'], volume: 0.6, sprite: { shoot: [0, 300] } }),
    bgm: new Howl({ src: ['Sounds/Battle in Space (Orchestral).wav'], loop: true, volume: 0.5 }),
    explosion: new Howl({ src: ['Sounds/Explosion.mp3'], volume: 0.7 }),
    menuMusic: new Howl({ src: ['Sounds/StudioKolomna - Main Track.mp3'], loop: true, volume: 0.4 }),
    // NEW: Power-up and special sounds
    powerUp: new Howl({ src: ['Sounds/PowerUp.wav'], volume: 0.5 }),
    special: new Howl({ src: ['Sounds/SpecialBoom.wav'], volume: 0.8 })
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    sounds.menuMusic.play();
    
    settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
    settingsModal.show();

    const shipPreviewCtx = document.getElementById('shipPreview').getContext('2d');

    function drawShipPreview(color) {
        const previewCtx = document.getElementById('shipPreview').getContext('2d');
        previewCtx.clearRect(0, 0, 100, 60);
        previewCtx.save();
        previewCtx.translate(50, 30);
        
        previewCtx.fillStyle = color;
        previewCtx.beginPath();
        previewCtx.moveTo(-20, -10);
        previewCtx.lineTo(-15, 20);
        previewCtx.lineTo(15, 20);
        previewCtx.lineTo(20, -10);
        previewCtx.closePath();
        previewCtx.fill();

        previewCtx.fillStyle = '#87CEEB';
        previewCtx.beginPath();
        previewCtx.moveTo(-10, -5);
        previewCtx.lineTo(0, -15);
        previewCtx.lineTo(10, -5);
        previewCtx.closePath();
        previewCtx.fill();

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

    document.getElementById('background').addEventListener('change', function(e) {
        const gameContainer = document.querySelector('.container-fluid');
        gameContainer.className = `container-fluid position-relative vh-100 bg-${e.target.value}`;
    });

    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    drawShipPreview(document.getElementById('shipColor').value);

    document.getElementById('startGame').addEventListener('click', () => {
        settingsModal.hide();
        sounds.menuMusic.stop();
        sounds.bgm.play();
        initGame();
    });

    document.getElementById('exitGame').addEventListener('click', () => {
        window.close();
    });

    window.addEventListener('resize', resizeCanvas);
});

// Core Game Functions
function initGame() {
    const settings = {
        difficulty: document.getElementById('difficulty').value,
        color: document.getElementById('shipColor').value,
        angles: parseInt(document.getElementById('angles').value),
        playerName: document.getElementById('playerName').value || 'Player'
    };

    player = {
        x: canvas.width/2,
        y: canvas.height - 100,
        width: 40,
        height: 60,
        color: settings.color,
        angles: settings.angles,
        speed: settings.angles === 1 ? 10 : 8,
        lastShot: 0,
        fireRate: 250,
        hits: 0,
        maxHits: 3,
        name: settings.playerName,
        shootingMode: settings.angles,
        // NEW: Special ability and power-up states
        specialCharge: 0,
        specialMax: 1000,
        shield: false,
        shieldTime: 0
    };

    resetGameState();
    setupEventListeners();
    startGameSystems(settings.difficulty);
}

function resetGameState() {
    score = 0;
    bullets = [];
    enemies = [];
    powerUps = [];
    particles = [];
    gameActive = true;
    player.hits = 0;
    level = 1;
    enemiesDestroyed = 0;
    bossesDefeated = 0;
    document.getElementById('currentScore').textContent = '0';
    document.getElementById('hitCounter').textContent = '3';
    document.getElementById('currentLevel').textContent = '1';
}

function setupEventListeners() {
    document.addEventListener('keydown', handleControls);
    canvas.addEventListener('click', handleShoot);
    canvas.addEventListener('touchend', handleShoot);
    
    if(isMobile) {
        document.getElementById('shootButton').addEventListener('touchstart', handleShoot);
        // NEW: Special ability button for mobile
        document.getElementById('specialButton').addEventListener('touchstart', useSpecial);
        let touchStartX = 0, touchStartY = 0;
        canvas.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            e.preventDefault();
        });
        
        canvas.addEventListener('touchmove', (e) => {
            if(!gameActive) return;
            const touch = e.touches[0];
            const moveX = touch.clientX - touchStartX;
            const moveY = touch.clientY - touchStartY;
            player.x = Math.max(20, Math.min(canvas.width - 20, player.x + moveX));
            player.y = Math.max(20, Math.min(canvas.height - 20, player.y + moveY));
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            e.preventDefault();
        });
    }

    document.getElementById('pauseBtn').addEventListener('click', togglePause);
    document.getElementById('soundBtn').addEventListener('click', toggleSound);
    document.getElementById('homeBtn').addEventListener('click', () => {
        gameActive = false;
        sounds.bgm.stop();
        settingsModal.show();
        document.getElementById('pauseOverlay').style.display = 'none';
        isPaused = false;
    });
}

function handleShoot(e) {
    e.preventDefault();
    shoot();
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
    updatePowerUps();
    updateParticles();
    checkCollisions();
    checkLevelProgression();
    requestAnimationFrame(gameLoop);
}

function updatePlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.moveTo(-20, -10);
    ctx.lineTo(-15, 20);
    ctx.lineTo(15, 20);
    ctx.lineTo(20, -10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#87CEEB';
    ctx.beginPath();
    ctx.moveTo(-10, -5);
    ctx.lineTo(0, -15);
    ctx.lineTo(10, -5);
    ctx.closePath();
    ctx.fill();

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

    ctx.fillStyle = '#FF4500';
    ctx.beginPath();
    ctx.moveTo(-15, 20);
    ctx.lineTo(0, 30);
    ctx.lineTo(15, 20);
    ctx.closePath();
    ctx.fill();

    // NEW: Shield effect
    if(player.shield) {
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.stroke();
        player.shieldTime--;
        if(player.shieldTime <= 0) player.shield = false;
    }

    // NEW: Thruster particles
    for(let i = 0; i < 3; i++) {
        particles.push({
            x: player.x + (Math.random() - 0.5) * 10,
            y: player.y + 30,
            dx: (Math.random() - 0.5) * 2,
            dy: 2 + Math.random() * 2,
            size: 2 + Math.random() * 2,
            life: 20,
            color: '#FF4500'
        });
    }

    ctx.restore();
}

// Game Mechanics
function handleControls(e) {
    if(!gameActive) return;
    switch(e.keyCode) {
        case KEY.LEFT: 
            player.x = Math.max(20, player.x - player.speed);
            break;
        case KEY.RIGHT: 
            player.x = Math.min(canvas.width - 20, player.x + player.speed);
            break;
        case KEY.UP:
            player.y = Math.max(20, player.y - player.speed);
            break;
        case KEY.DOWN:
            player.y = Math.min(canvas.height - 20, player.y + player.speed);
            break;
        case KEY.SPACE: 
            shoot();
            break;
        case KEY.SHIFT: // NEW: Special ability
            useSpecial();
            break;
    }
}

function shoot() {
    const now = Date.now();
    if(now - player.lastShot < player.fireRate) return;
    
    const angles = [];
    switch(player.shootingMode) {
        case 1: angles.push(0); break;
        case 3: angles.push(-15, 0, 15); break;
        case 5: angles.push(-30, -15, 0, 15, 30); break;
        case 7:
            for(let i = -45; i <= 45; i += 15) angles.push(i);
            break;
    }

    angles.forEach(angle => {
        bullets.push({
            x: player.x,
            y: player.y,
            dx: Math.sin(angle * Math.PI/180),
            dy: -Math.cos(angle * Math.PI/180),
            speed: 12 + level * 0.5
        });
    });

    player.lastShot = now;
    if(soundEnabled) {
        sounds.shoot.stop();
        sounds.shoot.play('shoot');
    }
}

// NEW: Special Ability
function useSpecial() {
    if(player.specialCharge >= player.specialMax) {
        player.specialCharge = 0;
        enemies.forEach((enemy, index) => {
            createExplosion(enemy.x, enemy.y);
            enemies.splice(index, 1);
            enemiesDestroyed++;
            if(enemy.type === 'boss') bossesDefeated++;
            score += enemy.type === 'boss' ? 500 : 100;
        });
        if(soundEnabled) sounds.special.play();
        document.getElementById('currentScore').textContent = score;
    }
}

// Enemy System
function startEnemySpawner(difficulty) {
    const settings = difficultySettings[difficulty];
    if(enemySpawnInterval) clearInterval(enemySpawnInterval);
    enemySpawnInterval = setInterval(() => {
        if(!gameActive || isPaused) return;
        enemies.push(createEnemy());
    }, settings.baseSpawnRate / (1 + level * 0.1));
}

function createEnemy() {
    const types = ['star', 'planet', 'wormhole', 'asteroid', 'boss'];
    const type = level >= 5 && Math.random() < 0.1 ? 'boss' : types[Math.floor(Math.random() * (types.length - 1))];
    const colors = [
        '#FF0000', '#00FF00', '#0000FF', '#FF00FF', '#FFFF00', '#00FFFF',
        '#FF69B4', '#7FFF00', '#00CED1', `hsl(${Math.random() * 360}, 100%, 50%)`
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];

    return {
        x: Math.random() * (canvas.width - 50),
        y: -50,
        width: type === 'boss' ? 80 : 40,
        height: type === 'boss' ? 80 : 40,
        type: type,
        speed: difficultySettings[document.getElementById('difficulty').value].baseEnemySpeed * (1 + level * 0.2) * (Math.random() * 0.5 + 0.75),
        color: color,
        health: type === 'boss' ? 5 : 1,
        // NEW: Boss phase and attack
        phase: type === 'boss' ? 1 : 0,
        lastAttack: 0
    };
}

function updateEnemies() {
    enemies.forEach((enemy, index) => {
        enemy.y += enemy.speed;
        if(enemy.type === 'boss') updateBoss(enemy);
        drawEnemy(enemy);
        if(enemy.y > canvas.height + 50) enemies.splice(index, 1);
    });
}

function updateBoss(enemy) {
    const now = Date.now();
    if(now - enemy.lastAttack > 2000) { // Attack every 2 seconds
        enemy.lastAttack = now;
        if(enemy.phase === 1 && enemy.health <= 3) enemy.phase = 2;

        if(enemy.phase === 1) {
            // Phase 1: Shoot downward bullets
            bullets.push({
                x: enemy.x,
                y: enemy.y + 40,
                dx: 0,
                dy: 1,
                speed: 8,
                isEnemyBullet: true
            });
        } else if(enemy.phase === 2) {
            // Phase 2: Shoot spread bullets
            for(let i = -30; i <= 30; i += 15) {
                bullets.push({
                    x: enemy.x,
                    y: enemy.y + 40,
                    dx: Math.sin(i * Math.PI / 180),
                    dy: Math.cos(i * Math.PI / 180),
                    speed: 8,
                    isEnemyBullet: true
                });
            }
        }
    }
}

function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = enemy.color;

    switch(enemy.type) {
        case 'star':
            ctx.beginPath();
            for(let i = 0; i < 5; i++) {
                ctx.lineTo(Math.cos(Math.PI * 2 * i / 5) * 20, Math.sin(Math.PI * 2 * i / 5) * 20);
                ctx.lineTo(Math.cos(Math.PI * (2 * i + 1) / 5) * 10, Math.sin(Math.PI * (2 * i + 1) / 5) * 10);
            }
            ctx.closePath();
            ctx.fill();
            break;
        case 'planet':
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(5, -5, 10, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'wormhole':
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'asteroid':
            ctx.beginPath();
            ctx.moveTo(-20, -10);
            ctx.lineTo(-10, -20);
            ctx.lineTo(10, -15);
            ctx.lineTo(20, 0);
            ctx.lineTo(15, 20);
            ctx.lineTo(-5, 15);
            ctx.lineTo(-20, 10);
            ctx.closePath();
            ctx.fill();
            break;
        case 'boss':
            ctx.beginPath();
            ctx.moveTo(-40, -40);
            ctx.lineTo(0, -20);
            ctx.lineTo(40, -40);
            ctx.lineTo(30, 0);
            ctx.lineTo(40, 40);
            ctx.lineTo(0, 20);
            ctx.lineTo(-40, 40);
            ctx.lineTo(-30, 0);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(0, -10, 10, 0, Math.PI * 2);
            ctx.fill();
            break;
    }

    ctx.restore();
}

// NEW: Power-Ups
function updatePowerUps() {
    powerUps.forEach((power, index) => {
        power.y += 2;
        drawPowerUp(power);
        if(checkCollision({ x: power.x, y: power.y }, player)) {
            applyPowerUp(power.type);
            powerUps.splice(index, 1);
            if(soundEnabled) sounds.powerUp.play();
        } else if(power.y > canvas.height) {
            powerUps.splice(index, 1);
        }
    });
}

function drawPowerUp(power) {
    ctx.save();
    ctx.translate(power.x, power.y);
    ctx.fillStyle = power.color;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(power.type[0], 0, 4);
    ctx.restore();
}

function applyPowerUp(type) {
    switch(type) {
        case 'speed':
            player.fireRate = Math.max(100, player.fireRate - 50);
            setTimeout(() => player.fireRate += 50, 10000);
            break;
        case 'shield':
            player.shield = true;
            player.shieldTime = 300; // 5 seconds at 60 FPS
            break;
        case 'life':
            player.hits = Math.max(0, player.hits - 1);
            document.getElementById('hitCounter').textContent = 3 - player.hits;
            break;
    }
}

// NEW: Particles
function updateParticles() {
    particles.forEach((particle, index) => {
        particle.x += particle.dx;
        particle.y += particle.dy;
        particle.life--;
        particle.size *= 0.95;
        if(particle.life <= 0 || particle.size < 0.1) particles.splice(index, 1);
        else drawParticle(particle);
    });
}

function drawParticle(particle) {
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
}

function checkLevelProgression() {
    const levelThreshold = level * 1000;
    if(score >= levelThreshold) {
        level++;
        player.shootingMode = Math.max(player.angles, Math.min(7, Math.floor(level / 2) * 2 + 1));
        document.getElementById('currentLevel').textContent = level;
    }
}

// Utility Functions
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function togglePause() {
    isPaused = !isPaused;
    document.getElementById('pauseOverlay').style.display = isPaused ? 'block' : 'none';
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
    bullets.forEach((bullet, bIndex) => {
        enemies.forEach((enemy, eIndex) => {
            if(checkCollision(bullet, enemy) && !bullet.isEnemyBullet) {
                handleCollision(bIndex, eIndex, enemy);
            }
        });
        // NEW: Player collision with enemy bullets
        if(bullet.isEnemyBullet && checkCollision(bullet, player) && !player.shield) {
            bullets.splice(bIndex, 1);
            handlePlayerHit(-1); // -1 indicates no enemy to splice
        }
    });

    enemies.forEach((enemy, eIndex) => {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if(distance < (enemy.type === 'boss' ? 60 : 50) && !player.shield) {
            handlePlayerHit(eIndex);
        }
    });
}

function checkCollision(obj1, obj2) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    return Math.sqrt(dx*dx + dy*dy) < (obj2.type === 'boss' ? 40 : 25);
}

function handleCollision(bIndex, eIndex, enemy) {
    enemy.health--;
    if(enemy.health <= 0) {
        score += enemy.type === 'boss' ? 500 : 100;
        enemiesDestroyed++;
        if(enemy.type === 'boss') bossesDefeated++;
        enemies.splice(eIndex, 1);
        createExplosion(enemy.x, enemy.y);
        // NEW: Power-up drop chance
        if(Math.random() < 0.2) {
            powerUps.push({
                x: enemy.x,
                y: enemy.y,
                type: ['speed', 'shield', 'life'][Math.floor(Math.random() * 3)],
                color: ['#FFFF00', '#00FFFF', '#FF00FF'][Math.floor(Math.random() * 3)]
            });
        }
    }
    bullets.splice(bIndex, 1);
    document.getElementById('currentScore').textContent = score;
    if(soundEnabled) sounds.explosion.play();
    player.specialCharge = Math.min(player.specialMax, player.specialCharge + 100);
}

function handlePlayerHit(enemyIndex) {
    if(enemyIndex >= 0) enemies.splice(enemyIndex, 1);
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
    clearInterval(enemySpawnInterval);
    
    if(score > highScore.score) {
        highScore = { score: score, player: player.name };
        localStorage.setItem('highScore', highScore.score);
        localStorage.setItem('highScorePlayer', highScore.player);
    }
    
    document.getElementById('finalScore').textContent = score;
    document.getElementById('highScorePlayer').textContent = highScore.player;
    document.getElementById('highScore').textContent = highScore.score;
    document.getElementById('enemiesDestroyed').textContent = enemiesDestroyed;
    document.getElementById('bossesDefeated').textContent = bossesDefeated;
    new bootstrap.Modal(document.getElementById('gameOverModal')).show();
}

function createExplosion(x, y) {
    const explosion = document.createElement('div');
    explosion.className = 'explosion';
    explosion.style.left = `${x - 20}px`;
    explosion.style.top = `${y - 20}px`;
    document.body.appendChild(explosion);
    setTimeout(() => explosion.remove(), 500);
    // NEW: Explosion particles
    for(let i = 0; i < 10; i++) {
        particles.push({
            x: x,
            y: y,
            dx: (Math.random() - 0.5) * 5,
            dy: (Math.random() - 0.5) * 5,
            size: 3 + Math.random() * 2,
            life: 30,
            color: '#FF8F00'
        });
    }
}

// Bullet Management
function updateBullets() {
    bullets.forEach((bullet, index) => {
        bullet.x += bullet.dx * bullet.speed;
        bullet.y += bullet.dy * bullet.speed;
        drawBullet(bullet);
        if(bullet.y < -10 || bullet.y > canvas.height + 10) bullets.splice(index, 1);
    });
}

function drawBullet(bullet) {
    ctx.fillStyle = bullet.isEnemyBullet ? '#FF00FF' : '#FF0000';
    ctx.fillRect(bullet.x - 2, bullet.y - 6, 4, 12);
}