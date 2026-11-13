"""Gera data/dicionario.json a partir do dicionário literário do Caderno Inteligente.

Uso: python3 tools/dicionario.py ~/Downloads/Transcrito/backend
"""
import json, sys, pathlib
sys.path.insert(0, sys.argv[1])
from app.data.literary_dictionary import all_entries  # noqa: E402

out = [{"t": t, "c": e.canonical, "v": list(e.variants), "k": list(e.capitalized), "x": e.context}
       for t, e in all_entries()]
p = pathlib.Path(__file__).resolve().parent.parent / "data" / "dicionario.json"
p.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print(len(out), "entradas ->", p)
