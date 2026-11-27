# @anthropic-ai/sdk

SDK oficial da Anthropic para JavaScript, licença MIT. Usado só por `js/claude.mjs` (tradução com o Claude, opcional).

- Origem: `@anthropic-ai/sdk@1.8.0`, empacotado num arquivo só para o navegador com esbuild: `export { default } from '@anthropic-ai/sdk'`.
- A chave é de quem usa o Caderno e fica só no aparelho (`localStorage`, chave `caderno-claude`); por isso o cliente é criado com `dangerouslyAllowBrowser: true`.
