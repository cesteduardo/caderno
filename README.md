# Caderno

Caderno de estudo num app só: a rotina diária, o leitor de livros (antigo INK)
e as aulas transcritas (antigo Caderno Inteligente).

- **Hoje**: tarefas do dia, diário e atalhos de estudo (revisar, continuar lendo, última aula, foco).
- **Ler**: EPUB, PDF e TXT. EPUB vira página ajustável; PDF abre como foi diagramado.
  Destaques em 4 cores, notas, busca, sumário e temas (Papel, Sépia, Noite, E-ink, Sol).
- **Aulas**: grava pelo microfone ou pelo áudio de uma aba, transcreve no próprio aparelho
  (Whisper via transformers.js) e monta a ficha: resumo, pontos-chave, autores, obras,
  conceitos e perguntas de revisão.
- **Revisar**: cartões com lacunas ou pergunta e resposta, repetição espaçada.
- **Notas**: tudo o que foi marcado, com busca nas transcrições e exportação em Markdown.
- **Rotina**: semana, planos, recursos e progresso.

Funciona offline (service worker). Dados ficam no aparelho; a sincronização entre PC e
celular usa um Gist secreto (token em Rotina → Progresso). Os arquivos dos livros e o
áudio das aulas não sincronizam.

Para trazer as aulas do Caderno Inteligente:
`python3 tools/exportar-transcrito.py ~/Downloads/Transcrito/backend/data/caderno.db aulas.json`
e depois Importar no rodapé.
