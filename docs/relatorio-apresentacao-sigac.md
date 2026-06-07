# SIGAC - Relatorio de Apresentacao

Data de preparacao: 07/06/2026  
Apresentacao prevista: 08/06/2026

## 1. Status executivo

O SIGAC foi preparado para demonstracao com base Senac controlada, PWA/backend validado e mobile Expo validado. A base configurada possui 13 cursos ativos, 5 usuarios demo, 4 vinculos aluno-curso, 9 certificados, 4 atividades, 3 oportunidades e dados de ML coerentes para dashboard.

Resultado atual: apto para apresentacao, desde que o backend seja reiniciado antes da demo para carregar a versao atual do `server.js`.

## 2. Base de demonstracao

Banco configurado: Neon em `ep-aged-sea-acul90lg.sa-east-1.aws.neon.tech/neondb`.

Dados principais:

- Cursos ativos: 13
- Usuarios demo: 5
- Vinculos aluno-curso: 4
- Certificados demo: 9
- Atividades: 4
- Oportunidades: 3
- Categorias de regras por curso: 7
- Marcador de base: `presentationBase=senac-demo`
- Meta padrao: `120h`

Backup sanitizado criado antes do reset:

`exports/backup-sigac-2026-06-07-12-13.json`

## 3. Acessos de demonstracao

Senha padrao dos acessos abaixo: `123456`

| Perfil | E-mail | Uso sugerido |
| --- | --- | --- |
| Super Admin | `admin@sigac.local` | Dashboard geral, cursos, relatorios, ML, certificados |
| Coordenador | `coordenador@sigac.local` | Painel de coordenacao, alunos, atividades e validacoes |
| Aluno principal | `einsteinbritoneves@gmail.com` | Dashboard mobile/PWA, dois cursos ativos, certificados e progresso |
| Aluno ADS | `hilccer@sigac.local` | Exemplo de risco alto/sem horas |
| Aluno JD | `izabel@sigac.local` | Exemplo de progresso completo |

## 4. Como iniciar o SIGAC PWA/Web

Abra o PowerShell na raiz do projeto:

```powershell
cd C:\Users\PC\Downloads\SIGAC_FINAL_GITHUB
npm install
npm start
```

Endereco local padrao:

```text
http://127.0.0.1:3000/loginsigac.html
```

Telas principais:

- Login: `http://127.0.0.1:3000/loginsigac.html`
- Admin: `http://127.0.0.1:3000/adminsigac.html`
- Coordenador: `http://127.0.0.1:3000/coordenador.html`
- Aluno/PWA: `http://127.0.0.1:3000/index.html`

Antes da apresentacao, se ja houver um servidor antigo aberto, encerre e rode `npm start` novamente para carregar as correcoes mais recentes.

## 5. Como iniciar o SIGAC Mobile

Em outro PowerShell:

```powershell
cd C:\Users\PC\Downloads\SIGAC_FINAL_GITHUB\mobile\sigac-mobile
npm install
npm run start:clear
```

O app usa Expo SDK 54 e Expo Go. Confirme que o arquivo `.env` do mobile aponta para a API correta:

```text
EXPO_PUBLIC_API_URL=http://IP_DA_MAQUINA:3000
```

Para celular fisico, nao use `127.0.0.1`; use o IP da maquina na mesma rede Wi-Fi. Exemplo:

```text
EXPO_PUBLIC_API_URL=http://192.168.0.10:3000
```

Depois, leia o QR Code no Expo Go.

## 6. Comandos de validacao

Web/backend:

```powershell
cd C:\Users\PC\Downloads\SIGAC_FINAL_GITHUB
node --check server.js scripts\seed-senac-demo.js js\data.js js\admin.js js\coordenador.js js\index.js
npm test
npm run test:mobile
```

Mobile:

```powershell
cd C:\Users\PC\Downloads\SIGAC_FINAL_GITHUB\mobile\sigac-mobile
npx expo-doctor
npx expo export --platform android --output-dir .expo-presentation-validation
```

Se usar o export apenas para teste, pode remover `.expo-presentation-validation` depois.

## 7. Evidencias dos testes de 07/06/2026

Validados com sucesso:

- `node --check` em backend, seed e arquivos JS principais.
- `npm test`: validacao estrutural da Entrega 1 concluida.
- `npm run test:mobile`: validacao estrutural mobile concluida.
- `npx expo-doctor`: 18/18 checks aprovados.
- `npx expo export --platform android`: bundle Android exportado com sucesso.
- Smoke API real com servidor isolado:
  - `/api/public/courses`: 200
  - `/loginsigac.html`: 200
  - `/adminsigac.html`: 200
  - `/coordenador.html`: 200
  - `/index.html`: 200
  - Admin dashboard: 13 cursos, 5 usuarios, 3 oportunidades, meta 120h
  - Mobile dashboard aluno: 2 cursos, 5 certificados, 3 oportunidades, 7 categorias, progresso 42%

## 8. Correcoes aplicadas para apresentacao

- Impedido que a base Senac de demonstracao receba cursos extras no boot do servidor.
- Seed Senac reforcado para validar exatamente 13 cursos ativos.
- Certificados demo trocados de texto cru para HTML profissional.
- Dashboard mobile passou a receber certificados, oportunidades e progresso por categoria.
- Submissoes do dashboard passaram a incluir dados da atividade para exibir nomes amigaveis.
- Confirmacao de envio do aluno por e-mail adicionada ao fluxo.
- Porcentagens seguem exibicao arredondada e visualmente limitada a 100%.

## 9. Checklist rapido para a apresentacao

1. Conectar notebook e celular na mesma rede Wi-Fi.
2. Iniciar backend/PWA com `npm start`.
3. Abrir `http://127.0.0.1:3000/loginsigac.html` no notebook.
4. Confirmar login Admin com `admin@sigac.local`.
5. Confirmar login Aluno com `einsteinbritoneves@gmail.com`.
6. Iniciar mobile com `npm run start:clear`.
7. Confirmar `EXPO_PUBLIC_API_URL` com IP da maquina.
8. Abrir Expo Go e testar login do aluno.
9. Mostrar fluxo recomendado:
   - Admin dashboard e ML.
   - Coordenador com alunos/atividades/certificados.
   - Aluno com progresso, troca de curso, certificados e oportunidades.
   - Mobile com dashboard, certificados e oportunidades.

## 10. Plano de contingencia

Se o mobile nao conectar:

- Verifique se o backend esta ligado.
- Troque `127.0.0.1` pelo IP da maquina no `.env` mobile.
- Rode `npm run start:clear`.
- Confirme que notebook e celular estao na mesma rede.

Se o PWA abrir com dados antigos:

- Pare o servidor Node antigo.
- Rode `npm start` novamente.
- Atualize a pagina com `Ctrl + F5`.

Se a base precisar ser recriada:

```powershell
cd C:\Users\PC\Downloads\SIGAC_FINAL_GITHUB
$env:RESET_CONFIRM='SIM'
npm run prepare:presentation
```

Use o comando acima apenas quando for aceitavel limpar os dados atuais do banco configurado.
