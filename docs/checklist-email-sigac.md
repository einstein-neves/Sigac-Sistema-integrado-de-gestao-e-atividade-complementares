# Checklist de testes - E-mails SIGAC

1. Aluno envia solicitacao pelo mobile e recebe o e-mail `Solicitacao de atividade complementar registrada`.
2. Coordenador vinculado ao curso recebe `Nova solicitacao de atividade complementar recebida`.
3. Coordenador aprova a solicitacao e o aluno recebe `Atividade complementar aprovada`.
4. Coordenador reprova a solicitacao com feedback e o aluno recebe `Atividade complementar reprovada`.
5. `EMAIL_MODE=mock` ou `SMTP_PASS` vazio nao quebra o envio da solicitacao; o e-mail fica registrado na tabela `emails`.
6. A mesma acao nao gera e-mails duplicados para o mesmo destinatario.
7. `SMTP_PASS`, tokens e senhas nao aparecem em logs, no painel de e-mails nem em arquivos versionados.
8. Coordenador so recebe e-mail de solicitacoes dos cursos aos quais esta vinculado.
9. Envio de certificado pelo aluno gera confirmacao para o aluno e aviso para coordenador/admin.
10. Aprovacao ou reprovacao de certificado envia resultado ao aluno apenas quando o status muda.

## Teste SMTP real

Com `.env` local configurado:

```powershell
npm run smtp:test -- destinatario@exemplo.com
```

Resultado esperado: mensagem enviada pelo remetente configurado em `SMTP_FROM`. Se falhar, conferir senha de app do Gmail, `EMAIL_MODE=smtp`, host, porta e bloqueios da conta.
