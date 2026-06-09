# Tarefas ML - SIGAC

## Isaque

Responsável por coleta, base bruta e exploração inicial.

Arquivos principais:

- `scripts/exportar_dados_api.py`
- `data/raw/`
- `data/exports/`
- `notebooks/01_exploracao_dados_sigac.ipynb`
- `dicionario_campos.md`

Entrega esperada: dados chegando organizados, com origem clara e sem mexer no banco principal.

## Einstein

Responsável por limpeza, métricas, gráficos e relatório de gestão.

Arquivos principais:

- `scripts/limpar_dados.py`
- `data/processed/`
- `notebooks/02_metricas_aprovacao_rejeicao.ipynb`
- `scripts/gerar_relatorio_ml.py`
- `reports/`

Entrega esperada: dados brutos transformados em informação visual e compreensível para gestão.

## Hilccer

Responsável por modelo de risco, integração técnica e explicação.

Arquivos principais:

- `notebooks/03_modelo_risco_aluno.ipynb`
- `scripts/treinar_modelo.py`
- `models/`
- `README_ML.md`

Entrega esperada: modelo simples de risco, com métricas, limites e explicação para apresentação.

## Regra de ouro

Ninguém altera banco real para testar ML. O pipeline trabalha com exportações, cópias controladas ou base simulada identificada.
