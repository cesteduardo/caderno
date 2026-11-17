# Caderno

Caderno de estudo e produtividade num app só: a rotina diária, o leitor de livros
(antigo INK), as aulas transcritas (antigo Caderno Inteligente), as notas ligadas
no espírito do GR Notes/Obsidian e o Escritor como editor de texto.

- **Hoje**: tarefas do dia, diário (abre também no Escritor) e atalhos de estudo
  (revisar, continuar lendo, última aula, foco).
- **Ler**: EPUB, PDF e TXT.
  - Uma página por vez é o padrão. Em Aa → Página dá para escolher **duas lado a
    lado** (só em tela larga) ou **rolagem** contínua, e a largura da linha.
  - Marcações em 6 cores e 4 estilos (marca-texto, sublinhado, ondulado, tachado).
    Um toque na cor marca; tocar numa marcação troca cor e estilo, abre a nota ou
    remove. Selecionar um trecho já marcado mostra **Remover**, que desmarca só
    aquele pedaço. Em Marcações: filtro por cor e “Remover…” (da cor, do capítulo
    ou do livro). Toda remoção tem **Desfazer**.
  - As cores podem ganhar sentido (Aa → “O que cada cor quer dizer”).
  - **Traduzir**: o trecho selecionado (com Ouvir, Copiar, Guardar na marcação e
    Cartão) ou a página inteira (aba Traduzir). Usa o tradutor do próprio Chrome
    quando o aparelho tem; senão, online (Google Tradutor, com o MyMemory de
    reserva). Dá para proibir o online em Aa → Tradução.
  - Sumário, busca, temas (Papel, Sépia, Noite, E-ink, Sol), fichamento e nota do livro.
- **Aulas**: grava pelo microfone ou pelo áudio de uma aba, transcreve no próprio aparelho
  (Whisper via transformers.js) e monta a ficha: resumo, pontos-chave, autores, obras,
  conceitos e perguntas de revisão.
- **Revisar**: cartões com lacunas ou pergunta e resposta, repetição espaçada.
- **Notas**: três abas.
  - **Notas** em Markdown que abrem no **Escritor** (`escrever/`): foco por frase,
    máquina de escrever, ortografia, revisão de estilo, classes gramaticais, exportar,
    pasta do Obsidian. `[[` liga a outra nota, a um livro ou a uma aula (com lista
    de sugestões); Ctrl+clique segue a ligação; ligação para nota que não existe
    cria a nota. `#etiquetas` agrupam. **Ligações** mostra quem cita a nota, o que
    ela cita e as marcações dos livros e aulas citados, com “Inserir”. Mudar o
    título atualiza as ligações nas outras notas.
  - **Diário**: o diário de cada dia da rotina.
  - **Marcações**: tudo o que foi marcado, com filtro por tipo, origem e cor; a busca
    procura também dentro das transcrições.
  - **Ctrl+O** (ou “Ir para…”) abre qualquer nota, livro, aula ou dia pelo nome.
  - Exporta um .zip pronto para o Obsidian (Notas/, Diário/, Marcações/).
- **Rotina**: semana, planos, recursos e progresso.

Funciona offline (service worker). Dados ficam no aparelho; a sincronização entre PC e
celular usa um Gist secreto (token em Rotina → Progresso). Os arquivos dos livros e o
áudio das aulas não sincronizam.

O Escritor roda num iframe da mesma origem e fala com o Caderno por
`window.CadernoPonte` (`js/escrever.js` ↔ `escrever/ponte.js`). Aberto sozinho
(`escrever/index.html`), continua sendo o Escritor de sempre, com o texto no
localStorage.

Para trazer as aulas do Caderno Inteligente:
`python3 tools/exportar-transcrito.py ~/Downloads/Transcrito/backend/data/caderno.db aulas.json`
e depois Importar no rodapé.
