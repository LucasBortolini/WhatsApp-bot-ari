# WhatsApp Bot - Instruções para VPS (Hostinger)

## Como rodar o bot em uma VPS (Hostinger)

1. **Acesse sua VPS via SSH:**
   ```bash
   ssh usuario@ip-da-sua-vps
   ```
2. **Instale o Node.js (recomendado Node 18+):**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
   ```
3. **Clone o projeto ou envie os arquivos para a VPS.**

4. **Instale as dependências:**
   ```bash
   npm install
   ```
5. **Execute o bot:**
   ```bash
   npm start
   ```
6. **(Opcional) Use PM2 para manter o bot sempre online:**
   ```bash
   npm install -g pm2
   pm2 start index.js --name whatsapp-bot
   pm2 save
   pm2 startup
   ```

---

## Sobre o arquivo `respostas.csv`
- Todas as respostas dos usuários são salvas neste arquivo.
- O formato é compatível com Excel.
- Telefones são formatados com o dígito 9 e datas no padrão DD/MM/AAAA.

---

## Dúvidas?
Se precisar de ajuda para deploy, configuração ou manutenção, consulte o README ou peça suporte ao desenvolvedor.

## Como resetar a conexão do WhatsApp (ler novo QR Code)

Se quiser desconectar o número atual e conectar outro, ou se der erro de autenticação:

1. Rode o comando:
   ```bash
   node reset-auth.js
   ```
2. Depois, rode o bot normalmente:
   ```bash
   npm start
   ```
3. O bot vai pedir um novo QR Code para parear com o WhatsApp.

---