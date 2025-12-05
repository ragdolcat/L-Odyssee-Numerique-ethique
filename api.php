<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

// --- PARAMÈTRES DE CONNEXION À LA BASE DE DONNÉES (MIS À JOUR) ---
// Extrait de: mysql://Odyssee_wallsheet:eeeb055c7daccfaebff1f9773478e8146256026b@lpri1s.h.filess.io:61002/Odyssee_wallsheet

$user = 'if0_40603312';   
$pass = '5FEZxVrgx0bcj';  
$host = 'sql103.infinityfree.com';
$port = '3306';
$db   = 'if0_40603312_oddyssee'; 

$charset = 'utf8mb4';
$questions_to_fetch = 8;

// Construction de la DSN (incluant le port)
$dsn = "mysql:host=$host;port=$port;dbname=$db;charset=$charset";

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