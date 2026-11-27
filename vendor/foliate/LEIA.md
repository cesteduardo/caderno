# foliate-js

Motor de livros do [Foliate](https://github.com/johnfactotum/foliate-js), de John Factotum. Licença MIT (ver `LICENSE`).

- Origem: pacote npm `foliate-js@1.0.1` (cópia do repositório do autor, abril de 2025).
- Arquivos: só os módulos que o Caderno usa (view, epub, epubcfi, progress, overlayer, text-walker, paginator, fixed-layout, search, mobi, fb2, comic-book, tts e `vendor/zip.js`, `vendor/fflate.js`). Ficaram de fora o leitor de exemplo, OPDS, dicionários e testes.
- Alteração 1: a primeira linha de `fixed-layout.js` importava `construct-style-sheets-polyfill` pelo nome do pacote, o que só funciona com empacotador. Virou comentário; todo navegador atual já tem `adoptedStyleSheets`.
- Alteração 2, em `paginator.js` (marcada com `[Caderno]`), contra as piscadas na troca de capítulo:
  - da última página de um capítulo vai direto para o próximo, sem deslizar até a página vazia que o paginador põe entre os dois (o mesmo para trás e ao arrastar com o dedo);
  - a página que sai fica na tela até a que entra estar desenhada e posicionada, e sai no mesmo passo, antes de a tela ser redesenhada: sem o quadro vazio entre os capítulos. Para isso o `#container` ganhou `position: relative`.
- O código foi lido antes de entrar: nenhuma chamada de rede além de abrir o arquivo do próprio livro.

Para atualizar: troque os arquivos pelos de uma versão nova, refaça a alteração acima e teste abrir, marcar, buscar e virar página.
