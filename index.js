import { Boom } from '@hapi/boom';
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import qrcode from 'qrcode-terminal';
import express from 'express';
import fs from 'fs';
import crypto from 'crypto';
import saveToMySQL from './saveToMySQL.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Servidor web para UptimeRobot
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>WhatsApp Bot</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1>🤖 WhatsApp Bot</h1>
        <p>✅ Bot está rodando e funcionando!</p>
        <p>⏰ ${new Date().toLocaleString('pt-BR')}</p>
        <p>🔄 Uptime: ${Math.floor(process.uptime())} segundos</p>
      </body>
    </html>
  `);
});

// Endpoints para monitoramento
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    bot: 'WhatsApp Bot Ativo'
  });
});

app.get('/ping', (req, res) => {
  res.send('pong');
});

app.get('/status', (req, res) => {
  res.json({
    bot: 'WhatsApp Bot',
    status: 'online',
    time: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + ' segundos'
  });
});

// Endpoint simples para UptimeRobot
app.get('/uptime', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Servidor web rodando na porta ${PORT}`);
  // Removido: logs de URL do Replit
  console.log(`✅ Servidor pronto para receber requisições!`);
});

// Keep-alive interno para manter o Replit ativo
const keepAliveInterval = setInterval(() => {
  const uptime = Math.floor(process.uptime());
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;
  
  console.log(`💚 [${new Date().toISOString()}] Keep-alive ativo - Uptime: ${hours}h ${minutes}m ${seconds}s`);
  
  // Log a cada 5 minutos para manter atividade
  if (uptime % 300 === 0) {
    console.log(`🔄 [${new Date().toISOString()}] Bot mantido ativo por ${hours}h ${minutes}m`);
  }
}, 60000); // A cada 1 minuto

// Endpoint adicional para keep-alive
app.get('/keep-alive', (req, res) => {
  const uptime = Math.floor(process.uptime());
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  
  res.json({
    status: 'alive',
    uptime: `${hours}h ${minutes}m`,
    timestamp: new Date().toISOString(),
    message: 'Bot mantido ativo!'
  });
});

// Banco de dados
const dbFile = path.join(__dirname, 'db.json');
const adapter = new JSONFile(dbFile);
const db = new Low(adapter, { users: [] });
await db.read();
db.data = db.data || { users: [] };
await db.write();

// Arquivo CSV para respostas
const csvFile = path.join(__dirname, 'respostas.csv');

// Função para salvar resposta no CSV
function saveToCSV(userData) {
  try {
    const nome = userData.nome || 'Sem nome';
    
    // Formata o número de telefone
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
    
    // Formata a data para DD/MM/AAAA
    const dataAtual = new Date();
    const dia = String(dataAtual.getDate()).padStart(2, '0');
    const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const ano = dataAtual.getFullYear();
    const data = `${dia}/${mes}/${ano}`;
    
    const linha = [
      nome,
      telefone,
      userData.answers.q1 || '',
      userData.answers.q2 || '',
      userData.answers.q3 || '',
      userData.answers.q4 || '',
      userData.answers.q5 || '',
      userData.answers.q6 || '',
      userData.answers.q7 || '',
      userData.answers.q8 || '',
      data
    ].map(campo => `"${campo}"`).join(',');
    
    fs.appendFileSync(csvFile, linha + '\n');
    console.log(`📊 Resposta salva no CSV: ${nome} - ${telefone}`);
  } catch (error) {
    console.error('❌ Erro ao salvar no CSV:', error);
  }
}

// Controle de spam por usuário
const userCooldowns = new Map();
const userMessageCounts = new Map();

// Controle de mensagens sequenciais
const userMessageQueue = new Map();
const messageProcessingDelay = 2000; // 2 segundos para processar mensagens

// Perguntas com opção de sair
const questions = [
  {
    key: 'q1',
    text: '1⃣ Como podemos definir sua relação com o autocuidado? 🤔\n\n(Queremos entender o seu momento e perfil para te oferecer algo à altura.)\n\nA - Sou minimalista — praticidade acima de tudo, mas sem abrir mão da qualidade. ✨\nB - Amo uma rotina completa — cada passo é um ritual. 🧖‍♀️\nC - Estou começando agora, mas quero aprender e investir no que há de melhor. 🌱\nS - Sair 🚪\n\nResponda com a letra (A, B, C ou S).',
    options: ['A', 'B', 'C', 'S'],
    multi: false
  },
  {
    key: 'q2',
    text: '2⃣ Quando o assunto é pele, qual objetivo fala mais alto no seu coração? 💖\n\nA - Prevenção de linhas finas e sinais do tempo. ⏰\nB - Clareamento, uniformidade e viço. ✨\nC - Controle de oleosidade e poros visíveis. 🎯\nD - Hidratação intensa e pele iluminada. 💧\nE - Sensação de frescor e leveza o dia todo. 🌿\nS - Sair 🚪\n\nResponda com a letra (A, B, C, D, E ou S).',
    options: ['A', 'B', 'C', 'D', 'E', 'S'],
    multi: false
  },
  {
    key: 'q3',
    text: '3⃣ Um produto perfeito para você precisa ter qual textura? 🧴\n\nA - Fluída e sofisticada, absorção instantânea. 💎\nB - Rica e encorpada, com toque sedoso. 🥰\nC - Leve e refrescante, quase um toque de água. 💦\nD - Oil-free, com efeito mate, mas hidratante. 🌟\nS - Sair 🚪\n\nResponda com a letra (A, B, C, D ou S).',
    options: ['A', 'B', 'C', 'D', 'S'],
    multi: false
  },
  {
    key: 'q4',
    text: '4⃣ Aromas também contam uma história. Qual delas combina com você? 🌸\n\nA - Discreta, quase imperceptível — o protagonismo é da pele. 🤫\nB - Floral elegante e delicado. 🌺\nC - Herbal ou cítrico, sensação de naturalidade e frescor. 🍋\nD - Doce e marcante, porém refinado. 🍯\nE - Sem fragrância — puro cuidado, sem interferências. 🌬️\nS - Sair 🚪\n\nResponda com a letra (A, B, C, D, E ou S).',
    options: ['A', 'B', 'C', 'D', 'E', 'S'],
    multi: false
  },
  {
    key: 'q5',
    text: '5⃣ Quando você investe em produtos de autocuidado, qual sentimento busca? 💭\n\nA - Sentir que estou investindo no meu poder e na minha confiança. 💪\nB - Ter um momento só meu, de paz e bem-estar. 🧘‍♀️\nC - Participar de algo exclusivo, de alta performance. 🏆\nD - Me sentir mais jovem, luminosa e radiante. ✨\nS - Sair 🚪\n\nResponda com a letra (A, B, C, D ou S).',
    options: ['A', 'B', 'C', 'D', 'S'],
    multi: false
  },
  {
    key: 'q6',
    text: '6⃣ Quais desses 3 produtos de autocuidado premium não podem faltar na sua rotina? 🛍️\n\n(Escolha até 3 que você considera indispensáveis para uma pele impecável.)\n\nA - Sérum Anti-idade / Antissinais 🧬\nB - Vitamina C Potente 🍊\nC - Hidratante Profundo 💧\nD - Gel de Limpeza Facial 🧼\nE - Máscara Facial Detox ou Hidratante 🎭\nF - Esfoliante Facial Suave 🌊\nG - Protetor Solar com Alta Tecnologia ☀️\nS - Sair 🚪\n\nResponda com até 3 letras separadas por vírgula (ex: A,B,C) ou S para sair.',
    options: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'S'],
    multi: true,
    max: 3
  },
  {
    key: 'q7',
    text: '7⃣ O que mais te incomoda ou você gostaria de melhorar na sua pele hoje? 🤔\n\n(Escolha até 2 principais.)\n\nA - Manchas ou tom de pele desigual 🎨\nB - Oleosidade ou acne 🔥\nC - Linhas finas e primeiros sinais de idade ⏳\nD - Falta de firmeza ou elasticidade 🎈\nE - Poros dilatados e textura irregular 🔍\nF - Pele opaca e sem brilho natural 💡\nG - Sensibilidade e vermelhidão 🌹\nH - Ressecamento ou falta de hidratação 🏜️\nS - Sair 🚪\n\nResponda com até 2 letras separadas por vírgula (ex: A,B) ou S para sair.',
    options: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'S'],
    multi: true,
    max: 2
  },
  {
    key: 'q8',
    text: '8⃣ Qual textura você mais ama na hora de aplicar um produto na pele? 🎯\n\nA - Sérum fluido e leve 💧\nB - Creme aveludado 🥰\nC - Gel refrescante 🌊\nD - Óleo leve e nutritivo 💎\nE - Bálsamo cremoso 🧈\nS - Sair 🚪\n\nResponda com a letra (A, B, C, D, E ou S).',
    options: ['A', 'B', 'C', 'D', 'E', 'S'],
    multi: false
  }
];

// Mensagens variadas
const greetings = [
  "Olá! 😊 Tudo bem? Que bom ter você por aqui! ✨",
  "Oi! 🌸 Como vai? Seja bem-vindo(a)! 💖",
  "Olá! ✨ Que prazer em conhecer você! 🌟",
  "Oi! 🌸 Tudo bem? Que bom que você chegou! 🎉",
  "Olá! 🌸 Como vai? Seja bem-vindo(a)! 💫"
];

// Mensagens de transição após cada pergunta (variações robustas e decoradas com emojis)
const afterQ1 = [
  (nome) => `✨ Excelente escolha, ${nome}! Você já começou a nos mostrar o seu DNA de autocuidado.\n\nAgora, vamos explorar um pouco mais o que verdadeiramente conecta você com sua pele? Confie, isso vai te surpreender. 💫`,
  (nome) => `🌱 Ótimo começo, ${nome}! Sua resposta já revela muito sobre seu olhar para o autocuidado.\n\nVamos aprofundar e descobrir o que realmente faz sentido para sua pele? Prepare-se para se surpreender! 😍`,
  (nome) => `💖 Adorei sua escolha, ${nome}! Isso já mostra o quanto você leva o autocuidado a sério.\n\nAgora, quero te convidar a mergulhar ainda mais fundo na sua relação com a pele. Topa? ✨`
];
const afterQ2 = [
  (nome) => `💎 Impecável. Esse é o tipo de resposta que revela quem sabe o que quer.\n\nEstamos alinhando cada detalhe, porque quem caminha conosco merece produtos feitos sob medida para suas ambições. Vamos seguir? 🚀`,
  (nome) => `🎯 Resposta certeira, ${nome}! Dá para ver que você sabe exatamente o que busca.\n\nEstamos ajustando cada nuance para criar algo à sua altura. Pronta para a próxima? 💫`,
  (nome) => `🌟 Perfeito, ${nome}! Sua clareza inspira.\n\nCada detalhe seu está sendo considerado para um resultado exclusivo. Vamos avançar? ✨`
];
const afterQ3 = [
  (nome) => `🧴 Textura é um segredo não dito do prazer no autocuidado... e você acabou de nos dar uma pista valiosa.\n\nAgora quero te perguntar algo que conecta diretamente com sua essência. Pronta? 💖`,
  (nome) => `🪄 A textura que você escolheu diz muito sobre o seu ritual de autocuidado, ${nome}.\n\nAgora, quero ir ainda mais fundo e entender o que realmente faz sentido para você. Vamos lá? ✨`,
  (nome) => `💆‍♀️ Sua escolha de textura revela muito sobre seu estilo, ${nome}.\n\nAgora, quero te fazer uma pergunta que vai direto ao seu coração. Preparada? 💫`
];
const afterQ4 = [
  (nome) => `🌸 Que escolha refinada! O aroma certo desperta emoções, cria memórias.\n\nE no seu caso... temos algo especial surgindo aqui. Permite que eu te conheça ainda mais? Estamos chegando lá. ✨`,
  (nome) => `🌺 Seu gosto para aromas é sofisticado, ${nome}. Isso faz toda a diferença na experiência.\n\nPosso te conhecer um pouco mais? Estamos quase lá! 💖`,
  (nome) => `🌼 A escolha do aroma mostra sua sensibilidade, ${nome}.\n\nSinto que estamos construindo algo único aqui. Vamos continuar? 💫`
];
const afterQ5 = [
  (nome) => `🔥 Incrível! Isso nos mostra que seu autocuidado não é só uma rotina — é um manifesto pessoal.\n\nA próxima pergunta vai lapidar ainda mais o seu perfil exclusivo. Posso prosseguir? ✨`,
  (nome) => `💪 Maravilhoso, ${nome}! Seu autocuidado é uma verdadeira declaração de quem você é.\n\nA próxima etapa vai deixar seu perfil ainda mais completo. Vamos em frente? 🚀`,
  (nome) => `🌟 Sua resposta mostra que autocuidado é parte da sua identidade, ${nome}.\n\nAgora, vamos refinar ainda mais esse perfil especial. Pronta para a próxima? 💫`
];
const afterQ6 = [
  (nome) => `🗺️ Informações valiosas, obrigado por compartilhar!\n\nAgora sim estamos desenhando um mapa personalizado da sua pele e dos seus desejos. Só mais um pouco, o melhor está chegando... ✨`,
  (nome) => `💎 Esses detalhes são ouro, ${nome}! Com eles, conseguimos criar um retrato fiel das suas necessidades.\n\nFalta pouco para finalizar! 💖`,
  (nome) => `🧩 Cada resposta sua nos ajuda a montar um plano sob medida, ${nome}.\n\nEstamos quase lá, só mais um passo! 🚀`
];
const afterQ7 = [
  (nome) => `🔑 Agora você tocou no ponto-chave. Entender o que te incomoda hoje é o primeiro passo para criarmos soluções que realmente façam sentido.\n\nEstou quase encerrando — mas essa próxima resposta é ouro puro. ✨`,
  (nome) => `🎯 Você foi direto ao ponto, ${nome}. Saber o que te incomoda é essencial para personalizarmos tudo para você.\n\nÚltima pergunta, e ela é fundamental! ✨`,
  (nome) => `💡 Essa resposta é crucial, ${nome}. Com ela, conseguimos pensar em soluções verdadeiramente transformadoras.\n\nSó mais uma pergunta, e fechamos com chave de ouro! ✨`
];
const afterQ8 = [
  (nome) => `✅ Prontíssimo, tudo registrado! Com essas respostas, conseguimos um raio-x precioso sobre você.\n\nMe dê só um instante... estou analisando cuidadosamente seu perfil para uma resposta à sua altura. 🤩`,
  (nome) => `📝 Tudo anotado, ${nome}! Suas respostas nos deram um panorama completo.\n\nAguarde só um momento enquanto analisamos tudo com carinho. ✨`,
  (nome) => `🔍 Respostas recebidas, ${nome}! Agora é hora de analisar cada detalhe para te dar um retorno à altura do seu perfil.\n\nSó um instante... 💎`
];

// Mensagens finais de aprovação para a Comunidade de Elite (4 opções fornecidas pelo usuário)
const grupoLink = '[link do grupo]'; // Substitua pelo link real
const finalEliteMessages = [
  (nome) => `🎉 Parabéns, ${nome}! Sua participação não passou despercebida. Após avaliarmos cuidadosamente suas respostas, é um prazer imenso confirmar que você foi selecionada para integrar nossa Comunidade de Elite.\n\nEste não é um simples grupo — é um círculo seleto de mulheres que, junto à nossa equipe, vão definir os próximos passos do autocuidado premium no Brasil e no mundo.\n\nA partir de agora, sua voz não será apenas ouvida — ela será influência direta nas inovações que estamos prestes a lançar. E, claro, terá acesso antecipado, condições exclusivas e oportunidades que não chegam ao público comum.\n\nA sua entrada prioritária está aqui: ${grupoLink}.\n\n⚠️ Mas seja rápida: as portas se fecham sem aviso, e poucas têm a honra de atravessá-las.\n\nNos vemos do lado de dentro, ${nome}. O futuro do autocuidado será escrito com a sua presença. ✨`,
  
  (nome) => `🏆 Você conseguiu, ${nome}! Suas respostas revelaram o perfil exato que procurávamos para fazer parte da nossa Comunidade de Elite.\n\nAqui, reunimos mulheres de alto padrão que vão influenciar, junto conosco, a criação dos produtos de autocuidado mais desejados do mercado.\n\nSua opinião não será apenas um detalhe — será um pilar na construção de uma nova era do autocuidado premium.\n\nAlém disso, você terá acesso antecipado, condições diferenciadas e um ambiente restrito de troca entre mentes brilhantes.\n\nAqui está o seu passe exclusivo: ${grupoLink}.\n\n⏰ Não pense duas vezes: as vagas são limitadas e o ciclo de decisões começa muito em breve.\n\nEstamos te esperando, ${nome}. Vamos construir o extraordinário juntas. 💎`,
  
  (nome) => `👑 Bem-vinda ao seleto grupo, ${nome}! Após uma análise profunda do seu perfil, você acabou de ser oficialmente aprovada para a nossa Comunidade de Elite.\n\nUm espaço que não é para todas — é para quem tem propósito, visão e deseja definir com a gente o novo padrão do autocuidado de luxo.\n\nAqui, você não será só uma voz: será uma arquiteta das próximas grandes experiências do mercado.\n\nO próximo passo é seu: acessar o grupo exclusivo onde o futuro está sendo desenhado agora.\n\n🔗 ${grupoLink}\n\n⚠️ Mas atenção: as vagas são escassas, e quem chega primeiro, ocupa seu lugar de direito.\n\nTe vejo lá, ${nome}. Você faz parte do futuro que estamos criando. ✨`,
  
  (nome) => `🌟 Parabéns, ${nome}! Seu perfil foi aprovado para integrar uma das iniciativas mais seletivas do país: a nossa Comunidade de Elite.\n\nUm conselho que não apenas opina — decide os rumos do autocuidado premium, influenciando produtos, experiências e tendências que o mercado ainda sequer conhece.\n\nAqui, você será protagonista, não espectadora. Cada opinião sua pode transformar a forma como o autocuidado será visto e vivido.\n\nPronta para ingressar? Seu acesso está aqui: ${grupoLink}.\n\n⏳ Lembre-se: as portas não ficarão abertas por muito tempo.\n\nChegou a sua vez, ${nome}. Vamos juntas revolucionar o que o mundo conhece como autocuidado. 🚀`
];

// Mensagens variadas de confirmação (com emojis)
const confirmations = [
  "✅ Perfeito! Sua resposta foi registrada.",
  "🎉 Ótimo! Vamos para a próxima pergunta.",
  "📝 Entendi! Anotado aqui.",
  "👏 Show! Próxima questão...",
  "💡 Legal! Vamos continuar..."
];

const finalMessages = [
  "✅ Pesquisa finalizada! Obrigado por participar. Suas respostas foram salvas. 📝✨",
  "🎉 Concluído! Muito obrigado por responder nossa pesquisa. 💖",
  "✨ Finalizado! Obrigado por dedicar seu tempo conosco. 🌟",
  "💫 Pesquisa completa! Suas respostas foram registradas com sucesso. 📊",
  "🎯 Terminado! Obrigado por participar da nossa pesquisa. 🙏"
];

// Funções de delay e humanização
function humanDelay(min = 2000, max = 5000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shortDelay(min = 1000, max = 2000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function simulateHumanTyping(sock, jid) {
  try {
    await sock.presenceSubscribe(jid);
    await sock.sendPresenceUpdate('composing', jid);
    await new Promise(resolve => setTimeout(resolve, humanDelay()));
    await sock.sendPresenceUpdate('paused', jid);
    await new Promise(resolve => setTimeout(resolve, shortDelay()));
  } catch (error) {
    console.log("Erro ao simular digitação:", error.message);
  }
}

// Função utilitária para normalizar texto (remove acentos, espaços extras, lowercase)
function normalizeText(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, ' ') // espaços múltiplos para um só
    .trim()
    .toLowerCase();
}

// Controle de spam
function isSpamming(userId) {
  const now = Date.now();
  const lastMessage = userCooldowns.get(userId) || 0;

  if (now - lastMessage < 2000) {
    return true;
  }

  userCooldowns.set(userId, now);
  return false;
}

function checkMessageLimit(userId) {
  const now = Date.now();
  const userData = userMessageCounts.get(userId) || { count: 0, resetTime: now };

  // Reset contador a cada hora
  if (now - userData.resetTime > 3600000) {
    userData.count = 0;
    userData.resetTime = now;
  }

  if (userData.count >= 20) { // Máximo 20 mensagens por hora
    return false;
  }

  userData.count++;
  userMessageCounts.set(userId, userData);
  return true;
}

// Funções auxiliares
function invalidMsg(q) {
  const errorMessages = [
    `❌ Ops! Resposta inválida. Tente com: ${q.options.join(', ')}${q.multi ? `\nVocê pode escolher até ${q.max} opção(ões).` : ''}`,
    `⚠️ Resposta incorreta. Use: ${q.options.join(', ')}${q.multi ? `\nEscolha até ${q.max} opção(ões).` : ''}`,
    `🤔 Não entendi. Responda com: ${q.options.join(', ')}${q.multi ? `\nMáximo ${q.max} opção(ões).` : ''}`
  ];
  return errorMessages[Math.floor(Math.random() * errorMessages.length)];
}

function validateAnswer(q, answer) {
  if (q.multi) {
    const arr = answer.split(',').map(a => a.trim().toUpperCase()).filter(Boolean);
    if (arr.length === 0 || arr.length > q.max) return false;
    return arr.every(a => q.options.includes(a));
  } else {
    return q.options.includes(answer.trim().toUpperCase());
  }
}

function normalizeAnswer(q, answer) {
  if (q.multi) {
    return answer.split(',').map(a => a.trim().toUpperCase()).filter(Boolean);
  } else {
    return answer.trim().toUpperCase();
  }
}

function getUserStep(user) {
  for (let i = 0; i < questions.length; i++) {
    if (!user.answers[questions[i].key]) return i;
  }
  return questions.length;
}

// Warming up do número
async function warmUpNumber(sock) {
  // Aguarda conexão ativa antes de logar sucesso
  let tentativas = 0;
  while (tentativas < 10) {
    if (sock.user && sock.user.id) {
      console.log('✅ Número aquecido e pronto!');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    tentativas++;
  }
  console.log('⚠️ Número NÃO conectado!');
  console.log('➡️ Aguarde o QR Code no terminal para parear o WhatsApp.');
  console.log('Se o QR não aparecer, verifique sua conexão de internet, firewall e tente rodar novamente.');
  console.log('Se continuar, reinicie o bot e confira se não há bloqueio de rede na VPS.');
}

// Adicionar função para obter nome do usuário
function getUserName(msg, sock) {
  // Tenta pegar o nome do pushName
  if (msg.pushName) return msg.pushName.split(' ')[0];
  // Tenta buscar nos contatos (caso pushName não exista)
  if (sock && sock.contacts && sock.contacts[msg.key.remoteJid]) {
    const name = sock.contacts[msg.key.remoteJid].name || sock.contacts[msg.key.remoteJid].notify;
    if (name) return name.split(' ')[0];
  }
  // Fallback: número
  return msg.key.remoteJid.split('@')[0];
}

// Convite para comunidade elite
const eliteInvite = {
  text: (nome) => `Olá, ${nome}! 👋✨\n\nQue prazer ter você conosco. Você acaba de conquistar um lugar na nossa Lista Premium de Autocuidado, um seleto espaço reservado para mulheres que enxergam o autocuidado como um verdadeiro ato de poder e sofisticação. 💎\n\nAgora, me diga com sinceridade... você gostaria de ser avaliada para ingressar na nossa Comunidade de Elite? 🤔\n\nEstamos reunindo um grupo extremamente restrito e criterioso, onde cada participante terá um papel direto na criação dos próximos lançamentos — além de receber acesso antecipado, condições exclusivas e experiências que o público comum jamais terá. 🌟\n\nLá dentro, você descobrirá que o autocuidado vai muito além de um produto — é uma cultura, um legado. 🏆\n\nA - Sim, quero participar! 🚀\nB - Não, obrigado(a). 😊\n\nResponda apenas com a letra A ou B.`,
  options: ['A', 'B']
};

// Mensagem de agradecimento e encerramento
const byeMsg = (nome) => `Muito obrigado pela sua atenção, ${nome}! 💖\n\nQuando quiser, estaremos por aqui. Tenha um ótimo dia! ✨👋`;

// Mensagem de análise e aprovação
const analyzingMsg = '⏳ Por favor aguarde, estamos analisando seu perfil... 🔍✨';
const approvedMsg = (nome) => `🎉 Parabéns ${nome}!!! Você foi aprovada para a nossa comunidade VIP, entre agora pelo link abaixo e fique por dentro de tudo sobre autocuidado, tudo em primeira mão! 💎\n\n👉 www.whatsapp.com.br/grupo 🔗`;

// Mensagem de saída
const exitMsg = (nome) => `Tudo bem ${nome}! 😊\n\nObrigado por ter participado. Se quiser voltar, é só enviar a mensagem de ativação novamente! 👋✨`;

// Frases de ativação permitidas
const activationMessages = [
  "Olá! Gostaria de receber mais informações sobre comunidade de elite, produtos premium e condições especiais! Aguardo seu retorno!",
  "Não consigo esperar, estou empolgado para garantir o produto!",
  "quero vivenciar a experiência completa"
];

// Explicação de resposta errada
function explainInvalid(q) {
  let base = '❌ Resposta inválida.';
  if (q.multi) {
    base += `\n\nResponda com até ${q.max} letra(s) separadas por vírgula. Exemplo: ${q.options.slice(0, q.max).join(',')} 📝`;
  } else {
    base += `\n\nResponda apenas com uma letra: ${q.options.join(', ')}. 📝`;
  }
  return base;
}

// Função para processar mensagem com delay
async function processMessageWithDelay(sock, msg, user) {
  const sender = msg.key.remoteJid;
  
  // Captura mensagem em diferentes formatos do WhatsApp
  let messageContent = '';
  if (msg.message.conversation) {
    messageContent = msg.message.conversation;
  } else if (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) {
    messageContent = msg.message.extendedTextMessage.text;
  } else if (msg.message.imageMessage && msg.message.imageMessage.caption) {
    messageContent = msg.message.imageMessage.caption;
  } else if (msg.message.videoMessage && msg.message.videoMessage.caption) {
    messageContent = msg.message.videoMessage.caption;
  } else if (msg.message.documentMessage && msg.message.documentMessage.caption) {
    messageContent = msg.message.documentMessage.caption;
  }
  
  const nome = getUserName(msg, sock);

  // Adiciona o nome do usuário aos dados
  user.nome = nome;

  // Normaliza mensagens para comparação
  const normalizedReceived = normalizeText(messageContent);
  // Verifica se a mensagem ativa o bot
  const activationMatch = activationMessages.some(msg => normalizedReceived === normalizeText(msg));
  const keywords = ['comunidade de elite', 'produtos premium', 'condicoes especiais'];
  const hasKeywords = keywords.every(keyword => normalizedReceived.includes(normalizeText(keyword)));
  const shouldActivate = activationMatch || hasKeywords ||
    normalizedReceived.includes('comunidade de elite') ||
    normalizedReceived.includes('produtos premium') ||
    normalizedReceived.includes('condicoes especiais');
  if (shouldActivate) {
    // Ativa ou reinicia o fluxo
    user.state = 'active';
    user.answers = {};
    await db.write();
    await new Promise(resolve => setTimeout(resolve, humanDelay()));
    await simulateHumanTyping(sock, sender);
    await sock.sendMessage(sender, { text: eliteInvite.text(nome) });
    return;
  }
  // Se não ativou, responde explicando
  if (user.state === 'inactive') {
    await sock.sendMessage(sender, { text: `Para iniciar o atendimento, envie uma das mensagens abaixo:\n\n${activationMessages.map(m => '"' + m + '"').join('\nou\n')}` });
  }

  // FLUXO 1: Mensagem de ativação especial
  if (normalizedReceived === normalizeText('Não consigo esperar, estou empolgada para garantir o produto!')) {
    const texto = `✨ [NOME], entendi tudo só pelo seu clique.\n\nVocê foi direto. E sabe por quê? Porque no fundo já sabe que esse produto não é comum, não vai durar muito e sempre é feito pra você. A sua pressa não é um problema.\n\nNa verdade, é um ótimo sinal: você sente quando algo é especial... e isso aqui é.\n\nMas, antes de você finalizar sua compra (e eu sei que você vai), deixa eu te mostrar algo que só revela pra quem realmente sente o que estamos construindo por aqui.\n\nEstamos abrindo, em silêncio, uma seleção íntima de mulheres que vão participar de uma experiência única e transformadora.\nUm espaço com acesso prioritário aos nossos melhores lançamentos, produtos diferenciados e outras surpresas que só revelamos a quem está dentro.\n\n@https://amzn.to/4neTpRf\n\nE quando garantir o seu produto, faça o seguinte:\nvolta aqui e me manda só isso: “já garanti o meu!”.\nEsse simples gesto pode te abrir portas que nem imagina.\nNos vemos do outro lado? ✨`;
    user.state = 'aguardando_confirmacao';
    await db.write();
    await simulateHumanTyping(sock, sender);
    await sock.sendMessage(sender, { text: texto.replace('[NOME]', nome) });
    return;
  }

  // FLUXO 2: Mensagem de ativação especial para experiência completa
  if (normalizedReceived === normalizeText('quero vivenciar a experiência completa')) {
    const texto = `[NOME], tem algo que só você vai entender...\n\nQuando clicou aqui, não foi só por interesse — foi porque algo lá dentro já sabia: isso é pra mim.\n\nA partir de agora, você não está apenas acessando uma experiência. Está desbloqueando um território reservado para poucas.\n\nE não é exagero — existe um padrão, um cuidado, uma linguagem que só quem sente consegue captar.\n\nEntão aqui vai meu convite direto:\n\nClique no botão abaixo para descobrir o que reservamos pra você.\n\nAh, e quando reservar seu produto premium — porque eu sei que você vai — volta aqui e me diz: “já garanti o meu.”\n\nPorque a verdade é que você não foi feita pra seguir o fluxo... e eu sinto que nós duas podemos criar algo ainda mais raro, mais bonito, mais nosso. Não vou te contar agora o que acontece depois disso...\n\nMas posso te prometer uma coisa: as mulheres que mandaram essa mensagem nunca mais olharam pra si mesmas da mesma forma.\n\nVocê chegou até aqui por um motivo. E ele começa agora.\n\n🌹\n\n[@https://commerceprime.com.br/ ]`;
    user.state = 'aguardando_confirmacao';
    await db.write();
    await simulateHumanTyping(sock, sender);
    await sock.sendMessage(sender, { text: texto.replace('[NOME]', nome) });
    return;
  }

  // FLUXO: Aceitar 'já garanti o meu' (com variações/erros) SOMENTE se user.state === 'aguardando_confirmacao'
  if (user.state === 'aguardando_confirmacao' && normalizeText(messageContent).replace(/[^a-zA-Z]/g, '').includes('jagarantiomeu')) {
    user.state = 'comunidade_secreta';
    user.answers = {};
    await db.write();
    await simulateHumanTyping(sock, sender);
    // Nova saudação especial
    const saudacao = `${nome}... que energia maravilhosa ter você aqui!\n\nSua mensagem me arrepiou. Isso significa que você não apenas garantiu seu produto, mas aceitou fazer parte de algo maior.\n\nVocê acaba de conquistar seu espaço na nossa Lista Premium de Autocuidado, uma seleção feita com todo cuidado para mulheres que entendem o valor de um ritual — e não apenas de um item.\n\nMas agora, tenho uma pergunta íntima e importante pra te fazer...\n\nVocê gostaria de ser avaliada para entrar na nossa Comunidade Secreta?\n\nEstamos reunindo um grupo altamente restrito de mulheres com perfis únicos, capazes de elevar o autocuidado a um novo patamar.\n\nLá dentro, você terá acesso a:\n\n✨ Experiências antecipadas — que ninguém mais terá\n🔐 Condições invisíveis ao público geral\n💎 Participação direta na construção dos próximos lançamentos\n💭 E um espaço íntimo, inspirador, onde o autocuidado vira um estilo de vida — não uma tendência.\n\nMas como tudo que é raro precisa ser preservado...\n\nAs vagas são limitadíssimas, e o processo de entrada exige uma pequena jornada seletiva.\n\nAlgo leve, rápido e especial — só pra termos certeza de que essa comunidade será composta pelas mentes e corações certos.\n\nSe você topar participar desse processo, me responda agora com:\n\nA - Quero participar!\nou\nB - Prefiro não participar por enquanto.\n\nEstou animada com o que podemos construir juntas. Mas só você pode dar o próximo passo.`;
    await sock.sendMessage(sender, { text: saudacao });
    return;
  }

  // Processa resposta da Comunidade Secreta
  if (user.state === 'comunidade_secreta') {
    const resposta = normalizeText(messageContent).trim().toUpperCase();
    if (resposta === 'A') {
      user.state = 'active';
      await db.write();
      await simulateHumanTyping(sock, sender);
      await sock.sendMessage(sender, { text: questions[0].text });
      return;
    } else if (resposta === 'B') {
      user.state = 'inactive';
      await db.write();
      await simulateHumanTyping(sock, sender);
      await sock.sendMessage(sender, { text: 'Tudo bem! 😊 Quando quiser, estaremos por aqui. Tenha um ótimo dia! ✨👋' });
      return;
    }
  }

  // NOVO FLUXO: Saudação inicial ao receber 'já garanti o meu'
  if (normalizeText(messageContent) === normalizeText('já garanti o meu')) {
    user.state = 'active';
    user.answers = {};
    await db.write();
    await simulateHumanTyping(sock, sender);
    // Saudação inicial (A ou B)
    await sock.sendMessage(sender, { text: eliteInvite.text(nome) });
    return;
  }

  // NOVO FLUXO: Disparo do questionário ao receber 'já garanti o meu' ou 'bot'
  if (
    normalizeText(messageContent) === normalizeText('já garanti o meu') ||
    normalizeText(messageContent) === normalizeText('bot')
  ) {
    user.state = 'active';
    user.answers = {};
    await db.write();
    await simulateHumanTyping(sock, sender);
    // Primeira pergunta do questionário
    await sock.sendMessage(sender, { text: questions[0].text });
    return;
  }
}

// Refatorar handleMessage para controlar mensagens sequenciais
async function handleMessage(sock, msg) {
  const sender = msg.key.remoteJid;
  
  // Captura mensagem em diferentes formatos do WhatsApp
  let messageContent = '';
  if (msg.message.conversation) {
    messageContent = msg.message.conversation;
  } else if (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) {
    messageContent = msg.message.extendedTextMessage.text;
  } else if (msg.message.imageMessage && msg.message.imageMessage.caption) {
    messageContent = msg.message.imageMessage.caption;
  } else if (msg.message.videoMessage && msg.message.videoMessage.caption) {
    messageContent = msg.message.videoMessage.caption;
  } else if (msg.message.documentMessage && msg.message.documentMessage.caption) {
    messageContent = msg.message.documentMessage.caption;
  }

  let user = db.data.users.find(u => u.id === sender);
  if (!user) {
    user = { id: sender, answers: {}, state: 'inactive' };
    db.data.users.push(user);
    await db.write();
  }

  // Se usuário está inativo, processa imediatamente (mensagem específica)
  if (user.state === 'inactive') {
    await processMessageWithDelay(sock, msg, user);
    return;
  }

  // Para usuários ativos, implementa fila de mensagens
  const now = Date.now();
  const userQueue = userMessageQueue.get(sender) || { timer: null, lastMessage: null };

  // Cancela timer anterior se existir
  if (userQueue.timer) {
    clearTimeout(userQueue.timer);
  }

  // Armazena a mensagem atual
  userQueue.lastMessage = { msg, user };

  // Cria novo timer para processar a mensagem
  userQueue.timer = setTimeout(async () => {
    if (userQueue.lastMessage) {
      await processMessageWithDelay(sock, userQueue.lastMessage.msg, userQueue.lastMessage.user);
      userMessageQueue.delete(sender);
    }
  }, messageProcessingDelay);

  userMessageQueue.set(sender, userQueue);
}

// Setup do Baileys
async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({
    auth: state
  });

  await warmUpNumber(sock);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    try {
      await handleMessage(sock, msg);
    } catch (e) {
      console.error('❌ Erro ao processar mensagem:', e);
      await sock.sendMessage(msg.key.remoteJid, { text: "❌ Ocorreu um erro. Tente novamente mais tarde. 🔧" });
    }
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n==================== QR CODE ====================');
      try {
        qrcode.generate(qr, { small: true });
        console.log('\n✅ QR code gerado acima.');
      } catch (e) {
        console.log('❌ Erro ao gerar QR code no terminal:', e);
      }
      // Sempre exibe o código do QR em texto
      console.log('\n🔗 QR code (copie e cole em https://wa-qr.dev se não aparecer o QR acima):');
      console.log(qr);
      console.log('================================================');
    } else {
      console.log('[DEBUG] Evento connection.update chamado, mas não há QR code. Update:', update);
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error = Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log('🔄 Reconectando...');
        startSock();
      }
    }

    if (connection === 'open') {
      console.log('✅ Conectado ao WhatsApp! 🎉');
    }
  });
}

// Handler global para erros não tratados
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Log de vida a cada minuto
setInterval(() => {
  console.log(`[${new Date().toISOString()}] 🤖 Bot está rodando... 💚`);
}, 60 * 1000);

startSock();