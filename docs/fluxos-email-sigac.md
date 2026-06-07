# Fluxos de e-mail do SIGAC

## Configuração SMTP

O envio real usa Nodemailer e variáveis de ambiente. Não grave credenciais no código e não versione o arquivo `.env`.

```env
EMAIL_MODE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM="SIGAC Atividades <email@dominio.com>"
```

Para Gmail, `SMTP_PASS` deve ser uma senha de app da conta remetente. O arquivo `.env.example` fica sem usuário e senha reais. Se `EMAIL_MODE` não for `smtp`, se `SMTP_PASS` estiver vazio ou se o SMTP falhar, o SIGAC registra o e-mail na tabela `emails` como fila/mock e o fluxo principal continua funcionando.

Teste direto:

```powershell
npm run smtp:test -- destinatario@exemplo.com
```

## Pré-visualização sem SMTP

Para validar assunto, texto e HTML sem enviar e-mail real:

```powershell
npm run email:preview
```

O comando gera arquivos em `exports/email-previews/` com modelos de solicitação registrada, aviso ao coordenador, aprovação, recusa e devolução para ajustes.

## Padrão visual e textual

Os e-mails relacionados a solicitações usam o mesmo layout institucional:

- cabeçalho “SIGAC Atividades”;
- assunto com sufixo `— SIGAC`;
- status destacado visualmente;
- protocolo visual no formato `SIGAC-AAAAMMDD-HHMM-ID`;
- dados da solicitação em bloco categorizado;
- comprovante exibido como `Comprovante enviado`, nunca como `Solicitação`;
- datas no formato brasileiro `DD/MM/AAAA às HH:mm`;
- carga horária como `40h`;
- categorias com capitalização e acentuação padronizadas;
- próximos passos;
- rodapé institucional e aviso de e-mail automático.

O protocolo é gerado apenas para o e-mail, usando dados já existentes. Nenhuma coluna nova foi criada no banco.

## Eventos que enviam e-mail

1. Aluno envia solicitação de atividade complementar pelo mobile ou web: o aluno recebe confirmação e os coordenadores ativos do curso recebem aviso de nova solicitação.
2. Aluno envia certificado/comprovante: o aluno recebe confirmação, os coordenadores do curso recebem aviso e o admin recebe o mesmo padrão institucional.
3. Coordenador aprova solicitação: o aluno recebe e-mail de aprovação com protocolo, curso, categoria, carga horária aprovada e data.
4. Coordenador reprova solicitação: o aluno recebe e-mail de recusa com categoria, carga horária solicitada, comprovante e feedback.
5. Coordenador ou admin aprova/reprova certificado: o aluno recebe e-mail de resultado quando o status muda.
6. Aluno ou coordenador é cadastrado: o usuário recebe e-mail de boas-vindas sem senha no corpo da mensagem.
7. Aluno é vinculado a curso ou coordenador tem vínculos atualizados: o sistema mantém os avisos existentes de vínculo.

## Eventos que não enviam e-mail

- Abertura de tela.
- Dashboard ou consultas comuns.
- Navegação no app.
- Erros técnicos internos.
- Atualização sem mudança de status acadêmico.

## Controle de duplicidade

O backend usa `queueEmail` como camada central. Chamadas críticas usam deduplicação curta para evitar dois e-mails idênticos na mesma ação, sem bloquear novas solicitações futuras. Coordenadores são deduplicados por endereço de e-mail antes do envio.

## Logs e auditoria

Cada e-mail fica registrado na tabela `emails` com destinatário, assunto, corpo texto, tipo, status e data. A auditoria registra eventos como `email_enfileirado` e `email_duplicado_ignorado`. O valor de `SMTP_PASS` nunca deve aparecer em logs.

## Status de correção

O fluxo atual usa `em_analise`, `aprovado` e `rejeitado`. Não foi criado um status intermediário de correção para evitar alterar regra de negócio. Existe template preparado para `correcao_necessaria`, mas ele só deve ser usado quando o fluxo real adotar esse status. Hoje, o botão de correção do coordenador reaproveita rejeição com feedback.
