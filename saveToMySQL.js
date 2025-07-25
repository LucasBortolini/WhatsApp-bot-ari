import axios from 'axios';

// Função para capitalizar nome
function capitalizeName(nome) {
  return nome.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// Função para formatar telefone para (xx) xxxxx-xxxx
function formatPhone(telefone) {
  console.log('[DEBUG] Telefone original:', telefone);
  
  // Copia exatamente a lógica que funciona no CSV
  let telefoneFormatado = telefone || 'Sem telefone';
  
  if (telefoneFormatado.includes('@s.whatsapp.net')) {
    // Remove o sufixo do WhatsApp
    telefoneFormatado = telefoneFormatado.replace('@s.whatsapp.net', '');
    console.log('[DEBUG] Telefone sem @s.whatsapp.net:', telefoneFormatado);
    
    // Se começa com 55 (código do Brasil), remove
    if (telefoneFormatado.startsWith('55')) {
      telefoneFormatado = telefoneFormatado.substring(2);
      console.log('[DEBUG] Telefone sem 55:', telefoneFormatado);
    }
    
    // Formata o número
    if (telefoneFormatado.length === 11) {
      // Número já tem 11 dígitos (com o 9)
      const ddd = telefoneFormatado.substring(0, 2);
      const parte1 = telefoneFormatado.substring(2, 7);
      const parte2 = telefoneFormatado.substring(7);
      telefoneFormatado = `(${ddd}) ${parte1}-${parte2}`;
    } else if (telefoneFormatado.length === 10) {
      // Número tem 10 dígitos (sem o 9) - adiciona o 9
      const ddd = telefoneFormatado.substring(0, 2);
      const parte1 = telefoneFormatado.substring(2, 6);
      const parte2 = telefoneFormatado.substring(6);
      telefoneFormatado = `(${ddd}) 9${parte1}-${parte2}`;
    }
  }
  
  console.log('[DEBUG] Telefone formatado final:', telefoneFormatado);
  return telefoneFormatado;
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
    // Usa a mesma lógica do CSV para formatar o telefone
    let telefone = userData.id || 'Sem telefone';
    if (telefone.includes('@s.whatsapp.net')) {
      // Remove o sufixo do WhatsApp
      telefone = telefone.replace('@s.whatsapp.net', '');
      
      // Se começa com 55 (código do Brasil), remove
      if (telefone.startsWith('55')) {
        telefone = telefone.substring(2);
      }
      
      // Formata o número
      if (telefone.length === 11) {
        // Número já tem 11 dígitos (com o 9)
        const ddd = telefone.substring(0, 2);
        const parte1 = telefone.substring(2, 7);
        const parte2 = telefone.substring(7);
        telefone = `${ddd} ${parte1}-${parte2}`;
      } else if (telefone.length === 10) {
        // Número tem 10 dígitos (sem o 9) - adiciona o 9
        const ddd = telefone.substring(0, 2);
        const parte1 = telefone.substring(2, 6);
        const parte2 = telefone.substring(6);
        telefone = `${ddd} 9${parte1}-${parte2}`;
      }
    }
    
    const params = new URLSearchParams();
    params.append('nome', capitalizeName(userData.nome || ''));
    params.append('telefone', telefone);
    params.append('q1', upperAll(userData.answers.q1 || ''));
    params.append('q2', upperAll(userData.answers.q2 || ''));
    params.append('q3', upperAll(userData.answers.q3 || ''));
    params.append('q4', upperAll(userData.answers.q4 || ''));
    params.append('q5', upperAll(userData.answers.q5 || ''));
    params.append('q6', upperAll(userData.answers.q6 || ''));
    params.append('q7', upperAll(userData.answers.q7 || ''));
    params.append('q8', upperAll(userData.answers.q8 || ''));
    params.append('datahora', getBrasiliaDateTime());

    console.log('[DEBUG] Telefone formatado (mesmo do CSV):', telefone);

    await axios.post('https://commerceprime.com.br/resposta_bot.php', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log('Resposta salva no MySQL!');
  } catch (e) {
    console.error('Erro ao salvar no MySQL:', e);
  }
}

export default saveToMySQL; 