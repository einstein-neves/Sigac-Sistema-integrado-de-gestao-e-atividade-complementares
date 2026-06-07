# Dicionário de campos - ML SIGAC

Este arquivo evita que cada integrante interprete os dados de um jeito diferente.
Atualize sempre que uma nova coluna entrar no pipeline.

| Campo | Tipo | Origem | Exemplo | Aceita nulo? | Uso no ML/relatório |
|---|---|---|---|---|---|
| aluno_id | inteiro/texto | API SIGAC ou base simulada | 101 | Não | Identificar o aluno sem expor nome quando possível |
| curso | texto | Cadastro do aluno | ADS | Não | Agrupar métricas por curso |
| carga_horaria | número | Atividade/certificado | 40 | Não | Calcular horas realizadas |
| status | texto | Solicitação | aprovado / rejeitado / em_analise | Não | Métricas e risco |
| categoria | texto | Tipo da atividade | curso / palestra / projeto | Sim | Encontrar categorias críticas |
| data_envio | data | Solicitação | 2026-05-18 | Sim | Analisar atraso e volume por período |
| feedback | texto | Admin/coordenação | Falta nome no certificado | Sim | Análise de rejeições |
| meta_horas | número | Curso/regra acadêmica | 120 | Sim | Calcular progresso do aluno |
| horas_aprovadas | número | Dados processados | 80 | Sim | Entrada do modelo de risco |
| qtd_rejeitadas | número | Dados processados | 2 | Sim | Entrada do modelo de risco |
| qtd_pendentes | número | Dados processados | 1 | Sim | Entrada do modelo de risco |
| risco | texto | Modelo/heurística | baixo / medio / alto | Sim | Saída do modelo |

## Regra de status padronizado

Use sempre estes valores nos dados processados:

- aprovado
- rejeitado
- em_analise

Evite misturar `pendente`, `em análise`, `Em Analise`, `reprovado` e variações sem padronizar antes.
