// --- CONFIGURATION ---
// Retiré : const questionPool est maintenant remplacé par le fetching
const QUESTIONS_PER_GAME = 8;
const BASE_TIME = 25; // Secondes
const API_URL = 'api.php';

// --- LOGIQUE DU JEU ---
let currentQuestions = [];
let currentIndex = 0;
let score = 0;
let timerObj;
let timeLeft = BASE_TIME;
let gameActive = false;

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
    finalScore: document.getElementById('final-score'),
    playerNameInput: document.getElementById('player-name-input'),
    submitScoreBtn: document.getElementById('submit-score-btn'),
    submissionMessage: document.getElementById('submission-message'),
    leaderboardContainer: document.getElementById('leaderboard-container')
};

// Initialisation
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
dom.nextBtn.addEventListener('click', nextQuestion);
dom.submitScoreBtn.addEventListener('click', submitScore);

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

async function startGame() {
    score = 0;
    currentIndex = 0;
    
    dom.startScreen.classList.add('hide');
    dom.endScreen.classList.add('hide');
    dom.gameScreen.classList.remove('hide');
    dom.score.innerText = '0';
    
    // 1. Récupération des questions avant de commencer
    currentQuestions = await fetchQuestions(); 

    if (currentQuestions.length > 0) {
        loadQuestion();
    } else {
        // Gérer le cas où la base de données est vide ou l'API a échoué
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

    // Rendu selon le type (le type est maintenant dans qData.type)
    if (qData.type === 'choice') renderChoice(qData);
    else if (qData.type === 'match') renderMatch(qData);
    else if (qData.type === 'gap') renderGap(qData);

    startTimer();
}

// --- RENDU : QCM ---
function renderChoice(qData) {
    const grid = document.createElement('div');
    grid.className = 'options-grid';
    qData.options.forEach((opt, idx) => {
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
    stopGame(idx === qData.correct);
    
    // Visuel
    const buttons = document.querySelectorAll('.option-btn');
    buttons[qData.correct].classList.add('correct');
    if (idx !== qData.correct) btn.classList.add('wrong');
}

// --- RENDU : ASSOCIATION (MATCH) ---
let matchesFound = 0;
let selectedLeft = null;
let totalPairs = 0;

function renderMatch(qData) {
    matchesFound = 0;
    totalPairs = qData.pairs.length;
    selectedLeft = null;

    const container = document.createElement('div');
    container.className = 'match-container';

    // Mélanger colonnes
    const leftItems = qData.pairs.map((p, i) => ({txt: p.left, id: i}));
    const rightItems = qData.pairs.map((p, i) => ({txt: p.right, id: i})).sort(() => 0.5 - Math.random());

    const colLeft = document.createElement('div'); colLeft.className = 'match-column';
    const colRight = document.createElement('div'); colRight.className = 'match-column';

    leftItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'match-card';
        div.innerText = item.txt;
        div.dataset.id = item.id;
        div.onclick = () => handleMatchClick(div, 'left');
        colLeft.appendChild(div);
    });

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

    // Si clic gauche
    if(side === 'left') {
        if(selectedLeft) selectedLeft.classList.remove('selected');
        selectedLeft = div;
        div.classList.add('selected');
    } 
    // Si clic droit
    else if(side === 'right' && selectedLeft) {
        if(selectedLeft.dataset.id === div.dataset.id) {
            // Match !
            selectedLeft.classList.add('matched');
            div.classList.add('matched');
            selectedLeft.classList.remove('selected');
            selectedLeft = null;
            matchesFound++;
            if(matchesFound === totalPairs) stopGame(true);
        } else {
            // Pas match
            div.classList.add('wrong');
            setTimeout(() => div.classList.remove('wrong'), 500);
        }
    }
}

// --- RENDU : TEXTE A TROUS (GAP) ---
function renderGap(qData) {
    const container = document.createElement('div');
    
    // Phrase
    const p = document.createElement('p');
    p.className = 'sentence-container';
    const parts = qData.sentence.split('[1]');
    p.innerHTML = `${parts[0]}<span class="gap-spot" id="gap-target">???</span>${parts[1]}`;
    container.appendChild(p);

    // Mots
    const bank = document.createElement('div');
    bank.className = 'word-bank';
    const allWords = [...qData.answers, ...qData.fake].sort(() => 0.5 - Math.random());
    
    allWords.forEach(word => {
        const tag = document.createElement('div');
        tag.className = 'word-tag';
        tag.innerText = word;
        tag.onclick = () => {
            if(!gameActive) return;
            const target = document.getElementById('gap-target');
            target.innerText = word;
            // Vérification immédiate
            if(word === qData.answers[0]) {
                target.style.color = "var(--success)";
                stopGame(true);
            } else {
                target.style.color = "var(--error)";
                tag.style.background = "#fab1a0"; // rouge pâle
            }
        };
        bank.appendChild(tag);
    });

    container.appendChild(bank);
    dom.interactionArea.appendChild(container);
}

// --- GESTION GLOBALE ---

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
    
    // Construction explication + analogie
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
    if(currentIndex < QUESTIONS_PER_GAME) {
        loadQuestion();
    } else {
        endGame();
    }
}

function endGame() {
    dom.gameScreen.classList.add('hide');
    dom.endScreen.classList.remove('hide');
    dom.finalScore.innerText = score;
    
    // Afficher la zone de soumission et le classement
    document.getElementById('score-submission-area').classList.remove('hide');
    dom.submissionMessage.innerText = '';
    
    const msg = document.getElementById('final-message');
    if(score > 1500) msg.innerText = "🥇 Excellent ! Le monde du Libre n'a plus de secrets pour vous.";
    else if(score > 800) msg.innerText = "🥈 Bien joué ! Vous avez compris l'essentiel.";
    else msg.innerText = "🥉 C'est un début ! Continuez à explorer ces sujets importants.";
    
    // Afficher le classement
    displayLeaderboard();
}

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
            displayLeaderboard(); // Recharger le classement
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