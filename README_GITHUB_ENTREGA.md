# SIGAC - Entrega Final Organizada

Sistema Integrado de Gestão e Atividades Complementares.

## Como rodar o PWA/API

```powershell
npm install
npm start
```

Acesse:

- http://127.0.0.1:3000/loginsigac.html
- http://127.0.0.1:3000/index.html
- http://127.0.0.1:3000/coordenador.html
- http://127.0.0.1:3000/adminsigac.html

## Como rodar o mobile

```powershell
cd mobile/sigac-mobile
npm install
npx expo start -c
```

Se o celular não conectar no mesmo Wi-Fi:

```powershell
npx expo start --tunnel -c
```

## Arquitetura resumida

Mobile ↔ API/Backend ↔ Banco/PWA.

- O aluno envia certificados e acompanha progresso pelo mobile/PWA.
- A API recebe e persiste dados.
- O PWA permite validação pelo Coordenador/Admin.
- OCR auxilia a leitura de certificados.
- ML/indicadores classificam risco e progresso.

## Segurança de entrega

Não subir `.env` real para GitHub.
Use `.env.example` e `.env.smtp.example`.
