/* =====================================================================
   Tradutor no aparelho: Bergamot (Mozilla, MPL 2.0)
   ---------------------------------------------------------------------
   O mesmo motor das traduções locais do Firefox, em WebAssembly: roda em
   qualquer navegador atual, sem mandar o texto para ninguém. Cada par de
   idiomas é um modelo de uns 20 a 30 MB, baixado uma vez do repositório
   público do projeto e guardado no aparelho (Cache Storage). Sem modelo
   direto (espanhol → português, por exemplo), passa pelo inglês.

   Pares disponíveis hoje, sempre com o inglês numa das pontas:
   português, espanhol, francês, italiano, alemão, russo, ucraniano,
   tcheco, búlgaro e estoniano.
   ===================================================================== */
import { BatchTranslator, TranslatorBacking } from '../vendor/bergamot/translator.js';

const REGISTRO = 'https://bergamot.s3.amazonaws.com/models/index.json';
const CAIXA = 'caderno-tradutor-v1';

const caixa = () => ('caches' in self ? caches.open(CAIXA) : Promise.resolve(null));

class Guardado extends TranslatorBacking {
  /* a lista de modelos também fica guardada: sem internet, vale a última */
  async loadModelRegistery(){
    const c = await caixa().catch(() => null);
    let r = null;
    try {
      r = await fetch(REGISTRO, { credentials: 'omit', cache: 'no-cache' });
      if (r.ok && c) await c.put(REGISTRO, r.clone());
    } catch (e) { r = null; }
    if ((!r || !r.ok) && c) r = await c.match(REGISTRO);
    if (!r) throw new Error('sem internet para buscar a lista de modelos');
    const reg = await r.json();
    return Object.entries(reg).map(([k, files]) => ({ from: k.slice(0, 2), to: k.slice(2, 4), files }));
  }
  /* cada arquivo do modelo: do aparelho, se já veio; senão baixa (com a
     soma de verificação do registro) e guarda */
  async fetch(url, checksum, extra){
    const c = await caixa().catch(() => null);
    const tinha = c && await c.match(url);
    if (tinha) return tinha.arrayBuffer();
    aviso('baixando', url);
    const opt = { credentials: 'omit', signal: extra && extra.signal };
    if (checksum) opt.integrity = 'sha256-' + this.hexToBase64(checksum);
    const r = await fetch(url, opt);
    if (!r.ok) throw new Error('modelo ' + r.status);
    if (c) await c.put(url, r.clone()).catch(() => {});
    aviso('baixou', url);
    return r.arrayBuffer();
  }
}

let ouvinte = null;
const aviso = (tipo, url) => { try { ouvinte && ouvinte(tipo, url); } catch (e) {} };

let motor = null, apoio = null;
function abre(){
  if (motor) return motor;
  apoio = new Guardado({ registryUrl: REGISTRO, downloadTimeout: 0, pivotLanguage: 'en' });
  motor = new BatchTranslator({ workers: 1, batchSize: 8, cacheSize: 2000 }, apoio);
  return motor;
}

/* Os pares que o registro oferece, direto ou passando pelo inglês */
export async function pares(){
  abre();
  const reg = await apoio.registry;
  return reg.map(m => m.from + m.to);
}
export async function cobre(from, to){
  abre();
  try { await apoio.getModels({ from, to }); return true; } catch (e) { return false; }
}
/* Quanto falta baixar para este par (0 se já está no aparelho) */
export async function faltaBaixar(from, to){
  abre();
  const models = await apoio.getModels({ from, to });
  const reg = await apoio.registry, c = await caixa().catch(() => null);
  let total = 0;
  for (const m of models){
    const e = reg.find(x => x.from === m.from && x.to === m.to);
    for (const f of Object.values((e && e.files) || {})) if (f && f.name && !(c && await c.match(f.name))) total += f.size || 0;
  }
  return total;
}
export function aoBaixar(fn){ ouvinte = fn; }

export async function traduz(textos, from, to){
  const t = abre();
  return Promise.all(textos.map(text => text.trim()
    ? t.translate({ from, to, text, html: false }).then(r => r.target.text)
    : Promise.resolve(text)));
}
/* Apaga os modelos guardados (Ajustes → Tradução) */
export async function esquece(){
  if ('caches' in self) await caches.delete(CAIXA);
  try { motor && motor.delete(); } catch (e) {}
  motor = null; apoio = null;
}
export async function guardado(){
  if (!('caches' in self)) return 0;
  const c = await caches.open(CAIXA);
  let n = 0;
  for (const req of await c.keys()){ if (req.url === REGISTRO) continue; const r = await c.match(req); const b = r && await r.blob(); n += b ? b.size : 0; }
  return n;
}
