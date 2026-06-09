from pathlib import Path

pastas = [
    "ml/data/raw",
    "ml/data/processed",
    "ml/data/exports",
    "ml/notebooks",
    "ml/scripts",
    "ml/models",
    "ml/reports",
]

arquivos = [
    "ml/notebooks/01_exploracao_dados_sigac.ipynb",
    "ml/notebooks/02_metricas_aprovacao_rejeicao.ipynb",
    "ml/notebooks/03_modelo_risco_aluno.ipynb",

    "ml/scripts/exportar_dados_api.py",
    "ml/scripts/limpar_dados.py",
    "ml/scripts/treinar_modelo.py",
    "ml/scripts/gerar_relatorio_ml.py",

    "ml/README_ML.md"
]

for pasta in pastas:
    Path(pasta).mkdir(parents=True, exist_ok=True)

for arquivo in arquivos:
    Path(arquivo).touch(exist_ok=True)

print("Estrutura ML criada com sucesso!")