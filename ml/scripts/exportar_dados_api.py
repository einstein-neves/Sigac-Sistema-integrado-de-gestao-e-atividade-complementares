"""Exporta dados para o módulo ML do SIGAC.

Uso:
    python scripts/exportar_dados_api.py

Se a variável SIGAC_API_URL estiver definida, o script tenta buscar dados da API.
Se não estiver definida ou se a API falhar, cria uma base simulada em data/raw.
"""

from __future__ import annotations

import csv
import json
import os
import sys
from pathlib import Path
from urllib.error import URLError, HTTPError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)

SIMULATED_ROWS = [
    {"aluno_id": "101", "curso": "ADS", "categoria": "curso", "carga_horaria": "40", "status": "aprovado", "data_envio": "2026-05-01", "feedback": "", "meta_horas": "120"},
    {"aluno_id": "102", "curso": "ADS", "categoria": "palestra", "carga_horaria": "10", "status": "rejeitado", "data_envio": "2026-05-02", "feedback": "Falta nome no certificado", "meta_horas": "120"},
    {"aluno_id": "103", "curso": "ADS", "categoria": "projeto", "carga_horaria": "30", "status": "em_analise", "data_envio": "2026-05-03", "feedback": "", "meta_horas": "120"},
    {"aluno_id": "104", "curso": "Sistemas", "categoria": "curso", "carga_horaria": "60", "status": "aprovado", "data_envio": "2026-05-04", "feedback": "", "meta_horas": "120"},
    {"aluno_id": "105", "curso": "ADS", "categoria": "evento", "carga_horaria": "8", "status": "rejeitado", "data_envio": "2026-05-05", "feedback": "Carga horaria ilegivel", "meta_horas": "120"},
]


def save_csv(rows: list[dict[str, str]], path: Path) -> None:
    if not rows:
        raise ValueError("Nenhum dado para salvar.")
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def fetch_api(api_url: str) -> list[dict[str, str]]:
    with urlopen(api_url, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if isinstance(payload, dict):
        for key in ("data", "result", "items", "solicitacoes"):
            if isinstance(payload.get(key), list):
                payload = payload[key]
                break
    if not isinstance(payload, list):
        raise ValueError("Resposta da API não veio como lista de registros.")
    return [dict(item) for item in payload]


def main() -> int:
    api_url = os.getenv("SIGAC_API_URL", "").strip()
    output = RAW_DIR / "certificados_bruto.csv"

    if api_url:
        try:
            rows = fetch_api(api_url)
            save_csv(rows, output)
            print(f"Dados exportados da API para: {output}")
            return 0
        except (URLError, HTTPError, ValueError, TimeoutError) as exc:
            print(f"Aviso: não foi possível buscar API ({exc}). Usando base simulada.")

    output = RAW_DIR / "certificados_simulados.csv"
    save_csv(SIMULATED_ROWS, output)
    print(f"Base simulada criada em: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
