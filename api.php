<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Sécurité à vérifier en production
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

// --- PARAMÈTRES DE CONNEXION À LA BASE DE DONNÉES ---
$host = 'localhost';
$db   = 'nom_de_votre_base'; // VOTRE BDD
$user = 'utilisateur_bdd';   // VOTRE USER
$pass = 'mot_de_passe_bdd';  // VOTRE MDP
$charset = 'utf8mb4';
$questions_to_fetch = 8;

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erreur de connexion BDD: ' . $e->getMessage()]);
    exit();
}

// Déterminer l'action demandée
$action = $_REQUEST['action'] ?? 'questions';

if ($action === 'leaderboard') {
    // ----------------------------------------------------
    // ACTION 1: FETCH LEADERBOARD (GET)
    // ----------------------------------------------------
    try {
        $stmt = $pdo->query("SELECT player_name, score, DATE_FORMAT(date_achieved, '%d/%m/%Y') as date FROM leaderboard ORDER BY score DESC, date_achieved ASC LIMIT 10");
        echo json_encode(['success' => true, 'leaderboard' => $stmt->fetchAll()]);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erreur de lecture du classement: ' . $e->getMessage()]);
    }

} elseif ($action === 'submit' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    // ----------------------------------------------------
    // ACTION 2: SUBMIT SCORE (POST)
    // ----------------------------------------------------
    $data = json_decode(file_get_contents('php://input'), true);
    $name = trim($data['name'] ?? '');
    $score = (int)($data['score'] ?? 0);

    // Validation simple
    if (empty($name) || $score <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nom ou score invalide.']);
        exit();
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO leaderboard (player_name, score) VALUES (?, ?)");
        $stmt->execute([substr($name, 0, 50), $score]); // Limite le nom à 50 caractères
        echo json_encode(['success' => true, 'message' => 'Score enregistré !']);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erreur lors de l\'enregistrement: ' . $e->getMessage()]);
    }

} else {
    // ----------------------------------------------------
    // ACTION 3: FETCH QUESTIONS (DEFAULT GET)
    // ----------------------------------------------------
    try {
        $sql = "
            SELECT id, type, question_text, data_json, description, analogy 
            FROM questions_souverainete 
            ORDER BY RAND() 
            LIMIT :limit
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':limit', $questions_to_fetch, PDO::PARAM_INT);
        $stmt->execute();
        $questions = $stmt->fetchAll();

        $gameQuestions = [];
        foreach ($questions as $q) {
            $data = json_decode($q['data_json'], true);
            $gameQuestions[] = [
                'id' => $q['id'],
                'type' => $q['type'],
                'q' => $q['question_text'],
                'desc' => $q['description'],
                'analogie' => $q['analogy'],
                'data' => $data 
            ];
        }

        echo json_encode($gameQuestions);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erreur de lecture des questions: ' . $e->getMessage()]);
    }
}
?>