"""Gera resumo de métricas do SIGAC para apresentação e gestão."""

from __future__ import annotations

import csv
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "processed" / "dataset_limpo.csv"
REPORTS_DIR = ROOT / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def read_rows() -> list[dict[str, str]]:
    if not INPUT.exists():
        raise FileNotFoundError("dataset_limpo.csv não encontrado. Rode limpar_dados.py primeiro.")
    with INPUT.open("r", encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def to_number(value: str) -> float:
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return 0.0


def main() -> int:
    rows = read_rows()
    total = len(rows)
    status_counter = Counter(row["status"] for row in rows)
    curso_counter = Counter(row["curso"] for row in rows)
    horas_por_curso = defaultdict(float)

    for row in rows:
        if row.get("status") == "aprovado":
            horas_por_curso[row.get("curso", "NAO_INFORMADO")] += to_number(row.get("carga_horaria", "0"))

    resumo_csv = REPORTS_DIR / "resumo_metricas.csv"
    with resumo_csv.open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["metrica", "valor"])
        writer.writerow(["total_registros", total])
        for status, count in sorted(status_counter.items()):
            writer.writerow([f"status_{status}", count])
        for curso, count in sorted(curso_counter.items()):
            writer.writerow([f"registros_curso_{curso}", count])
        for curso, horas in sorted(horas_por_curso.items()):
            writer.writerow([f"horas_aprovadas_{curso}", f"{horas:.2f}"])

    resumo_txt = REPORTS_DIR / "resumo_executivo.txt"
    aprovados = status_counter.get("aprovado", 0)
    rejeitados = status_counter.get("rejeitado", 0)
    pendentes = status_counter.get("em_analise", 0)
    taxa_aprovacao = (aprovados / total * 100) if total else 0

    resumo_txt.write_text(
        (
            "Resumo executivo - ML SIGAC\n"
            f"Total de registros: {total}\n"
            f"Aprovados: {aprovados}\n"
            f"Rejeitados: {rejeitados}\n"
            f"Em análise: {pendentes}\n"
            f"Taxa de aprovação: {taxa_aprovacao:.2f}%\n"
        ),
        encoding="utf-8",
    )

    print(f"Relatórios gerados em: {REPORTS_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
