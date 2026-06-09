# Entrega 2 - Mobile

Este documento descreve como instalar, configurar, executar e validar o aplicativo mobile React Native/Expo do SIGAC para alunos.

## Escopo

O app mobile fica em `mobile/sigac-mobile` e consome o backend existente do SIGAC. O fluxo mobile e exclusivo para alunos e cobre login, dashboard individual, troca de curso ativo, atividades, envio de comprovantes por camera/galeria/PDF, status das solicitacoes, certificados e oportunidades.

## Instalar dependencias

Na raiz:

```powershell
npm install
```

No app mobile:

```powershell
cd mobile/sigac-mobile
npm ci
```

O app mobile esta travado no Expo SDK 54.0.0. Use `npm ci` para respeitar o `package-lock.json` e evitar que o Expo ou bibliotecas nativas sejam atualizados automaticamente. A dependencia `expo` deve existir apenas em `mobile/sigac-mobile`, nao na raiz do backend. O pacote npm `expo` fica fixado em `54.0.34`, patch compatível do SDK 54.

## Configurar ambiente

Na raiz, copie `.env.example` para `.env` e configure:

```env
DATABASE_URL=postgresql://usuario:senha@host:porta/banco
PORT=3000
HOST=0.0.0.0
SESSION_SECRET=troque_essa_chave
EMAIL_MODE=mock
```

No mobile, copie `mobile/sigac-mobile/.env.example` para `.env` e configure:

```env
EXPO_PUBLIC_API_URL=http://SEU-IP-DA-MAQUINA:3000
```

Nao coloque senhas reais, tokens ou credenciais SMTP em arquivos versionados.

## Rodar backend

Na raiz:

```powershell
npm start
```

Para testar no celular, use `HOST=0.0.0.0` e aponte o mobile para o IP da maquina que executa o backend. `localhost` no celular aponta para o proprio celular.

## Rodar app Expo

```powershell
cd mobile/sigac-mobile
.\start-expo-go.ps1
```

Ou manualmente:

```powershell
$env:EXPO_PUBLIC_API_URL="http://SEU-IP-DA-MAQUINA:3000"
npm run start:lan
```

## Login de aluno

Use um usuario com perfil `aluno`. Perfis `superadmin` e `coordenador` sao bloqueados no app mobile e devem usar o PWA/web.

Se estiver usando seed demo em banco de desenvolvimento vazio, consulte `mobile/sigac-mobile/README_MOBILE.md` para exemplos de usuarios. Em banco real, use credenciais cadastradas pelo SIGAC.

## Testar troca de curso

1. Entre como aluno vinculado a mais de um curso.
2. Abra `Perfil`.
3. Confira o curso marcado como `Ativo`.
4. Toque em `Usar este curso` em outro curso vinculado.
5. Volte ao dashboard e atividades para confirmar que os dados foram recarregados para o curso selecionado.

O backend valida que o curso escolhido pertence ao aluno antes de atualizar o curso ativo.

## Testar envio com camera

1. Abra `Atividades`.
2. Escolha uma atividade disponivel.
3. Preencha todos os campos obrigatorios.
4. Toque em `Tirar foto com a camera`.
5. Autorize a permissao quando solicitado.
6. Confira a pre-visualizacao da imagem.
7. Envie para analise.

Se a permissao for negada ou a captura cancelada, o app mostra mensagem clara e permite tentar outra opcao.

## Testar envio com galeria

1. Abra o formulario de envio.
2. Toque em `Selecionar da galeria`.
3. Escolha uma imagem JPG, PNG ou WEBP.
4. Confira a pre-visualizacao e envie.

## Testar envio com PDF

1. Abra o formulario de envio.
2. Toque em `Selecionar PDF/arquivo`.
3. Escolha um PDF.
4. Confira o nome do arquivo exibido.
5. Envie para analise.

## Testar status das solicitacoes

1. Apos enviar uma atividade, abra a aba `Status`.
2. Confira titulo, categoria, carga horaria, status, data de envio, observacao/feedback e comprovante associado.
3. Toque em `Abrir comprovante` para validar o acesso ao arquivo.

## E-mail e SMTP

Ao registrar uma nova solicitacao, o backend mantem a notificacao/e-mail para a coordenacao e adiciona uma confirmacao ao aluno com nome, curso, categoria, carga horaria e data de envio.

Com `EMAIL_MODE=mock`, a mensagem fica registrada na fila local/tabela `emails`. Para envio real, configure SMTP no `.env` da raiz:

```env
EMAIL_MODE=smtp
SMTP_HOST=smtp.exemplo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario
SMTP_PASS=senha
SMTP_FROM="SIGAC <noreply@exemplo.com>"
```

Para Gmail, use senha de app e o padrao:

```env
EMAIL_MODE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<MEU_EMAIL_GMAIL>
SMTP_PASS=<MINHA_SENHA_DE_APP_GMAIL>
SMTP_FROM="SIGAC Atividades <MEU_EMAIL_GMAIL>"
```

Se `SMTP_PASS` nao existir, se SMTP nao estiver configurado ou se o envio falhar, o fluxo nao quebra; o e-mail permanece registrado como fila/mock.

O arquivo `.env.smtp.example` traz modelos para Gmail, Outlook/Microsoft 365 e dominio proprio. Para testar o SMTP real:

```powershell
npm run smtp:test -- destinatario@exemplo.com
```

Os fluxos transacionais completos estao descritos em `docs/fluxos-email-sigac.md`. Para a Entrega 2 Mobile, o fluxo obrigatorio e: aluno envia solicitacao pelo app, backend registra a solicitacao, aluno recebe confirmacao, coordenador do curso recebe aviso, e o aluno recebe o resultado quando a coordenacao aprova ou reprova.

## OCR

O OCR existente permanece como apoio em certificados e revisoes do SIGAC. O aluno deve preencher e revisar manualmente os campos obrigatorios antes do envio. Falhas de OCR nao impedem o envio manual.

## Limpeza da entrega

Antes de enviar, gere um pacote limpo:

```powershell
.\preparar-envio.bat
```

O script remove do pacote `.env`, `.git`, `node_modules`, `.expo`, `dist`, `build`, logs, bancos locais, zips antigos e arquivos temporarios.

## Validacao automatizada leve

Na raiz:

```powershell
npm run test:mobile
```

Esse teste confere a presenca estrutural dos recursos da Entrega 2 Mobile. O teste em aparelho ainda e necessario para validar camera, permissao e QR Code do Expo Go.
