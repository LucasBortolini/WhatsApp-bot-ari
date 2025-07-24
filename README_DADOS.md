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