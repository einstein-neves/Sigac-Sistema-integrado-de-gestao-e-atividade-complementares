"""Limpa e padroniza os dados brutos do SIGAC para uso em métricas e modelo."""

from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

STATUS_MAP = {
    "aprovado": "aprovado",
    "aprovada": "aprovado",
    "rejeitado": "rejeitado",
    "rejeitada": "rejeitado",
    "reprovado": "rejeitado",
    "reprovada": "rejeitado",
    "pendente": "em_analise",
    "em analise": "em_analise",
    "em análise": "em_analise",
    "em_analise": "em_analise",
}


def normalize_status(value: str) -> str:
    text = (value or "").strip().lower()
    return STATUS_MAP.get(text, text or "em_analise")


def to_number(value: str, default: float = 0.0) -> float:
    try:
        return float(str(value).replace(",", ".").strip())
    except (TypeError, ValueError):
        return default


def find_input_file() -> Path:
    files = sorted(RAW_DIR.glob("*.csv"))
    if not files:
        raise FileNotFoundError("Nenhum CSV encontrado em ml/data/raw. Rode exportar_dados_api.py primeiro.")
    return files[0]


def main() -> int:
    input_file = find_input_file()
    output_file = PROCESSED_DIR / "dataset_limpo.csv"

    with input_file.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        rows = list(reader)

    cleaned = []
    seen = set()
    for row in rows:
        aluno_id = str(row.get("aluno_id", "")).strip()
        curso = str(row.get("curso", "")).strip().upper() or "NAO_INFORMADO"
        categoria = str(row.get("categoria", "")).strip().lower() or "nao_informado"
        carga = to_number(row.get("carga_horaria", "0"))
        status = normalize_status(row.get("status", ""))
        data_envio = str(row.get("data_envio", "")).strip()
        feedback = str(row.get("feedback", "")).strip()
        meta = to_number(row.get("meta_horas", "120"), 120.0)

        key = (aluno_id, curso, categoria, carga, status, data_envio)
        if key in seen:
            continue
        seen.add(key)

        cleaned.append({
            "aluno_id": aluno_id,
            "curso": curso,
            "categoria": categoria,
            "carga_horaria": f"{carga:.2f}",
            "status": status,
            "data_envio": data_envio,
            "feedback": feedback,
            "meta_horas": f"{meta:.2f}",
        })

    with output_file.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(cleaned[0].keys()))
        writer.writeheader()
        writer.writerows(cleaned)

    print(f"Dados limpos salvos em: {output_file}")
    print(f"Registros processados: {len(cleaned)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
