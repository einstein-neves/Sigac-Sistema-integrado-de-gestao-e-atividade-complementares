"""Cria um modelo simples de risco para o SIGAC.

Este arquivo usa uma heurística transparente para evitar dependência obrigatória de bibliotecas pesadas.
Depois, se o grupo quiser, pode trocar por scikit-learn mantendo a mesma entrada e saída.
"""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "processed" / "dataset_limpo.csv"
MODELS_DIR = ROOT / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)


def to_number(value: str) -> float:
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return 0.0


def classificar_risco(horas_aprovadas: float, meta_horas: float, rejeitadas: int, pendentes: int) -> str:
    progresso = horas_aprovadas / meta_horas if meta_horas else 0
    if progresso >= 0.75 and rejeitadas <= 1:
        return "baixo"
    if progresso < 0.35 or rejeitadas >= 3 or pendentes >= 3:
        return "alto"
    return "medio"


def main() -> int:
    if not INPUT.exists():
        raise FileNotFoundError("dataset_limpo.csv não encontrado. Rode limpar_dados.py primeiro.")

    with INPUT.open("r", encoding="utf-8", newline="") as file:
        rows = list(csv.DictReader(file))

    alunos = defaultdict(lambda: {"horas_aprovadas": 0.0, "rejeitadas": 0, "pendentes": 0, "meta_horas": 120.0})

    for row in rows:
        aluno_id = row.get("aluno_id") or "sem_id"
        status = row.get("status", "em_analise")
        alunos[aluno_id]["meta_horas"] = to_number(row.get("meta_horas", "120")) or 120.0
        if status == "aprovado":
            alunos[aluno_id]["horas_aprovadas"] += to_number(row.get("carga_horaria", "0"))
        elif status == "rejeitado":
            alunos[aluno_id]["rejeitadas"] += 1
        else:
            alunos[aluno_id]["pendentes"] += 1

    resultados = []
    for aluno_id, dados in sorted(alunos.items()):
        risco = classificar_risco(
            dados["horas_aprovadas"],
            dados["meta_horas"],
            dados["rejeitadas"],
            dados["pendentes"],
        )
        resultados.append({"aluno_id": aluno_id, **dados, "risco": risco})

    modelo = {
        "tipo": "heuristica_transparente",
        "descricao": "Classifica risco por progresso de horas, rejeições e pendências.",
        "regras": {
            "baixo": "progresso >= 75% e rejeitadas <= 1",
            "alto": "progresso < 35% ou rejeitadas >= 3 ou pendentes >= 3",
            "medio": "demais casos",
        },
        "resultados": resultados,
    }

    output = MODELS_DIR / "modelo_risco_aluno.json"
    output.write_text(json.dumps(modelo, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Modelo salvo em: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
