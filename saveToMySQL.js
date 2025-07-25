import axios from 'axios';

// Função para capitalizar nome
function capitalizeName(nome) {
  return nome.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// Função para formatar telefone para (xx) xxxxx-xxxx
function formatPhone(telefone) {
  // Extrai apenas números
  const nums = telefone.replace(/\D/g, '');
  if (nums.length === 13 && nums.startsWith('55')) {
    // Remove o 55
    const ddd = nums.slice(2, 4);
    const parte1 = nums.slice(4, 9);
    const parte2 = nums.slice(9, 13);
    return `(${ddd}) ${parte1}-${parte2}`;
  } else if (nums.length === 11) {
    const ddd = nums.slice(0, 2);
    const parte1 = nums.slice(2, 7);
    const parte2 = nums.slice(7, 11);
    return `(${ddd}) ${parte1}-${parte2}`;
  }
  return telefone;
}

// Função para deixar respostas em maiúsculo
function upperAll(str) {
  if (!str) return '';
  return str.split(',').map(s => s.trim().toUpperCase()).join(',');
}

// Função para data/hora de Brasília no formato DD/MM/AAAA HH:MM:SS
function getBrasiliaDateTime() {
  const date = new Date();
  // Ajusta para UTC-3
  date.setHours(date.getHours() - (date.getTimezoneOffset() / 60) - 3);
  const pad = n => n.toString().padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth()+1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function saveToMySQL(userData) {
  try {
    const params = new URLSearchParams();
    params.append('nome', capitalizeName(userData.nome || ''));
    params.append('telefone', formatPhone(userData.id || ''));
    params.append('q1', upperAll(userData.answers.q1 || ''));
    params.append('q2', upperAll(userData.answers.q2 || ''));
    params.append('q3', upperAll(userData.answers.q3 || ''));
    params.append('q4', upperAll(userData.answers.q4 || ''));
    params.append('q5', upperAll(userData.answers.q5 || ''));
    params.append('q6', upperAll(userData.answers.q6 || ''));
    params.append('q7', upperAll(userData.answers.q7 || ''));
    params.append('q8', upperAll(userData.answers.q8 || ''));
    params.append('datahora', getBrasiliaDateTime());

    await axios.post('https://commerceprime.com.br/resposta_bot.php', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log('Resposta salva no MySQL!');
  } catch (e) {
    console.error('Erro ao salvar no MySQL:', e);
  }
}

export default saveToMySQL; 