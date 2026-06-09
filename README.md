# SIGAC

Sistema Integrado de Gestão de Atividades Complementares.

## Descrição

O **SIGAC** é uma aplicação acadêmica web/PWA com integração mobile para controle de atividades complementares. O sistema centraliza cursos, usuários, regras por curso, alunos, envios de atividades, certificados, OCR de apoio, dashboards, notificações, logs e fila de e-mails.

A solução é dividida em:

* **PWA/Web:** utilizado por Super Admin, Coordenador e Aluno.
* **Mobile Expo:** utilizado pelo Aluno para login, dashboard, envio de comprovantes e acompanhamento de status.
* **Backend/API:** servidor único em Node.js responsável pelas regras, autenticação e comunicação com o banco.
* **Banco de Dados:** PostgreSQL, usado para armazenar usuários, cursos, atividades, certificados, envios, logs e configurações.

Fluxo principal do sistema:

```text
Mobile ↔ API ↔ Banco de Dados ↔ PWA
```

O aluno pode enviar dados e arquivos pelo aplicativo mobile. A API recebe, valida e salva as informações no banco. Depois, essas informações ficam disponíveis no PWA para análise do coordenador ou administrador.

## Objetivo do Projeto

O objetivo do SIGAC é facilitar o gerenciamento de atividades complementares em ambiente acadêmico, permitindo que alunos enviem comprovantes e certificados, enquanto coordenadores e administradores acompanham, validam e organizam essas informações de forma centralizada.

## Entrega Web/PWA

A parte web/PWA do SIGAC contempla os perfis:

* Super Admin;
* Coordenador;
* Aluno Web.

O PWA permite:

* login por perfil;
* cadastro e gestão de cursos;
* cadastro de coordenadores e alunos;
* vínculo de usuários a cursos;
* criação e controle de atividades complementares;
* envio e análise de comprovantes;
* envio e análise de certificados;
* dashboards por perfil;
* notificações internas;
* logs de auditoria;
* fila de e-mails;
* OCR opcional como apoio à validação;
* funcionamento responsivo;
* instalação como aplicativo pelo navegador.

## Entrega Mobile

O aplicativo mobile está localizado em:

```text
mobile/sigac-mobile
```

Ele foi desenvolvido com **React Native** utilizando **Expo Go**.

O mobile é focado no perfil de **Aluno** e permite:

* realizar login;
* visualizar dashboard individual;
* alternar curso ativo;
* consultar atividades disponíveis;
* enviar comprovante usando câmera, galeria ou PDF;
* consultar status das solicitações;
* visualizar certificados;
* acompanhar oportunidades;
* consumir o mesmo backend utilizado pelo PWA.

A documentação específica da entrega mobile está em:

```text
docs/entrega-2-mobile.md
docs/checklist-entrega-2-mobile.md
mobile/sigac-mobile/README_MOBILE.md
```

## Tecnologias Utilizadas

### Backend

* Node.js;
* API HTTP;
* PostgreSQL;
* Driver `pg`;
* Dotenv para variáveis de ambiente;
* Nodemailer para envio opcional de e-mails;
* Sessões e autenticação por token.

### Frontend Web/PWA

* HTML;
* CSS;
* JavaScript;
* Manifest PWA;
* Service Worker;
* Cache seguro de arquivos públicos;
* Chart.js local;
* OCR opcional com Tesseract.js/PDF.js via CDN.

### Mobile

* React Native;
* Expo Go;
* React Navigation;
* Expo Image Picker;
* Expo Document Picker;
* Expo File System;
* Expo Secure Store;
* AsyncStorage;
* NetInfo.

## Perfis do Sistema

### Super Admin

Responsável pela gestão global do sistema.

Pode gerenciar:

* cursos;
* usuários;
* regras;
* certificados;
* dashboards;
* logs;
* configurações;
* comunicações;
* fila de e-mails.

### Coordenador

Responsável pelos cursos vinculados ao seu perfil.

Pode gerenciar:

* alunos do curso;
* atividades complementares;
* regras do curso;
* envios de alunos;
* certificados;
* aprovações e reprovações.

### Aluno Web

Pode:

* acompanhar progresso;
* visualizar atividades;
* enviar comprovantes;
* enviar certificados;
* consultar status;
* visualizar oportunidades.

### Aluno Mobile

Pode:

* fazer login pelo app;
* consultar dashboard;
* enviar comprovantes;
* anexar imagem ou PDF;
* acompanhar status;
* consultar certificados e oportunidades.

## Funcionalidades Implementadas

* Autenticação com controle de perfis.
* Senhas armazenadas com hash e salt.
* Cadastro de cursos.
* Cadastro de coordenadores.
* Cadastro de alunos.
* Vínculo de coordenadores e alunos a cursos.
* Regras de atividades complementares por curso.
* Upload de comprovantes em PDF ou imagem.
* Upload de certificados em PDF ou imagem.
* Aprovação e reprovação de envios.
* Dashboard administrativo.
* Dashboard do coordenador.
* Dashboard do aluno.
* OCR opcional como apoio.
* Notificações internas.
* Logs de auditoria.
* Fila de e-mails.
* PWA instalável.
* Cache seguro de arquivos públicos.
* Mobile em Expo Go integrado ao backend.

## Requisitos da Entrega Mobile

O aplicativo mobile atende aos seguintes pontos solicitados:

* navegação com Tabs e Stack;
* interface organizada;
* consumo de API;
* upload/envio de arquivos;
* comunicação com backend/PWA;
* envio de imagem;
* envio de PDF;
* demonstração via Expo Go;
* código-fonte disponível no GitHub;
* documentação simples.

O fluxo principal do mobile é:

```text
Aluno abre o app
↓
Faz login
↓
Acessa dashboard
↓
Consulta atividades
↓
Anexa imagem ou PDF
↓
Envia comprovante
↓
API recebe os dados
↓
Banco armazena
↓
PWA exibe para coordenador/admin
↓
Aluno acompanha o status
```

## Como Instalar o Projeto

Na raiz do projeto, instale as dependências:

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

Depois, configure o arquivo `.env` com os dados locais do projeto.

Nenhuma credencial real acompanha o repositório.

## Configuração do Banco PostgreSQL

No arquivo `.env`, configure a variável `DATABASE_URL`:

```env
DATABASE_URL=postgresql://usuario:senha@host:porta/banco
PORT=3000
SESSION_SECRET=troque_essa_chave
```

O servidor cria as tabelas e índices necessários durante a inicialização.

## Como Rodar o Backend/PWA

Na raiz do projeto, execute:

```bash
npm start
```

Depois acesse no navegador:

```text
http://localhost:3000/
```

Páginas principais:

```text
Login: http://localhost:3000/loginsigac.html
Super Admin: http://localhost:3000/adminsigac.html
Coordenador: http://localhost:3000/coordenador.html
Aluno: http://localhost:3000/index.html
```

## Como Rodar o Mobile com Expo Go

O aplicativo mobile está dentro da pasta:

```text
mobile/sigac-mobile
```

Antes de iniciar o mobile, deixe o backend/PWA rodando na raiz do projeto:

```bash
npm start
```

### 1. Entrar na pasta do mobile

```bash
cd mobile/sigac-mobile
```

### 2. Instalar dependências do mobile

```bash
npm install
```

### 3. Configurar a URL da API

No celular físico com Expo Go, não use `localhost`, porque `localhost` no celular aponta para o próprio celular, não para o computador.

É necessário usar o IP da máquina que está rodando o backend.

No Windows PowerShell, descubra o IP com:

```powershell
ipconfig
```

Procure o endereço IPv4 da rede Wi-Fi. Exemplo:

```text
192.168.0.10
```

No arquivo `.env` do mobile, configure:

```env
EXPO_PUBLIC_API_URL=http://192.168.0.10:3000
```

Troque `192.168.0.10` pelo IP real do computador.

Para permitir que o backend responda ao celular na rede local, no `.env` da raiz do projeto use:

```env
HOST=0.0.0.0
PORT=3000
```

### 4. Iniciar o Expo

Dentro da pasta `mobile/sigac-mobile`, execute:

```bash
npm run start
```

Ou, para limpar o cache:

```bash
npx expo start -c
```

O terminal exibirá um QR Code.

### 5. Abrir no celular

No celular:

1. Instale o aplicativo **Expo Go**.
2. Conecte o celular na mesma rede Wi-Fi do computador.
3. Escaneie o QR Code exibido no terminal.
4. O app SIGAC Mobile será aberto no Expo Go.

### 6. Caso o celular não conecte

Tente iniciar com túnel:

```bash
npx expo start --tunnel -c
```

Verifique também:

* se o backend está rodando;
* se o IP no `EXPO_PUBLIC_API_URL` está correto;
* se o celular e o computador estão na mesma rede;
* se o firewall do Windows não está bloqueando a porta `3000`;
* se o `.env` do mobile foi salvo antes de iniciar o Expo.

Sempre que alterar o `.env` do mobile, reinicie o Expo com:

```bash
npx expo start -c
```

## Rotas Consumidas pelo Mobile

O aplicativo mobile consome rotas do backend, incluindo:

```text
POST /api/auth/login
POST /api/auth/change-temporary-password
POST /api/auth/logout
GET /api/me
GET /api/courses
GET /api/student/dashboard
POST /api/student/active-course
GET /api/student/activities
POST /api/student/submissions
GET /api/mobile/student/submissions/:id/file
```

## Como Testar o Projeto

Para executar os testes gerais:

```bash
npm test
```

Esse comando valida:

* estrutura do projeto;
* PWA;
* `.gitignore`;
* `.env.example`;
* documentação;
* sintaxe JavaScript;
* smoke test de API em modo seguro.

Por padrão, o smoke test funcional não exige banco nem servidor rodando.

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

Para validar a estrutura da entrega mobile:

```bash
npm run test:mobile
```

## Como Testar o PWA

1. Rode o backend:

```bash
npm start
```

2. Abra no navegador:

```text
http://localhost:3000/loginsigac.html
```

3. No Chrome ou Edge, abra:

```text
DevTools > Application
```

4. Confira:

* Manifest;
* Service Worker;
* Cache Storage;
* ícones;
* instalação do PWA.

5. Teste a instalação pelo navegador.

6. Simule offline com uma tela já carregada.

Os arquivos públicos continuam disponíveis em cache. As chamadas `/api` não são cacheadas e exibem erro amigável caso não exista conexão.

## E-mails

O sistema possui uma fila de e-mails.

Por padrão, a entrega usa:

```env
EMAIL_MODE=mock
```

Nesse modo, os e-mails não são enviados de verdade. Eles ficam registrados na fila local/tabela de e-mails e podem ser consultados pelo painel administrativo.

Para envio real via SMTP/Nodemailer, configure no `.env`:

```env
EMAIL_MODE=smtp
SMTP_HOST=smtp.exemplo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario
SMTP_PASS=senha
SMTP_FROM="SIGAC <noreply@exemplo.com>"
```

Para Gmail, use senha de app:

```env
EMAIL_MODE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<MEU_EMAIL_GMAIL>
SMTP_PASS=<MINHA_SENHA_DE_APP_GMAIL>
SMTP_FROM="SIGAC Atividades <MEU_EMAIL_GMAIL>"
```

Depois de configurar, teste com:

```bash
npm run smtp:test -- destinatario@exemplo.com
```

Nunca envie credenciais SMTP reais para o GitHub.

## Recuperação de Senha

Para recuperação de senha por e-mail, configure:

```env
PASSWORD_RESET_PUBLIC_URL=https://sigac.seudominio.com
```

O token de recuperação é aleatório, salvo apenas como hash, expira em poucos minutos, funciona uma única vez e não é gravado em texto puro no histórico local de e-mails.

## Autenticação em Duas Etapas

A autenticação em duas etapas por e-mail pode ser ativada com:

```env
TWO_FACTOR_AUTH_ENABLED=true
TWO_FACTOR_CODE_TTL_MINUTES=10
TWO_FACTOR_MAX_ATTEMPTS=5
```

Use essa configuração somente depois que o SMTP real estiver funcionando.

O código 2FA é aleatório, salvo apenas como hash, expira em poucos minutos e possui limite de tentativas.

## OCR

O OCR é opcional e serve apenas como apoio para análise de certificados e comprovantes.

Nesta versão, Tesseract.js e PDF.js podem ser carregados por CDN.

Se a internet, a CDN ou o OCR falharem, o sistema exibe uma mensagem amigável e permite continuar a análise manual.

A decisão final de aprovação ou reprovação continua sendo humana.

## Como Demonstrar na Apresentação

Roteiro sugerido:

1. Rodar o backend com `npm start`.
2. Abrir o PWA em `http://localhost:3000/`.
3. Fazer login como Super Admin.
4. Mostrar cadastro de curso.
5. Mostrar cadastro de coordenador e vínculo ao curso.
6. Fazer login como Coordenador.
7. Mostrar cadastro ou listagem de aluno.
8. Fazer login como Aluno.
9. Enviar uma atividade com comprovante.
10. Enviar certificado e mostrar OCR opcional.
11. Voltar como Coordenador/Admin.
12. Aprovar ou reprovar envio/certificado.
13. Mostrar dashboard atualizado.
14. Mostrar notificações, logs e fila de e-mails.
15. Mostrar instalação PWA pelo navegador.
16. Abrir o mobile pelo Expo Go.
17. Fazer login no app.
18. Mostrar dashboard mobile.
19. Enviar comprovante com imagem ou PDF.
20. Mostrar que o envio chega no backend/PWA.

## Segurança

Nunca envie o arquivo `.env` para o GitHub.

Use apenas:

```text
.env.example
.env.smtp.example
```

para documentar variáveis necessárias.

O `.gitignore` ignora:

* `.env`;
* `node_modules`;
* logs;
* banco local;
* exports gerados;
* tokens;
* sessões;
* arquivos temporários.

Antes de publicar, revise:


O ideal é que o segundo comando não retorne nada.

## Como Gerar Pacote Limpo para Envio

No Windows:

```bash
preparar-envio.bat
```

Esse script gera um pacote `SIGAC-envio.zip` sem arquivos sensíveis ou desnecessários, como:

* `.env`;
* `.git`;
* `node_modules`;
* bancos locais;
* logs;
* tokens;
* sessões;
* arquivos temporários.

## Estrutura Principal do Projeto

```text
SIGAC/
├── docs/
├── icons/
├── js/
├── mobile/
│   └── sigac-mobile/
├── scripts/
├── vendor/
├── server.js
├── package.json
├── manifest.json
├── service-worker.js
├── sigac.css
├── student-polish.css
├── adminsigac.html
├── coordenador.html
├── index.html
├── loginsigac.html
├── README.md
└── .env.example
```

## Limitações Conhecidas

* O OCR é apenas apoio automatizado.
* A decisão final continua sendo feita por coordenador ou administrador.
* O OCR pode depender de internet/CDN nesta versão.
* SMTP real depende de configuração externa.
* Testes automatizados completos podem ser ampliados com banco isolado.
* O mobile cobre principalmente o fluxo do Aluno.
* Admin e Coordenador seguem prioritariamente no PWA/Web.

## Próximos Passos

* Ampliar testes automatizados com banco de teste.
* Definir provedor SMTP oficial.
* Expandir o mobile para mais recursos administrativos.
* Melhorar relatórios acadêmicos.
* Ampliar monitoramento e métricas.
* Publicar backend/API em ambiente online para facilitar testes externos.

## Link do Repositório

```text

```
