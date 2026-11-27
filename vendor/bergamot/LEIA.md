# bergamot-translator

Tradução automática no aparelho, em WebAssembly: o motor das traduções locais do Firefox. Projeto [browsermt/bergamot-translator](https://github.com/browsermt/bergamot-translator), licença MPL 2.0 (https://mozilla.org/MPL/2.0/).

- Origem: pacote npm `@browsermt/bergamot-translator@0.4.9`, sem alterações (`translator.js` e `worker/`).
- Modelos: não ficam no repositório. O navegador baixa cada par na primeira vez do registro público `https://bergamot.s3.amazonaws.com/models/index.json` (com soma SHA-256 de cada arquivo) e guarda no Cache Storage. Ver `js/bergamot.mjs`.
