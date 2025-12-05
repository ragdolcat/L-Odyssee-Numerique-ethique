// --- CONFIGURATION ---
const BASE_TIME = 25; // Secondes pour répondre
const API_URL = 'api.php'; // Chemin vers le fichier API PHP

// --- LOGIQUE GLOBALE DU JEU ---
let currentQuestions = [];
let currentIndex = 0;
let score = 0;
let timerObj;
let timeLeft = BASE_TIME;
let gameActive = false;

// --- ÉLÉMENTS DOM ---
const dom = {
    startScreen: document.getElementById('start-screen'),
    gameScreen: document.getElementById('game-screen'),
    endScreen: document.getElementById('end-screen'),
    interactionArea: document.getElementById('interaction-area'),
    questionText: document.getElementById('question-text'),
    score: document.getElementById('score'),
    timerBar: document.getElementById('timer-bar'),
    feedbackArea: document.getElementById('feedback-area'),
    feedbackText: document.getElementById('feedback-text'),
    feedbackTitle: document.getElementById('feedback-title'),
    nextBtn: document.getElementById('next-btn'),
    
    // Éléments du Leaderboard
    finalScore: document.getElementById('final-score'),
    playerNameInput: document.getElementById('player-name-input'),
    submitScoreBtn: document.getElementById('submit-score-btn'),
    submissionMessage: document.getElementById('submission-message'),
    leaderboardContainer: document.getElementById('leaderboard-container')
};

// --- INITIALISATION & LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', startGame);
    dom.nextBtn.addEventListener('click', nextQuestion);
    dom.submitScoreBtn.addEventListener('click', submitScore);
});


// --- GESTION DE LA BASE DE DONNÉES (FETCHING) ---

async function fetchQuestions() {
    dom.questionText.innerText = "Chargement des questions depuis la base de données...";
    dom.interactionArea.innerHTML = '';
    
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        return data;

    } catch (error) {
        console.error("Erreur de récupération des questions:", error);
        dom.questionText.innerText = `Échec du chargement : ${error.message}. Vérifiez api.php et la connexion BDD.`;
        return [];
    }
}

// --- GESTION DU JEU ---

async function startGame() {
    score = 0;
    currentIndex = 0;
    
    dom.startScreen.classList.add('hide');
    dom.endScreen.classList.add('hide');
    dom.gameScreen.classList.remove('hide');
    dom.score.innerText = '0';
    
    currentQuestions = await fetchQuestions(); 

    if (currentQuestions.length > 0) {
        loadQuestion();
    } else {
        dom.questionText.innerText = "Aucune question chargée. Veuillez vérifier la connexion à la base de données.";
    }
}

function loadQuestion() {
    const qData = currentQuestions[currentIndex];
    gameActive = true;
    timeLeft = BASE_TIME;
    
    // UI Updates
    document.getElementById('question-count').innerText = `${currentIndex + 1}/${currentQuestions.length}`;
    dom.questionText.innerText = qData.q;
    dom.interactionArea.innerHTML = ''; // Clear previous
    dom.feedbackArea.classList.add('hide');
    dom.nextBtn.style.display = 'none';

    // Rendu selon le type
    if (qData.type === 'choice') renderChoice(qData);
    else if (qData.type === 'match') renderMatch(qData);
    else if (qData.type === 'gap') renderGap(qData);

    startTimer();
}

function stopGame(isWin) {
    gameActive = false;
    clearInterval(timerObj);
    dom.timerBar.style.transition = 'none';

    const qData = currentQuestions[currentIndex];
    
    if(isWin) {
        const pts = 100 + (timeLeft * 10);
        score += pts;
        dom.feedbackTitle.innerText = "✅ Bravo !";
        dom.feedbackTitle.style.color = "var(--success)";
    } else {
        dom.feedbackTitle.innerText = "❌ Dommage...";
        dom.feedbackTitle.style.color = "var(--error)";
    }

    dom.score.innerText = score;
    
    let html = `<strong>Explication :</strong> ${qData.desc}`;
    if(qData.analogie) {
        html += `<br><span class="analogie">💡 Analogie : ${qData.analogie}</span>`;
    }
    dom.feedbackText.innerHTML = html;
    
    dom.feedbackArea.classList.remove('hide');
    dom.nextBtn.style.display = 'inline-block';
}

function nextQuestion() {
    currentIndex++;
    if(currentIndex < currentQuestions.length) {
        loadQuestion();
    } else {
        endGame();
    }
}

function startTimer() {
    clearInterval(timerObj);
    dom.timerBar.style.transition = 'none';
    dom.timerBar.style.transform = 'scaleX(1)';
    void dom.timerBar.offsetWidth; // Force reflow
    dom.timerBar.style.transition = `transform ${BASE_TIME}s linear`;
    dom.timerBar.style.transform = 'scaleX(0)';

    timerObj = setInterval(() => {
        timeLeft--;
        if(timeLeft <= 0) stopGame(false);
    }, 1000);
}

function endGame() {
    dom.gameScreen.classList.add('hide');
    dom.endScreen.classList.remove('hide');
    dom.finalScore.innerText = score;
    
    document.getElementById('score-submission-area').classList.remove('hide');
    dom.submissionMessage.innerText = '';
    
    const msg = document.getElementById('final-message');
    if(score > 1500) msg.innerText = "🥇 Excellent ! Le monde du Libre n'a plus de secrets pour vous.";
    else if(score > 800) msg.innerText = "🥈 Bien joué ! Vous avez compris l'essentiel.";
    else msg.innerText = "🥉 C'est un début ! Continuez à explorer ces sujets importants.";
    
    displayLeaderboard();
}

// --- RENDU ET VÉRIFICATION DES RÉPONSES (CORRIGÉ POUR ACCÉDER À qData.data.*) ---

// 1. QCM
function renderChoice(qData) {
    const options = qData.data.options; // CORRIGÉ
    
    const grid = document.createElement('div');
    grid.className = 'options-grid';
    options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = () => checkChoice(idx, btn, qData);
        grid.appendChild(btn);
    });
    dom.interactionArea.appendChild(grid);
}

function checkChoice(idx, btn, qData) {
    if(!gameActive) return;
    
    // CORRIGÉ : accès via qData.data.correct
    stopGame(idx === qData.data.correct); 
    
    const buttons = document.querySelectorAll('.option-btn');
    buttons[qData.data.correct].classList.add('correct'); // CORRIGÉ
    if (idx !== qData.data.correct) btn.classList.add('wrong'); // CORRIGÉ
}


// 2. ASSOCIATION
let matchesFound = 0;
let selectedLeft = null;
let totalPairs = 0;

function renderMatch(qData) {
    // --- CORRECTION CLÉ : Accès direct à qData.data ---
    const pairs = qData.data; // <--- C'EST ICI LA CORRECTION
    
    matchesFound = 0;
    totalPairs = pairs.length;
    selectedLeft = null;

    const container = document.createElement('div');
    container.className = 'match-container';

    // Création des listes à afficher
    const leftItems = pairs.map((p, i) => ({txt: p.left, id: i}));
    const rightItems = pairs.map((p, i) => ({txt: p.right, id: i})).sort(() => 0.5 - Math.random());

    const colLeft = document.createElement('div'); colLeft.className = 'match-column';
    const colRight = document.createElement('div'); colRight.className = 'match-column';

    // Rendu de la colonne de gauche
    leftItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'match-card';
        div.innerText = item.txt;
        div.dataset.id = item.id;
        div.onclick = () => handleMatchClick(div, 'left');
        colLeft.appendChild(div);
    });

    // Rendu de la colonne de droite
    rightItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'match-card';
        div.innerText = item.txt;
        div.dataset.id = item.id;
        div.onclick = () => handleMatchClick(div, 'right');
        colRight.appendChild(div);
    });

    container.appendChild(colLeft);
    container.appendChild(colRight);
    dom.interactionArea.appendChild(container);
}

function handleMatchClick(div, side) {
    if(!gameActive || div.classList.contains('matched')) return;

    if(side === 'left') {
        if(selectedLeft) selectedLeft.classList.remove('selected');
        selectedLeft = div;
        div.classList.add('selected');
    } 
    else if(side === 'right' && selectedLeft) {
        if(selectedLeft.dataset.id === div.dataset.id) {
            selectedLeft.classList.add('matched');
            div.classList.add('matched');
            selectedLeft.classList.remove('selected');
            selectedLeft = null;
            matchesFound++;
            if(matchesFound === totalPairs) stopGame(true);
        } else {
            div.classList.add('wrong');
            setTimeout(() => div.classList.remove('wrong'), 500);
        }
    }
}


// 3. TEXTE À TROUS
function renderGap(qData) {
    const sentence = qData.data.sentence; // CORRIGÉ
    const answers = qData.data.answers;   // CORRIGÉ
    const fake = qData.data.fake;         // CORRIGÉ
    
    const container = document.createElement('div');
    
    const p = document.createElement('p');
    p.className = 'sentence-container';
    const parts = sentence.split('[1]'); // Utilise 'sentence' corrigée
    p.innerHTML = `${parts[0]}<span class="gap-spot" id="gap-target">???</span>${parts[1]}`;
    container.appendChild(p);

    const bank = document.createElement('div');
    bank.className = 'word-bank';
    
    const allWords = [...answers, ...fake].sort(() => 0.5 - Math.random()); // Utilise 'answers' et 'fake' corrigés
    
    allWords.forEach(word => {
        const tag = document.createElement('div');
        tag.className = 'word-tag';
        tag.innerText = word;
        tag.onclick = () => {
            if(!gameActive) return;
            const target = document.getElementById('gap-target');
            target.innerText = word;
            
            // CORRIGÉ : Accès via qData.data.answers
            if(word === qData.data.answers[0]) { 
                target.style.color = "var(--success)";
                stopGame(true);
            } else {
                target.style.color = "var(--error)";
                tag.style.background = "#fab1a0";
            }
        };
        bank.appendChild(tag);
    });

    container.appendChild(bank);
    dom.interactionArea.appendChild(container);
}


// --- GESTION DU LEADERBOARD ---

async function submitScore() {
    const name = dom.playerNameInput.value.trim();
    if (name.length < 2) {
        dom.submissionMessage.innerText = "Veuillez entrer au moins 2 caractères.";
        return;
    }

    dom.submitScoreBtn.disabled = true;
    dom.submissionMessage.innerText = "Enregistrement en cours...";

    try {
        const response = await fetch(`${API_URL}?action=submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, score: score })
        });
        
        const result = await response.json();

        if (result.success) {
            dom.submissionMessage.innerText = `🥳 Score de ${score} enregistré avec succès !`;
            document.getElementById('score-submission-area').classList.add('hide');
            displayLeaderboard();
        } else {
            dom.submissionMessage.innerText = `Échec de l'enregistrement: ${result.message}`;
        }
    } catch (error) {
        console.error("Erreur de soumission:", error);
        dom.submissionMessage.innerText = "Erreur réseau lors de l'enregistrement.";
    } finally {
        dom.submitScoreBtn.disabled = false;
    }
}

async function displayLeaderboard() {
    dom.leaderboardContainer.innerHTML = '<p>Chargement du classement...</p>';

    try {
        const response = await fetch(`${API_URL}?action=leaderboard`);
        const result = await response.json();

        if (result.success && result.leaderboard.length > 0) {
            let html = '<ol>';
            result.leaderboard.forEach((item, index) => {
                const rank = index + 1;
                const medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : ''));
                html += `<li>${medal} <strong>${item.player_name}</strong> - ${item.score} pts (${item.date})</li>`;
            });
            html += '</ol>';
            dom.leaderboardContainer.innerHTML = html;
        } else {
            dom.leaderboardContainer.innerHTML = '<p>Aucun score enregistré pour l\'instant. Soyez le premier !</p>';
        }
    } catch (error) {
        console.error("Erreur de récupération du classement:", error);
        dom.leaderboardContainer.innerHTML = '<p style="color:red;">Erreur lors du chargement du classement.</p>';
    }
}