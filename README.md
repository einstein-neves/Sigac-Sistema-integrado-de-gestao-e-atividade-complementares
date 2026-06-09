# SIGAC

Sistema Integrado de Gestao de Atividades Complementares.

## Descricao

O SIGAC e uma aplicacao web/PWA academica para controle de atividades complementares. A plataforma centraliza cursos, perfis, regras por curso, alunos, envios de atividades, certificados, OCR de apoio, dashboards, notificacoes, logs e e-mails em fila. A pasta `mobile/sigac-mobile` contem a versao React Native/Expo inicial para o fluxo do Aluno.

## Objetivo da Entrega 1

Preparar a aplicacao PWA da Entrega 1 do Projeto Integrador ADS-3, com foco em Super Admin, Coordenador e Aluno web. A entrega usa backend unico em Node.js integrado ao PostgreSQL. A versao mobile agora consome esse mesmo backend sem alterar as rotas ou o banco.

## Entrega 2 Mobile

A Entrega 2 Mobile esta documentada em `docs/entrega-2-mobile.md` e `docs/checklist-entrega-2-mobile.md`. O app Expo em `mobile/sigac-mobile` permite ao aluno logar, visualizar dashboard individual, alternar curso ativo, enviar atividade com camera/galeria/PDF, consultar status das solicitacoes e receber confirmacao por e-mail/fila mock apos submissao.

## Tecnologias

- Node.js com API HTTP.
- PostgreSQL com driver `pg`.
- HTML, CSS e JavaScript no frontend.
- PWA com `manifest.json`, `service-worker.js`, icones e cache estatico seguro.
- React Native/Expo em `mobile/sigac-mobile` para o fluxo inicial do Aluno.
- Chart.js local em `vendor/chart.umd.min.js`.
- OCR opcional no navegador com Tesseract.js/PDF.js via CDN.
- E-mail mock por padrao e SMTP opcional com Nodemailer.
- Variaveis de ambiente com `dotenv`.

## Perfis do sistema

- Super Admin: gestao global de cursos, usuarios, regras, certificados, dashboards, logs, configuracoes e comunicacoes.
- Coordenador: gestao de alunos, atividades, regras, envios e certificados dos cursos vinculados.
- Aluno web: acompanhamento de progresso, envio de comprovantes, certificados e oportunidades.

## Funcionalidades implementadas

- Autenticacao com sessoes e controle de perfis.
- Senhas armazenadas com hash `scrypt` e salt.
- Cadastro de cursos, coordenadores e alunos.
- Vinculo de coordenadores e alunos a cursos.
- Regras de atividades complementares por curso.
- Upload de comprovantes e certificados em PDF/imagem.
- Validacao/reprovacao de envios e certificados.
- Dashboard administrativo, coordenador e aluno.
- OCR opcional como apoio, sem substituir validacao humana.
- Notificacoes internas, logs de auditoria e fila de e-mails.
- PWA instalavel com cache de arquivos estaticos publicos.

## Como instalar

```bash
npm install
```

Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Preencha o `.env` com credenciais locais. Nenhuma credencial real acompanha o projeto.

## Como configurar o banco PostgreSQL

Configure a variavel `DATABASE_URL` no `.env`:

```env
DATABASE_URL=postgresql://usuario:senha@host:porta/banco
PORT=3000
SESSION_SECRET=troque_essa_chave
```

O servidor cria tabelas e indices necessarios na inicializacao.

## E-mails

Nesta versao, o sistema registra e-mails em uma fila simulada, preparada para integracao futura com SMTP/Nodemailer/SendGrid/Resend.

Por padrao, use:

```env
EMAIL_MODE=mock
```

Nesse modo, os e-mails ficam registrados na tabela `emails` e podem ser visualizados no painel administrativo.

Para envio real opcional via SMTP/Nodemailer, configure no `.env`:

```env
EMAIL_MODE=smtp
SMTP_HOST=smtp.exemplo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario
SMTP_PASS=senha
SMTP_FROM="SIGAC <noreply@exemplo.com>"
PASSWORD_RESET_PUBLIC_URL=https://sigac.seudominio.com
TWO_FACTOR_AUTH_ENABLED=true
TWO_FACTOR_CODE_TTL_MINUTES=10
TWO_FACTOR_MAX_ATTEMPTS=5
```

Use `.env.smtp.example` como modelo. A entrega esta padronizada para Gmail com senha de app:

```env
EMAIL_MODE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<MEU_EMAIL_GMAIL>
SMTP_PASS=<MINHA_SENHA_DE_APP_GMAIL>
SMTP_FROM="SIGAC Atividades <MEU_EMAIL_GMAIL>"
```

Depois de preencher o `.env`, teste o envio real com:

```powershell
npm run smtp:test -- destinatario@exemplo.com
```

O SMTP so e acionado quando `EMAIL_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `SMTP_FROM` estiverem configurados. Se a senha de app nao existir ou o envio falhar, o sistema continua registrando a fila local sem quebrar o fluxo. Nunca versionar credenciais SMTP reais.

Para recuperacao de senha por e-mail, configure `PASSWORD_RESET_PUBLIC_URL` com a URL publica do SIGAC. O token e aleatorio, salvo apenas como hash, expira em poucos minutos, funciona uma unica vez e nao e gravado no historico local de e-mails.

Para ativar autenticacao de dois fatores por e-mail, use `TWO_FACTOR_AUTH_ENABLED=true` somente depois que o SMTP real estiver funcionando. O codigo 2FA e aleatorio, salvo apenas como hash vinculado ao desafio de login, expira em poucos minutos, tem limite de tentativas e nao e gravado no historico local de e-mails.

### Fluxos de e-mail do SIGAC

Detalhes completos estao em `docs/fluxos-email-sigac.md` e o roteiro de validacao esta em `docs/checklist-email-sigac.md`.

Eventos principais:

- envio de solicitacao de atividade pelo mobile/web: confirmacao para o aluno e aviso ao coordenador do curso;
- envio de certificado por aluno: confirmacao para o aluno, aviso aos coordenadores do curso e alerta administrativo existente;
- aprovacao ou reprovacao pelo coordenador/admin: resultado enviado ao aluno;
- cadastro de aluno/coordenador: e-mail de boas-vindas sem senha no corpo da mensagem.

O sistema nao envia e-mail para dashboard, abertura de tela, navegacao comum ou erro tecnico interno.

## Como rodar

```bash
npm start
```

Acesse:

```text
http://localhost:3000/
```

Paginas principais:

- Login: `http://localhost:3000/loginsigac.html`
- Super Admin: `http://localhost:3000/adminsigac.html`
- Coordenador: `http://localhost:3000/coordenador.html`
- Aluno: `http://localhost:3000/index.html`

## Como testar

```bash
npm test
```

Esse comando valida estrutura, PWA, `.gitignore`, `.env.example`, documentacao, sintaxe JS e smoke test de API em modo seguro. Por padrao, o smoke test funcional nao exige banco nem servidor rodando.

Para testar rotas reais com o backend ligado:

```powershell
$env:SIGAC_TEST_BASE_URL="http://127.0.0.1:3000"
npm test
```

Opcionalmente, para testar rotas autenticadas:

```powershell
$env:SIGAC_TEST_ADMIN_EMAIL="admin@example.com"
$env:SIGAC_TEST_ADMIN_PASSWORD="senha_do_admin"
npm test
```

## Como rodar o mobile Expo

Entre na pasta mobile:

```powershell
cd mobile/sigac-mobile
npm install
npm run start
```

Use `npm ci` quando quiser respeitar exatamente o `package-lock.json`. O app mobile esta fixado no Expo SDK 54.0.0. A raiz do backend nao possui dependencia `expo`, evitando abrir a pasta errada como projeto Expo mais novo. O pacote npm `expo` fica travado em `54.0.34`, patch compativel do SDK 54.

No celular fisico com Expo Go, nao use `localhost`: use o IP da maquina que roda o backend ou uma API publicada. Para a API responder ao celular na rede local, configure `HOST=0.0.0.0` no `.env` da raiz durante o teste local. Detalhes, rotas usadas e usuarios de teste ficam em `mobile/sigac-mobile/README_MOBILE.md`.

Rotas consumidas pelo mobile:

- `POST /api/auth/login`
- `POST /api/auth/change-temporary-password`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/courses`
- `GET /api/student/dashboard`
- `POST /api/student/active-course`
- `GET /api/student/activities`
- `POST /api/student/submissions`
- `GET /api/mobile/student/submissions/:id/file`

Para validar a estrutura da Entrega 2 Mobile:

```powershell
npm run test:mobile
```

## Como testar o PWA

1. Rode `npm start`.
2. Abra `http://localhost:3000/loginsigac.html` no Chrome ou Edge.
3. Abra DevTools > Application.
4. Confira `Manifest` e `Service Workers`.
5. Use a opcao de instalar aplicativo do navegador.
6. Simule offline com uma tela ja carregada. Assets publicos devem continuar disponiveis; chamadas `/api` nao sao cacheadas e exibem erro amigavel.

## OCR

O OCR e opcional e serve apenas como apoio. Tesseract.js e PDF.js sao carregados por CDN nesta versao. Se a internet, a CDN ou o OCR falharem, o sistema mostra mensagem amigavel e permite continuar a analise manual. O formulario obrigatorio continua sendo a fonte final dos dados criticos.

## Como demonstrar na apresentacao

1. Login como Super Admin.
2. Criar curso.
3. Cadastrar coordenador e vincular ao curso.
4. Login como Coordenador.
5. Cadastrar aluno no curso.
6. Login como Aluno web.
7. Enviar atividade com comprovante.
8. Enviar certificado e processar OCR opcional.
9. Login como Coordenador.
10. Aprovar ou reprovar envio/certificado.
11. Mostrar dashboard atualizado, notificacoes, logs e fila de e-mails.
12. Mostrar instalacao PWA pelo navegador.

## Seguranca

Nunca envie o arquivo `.env` para o GitHub. Use apenas `.env.example` para documentar variaveis necessarias.

O `.gitignore` ignora `.env`, `node_modules`, logs, banco local, exports gerados, tokens, sessoes e artefatos temporarios. Antes de publicar, revise:

```bash
git status
git ls-files .env node_modules
```

## Como gerar pacote limpo para envio

No Windows:

```bat
preparar-envio.bat
```

O script gera `SIGAC-envio.zip` sem `.env`, `.git`, `node_modules`, `data`, `exports`, `.sixth`, logs, banco local, tokens ou sessoes.

## Limitacoes conhecidas

- OCR e apoio automatizado; a decisao final continua humana.
- OCR depende de internet para carregar Tesseract.js/PDF.js nesta versao.
- SMTP real e opcional e depende de configuracao externa.
- Testes automatizados completos de fluxo podem ser ampliados com banco de teste isolado.
- O mobile cobre primeiro o fluxo do Aluno; Admin e Coordenador seguem no web nesta etapa.

## Proximos passos

- Criar suite automatizada de integracao com banco de teste.
- Definir provedor SMTP oficial da instituicao/equipe.
- Expandir o aplicativo mobile para certificados, oportunidades e, futuramente, Coordenador.
- Ampliar monitoramento e relatorios academicos.
