/* =====================================================================
   Tradução literária com o Claude (opcional, com a chave de quem usa)
   ---------------------------------------------------------------------
   Os modelos que rodam no aparelho traduzem frase por frase, sem saber
   quem narra nem do que o livro trata: "minha mãe costurara no uniforme"
   vira "her uniform", "bolsinho" vira "dumpling". Aqui o Claude recebe o
   trecho junto com o parágrafo em volta (e o título e o autor do livro),
   para resolver de quem é o uniforme, manter o registro e o ritmo, e não
   inventar o que o original não diz.

   A chave da API fica só neste aparelho (localStorage 'caderno-claude'):
   não vai para a sincronização, para o backup nem para o GitHub. O
   pedido sai do navegador direto para api.anthropic.com.
   SDK oficial (@anthropic-ai/sdk 1.8.0) em vendor/anthropic-sdk.min.mjs.
   ===================================================================== */
import Anthropic from '../vendor/anthropic-sdk.min.mjs';

const CHAVE = 'caderno-claude';
const MODELO = 'claude-opus-5-5';

export const chave = () => { try { return localStorage.getItem(CHAVE) || ''; } catch (e) { return ''; } };
export const guardaChave = k => { try { k ? localStorage.setItem(CHAVE, k.trim()) : localStorage.removeItem(CHAVE); } catch (e) {} cliente = null; };

let cliente = null;
const abre = () => {
  const k = chave();
  if (!k) throw new Error('sem chave da API do Claude (Aa → Tradução)');
  /* a chave é de quem usa e mora só neste aparelho: chamar do navegador é o desenho */
  return (cliente ||= new Anthropic({ apiKey: k, dangerouslyAllowBrowser: true, maxRetries: 2 }));
};

const NOMES = { pt: 'português do Brasil', en: 'inglês', es: 'espanhol', fr: 'francês', it: 'italiano', de: 'alemão', la: 'latim', ru: 'russo', ja: 'japonês', zh: 'chinês' };
const nome = c => NOMES[String(c || '').split('-')[0]] || c;

const SISTEMA = `Você é tradutor literário. Traduz trechos de um livro que alguém está lendo e estudando.

Como traduzir:
- Traduza cada trecho numerado para a língua pedida, com sentido, registro, ritmo e imagens do original. Prefira a solução que um bom tradutor publicado escolheria à tradução palavra por palavra.
- Use o contexto (livro, autor, parágrafo em volta) para resolver o que a frase sozinha deixa em aberto: quem fala, gênero e número, a quem pertence o quê, a que se refere um pronome. Exemplo: em "minha mãe costurara no uniforme", narrado por um soldado, o uniforme é de quem narra ("my uniform"), não da mãe.
- Não acrescente informação que o original não tem e não explique nada: devolva só a tradução de cada trecho.
- Nomes próprios, títulos e citações de obras ficam como no original, salvo forma consagrada na língua de destino.
- Se o texto vier com marcas de OCR (palavra partida, letra trocada, espaço faltando), traduza o que o autor evidentemente escreveu.`;

const ESQUEMA = {
  type: 'object',
  properties: { traducoes: { type: 'array', items: { type: 'string' }, description: 'Uma tradução por trecho, na mesma ordem e na mesma quantidade' } },
  required: ['traducoes'],
  additionalProperties: false,
};

/* traduz(['…', '…'], 'pt', 'en', { livro, autor, contexto }) → ['…', '…'] */
export async function traduz(textos, from, to, ctx = {}){
  const c = abre();
  const cab = [
    ctx.livro ? `Livro: ${ctx.livro}${ctx.autor ? ', de ' + ctx.autor : ''}` : '',
    `Traduzir de ${from ? nome(from) : 'língua a identificar'} para ${nome(to)}.`,
    ctx.contexto ? `Contexto (não traduza, só use para entender):\n<contexto>\n${ctx.contexto.slice(0, 6000)}\n</contexto>` : '',
  ].filter(Boolean).join('\n\n');
  const corpo = textos.map((t, i) => `<trecho n="${i + 1}">\n${t}\n</trecho>`).join('\n');
  const r = await c.beta.messages.create({
    model: MODELO,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA } },
    system: SISTEMA,
    messages: [{ role: 'user', content: `${cab}\n\n${corpo}` }],
  });
  if (r.stop_reason === 'refusal') throw new Error('o Claude recusou este trecho');
  if (r.stop_reason === 'max_tokens') throw new Error('a tradução ficou longa demais; traduza um pedaço menor');
  const txt = r.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const out = JSON.parse(txt).traducoes;
  if (!Array.isArray(out) || out.length !== textos.length) throw new Error('a resposta veio fora do formato');
  return out;
}

/* testa a chave com um pedido mínimo */
export async function testa(){
  const out = await traduz(['Bom dia.'], 'pt', 'en');
  return out[0];
}
