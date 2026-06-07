# SIGAC Mobile

Aplicativo mobile do SIGAC para alunos, em React Native com Expo SDK 54.0.0, compativel com o Expo Go usado nos celulares de teste. O app consome a API real do backend e cobre login, primeiro acesso, curso ativo, dashboard, atividades, certificados, oportunidades, status, cache offline parcial, rascunhos e push token.

## Instalar

Execute os comandos dentro da pasta do app:

```powershell
cd mobile/sigac-mobile
npm install
```

Para reproduzir exatamente o `package-lock.json`, use `npm ci`. O pacote `expo` usa a linha `54.0.x`, com `sdkVersion: 54.0.0` no `app.json`.

## Configurar API

Configure `EXPO_PUBLIC_API_URL` em `mobile/sigac-mobile/.env`. Nao altere o `.env` durante empacotamento ou limpeza.

Exemplo:

```env
EXPO_PUBLIC_API_URL=http://SEU-IP-DA-MAQUINA:3000
```

Em celular fisico, nao use `localhost`; use o IP da maquina na mesma rede. No backend, rode com `HOST=0.0.0.0` quando for testar pelo telefone.

## Rodar

```powershell
cd mobile/sigac-mobile
npm run start
```

Com cache limpo:

```powershell
npm run start:clear
```

Com tunnel:

```powershell
npm run start:tunnel
```

A raiz do projeto tambem possui atalhos que entram na pasta correta:

```powershell
npm run start:mobile
npm run start:mobile:clear
```

## Fluxos Para Testar

1. Login normal de aluno: entrar com aluno sem senha temporaria e conferir Dashboard.
2. Senha temporaria: entrar com aluno `mustChangePassword`, trocar a senha em Primeiro acesso e voltar ao login.
3. Bloqueio de perfis web: tentar coordenador/admin e confirmar a mensagem de app exclusivo para aluno.
4. Troca de curso: Perfil > Usar este curso; dashboard, status e atividades devem recarregar.
5. Dashboard por categoria: conferir total aprovado, meta, faltantes, pendentes, rejeitadas, percentual e barras por regra.
6. Atividades: filtrar por status, prazo vencido e categoria; atividades vencidas devem aparecer bloqueadas.
7. Nova atividade: escolher atividade, selecionar categoria real do curso, validar carga horaria e anexar comprovante.
8. Upload: testar camera com recorte, galeria, PDF, preview, troca e remocao de arquivo.
9. Status: abrir detalhes, comprovante e corrigir/reencaminhar solicitacao rejeitada.
10. Certificados: preencher titulo, instituicao, participante, data, horas maior que zero e enviar por camera, galeria ou PDF.
11. OCR: quando o backend retornar campos OCR, conferir resumo humano e dados detectados no historico.
12. Oportunidades: inscrição/desinscrição nao deve ser confundida com horas aprovadas.
13. Offline: carregar telas online, desligar rede e verificar cache persistente com aviso de dados possivelmente desatualizados.
14. Rascunhos: preencher atividade ou certificado, sair/voltar e recuperar o rascunho.
15. Push: em dispositivo fisico, aceitar permissao e verificar envio do token ao backend.
16. Android/iOS: testar no Expo Go com a mesma URL de API acessivel pelo dispositivo.

## Endpoints Usados

- `POST /api/auth/login`
- `POST /api/auth/change-temporary-password`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/mobile/student/profile`
- `POST /api/student/active-course`
- `GET /api/mobile/student/dashboard`
- `GET /api/mobile/student/activities`
- `POST /api/mobile/student/submissions`
- `GET /api/mobile/student/submissions/:id/file`
- `GET /api/mobile/student/certificates`
- `POST /api/mobile/student/certificates`
- `GET /api/certificates/:id/file`
- `GET /api/mobile/student/opportunities`
- `POST /api/mobile/student/opportunities/:id/toggle`
- `POST /api/mobile/student/push-token`

## Dependencias De Backend

- Categorias e limites dependem de `activity_rules`.
- Correcao/reenvio usa o versionamento existente de `submission_versions`.
- Cancelamento de envio ainda depende de endpoint especifico no backend.
- OCR de certificados depende do processamento backend preencher `detectedTitle`, `detectedHours`, `humanSummary`, `ocrStatus` e campos relacionados.
- Push real depende de rotina backend para disparar notificacoes; o app ja registra o token.

## Limpeza Para Entrega

Pode ser removido antes de compactar a entrega, se nao estiver em uso:

- `mobile/sigac-mobile/node_modules`
- `node_modules` da raiz
- `.expo` da raiz e de `mobile/sigac-mobile`
- `mobile/sigac-mobile/dist`
- logs `*.log`
- prints antigos `*.png` gerados por testes
- builds e caches locais antigos

Nao remova nem altere arquivos `.env`.
