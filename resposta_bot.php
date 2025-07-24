<?php
// Ativar exibição de erros
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Dados de conexão (os mesmos do cadastro.php)
$host = 'localhost';
$db   = 'u440519781_cadastro_site'; 
$user = 'u440519781_arijunior';   
$pass = 'Arijr1234'; 

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['erro' => 'Erro de conexão com o banco de dados: ' . $conn->connect_error]);
    exit;
}

// Recebe os dados do bot
$nome     = trim($_POST['nome'] ?? '');
$telefone = trim($_POST['telefone'] ?? '');
$q1 = trim($_POST['q1'] ?? '');
$q2 = trim($_POST['q2'] ?? '');
$q3 = trim($_POST['q3'] ?? '');
$q4 = trim($_POST['q4'] ?? '');
$q5 = trim($_POST['q5'] ?? '');
$q6 = trim($_POST['q6'] ?? '');
$q7 = trim($_POST['q7'] ?? '');
$q8 = trim($_POST['q8'] ?? '');

// Insere na tabela
$stmt = $conn->prepare("INSERT INTO respostas_bot (nome, telefone, q1, q2, q3, q4, q5, q6, q7, q8) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['erro' => 'Erro ao preparar statement: ' . $conn->error]);
    exit;
}
$stmt->bind_param("ssssssssss", $nome, $telefone, $q1, $q2, $q3, $q4, $q5, $q6, $q7, $q8);

if ($stmt->execute()) {
    echo json_encode(['sucesso' => true, 'mensagem' => 'Resposta salva com sucesso!']);
} else {
    http_response_code(500);
    echo json_encode(['erro' => 'Erro ao executar statement: ' . $stmt->error]);
}

$stmt->close();
$conn->close(); 
file_put_contents('debug.txt', print_r($_POST, true)); 