import axios from 'axios';

async function saveToMySQL(userData) {
  try {
    await axios.post('https://commerceprime.com.br/resposta_bot.php', {
      nome: userData.nome || '',
      telefone: userData.id || '',
      q1: userData.answers.q1 || '',
      q2: userData.answers.q2 || '',
      q3: userData.answers.q3 || '',
      q4: userData.answers.q4 || '',
      q5: userData.answers.q5 || '',
      q6: userData.answers.q6 || '',
      q7: userData.answers.q7 || '',
      q8: userData.answers.q8 || ''
    });
    console.log('Resposta salva no MySQL!');
  } catch (e) {
    console.error('Erro ao salvar no MySQL:', e);
  }
}

export default saveToMySQL; 