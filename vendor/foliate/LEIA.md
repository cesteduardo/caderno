# foliate-js

Motor de livros do [Foliate](https://github.com/johnfactotum/foliate-js), de John Factotum. Licença MIT (ver `LICENSE`).

- Origem: pacote npm `foliate-js@1.0.1` (cópia do repositório do autor, abril de 2025).
- Arquivos: só os módulos que o Caderno usa (view, epub, epubcfi, progress, overlayer, text-walker, paginator, fixed-layout, search, mobi, fb2, comic-book, tts e `vendor/zip.js`, `vendor/fflate.js`). Ficaram de fora o leitor de exemplo, OPDS, dicionários e testes.
- Única alteração: a primeira linha de `fixed-layout.js` importava `construct-style-sheets-polyfill` pelo nome do pacote, o que só funciona com empacotador. Virou comentário; todo navegador atual já tem `adoptedStyleSheets`.
- O código foi lido antes de entrar: nenhuma chamada de rede além de abrir o arquivo do próprio livro.

Para atualizar: troque os arquivos pelos de uma versão nova, refaça a alteração acima e teste abrir, marcar, buscar e virar página.
