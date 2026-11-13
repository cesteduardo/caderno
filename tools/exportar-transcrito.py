"""Exporta as aulas do Caderno Inteligente (SQLite) para o formato de importação do Caderno.

Uso: python3 tools/exportar-transcrito.py ~/Downloads/Transcrito/backend/data/caderno.db saida.json
Depois: Caderno → Notas → Importar backup → escolha o arquivo gerado.
O áudio não vai junto (fica na pasta do app antigo).
"""
import json, sqlite3, sys
from datetime import datetime


def ms(dt):
    if not dt:
        return None
    return int(datetime.fromisoformat(str(dt).replace(" ", "T")).timestamp() * 1000)


db = sqlite3.connect(sys.argv[1])
db.row_factory = sqlite3.Row
out = []
for l in db.execute("select * from lessons order by id"):
    lid = f"t{l['id']}"
    segs = [dict(id=f"{lid}s{s['id']}", ms=s["start_ms"], end=s["end_ms"], text=s["text"])
            for s in db.execute("select * from segments where lesson_id=? order by start_ms", (l["id"],))]
    marks = [dict(id=f"{lid}m{h['id']}", ms=h["timestamp_ms"], text=h["text"], note=h["note"] or "")
             for h in db.execute("select * from highlights where lesson_id=?", (l["id"],))]
    refs = [dict(t=r["type"], c=r["canonical_name"], ok=bool(r["confirmed"]), raw=r["raw_text"],
                 ms=r["first_occurrence_ms"], n=r["mention_count"],
                 occ=json.loads(r["occurrences"] or "[]")[:20], x=r["context"])
            for r in db.execute('select * from "references" where lesson_id=?', (l["id"],))]
    created = ms(l["created_at"]) or 0
    out.append(dict(
        id=lid, u=created, name=l["name"] or "Aula", professor=l["professor"] or "", course=l["course"] or "",
        theme=l["theme"] or "", number=l["number"] or "", created=created, ended=ms(l["ended_at"]),
        durMs=l["duration_ms"], status="done", oneLiner=l["one_liner"] or "", summary=l["summary"] or "",
        keyPoints=json.loads(l["key_points"] or "[]"), questions=json.loads(l["review_questions"] or "[]"),
        refs=refs, segs=segs, marks=marks, notes=[], origem="Caderno Inteligente"))

json.dump({"tipo": "caderno-estudo", "versao": 1, "lessons": out}, open(sys.argv[2], "w"), ensure_ascii=False)
print(len(out), "aula(s) ->", sys.argv[2])
