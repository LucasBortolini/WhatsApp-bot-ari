import axios from 'axios';

async function saveToMySQL(userData) {
  try {
    const params = new URLSearchParams();
    params.append('nome', userData.nome || '');
    params.append('telefone', userData.id || '');
    params.append('q1', userData.answers.q1 || '');
    params.append('q2', userData.answers.q2 || '');
    params.append('q3', userData.answers.q3 || '');
    params.append('q4', userData.answers.q4 || '');
    params.append('q5', userData.answers.q5 || '');
    params.append('q6', userData.answers.q6 || '');
    params.append('q7', userData.answers.q7 || '');
    params.append('q8', userData.answers.q8 || '');

    await axios.post('https://commerceprime.com.br/resposta_bot.php', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log('Resposta salva no MySQL!');
  } catch (e) {
    console.error('Erro ao salvar no MySQL:', e);
  }
}

export default saveToMySQL; 