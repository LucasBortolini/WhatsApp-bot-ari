// Script para resetar a autenticação do WhatsApp (Baileys)
// Use: node reset-auth.js

import fs from 'fs';
import path from 'path';

const authDir = path.join(process.cwd(), 'auth_info');

if (fs.existsSync(authDir)) {
  fs.rmSync(authDir, { recursive: true, force: true });
  console.log('✅ Pasta de autenticação removida com sucesso!');
  console.log('Ao rodar o bot novamente, será solicitado um novo QR Code.');
} else {
  console.log('ℹ️ Pasta de autenticação não encontrada. Já está limpa!');
} 