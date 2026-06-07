# SIGAC - Módulo de ML/Data Science

Este módulo fica isolado na pasta `ml/` para não quebrar o SIGAC web/PWA.
Ele serve para gerar análises, métricas de gestão e um modelo simples de risco do aluno não completar as horas de atividades complementares.

## Como rodar

Entre na pasta `ml`:

```bash
cd ml
```

Instale as dependências sugeridas:

```bash
pip install -r requirements.txt
```

Execute o pipeline básico:

```bash
python scripts/exportar_dados_api.py
python scripts/limpar_dados.py
python scripts/gerar_relatorio_ml.py
python scripts/treinar_modelo.py
```

## Fluxo

1. `exportar_dados_api.py` cria ou exporta dados em `data/raw/`.
2. `limpar_dados.py` lê `data/raw/` e gera `data/processed/dataset_limpo.csv`.
3. `gerar_relatorio_ml.py` gera resumo em `reports/`.
4. `treinar_modelo.py` gera um modelo simples em `models/`.

## Observação importante

Se a API ainda não estiver pronta, o script de exportação cria uma base simulada identificada como simulada.
Na apresentação, deixem claro quando os dados forem simulados.

## Limites do modelo

O modelo de risco é apoio à gestão. Ele não substitui validação humana, análise do coordenador ou regra oficial do SIGAC.
