# Caderno

Caderno de estudo e produtividade num app só: a rotina diária, o leitor de livros
(antigo INK), as aulas transcritas (antigo Caderno Inteligente), as notas ligadas
no espírito do GR Notes/Obsidian e o Escritor como editor de texto.

O visual é o do Escritor: Inter em tudo, papel branco, preenchimentos de meio tom,
o azul do Escritor como destaque, ícones Lucide (`js/icones.js`) e uma barra de
vidro no topo com as seções, **Ir para** (Ctrl+O) e **Foco**. No celular a barra
vira a barra de abas embaixo. **Modo escuro**: segue o sistema; o botão de tema
na barra alterna automático, claro e escuro (o leitor no tema Auto acompanha).
Todo controle de alternar (abas, segmentados, filtros) usa a mesma pílula que
desliza da barra (`js/pilula.js`). O app busca a versão nova na rede primeiro
e só usa a cópia guardada sem internet. A página usa até 1440 px de largura; campos e
botões têm uma altura só (`--ctl`, 40 px), seletores e buscas no mesmo desenho
(seta e lupa finas), e o leitor usa as mesmas peças do resto (barra, segmentados,
botões de ícone).

**Caderno pessoal.** Desde 27/11/2026 o Caderno é de uso só do dono: o link não
é divulgado e ninguém mais usa o app. O repositório continua público (por causa
do GitHub Pages), mas isso não impede guardar coisas pessoais: rotina, planos,
áreas, recursos, trilha, textos e o dia de início podem ficar no código ou no
estado (`state.perfil`, no aparelho, no Gist da sincronização e no backup), e
quem trabalha no app (inclusive o Claude) pode ler e alterar esses dados, o
Gist incluído, sem pedir licença por privacidade. Segredos continuam fora do
código: token do GitHub, senhas e chaves nunca entram no repositório. O convite
"Seu Caderno começa vazio" e as áreas genéricas (`AREAS_PADRAO`) ficam como
estão.

- **Agenda** (no topo do Hoje): os horários das tarefas da rotina (editáveis em
  Rotina → Editar rotina), mais os marcos que não são tarefa (Acordar, 5h30). Sem
  nenhuma tarefa com horário, vale `state.perfil.agenda` ou a lista `AGENDA` de
  `js/agenda.js`. Manhã igual todos os dias; de segunda a sexta entram a saída, a
  caminhada e o Trabalho (10h30 às 21h30). O bloco da hora atual fica em azul com "Agora" e os que já passaram
  ficam apagados; o destaque anda sozinho a cada minuto.
- **Hoje**: a data como título, os dias numa navegação compacta (‹ Hoje ›) e o
  progresso do dia numa barra larga com os números ao lado (minutos feitos,
  restantes e tarefas). Tarefas do dia, diário (abre também no Escritor) e
  atalhos de estudo (revisar, continuar lendo, última aula, foco).
- **Foco** (na barra do topo ou no atalho do Hoje): Pomodoro (25 + 5, quatro
  ciclos com pausa longa), Foco profundo (50 + 10), Sessão longa (90), Livre
  (você escolhe os minutos) e Cronômetro. Intenção do bloco, ligação a uma
  tarefa de hoje, som ambiente gerado no aparelho (ruído marrom, rosa ou
  branco, com volume), sino entre as etapas e tela cheia. Na tela de foco:
  pausar (Espaço), +5 min, pular etapa, silenciar, encerrar e minimizar (Esc);
  minimizado, o tempo aparece no título da aba. Os minutos ficam no dia.
- **Ler**: EPUB, MOBI/AZW3, FB2, CBZ, PDF e TXT.
  - **Motor**: os livros abrem no [foliate-js](https://github.com/johnfactotum/foliate-js)
    (MIT), o motor do Foliate (`js/folio.js`): o livro aparece como a editora o fez
    (capitulares, versaletes, epígrafes, recuos), com os seus ajustes por cima; notas
    de rodapé abrem numa janela; posição e marcações usam EPUB CFI. Livros
    importados antes dele seguem no leitor antigo até o arquivo ser adicionado de
    novo, e então posição e marcações migram sozinhas (reencontradas pelo texto).
    PDF no pdf.js 5 (Mozilla); TXT no leitor antigo.
  - Uma página por vez é o padrão. Em Aa → Página dá para escolher **duas lado a
    lado** (só em tela larga) ou **rolagem** contínua, e a largura da linha.
  - Marcações em 6 cores e 4 estilos (marca-texto, sublinhado, ondulado, tachado).
    Um toque na cor marca; tocar numa marcação troca cor e estilo, abre a nota ou
    remove. Selecionar um trecho já marcado mostra **Remover**, que desmarca só
    aquele pedaço. Em Marcações: filtro por cor e “Remover…” (da cor, do capítulo
    ou do livro). Toda remoção tem **Desfazer**.
  - As cores podem ganhar sentido (Aa → “O que cada cor quer dizer”).
  - **Traduzir**: o trecho selecionado (com Ouvir, Copiar, Guardar na marcação e
    Cartão) ou a página inteira (aba Traduzir). No aparelho, sem mandar o texto
    para ninguém: o tradutor do Chrome, quando existe, e o **Bergamot** (MPL 2.0,
    o motor local do Firefox, `js/bergamot.mjs`) em qualquer navegador, com cada
    par de idiomas baixado uma vez. O idioma sai do franc (MIT). Online só para o
    que nenhum modelo local cobre (latim, japonês, chinês), e só se escolhido em
    Aa → Tradução: MyMemory, um servidor LibreTranslate seu ou o Google.
    Para prosa literária, Aa → Tradução → **Motor: Claude**, com a sua chave da API
    (fica só no aparelho): o trecho vai com o parágrafo em volta e o título do
    livro, e o Claude resolve quem fala, gênero e a quem pertence o quê
    (`js/claude.mjs`, SDK oficial em `vendor/`).
  - **Moldura do leitor**: Sumário, Marcações e Buscar (Ctrl+F) abrem numa barra
    lateral que empurra o texto em vez de cobri-lo, e ela continua aberta quando
    você pula para um trecho (marcar, conferir e seguir lendo sem fechar nada). A
    tradução da página fica do outro lado (**Ao lado**) ou numa janela de vidro
    que se arrasta (**Soltar**), mostrando a tradução em destaque e o original
    embaixo; acompanha a página quando você vira. O **Aa** desce do próprio botão,
    com os temas em amostras. No celular, lateral e Aa viram folhas que sobem de
    baixo e fecham no Voltar. Esc fecha o que estiver aberto.
  - Temas (Papel, Sépia, Noite, E-ink, Sol), fichamento e nota do livro.
- **OCR** (PDF escaneado): a página é lida numa imagem própria a ~300 DPI, com
  contraste esticado; os parágrafos são refeitos pela posição das palavras; copiar
  e traduzir mantêm os espaços e juntam a palavra partida no fim da linha. Aa →
  "Ler de novo esta página" refaz uma página lida antes. O OCR mora num ícone na
  barra do leitor de PDF (ao lado de Traduzir), que acende com um ponto azul
  quando a página na tela é escaneada e ainda não foi lida; dali saem "Ler esta
  página", "Ler de novo", "Ler sozinho" e o idioma.
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
- **Rotina**: semana, planos, recursos e progresso. Cada tarefa tem duração e,
  se quiser, **horário** de início (campo de relógio no Editar rotina; apague
  para tirar). Com horário, a tarefa entra na **Agenda** do Hoje e mostra a hora
  na lista (5h40 às 6h05…), na ordem do relógio, também na Semana.
  **Ajustes pessoais** (`js/ajustes.js`): mudanças de rotina pedidas pelo dono
  vêm no código e rodam uma vez, no primeiro aparelho que abrir o app (depois de
  mesclar com o Gist); a sincronização leva o resultado aos outros.

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
