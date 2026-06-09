# Fluxo Mobile, API e PWA do SIGAC

## Visão geral

O SIGAC usa uma única API Node/Express e um único banco PostgreSQL para atender o aplicativo mobile e o PWA:

1. O aluno envia uma atividade ou certificado pelo mobile ou PWA.
2. A API autentica o aluno, valida o arquivo e armazena os dados no banco.
3. O PWA exibe o envio para o Coordenador ou Admin responsável.
4. O OCR auxilia a leitura do certificado, sem substituir a validação humana.
5. Coordenador ou Admin aprova, rejeita ou remove o certificado da contagem.
6. A análise ML classifica risco e progresso.
7. Tabela ML, cards, gráficos e relatórios usam a mesma base acadêmica.

A consulta de alunos em risco é recalculada a partir da base atual do dashboard. O Admin recebe todos os cursos e alunos; o Coordenador recebe somente seus vínculos. A fórmula permanece a mesma nos dois perfis.

## Regras principais

- O OCR em lote aceita até 10 certificados por envio.
- O X remove o certificado da contagem, mas mantém o arquivo e o histórico para rastreabilidade.
- Um aluno pode ter até dois cursos com o mesmo e-mail e matrículas diferentes.
- O Admin visualiza todos os alunos, cursos e vínculos.
- O Coordenador visualiza somente alunos e cursos vinculados a ele.
- O aluno acompanha progresso, atividades, certificados e oportunidades.
- Somente horas aprovadas entram no progresso.
- Horas aproveitadas e progresso são limitados à meta do curso.
- Horas identificadas/registradas permanecem disponíveis para auditoria mesmo quando ultrapassam a meta.
- Ao atingir a meta, o aluno fica concluído e com risco ML baixo.

## Compatibilidade mobile

O backend mantém as rotas atuais do PWA e também oferece aliases `/api/mobile/student/...`:

- `GET /api/mobile/student/profile`
- `GET /api/mobile/student/dashboard`
- `POST /api/mobile/student/active-course`
- `GET /api/mobile/student/activities`
- `POST /api/mobile/student/submissions`
- `GET|POST /api/mobile/student/certificates`
- `GET /api/mobile/student/opportunities`
- `POST /api/mobile/student/opportunities/:id/toggle`

Os aliases reutilizam as mesmas autenticações, validações e regras das rotas web.
