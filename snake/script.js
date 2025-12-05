// --- CONSTANTES ET VARIABLES GLOBALES ---
const BOARD_SIZE = 20;

// Configurations des modes de difficulté
const DIFFICULTY_SETTINGS = {
    'easy': { speed: 200, stopChance: 150, turboChance: 300, inversionChance: 600, wallChance: 0 },
    'medium': { speed: 150, stopChance: 100, turboChance: 200, inversionChance: 400, wallChance: 200 }, // Chance d'apparition des murs
    'hard': { speed: 100, stopChance: 50, turboChance: 100, inversionChance: 200, wallChance: 100 }
};

const TURBO_SPEED = 75; 
const TURBO_DURATION = 1500;
const STOP_DURATION = 500;
const INVERSION_DURATION = 7000;
const MAGNET_DURATION = 5000;

// Définition des skins et de leurs prix
const SKIN_PRICES = {
    'default': 0,
    'red': 50,
    'gold': 150,
    'rainbow': 300,
    'diamond_food': 75 // Nouveau skin de nourriture
};

// Variables dynamiques pour les paramètres de jeu (initialisés à 'medium')
let gameSpeed = DIFFICULTY_SETTINGS['medium'].speed;
let stopChance = DIFFICULTY_SETTINGS['medium'].stopChance;
let turboChance = DIFFICULTY_SETTINGS['medium'].turboChance;
let inversionChance = DIFFICULTY_SETTINGS['medium'].inversionChance;
let wallChance = DIFFICULTY_SETTINGS['medium'].wallChance;

// Variable pour le skin du serpent (par défaut)
let snakeSkin = 'default';

// Variables pour la monnaie et les skins débloqués (chargées/sauvegardées localement)
let playerCoins = loadPlayerCoins(); 
let unlockedSkins = loadUnlockedSkins(); 

// États du jeu
let snake = [{ x: 10, y: 10 }]; 
let food = {};
let direction = { x: 0, y: 0 };
let lastDirection = { x: 0, y: 0 };
let score = 0;
let gameInterval;
let isTurbo = false;
let isStopped = false;
let areControlsInverted = false;
let inversionTimeout;
let inversionCountdownInterval;

// Murs aléatoires et Power-ups
let walls = [];
let powerUp = {};
let isMagnetActive = false;
let isFoodDiamond = false;
let magnetTimeout;

// Éléments DOM
const gameBoard = document.getElementById('game-board'); 
const gameBoardPreview = document.getElementById('game-board-preview'); 
const scoreDisplay = document.getElementById('score');
const leaderboardList = document.getElementById('leaderboard-list');
const inversionTimerDisplay = document.getElementById('inversion-timer');
const selectionScreen = document.getElementById('selection-screen'); 
const gameWrapper = document.getElementById('game-wrapper');
const startGameButton = document.getElementById('start-game-button');
const backToMenuButton = document.getElementById('back-to-menu-button'); 
const coinsDisplay = document.getElementById('player-coins');
const skinOptionGroup = document.getElementById('snake-skin-options');
const powerUpDisplay = document.getElementById('powerup-display');


// --- FONCTIONS DE GESTION DE LA MONNAIE/SKINS ---

function loadPlayerCoins() {
    const coins = localStorage.getItem('snakeCoins');
    return coins !== null ? parseInt(coins) : 0;
}

function savePlayerCoins() {
    localStorage.setItem('snakeCoins', playerCoins);
    if (coinsDisplay) {
        coinsDisplay.textContent = `COINS: ${playerCoins} 💰`;
    }
}

function loadUnlockedSkins() {
    const skins = localStorage.getItem('unlockedSkins');
    return skins ? JSON.parse(skins) : ['default'];
}

function saveUnlockedSkins() {
    localStorage.setItem('unlockedSkins', JSON.stringify(unlockedSkins));
}

function updateCoinsAfterGame(finalScore) {
    // Gagne 1 Coin pour 10 points de score
    const coinsGained = Math.floor(finalScore / 10);
    playerCoins += coinsGained;
    savePlayerCoins();
    
    if (coinsGained > 0) {
        // Affiche un message si des coins ont été gagnés
        alert(`Félicitations ! Vous avez gagné ${coinsGained} Coins pour votre score de ${finalScore} ! Solde total : ${playerCoins} 💰`);
    } else {
        alert(`Vous n'avez pas gagné de Coins pour cette partie.`);
    }
}

function buySkin(skinName, price, button) {
    if (playerCoins >= price) {
        playerCoins -= price;
        unlockedSkins.push(skinName);
        
        savePlayerCoins();
        saveUnlockedSkins();
        
        alert(`Félicitations ! Le skin '${skinName}' est débloqué.`);
        
        updateSkinButtons();
        
        if (skinName !== 'diamond_food') {
             snakeSkin = skinName;
             resetPreview();
        } else {
            isFoodDiamond = true;
            resetPreview();
        }
    } else {
        alert(`Vous n'avez pas assez de Coins. Il vous manque ${price - playerCoins} Coins.`);
    }
}

function updateSkinButtons() {
    if (!skinOptionGroup) return;

    skinOptionGroup.innerHTML = '';
    
    isFoodDiamond = unlockedSkins.includes('diamond_food');

    Object.keys(SKIN_PRICES).forEach(skinName => {
        const price = SKIN_PRICES[skinName];
        const isUnlocked = unlockedSkins.includes(skinName);
        const isSnakeSkin = !skinName.includes('_food');
        
        const button = document.createElement('button');
        button.dataset.skin = skinName;
        button.classList.add('skin-button');
        
        const displayName = skinName.replace('_food', ' (Nourriture)').charAt(0).toUpperCase() + skinName.slice(1).replace('_food', ' (Nourriture)');
        button.textContent = displayName;
        
        if (isSnakeSkin) {
            if (skinName === snakeSkin) {
                button.classList.add('selected');
            }
        } else { 
            if (isUnlocked && skinName === 'diamond_food') {
                button.classList.add('selected'); 
            }
        }
        
        if (isUnlocked) {
            button.textContent += isSnakeSkin ? ' (Sélectionner)' : ' (Actif)';
            button.addEventListener('click', () => {
                if (isSnakeSkin) {
                    document.querySelectorAll('.skin-button').forEach(b => {
                        if (!b.dataset.skin.includes('_food')) { 
                            b.classList.remove('selected');
                        }
                    });
                    button.classList.add('selected');
                    snakeSkin = button.dataset.skin;
                    resetPreview();
                } else {
                    alert("Ce skin de nourriture est actif ! Il est appliqué automatiquement.");
                }
            });
        } else {
            button.textContent += ` (${price} 💰)`;
            button.classList.add('buy-button');
            button.addEventListener('click', () => {
                buySkin(skinName, price, button);
            });
        }
        
        skinOptionGroup.appendChild(button);
    });
}


// --- FONCTIONS UTILITAIRES DE JEU ---

function placeObject(excludedCells) {
    let position;
    do {
        position = {
            x: Math.floor(Math.random() * BOARD_SIZE),
            y: Math.floor(Math.random() * BOARD_SIZE)
        };
    } while (excludedCells.some(cell => cell.x === position.x && cell.y === position.y));
    return position;
}

function placeFood() {
    const excludedCells = [...snake, ...walls, powerUp];
    food = placeObject(excludedCells);
}

function placePowerUp() {
    // 10% de chance d'apparition (augmentation)
    if (Math.random() < 0.10) { 
        const excludedCells = [...snake, ...walls, food];
        powerUp = placeObject(excludedCells);
        
        // Types de power-up : 1. Aimant (35%), 2. Nettoyeur (35%), 3. Mega Coin (30%)
        const typeRoll = Math.random();
        if (typeRoll < 0.35) {
            powerUp.type = 'magnet';
        } else if (typeRoll < 0.70) {
            powerUp.type = 'cleaner';
        } else {
            powerUp.type = 'megacoin';
        }
    } else {
         powerUp = {}; // Aucun power-up
    }
}

function addWall() {
    if (wallChance > 0 && Math.random() < 1 / wallChance) {
        const newWall = placeObject([...snake, ...walls, food, powerUp]); 
        walls.push(newWall);
    }
}

function activateMagnet() {
    if (isMagnetActive) return;

    isMagnetActive = true;
    powerUpDisplay.textContent = "Aimant Actif 🧲";
    powerUpDisplay.style.display = 'block';

    magnetTimeout = setTimeout(() => {
        isMagnetActive = false;
        powerUpDisplay.textContent = "";
        powerUpDisplay.style.display = 'none';
    }, MAGNET_DURATION);
}

function activateCleaner() {
    if (snake.length > 5) { 
        const segmentsToRemove = Math.floor(snake.length / 2);
        snake.splice(snake.length - segmentsToRemove);
        score = Math.max(0, score - segmentsToRemove * 5); 
        scoreDisplay.textContent = `SCORE: ${score}`;
        
        // Affichage rapide du bonus
        powerUpDisplay.textContent = `Nettoyeur: -${segmentsToRemove} ✂️`;
        powerUpDisplay.style.display = 'block';
        setTimeout(() => {
            if (!isMagnetActive) {
                powerUpDisplay.style.display = 'none';
                powerUpDisplay.textContent = "";
            }
        }, 1000);
        
    } else {
         // Affichage rapide du message d'échec
        powerUpDisplay.textContent = "Trop court 🙅‍♂️";
        powerUpDisplay.style.display = 'block';
        setTimeout(() => {
            if (!isMagnetActive) {
                powerUpDisplay.style.display = 'none';
                powerUpDisplay.textContent = "";
            }
        }, 1000);
    }
}

function consumeMegaCoin() {
    score += 50; 
    playerCoins += 10; 
    savePlayerCoins();
    scoreDisplay.textContent = `SCORE: ${score}`;
    
    // Affichage rapide du bonus
    powerUpDisplay.textContent = "✨ Mega Coin: +50pts +10💰";
    powerUpDisplay.style.display = 'block';
    setTimeout(() => {
         if (!isMagnetActive) {
            powerUpDisplay.style.display = 'none';
            powerUpDisplay.textContent = "";
        }
    }, 1500);
}

function createGrid(targetBoard) {
    if (!targetBoard) return; 

    targetBoard.innerHTML = '';
    for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.x = x;
            cell.dataset.y = y;
            targetBoard.appendChild(cell);
        }
    }
}

function drawGame(targetBoard) {
    const boardToDraw = targetBoard || (selectionScreen.style.display !== 'none' ? gameBoardPreview : gameBoard);
    
    if (!boardToDraw) return;

    const allSkinClasses = ['snake-default', 'snake-red', 'snake-gold', 'snake-rainbow'];

    boardToDraw.querySelectorAll('.cell').forEach(cell => {
        cell.classList.remove('food', 'wall', 'power-up', 'power-up-magnet', 'power-up-cleaner', 'power-up-megacoin', ...allSkinClasses, 'diamond-food-skin');
        cell.style.backgroundColor = ''; 
    });

    // 1. Dessin du serpent
    const skinClass = `snake-${snakeSkin}`;
    snake.forEach(segment => {
        const cell = boardToDraw.querySelector(`.cell[data-x="${segment.x}"][data-y="${segment.y}"]`);
        if (cell) {
            cell.classList.add(skinClass); 
            if (snakeSkin === 'default') {
                cell.style.backgroundColor = '#3f90b0'; 
            } else if (snakeSkin === 'red') {
                cell.style.backgroundColor = '#ff004c'; 
            }
        }
    });

    // 2. Dessin des murs
    walls.forEach(wall => {
        const wallCell = boardToDraw.querySelector(`.cell[data-x="${wall.x}"][data-y="${wall.y}"]`);
        if (wallCell) {
            wallCell.classList.add('wall');
        }
    });

    // 3. Dessin de la nourriture
    const foodCell = boardToDraw.querySelector(`.cell[data-x="${food.x}"][data-y="${food.y}"]`);
    if (foodCell) {
        foodCell.classList.add('food');
        if (unlockedSkins.includes('diamond_food')) {
            foodCell.classList.add('diamond-food-skin'); 
        } else {
            foodCell.classList.remove('diamond-food-skin');
        }
    }
    
    // 4. Dessin du Power-up
    if (powerUp.type) {
        const powerUpCell = boardToDraw.querySelector(`.cell[data-x="${powerUp.x}"][data-y="${powerUp.y}"]`);
        if (powerUpCell) {
            powerUpCell.classList.add('power-up', `power-up-${powerUp.type}`);
        }
    }
}

function setGameInterval(speed) {
    clearInterval(gameInterval);
    gameInterval = setInterval(moveSnake, speed);
}

function activateTurbo() {
    if (isTurbo) return;

    isTurbo = true;
    setGameInterval(TURBO_SPEED);

    setTimeout(() => {
        isTurbo = false;
        if (direction.x !== 0 || direction.y !== 0) { 
            setGameInterval(gameSpeed); 
        }
    }, TURBO_DURATION);
}

function activateInversion() {
    if (areControlsInverted) return;

    areControlsInverted = true;
    inversionTimerDisplay.style.display = 'block';

    let timeLeft = INVERSION_DURATION / 1000;
    
    inversionTimerDisplay.textContent = `INVERSÉ: ${timeLeft}s`;
    inversionTimerDisplay.style.color = '#e94560'; 

    inversionTimeout = setTimeout(() => {
        areControlsInverted = false;
        clearInterval(inversionCountdownInterval);
        inversionTimerDisplay.textContent = "";
        inversionTimerDisplay.style.display = 'none';
        setGameInterval(gameSpeed); 
    }, INVERSION_DURATION);
    
    setGameInterval(gameSpeed + 50);

    inversionCountdownInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
             inversionTimerDisplay.textContent = `INVERSÉ: ${timeLeft}s`;
        }
    }, 1000);
}

function checkOriginalFeatures() {
    // 1. Turbo Aléatoire
    if (!isTurbo && !isStopped && Math.random() < 1 / turboChance) {
        activateTurbo();
    }
    
    // 2. Arrêt Aléatoire
    if ((direction.x !== 0 || direction.y !== 0) && !isStopped && Math.random() < 1 / stopChance) {
        isStopped = true;
        lastDirection = direction; 
        direction = { x: 0, y: 0 }; 

        setTimeout(() => {
            isStopped = false;
            if (direction.x === 0 && direction.y === 0) { 
                 direction = lastDirection; 
            }
        }, STOP_DURATION);
    }

    // 3. Inversion Aléatoire
    if (!isTurbo && !isStopped && !areControlsInverted && Math.random() < 1 / inversionChance) {
        activateInversion();
    }
}


// --- FONCTION PRINCIPALE DE JEU (BOUCLE) ---

function moveSnake() {
    
    checkOriginalFeatures();
    addWall(); 
    
    if (direction.x === 0 && direction.y === 0) return; 

    lastDirection = direction; 
    let moveDirection = { x: direction.x, y: direction.y }; // Direction par défaut est celle du joueur

    // Aimant : ajuste la direction vers la nourriture si elle est proche
    if (isMagnetActive) {
        const head = snake[0];
        const distanceX = food.x - head.x;
        const distanceY = food.y - head.y;
        
        // Active l'attraction si la nourriture est dans un rayon de 3 cases
        if (Math.abs(distanceX) <= 3 && Math.abs(distanceY) <= 3) {
            let dx = 0;
            let dy = 0;
            
            // Prioriser le mouvement sur l'axe où la distance est la plus grande
            if (Math.abs(distanceX) > Math.abs(distanceY)) {
                dx = distanceX > 0 ? 1 : -1;
            } else {
                dy = distanceY > 0 ? 1 : -1;
            }
            
            const attractionDirection = { x: dx, y: dy };
            
            // L'aimant modifie le mouvement, à condition qu'il ne s'agisse pas d'un virage à 180 degrés
            // moveDirection est la direction choisie par l'utilisateur (direction)
            if (attractionDirection.x !== -moveDirection.x || attractionDirection.y !== -moveDirection.y) {
                 moveDirection = attractionDirection; 
            }
        }
    }


    const newHead = {
        x: snake[0].x + moveDirection.x, // Utilise moveDirection
        y: snake[0].y + moveDirection.y
    };
    
    // Détection de collision (Mur, bordures, corps)
    if (newHead.x < 0 || newHead.x >= BOARD_SIZE ||
        newHead.y < 0 || newHead.y >= BOARD_SIZE ||
        snake.some(segment => segment.x === newHead.x && segment.y === newHead.y) ||
        walls.some(wall => wall.x === newHead.x && wall.y === newHead.y)) { 
        
        // 1. ARRÊT DU JEU
        clearInterval(gameInterval);
        clearTimeout(inversionTimeout); 
        clearInterval(inversionCountdownInterval); 
        clearTimeout(magnetTimeout);
        
        // 2. SAUVEGARDE DU SCORE
        saveLeaderboard(score); 
        
        // 3. COLLECTE DE L'ARGENT (COINS)
        updateCoinsAfterGame(score); 

        alert(`GAME OVER! Votre score final : ${score}`); 
        
        // 4. RETOUR AU MENU PRINCIPAL
        gameWrapper.style.display = 'none';
        selectionScreen.style.display = 'block';
        
        inversionTimerDisplay.style.display = 'none'; 
        powerUpDisplay.style.display = 'none';
        return;
    }

    // Gestion du mouvement
    snake.unshift(newHead);
    
    // Vérification des Power-ups
    if (powerUp.type && newHead.x === powerUp.x && newHead.y === powerUp.y) {
        if (powerUp.type === 'magnet') {
            activateMagnet();
        } else if (powerUp.type === 'cleaner') {
            activateCleaner();
        } else if (powerUp.type === 'megacoin') {
            consumeMegaCoin();
        }
        powerUp = {}; 
        placeFood();
        placePowerUp(); 
    }

    // Gestion de la nourriture
    if (newHead.x === food.x && newHead.y === food.y) {
        score += 10;
        scoreDisplay.textContent = `SCORE: ${score}`;
        placeFood();
        placePowerUp(); 
    } else {
        snake.pop(); 
    }

    drawGame(gameBoard); 
}


// --- FONCTIONS D'ÉVÉNEMENTS ---
function handleKeyPress(event) {
    let dx = 0;
    let dy = 0;

    switch (event.key) {
        case 'ArrowUp':
        case 'z':
            dy = -1; 
            break;
        case 'ArrowDown':
        case 's':
            dy = 1; 
            break;
        case 'ArrowLeft':
        case 'q':
            dx = -1; 
            break;
        case 'ArrowRight':
        case 'd':
            dx = 1; 
            break;
    }

    if (dx === 0 && dy === 0) return;

    if (areControlsInverted) {
        dx *= -1;
        dy *= -1;
    }

    // Empêche le virage à 180 degrés
    if (dx !== -direction.x || dy !== -direction.y) {
        direction = { x: dx, y: dy };
    }
    
    if (direction.x !== 0 || direction.y !== 0) {
        lastDirection = direction; 
    }
}

function startGame() {
    clearInterval(gameInterval); 
    clearTimeout(inversionTimeout); 
    clearInterval(inversionCountdownInterval); 
    clearTimeout(magnetTimeout);
    
    // Position et état initial du jeu
    snake = [{ x: 10, y: 10 }];
    direction = { x: 0, y: 0 };
    lastDirection = { x: 0, y: 0 };
    isTurbo = false; 
    isStopped = false;
    areControlsInverted = false; 
    isMagnetActive = false;
    walls = []; 
    powerUp = {}; 
    
    score = 0;
    scoreDisplay.textContent = `SCORE: 0`;
    inversionTimerDisplay.style.display = 'none'; 
    powerUpDisplay.style.display = 'none';

    createGrid(gameBoard); 
    placeFood();
    placePowerUp();
    drawGame(gameBoard);
    setGameInterval(gameSpeed);
}

function resetPreview() {
    if (!gameBoardPreview) return;
    
    createGrid(gameBoardPreview); 
    
    const center = Math.floor(BOARD_SIZE / 2);
    snake = [
        { x: center, y: center },
        { x: center - 1, y: center },
        { x: center - 2, y: center }
    ];
    
    food = { x: center + 5, y: center - 5 }; 
    walls = [{ x: center - 5, y: center - 5 }]; 
    powerUp = { x: center + 5, y: center + 5, type: 'magnet' }; 
    
    drawGame(gameBoardPreview);
    
    savePlayerCoins();
    updateSkinButtons();
}

// --- LEADERBOARD & INITIALISATION ---

function loadLeaderboard() {
    const scoresJson = localStorage.getItem('snakeLeaderboard');
    return scoresJson ? JSON.parse(scoresJson).sort((a, b) => b.score - a.score) : [];
}

function displayLeaderboard(leaderboard) {
    if (!leaderboardList) return;
    leaderboardList.innerHTML = '';
    leaderboard.forEach((entry, index) => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <span>#${index + 1} ${entry.name}</span>
            <span>${entry.score}</span>
        `;
        leaderboardList.appendChild(listItem);
    });
}

function saveLeaderboard(currentScore) {
    let leaderboard = loadLeaderboard();
    
    // Demander le nom de l'utilisateur uniquement si le score est supérieur à 0
    if (currentScore > 0) {
        let playerName = prompt(`Nouveau score de ${currentScore} ! Entrez votre nom pour le classement :`) || 'Anonyme';
        playerName = playerName.trim().substring(0, 15); // Limiter la longueur
        
        // --- NOUVELLE LOGIQUE POUR LE MEILLEUR SCORE UNIQUE ---
        
        const existingIndex = leaderboard.findIndex(entry => entry.name.toLowerCase() === playerName.toLowerCase());
        
        if (existingIndex !== -1) {
            // Le joueur existe déjà
            if (currentScore > leaderboard[existingIndex].score) {
                // Mettre à jour si c'est un meilleur score
                leaderboard[existingIndex].score = currentScore;
                leaderboard[existingIndex].date = new Date().toLocaleDateString();
                alert(`Nouveau meilleur score pour ${playerName}!`);
            } else {
                alert(`Dommage, votre meilleur score précédent de ${leaderboard[existingIndex].score} est conservé.`);
            }
        } else {
            // Nouveau joueur
            leaderboard.push({ name: playerName, score: currentScore, date: new Date().toLocaleDateString() });
            alert(`Bienvenue ${playerName}! Votre score est enregistré.`);
        }
        
        // --- FIN NOUVELLE LOGIQUE ---
        
        // Trier par score (les meilleurs scores seront en tête) et limiter au Top 10
        leaderboard.sort((a, b) => b.score - a.score);
        leaderboard = leaderboard.slice(0, 10); 

        localStorage.setItem('snakeLeaderboard', JSON.stringify(leaderboard));
        displayLeaderboard(leaderboard);
    }
}

function setupSelectionListeners() {
    // 1. Listeners pour la difficulté
    document.querySelectorAll('.mode-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.mode-button').forEach(b => b.classList.remove('selected'));
            button.classList.add('selected');
            const difficulty = button.dataset.difficulty;
            const settings = DIFFICULTY_SETTINGS[difficulty];
            
            gameSpeed = settings.speed;
            stopChance = settings.stopChance;
            turboChance = settings.turboChance;
            inversionChance = settings.inversionChance;
            wallChance = settings.wallChance; 
        });
    });

    // 2. Listeners pour le fond d'écran
    document.querySelectorAll('.bg-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.bg-button').forEach(b => b.classList.remove('selected'));
            button.classList.add('selected');
            applyBackground(button.dataset.background);
        });
    });
    
    // 3. Bouton JOUER
    startGameButton.addEventListener('click', () => {
        selectionScreen.style.display = 'none';
        gameWrapper.style.display = 'flex'; 
        startGame(); 
    });

    // 4. Bouton Retour au Menu
    backToMenuButton.addEventListener('click', () => {
        clearInterval(gameInterval); 
        clearTimeout(inversionTimeout); 
        clearInterval(inversionCountdownInterval); 
        clearTimeout(magnetTimeout);
        gameWrapper.style.display = 'none';
        selectionScreen.style.display = 'block';
        
        resetPreview(); 
    });
}

function applyBackground(theme) {
    document.body.className = `theme-${theme}`;
}

document.addEventListener('keydown', handleKeyPress);

document.addEventListener('DOMContentLoaded', () => {
    applyBackground('neon'); 
    setupSelectionListeners();
    displayLeaderboard(loadLeaderboard());
    
    if (gameBoardPreview) {
        resetPreview();
    }
});