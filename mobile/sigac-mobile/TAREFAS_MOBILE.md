# Tarefas Mobile - SIGAC

## Arthur

Responsável pela base do app, autenticação, navegação e cursos.

Arquivos principais:

- `package.json`
- `app.json`
- `src/services/api.js`
- `src/screens/LoginScreen.jsx`
- `src/screens/MeusCursosScreen.jsx`
- `src/navigation/`

Entrega esperada: app abrindo, login funcionando, sessão protegida e cursos aparecendo.

## Guilherme

Responsável por dashboard, nova atividade, upload e status.

Arquivos principais:

- `src/screens/DashboardAlunoScreen.jsx`
- `src/screens/NovaAtividadeScreen.jsx`
- `src/screens/UploadComprovanteScreen.jsx`
- `src/screens/StatusSolicitacoesScreen.jsx`
- `src/components/`
- `src/utils/`

Entrega esperada: aluno consultando progresso, cadastrando atividade, enviando comprovante e vendo status.

## Regra de ouro

`api.js` tem um dono principal para evitar conflito. O outro integrante revisa, testa e pede ajustes.
Não espalhar URL de API pelas telas.
