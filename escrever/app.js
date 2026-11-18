/* ═══════════════════════════════════════════════════════════
   Escritor — motor
   ─────────────────────────────────────────────────────────
   O texto vive numa <textarea> transparente. Um <div> logo
   abaixo espelha o mesmo conteúdo já colorido, com a mesma
   métrica tipográfica. O cursor, a seleção e o corretor do
   navegador continuam sendo os nativos — só a cor do texto
   sai de cena.

   A linha é quebrada numa lista de PEDAÇOS. Cada pedaço é um
   trecho de texto com zero ou mais classes, e a regra que
   sustenta tudo é esta: emendar os pedaços de volta devolve a
   linha exatamente como ela estava, caractere por caractere.
   Nenhum realce cria, some ou desloca um único caractere — é
   por isso que o cursor nunca sai do lugar.
   ═══════════════════════════════════════════════════════════ */

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

/* ── atalhos do jeito de cada sistema ─────────────────────────
   No Mac (e no iPad com teclado) o atalho se escreve com os símbolos
   da Apple, na ordem dela: ⌥ ⇧ ⌘ e a tecla, tudo junto (⇧⌘O). No
   Windows e no Linux fica Ctrl+Shift+O. O teclado já aceita os dois:
   Cmd e Ctrl fazem a mesma coisa. */
const MAC = /Mac|iPhone|iPad|iPod/i.test(
  (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent);
function paraSO(txt){
  if (!MAC || txt == null) return txt;
  return String(txt).replace(/\b((?:(?:Ctrl|Alt|Shift)\+)+)(\w+|[^\s\w])/g, (_, mods, k) => {
    const m = mods.split('+');
    const sim = (m.includes('Alt') ? '⌥' : '') + (m.includes('Shift') ? '⇧' : '') + (m.includes('Ctrl') ? '⌘' : '');
    return k.length > 1 && k === k.toLowerCase() ? sim + '+' + k : sim + k;   // ⌘+clique
  });
}
function aplicarTeclasSO(raiz = document){
  if (!MAC) return;
  raiz.querySelectorAll('kbd').forEach(k => { if (/Ctrl|Alt|Shift/.test(k.textContent)) k.textContent = paraSO(k.textContent); });
  raiz.querySelectorAll('[title]').forEach(n => { if (/Ctrl|Alt|Shift/.test(n.title)) n.title = paraSO(n.title); });
}
document.documentElement.classList.toggle('mac', MAC);
document.addEventListener('DOMContentLoaded', () => aplicarTeclasSO());

const editor   = $('#editor');
const overlay  = $('#overlay');
const scroller = $('#scroller');
const preview  = $('#preview');
const corpo    = document.body;
const regua    = $('#regua');
const reguaTrilho = $('#reguaTrilho');
const reguaCursor = $('#reguaCursor');
const reguaNumero = $('#reguaNumero');
const reguaAlvo = $('#reguaAlvo');
const numerosLinha = $('#numerosLinha');

const CHAVE_TEXTO = 'escritor:texto';
const CHAVE_PREFS = 'escritor:prefs';
/* Marca que o documento guardado é seu, e não o guia: só a partir daí
   o rascunho passa a ter precedência sobre o texto de abertura. */
const CHAVE_SEU   = 'escritor:seu';

/* Dentro do Caderno o Escritor é o editor das notas: o texto vem da nota
   aberta e volta para ela (window.parent.CadernoPonte, mesma origem).
   Sozinho, continua guardando no localStorage como sempre. */
const PONTE = (() => {
  try { return (window.parent !== window && window.parent.CadernoPonte) || null; }
  catch { return null; }
})();
if (PONTE) document.documentElement.classList.add('embutido');

const prefs = Object.assign({
  escopo: 'nenhum', maquina: false, classe: 'nenhuma',
  ortografia: true, estilo: true, tema: 'claro', fonte: 'duo',
  corpo: 18, contagem: 0, visualizando: false, poeta: false,
  obsidianAuto: false,
  // personalizar.js: cor de destaque, entrelinha, largura da coluna,
  // sinais do Markdown, barra, rodapé, tipografia e meta de palavras
  cor: 'padrao', altura: 1.75, coluna: 46, sinais: 'visiveis',
  barraSome: true, rodape: true, tipografia: false, meta: 0,
  // painel Personalizar: papel automático, cor própria, títulos,
  // espaço entre letras, intensidade do foco, leitura e seus estilos
  autoClaro: 'claro', autoEscuro: 'escuro', corPropria: '#2b7fff',
  titulos: 'tinta', letras: 0, esmaecer: 'medio', ppm: 200,
  mostrarTempo: true, meusEstilos: [],
  // autoria: quem assina o texto exportado (e um link opcional)
  autor: '', autorLink: ''
}, lerPrefs());

/* Migração da primeira versão, em que a ferramenta se chamava
   apenas “Régua”. O documento e a preferência do usuário continuam. */
if (typeof prefs.regua === 'boolean' && typeof lerPrefs().poeta !== 'boolean'){
  prefs.poeta = prefs.regua;
}
delete prefs.regua;

function lerPrefs(){
  try { return JSON.parse(localStorage.getItem(CHAVE_PREFS) || '{}'); }
  catch { return {}; }
}

/* ═══════════════════════════════════════════════════════════
   1. Português — listas de apoio
   ═══════════════════════════════════════════════════════════ */

const LETRA = "A-Za-zÀ-ÖØ-öø-ÿ";
const RE_PALAVRA = new RegExp(`[${LETRA}][${LETRA}'’\\-]*`, 'g');

/* Grafias que simplesmente não existem em português, com a forma
   correta ao lado. Complementam — não substituem — o dicionário
   pt-BR do próprio navegador.

   O critério para entrar aqui é um só: a palavra tem de estar
   SEMPRE errada. Formas que existem em algum contexto ("nos",
   "mais", "há", "pra", "publico", "pratica") ficam de fora, porque
   um alarme falso custa mais caro do que um erro não apontado. */
const ERROS = new Map(Object.entries({
  // duas palavras escritas como uma
  'concerteza':'com certeza', 'comcerteza':'com certeza', 'conserteza':'com certeza',
  'derrepente':'de repente', 'apartir':'a partir', 'porisso':'por isso',
  'denovo':'de novo', 'porfavor':'por favor', 'apesarde':'apesar de',

  // trocas de letra consagradas
  'excessão':'exceção', 'excessões':'exceções',
  'previlegio':'privilégio', 'previlégio':'privilégio', 'priviégio':'privilégio',
  'reinvindicar':'reivindicar', 'reinvindicação':'reivindicação', 'reinvindicou':'reivindicou',
  'beneficiente':'beneficente', 'beneficiencia':'beneficência',
  'menas':'menos', 'seje':'seja', 'sejem':'sejam', 'esteje':'esteja', 'estejem':'estejam',
  'impecilho':'empecilho', 'empecilio':'empecilho',
  'asterístico':'asterisco', 'probrema':'problema', 'pobrema':'problema',
  'adevogado':'advogado', 'cardaço':'cadarço', 'mendingo':'mendigo',
  'bassoura':'vassoura', 'largatixa':'lagartixa', 'iorgute':'iogurte',
  'metereologia':'meteorologia', 'metereológico':'meteorológico',
  'frustado':'frustrado', 'frustada':'frustrada',
  'frustados':'frustrados', 'frustadas':'frustradas',
  'rúbrica':'rubrica', 'sombrancelha':'sobrancelha', 'bicabornato':'bicarbonato',
  'cabelereiro':'cabeleireiro', 'entertido':'entretido', 'entertida':'entretida',
  'prazeiroso':'prazeroso', 'prazeirosa':'prazerosa', 'mortandela':'mortadela',
  'estrupo':'estupro', 'estrupador':'estuprador', 'aciola':'axila',
  'bulcão':'vulcão', 'cusphe':'cuspe', 'desplicente':'displicente',
  'trousse':'trouxe', 'trousseram':'trouxeram', 'chicrete':'chiclete',
  'pisicologia':'psicologia', 'pisicólogo':'psicólogo', 'pisicologo':'psicólogo',
  'vitrini':'vitrine', 'hamburger':'hambúrguer',

  // s trocado por z (e vice-versa)
  'paralizar':'paralisar', 'paralizado':'paralisado', 'paraliza':'paralisa',
  'analizar':'analisar', 'analiza':'analisa', 'analizado':'analisado', 'analizei':'analisei',
  'realisar':'realizar', 'realisado':'realizado', 'utilisar':'utilizar',
  'pesquiza':'pesquisa', 'pesquizar':'pesquisar', 'pesquizador':'pesquisador',
  'atrazar':'atrasar', 'atrazado':'atrasado', 'atrazo':'atraso',
  'atravez':'através', 'quizeram':'quiseram', 'quizer':'quiser', 'quizesse':'quisesse',

  // trocas de prefixo
  'ancioso':'ansioso', 'anciosa':'ansiosa', 'anciedade':'ansiedade', 'ancieadade':'ansiedade',
  'essiste':'existe', 'essistem':'existem', 'essistir':'existir', 'essistiu':'existiu',
  'disgraça':'desgraça', 'disculpa':'desculpa', 'discupa':'desculpa', 'discultir':'discutir',
  'enchergar':'enxergar', 'encherga':'enxerga', 'enchergou':'enxergou', 'enxirido':'enxerido',
  'expontaneo':'espontâneo', 'expontânea':'espontânea', 'expontâneo':'espontâneo',
  'extender':'estender', 'estenção':'extensão',
  'própio':'próprio', 'requeremento':'requerimento',
  'siguinte':'seguinte', 'sinseramente':'sinceramente', 'supitão':'supetão',

  // acento que ficou pelo caminho
  'voce':'você', 'voces':'vocês', 'tambem':'também', 'porem':'porém',
  'alem':'além', 'ninguem':'ninguém', 'armazem':'armazém', 'parabens':'parabéns',
  'sao':'são', 'nao':'não', 'entao':'então', 'licao':'lição', 'coracao':'coração',
  'emocao':'emoção', 'razao':'razão', 'situacao':'situação', 'informacao':'informação',
  'ja':'já', 'apos':'após', 'atraves':'através', 'alguem':'alguém', 'tres':'três',
  'seculo':'século', 'musica':'música', 'proximo':'próximo', 'ultimo':'último',
  'unico':'único', 'historia':'história', 'familia':'família', 'memoria':'memória',
  'distancia':'distância', 'importancia':'importância', 'experiencia':'experiência',
  'consciencia':'consciência', 'ciencia':'ciência', 'paciencia':'paciência',
  'referencia':'referência', 'diferenca':'diferença', 'possivel':'possível',
  'dificil':'difícil', 'facil':'fácil', 'nivel':'nível', 'util':'útil'
}));

/* ── Revisão de estilo ──────────────────────────────────────
   Clichê, muleta, redundância e escorregão de norma-padrão.
   Cada regra aponta o trecho e diz, em uma frase, o que fazer.
   As bordas usam lookaround para não morder a palavra vizinha. */
const B_ANTES = '(?<![A-Za-zÀ-ÖØ-öø-ÿ])';
const B_DEPOIS = '(?![A-Za-zÀ-ÖØ-öø-ÿ])';

const CLICHES = [
  "sem dúvida","é importante ressaltar","de forma geral","no final das contas",
  "em suma","basicamente","literalmente","muito único","cada vez mais",
  "de certa forma","na verdade","tipo assim","vale ressaltar","dito isso",
  "ao longo do tempo","significativamente","de alguma forma","por assim dizer",
  "em última análise","nesse sentido","é válido lembrar","não é à toa que",
  "a nível de","antes de mais nada","via de regra","pra ser sincero",
  "para ser sincero","o fato é que","de uma forma ou de outra"
];

const REGRAS_ESTILO_ANTIGAS = [
  ...CLICHES.map(c => ({
    re: new RegExp(B_ANTES + c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + B_DEPOIS, 'gi'),
    msg: 'Expressão desgastada ou pouco precisa. Considere uma formulação mais direta.'
  })),

  { re:/(?<![A-Za-zÀ-ÖØ-öø-ÿ])houveram(?![A-Za-zÀ-ÖØ-öø-ÿ])/gi,
    msg:'O verbo “haver”, com sentido de existir, é impessoal: use “houve”.' },
  { re:/(?<![A-Za-zÀ-ÖØ-öø-ÿ])haviam\s+(?:muitos?|muitas?|vários?|várias?|poucos?|poucas?|\d+)(?![A-Za-zÀ-ÖØ-öø-ÿ])/gi,
    msg:'Com sentido de existir, “haver” fica no singular: use “havia”.' },
  { re:/(?<![A-Za-zÀ-ÖØ-öø-ÿ])fazem\s+(?:\d+|dois|duas|três|quatro|cinco|seis|sete|oito|nove|dez)\s+(?:dias?|meses?|anos?|semanas?|horas?)(?![A-Za-zÀ-ÖØ-öø-ÿ])/gi,
    msg:'Ao indicar tempo decorrido, “fazer” é impessoal: use “faz”.' },
  { re:/(?<![A-Za-zÀ-ÖØ-öø-ÿ])com\s+certeza\s+absoluta(?![A-Za-zÀ-ÖØ-öø-ÿ])/gi,
    msg:'“Certeza absoluta” é redundante. Em geral, “certeza” basta.' },
  { re:/(?<![A-Za-zÀ-ÖØ-öø-ÿ])mim\s+\w+(?:ar|er|ir)(?![A-Za-zÀ-ÖØ-öø-ÿ])/gi,
    msg:'Antes de verbo no infinitivo, use “eu”: por exemplo, “para eu fazer”.' },
  { re:/(?<![A-Za-zÀ-ÖØ-öø-ÿ])entre\s+eu\s+e(?![A-Za-zÀ-ÖØ-öø-ÿ])/gi,
    msg:'Depois da preposição “entre”, use “mim”: “entre mim e…”.' },
  { re:/(?<![A-Za-zÀ-ÖØ-öø-ÿ])há\s+(?:\d+|um|uma|dois|duas|três|quatro|cinco|seis|sete|oito|nove|dez)\s+\w+\s+atrás(?![A-Za-zÀ-ÖØ-öø-ÿ])/gi,
    msg:'“Há” já indica passado; retire “atrás”.' },
  { re:/(?<![A-Za-zÀ-ÖØ-öø-ÿ])(?:vou|vamos|vai|vão|iria|iremos)\s+estar\s+\w+ndo(?![A-Za-zÀ-ÖØ-öø-ÿ])/gi,
    msg:'Evite o gerundismo. Prefira uma forma direta, como “farei” ou “vou fazer”.' },
  { re:/(?<![A-Za-zÀ-ÖØ-öø-ÿ])à\s+(?:fazer|ser|ter|ir|vir|dizer|colocar|ver|partir|começar|escrever|trabalhar)(?![A-Za-zÀ-ÖØ-öø-ÿ])/gi,
    msg:'Não ocorre crase antes de verbo no infinitivo.' },
  { re:/(?<![A-Za-zÀ-ÖØ-öø-ÿ])à\s+(?:pé|cavalo|prazo)(?![A-Za-zÀ-ÖØ-öø-ÿ])/gi,
    msg:'Não ocorre crase nesta expressão.' },
  { re:/(?<![A-Za-zÀ-ÖØ-öø-ÿ])à\s+(?:ela|ele|você|mim|ti|nós|vocês)(?![A-Za-zÀ-ÖØ-öø-ÿ])/gi,
    msg:'Em geral, não ocorre crase antes de pronome pessoal.' },
  { re:/(?<![A-Za-zÀ-ÖØ-öø-ÿ])mais\s+(?:melhor|maior|pior|menor)(?![A-Za-zÀ-ÖØ-öø-ÿ])/gi,
    msg:'A palavra seguinte já é comparativa: retire “mais”.' },
  { re:/(?<![A-Za-zÀ-ÖØ-öø-ÿ])(?:subir\s+para\s+cima|descer\s+para\s+baixo|entrar\s+para\s+dentro|sair\s+para\s+fora)(?![A-Za-zÀ-ÖØ-öø-ÿ])/gi,
    msg:'Há uma redundância: o verbo já contém a ideia indicada depois.' },
  { re:/(?<![A-Za-zÀ-ÖØ-öø-ÿ])(?:elo\s+de\s+ligação|acabamento\s+final|planejar\s+antecipadamente|encarar\s+de\s+frente|surpresa\s+inesperada|monopólio\s+exclusivo)(?![A-Za-zÀ-ÖØ-öø-ÿ])/gi,
    msg:'Expressão redundante; considere retirar a palavra desnecessária.' },
  { re:/(?<![A-Za-zÀ-ÖØ-öø-ÿ])(\w{3,})\s+\1(?![A-Za-zÀ-ÖØ-öø-ÿ])/gi,
    msg:'Palavra repetida em sequência.' },
  { re:/\s+([,.;:!?])/g,
    msg:'Retire o espaço antes do sinal de pontuação.' },
  { re:/[!?]{3,}/g,
    msg:'O excesso de sinais pode enfraquecer a frase; um costuma bastar.' }
];

/* O Ctrl+R usa somente estes critérios. As antigas regras acima ficam
   isoladas para não misturar correção gramatical com revisão estilística. */
const PALAVRAS_COMUNS = new Set(`
a o as os um uma uns umas de da do das dos em no na nos nas por para com sem
e ou mas nem que se como quando porque pois embora enquanto então assim também
à ao aos às pelo pela pelos pelas seu sua seus suas este esta estes estas esse
essa esses essas ele ela eles elas eu tu nós vós você vocês me te lhe lhes meu
minha meus minhas nosso nossa nossos nossas isso isto aquilo ser estar ter haver
foi eram era são é tem têm há mais menos muito muita muitos muitas já ainda não
sim só cada todo toda todos todas outro outra outros outras mesmo mesma mesmos mesmas
`.trim().split(/\s+/));

const TROCAS_CONCISAS = [
  [/\b(?:é importante|vale) (?:ressaltar|destacar|lembrar) que\s*/gi, ''],
  [/\bdevido ao fato de que\b/gi, 'porque'],
  [/\bcom o objetivo de\b/gi, 'para'],
  [/\bno que diz respeito a\b/gi, 'sobre'],
  [/\bno final das contas\b/gi, ''],
  [/\b(?:de certa forma|de alguma forma|por assim dizer|basicamente|literalmente)\b,?\s*/gi, ''],
  [/\b(?:planejar antecipadamente|encarar de frente)\b/gi, m => m.split(' ')[0]],
  [/\b(?:subir para cima|descer para baixo|entrar para dentro|sair para fora)\b/gi,
    m => m.split(' ')[0]]
];

/* Conectivos ligam palavras, orações e ideias: conjunções, preposições
   e locuções conjuntivas/adverbiais. Artigos e pronomes não pertencem
   a esta classe e, por isso, ficam fora do realce. */
const CONECTIVOS = new Set(`
ao aos à às da do das dos na no nas nos num numa nuns numas
dum duma pelo pela pelos pelas
de em para por com sem sob sobre entre até após ante desde contra
perante trás conforme durante mediante salvo exceto segundo
e ou mas porém contudo todavia entretanto porque pois porquanto que
se quando enquanto embora caso como portanto logo assim
então ora quer seja nem tampouco outrossim conquanto posto
`.trim().split(/\s+/));

const ADVERBIOS = new Set(`
não sim já ainda sempre nunca jamais talvez muito pouco mais menos
bem mal assim aqui ali lá cá aí acolá hoje ontem amanhã agora antes
depois cedo tarde longe perto dentro fora acima abaixo adiante atrás
também apenas só somente quase bastante demais tanto tão certamente
realmente provavelmente possivelmente sobretudo inclusive aliás ademais
`.trim().split(/\s+/));

/* Verbos irregulares e auxiliares de alta frequência. */
const VERBOS = new Set(`
é são foi foram era eram ser sendo sido sou és somos sois
está estão estava estavam estar estando estado estou estamos esteve estiveram
tem têm tinha tinham ter tendo tido tenho temos teve tiveram
há havia houve haver havendo havido hão
vai vão ia iam ir indo ido vou vamos fui fomos
faz fazem fazia faziam fazer fazendo feito faço fazemos fez fizeram
pode podem podia podiam poder podendo podido posso podemos pôde puderam
deve devem devia deviam dever devendo devido devo devemos
diz dizem dizia diziam dizer dizendo dito digo dizemos disse disseram
vem vêm vinha vinham vir vindo venho viemos veio vieram
dá dão dava davam dar dando dado dou damos deu deram
vê veem via viam ver vendo visto vejo vemos viu viram
sabe sabem sabia sabiam saber sabendo sabido sei sabemos soube souberam
quer querem queria queriam querer querendo querido quero queremos quis quiseram
põe põem punha punham pôr pondo posto ponho pomos pôs puseram
fala falam falou falar escrevo escreve escrevem escreveu escrever
leio lê leem leu ler trabalho trabalha trabalham trabalhou trabalhar
ando anda andam andou andar corro corre correm correu correr
abro abre abrem abriu abrir penso pensa pensam pensou pensar
chego chega chegam chegou chegar fico fica ficam ficou ficar
passo passa passam passou passar acho acha acham achou achar
uso usa usam usou usar preciso precisa precisam precisou precisar
começo começa começam começou começar encontro encontra encontram encontrou encontrar
`.trim().split(/\s+/));

/* Vocabulário inequívoco e frequente. Ele cobre as palavras simples que
   não têm uma terminação reveladora ("casa", "livro", "feliz" etc.). */
const SUBSTANTIVOS = new Set(`
pessoa pessoas homem homens mulher mulheres criança crianças gente
casa casas cidade cidades país países mundo vida vidas tempo tempos dia dias
noite noites manhã manhãs ano anos vez vezes parte partes lugar lugares
livro livros texto textos palavra palavras frase frases história histórias
ideia ideias coisa coisas caso casos fato fatos forma formas modo modos
trabalho trabalhos escola escolas aluno alunos professor professores
família famílias amigo amigos amor água águas terra terras rua ruas
mesa mesas porta portas janela janelas carro carros caminho caminhos
problema problemas pergunta perguntas resposta respostas exemplo exemplos
nome nomes voz vozes corpo corpos cabeça cabeças mão mãos olhos
governo governos empresa empresas grupo grupos sistema sistemas processo processos
informação informações conhecimento conhecimentos resultado resultados
`.trim().split(/\s+/));

const ADJETIVOS = new Set(`
bom boa bons boas mau má maus más grande grandes pequeno pequena pequenos pequenas
novo nova novos novas velho velha velhos velhas jovem jovens melhor melhores pior piores
feliz felizes triste tristes fácil fáceis difícil difíceis simples simples
forte fortes fraco fraca fracos fracas alto alta altos altas baixo baixa baixos baixas
claro clara claros claras escuro escura escuros escuras certo certa certos certas
errado errada errados erradas importante importantes diferente diferentes igual iguais
possível possíveis impossível impossíveis necessário necessária necessários necessárias
primeiro primeira primeiros primeiras último última últimos últimas
branco branca brancos brancas preto preta pretos pretas vermelho vermelha vermelhos vermelhas
`.trim().split(/\s+/));

const DETERMINANTES = new Set(`
a o as os um uma uns umas meu minha meus minhas teu tua teus tuas
seu sua seus suas nosso nossa nossos nossas este esta estes estas
esse essa esses essas aquele aquela aqueles aquelas
`.trim().split(/\s+/));
const PRONOMES_SUJEITO = new Set('eu tu ele ela nós vós eles elas você vocês'.split(/\s+/));

const SUF_VERBO = [
  'ar','er','ir',
  'ou','aram','eram','iram','ava','avam','ávamos','iam','íamos',
  'ando','endo','indo','ondo',
  'ado','ados','ada','adas','ido','idos','ida','idas',
  'asse','esse','isse','assem','essem','issem','ássemos','êssemos',
  'ará','erá','irá','arão','erão','irão','arei','erei','irei',
  'aria','eria','iria','ariam','eriam','iriam','aríamos',
  'amos','emos','imos','armos','ermos','irmos',
  'ei','eu','iu','ram','rem'
];
const SUF_ADJ = [
  'oso','osa','osos','osas','ável','áveis','ível','íveis',
  'ico','ica','icos','icas','ivo','iva','ivos','ivas','ante','antes',
  'íssimo','íssima','íssimos','íssimas',
  'ês','esa','eses','esas','ano','ana','anos','anas','ino','ina',
  'udo','uda','ento','enta','onho','onha'
];
const SUF_SUBST = [
  'ção','ções','são','sões','dade','dades','mento','mentos','ismo','ismos',
  'ista','istas','eza','ezas','ura','uras','agem','agens',
  'ência','ências','ância','âncias','tude','tudes','ário','ários','ária','árias',
  'eiro','eira','eiros','eiras','dor','dora','dores','doras',
  'ador','adora','ez','ice','ncia'
];

/* Palavras curtas e frequentes que os sufixos classificariam mal:
   "lugar" não é verbo só por terminar em -ar. */
const NAO_VERBO = new Set(`
lugar mar par ar bar lar altar colar dolar dólar pilar militar
mulher qualquer talher poder prazer dever saber ser ter ver
senhor amor calor valor cor dor flor ator autor açúcar caráter colher
`.trim().split(/\s+/));

function terminaCom(p, sufixos){
  return sufixos.some(s => p.length > s.length + 1 && p.endsWith(s));
}

/* Classificador heurístico. Não é um analisador morfológico —
   é uma leitura rápida, no espírito do realce do iA Writer. */
function classeGramatical(p, anterior = ''){
  if (CONECTIVOS.has(p)) return 'g-conj';
  if (ADVERBIOS.has(p) || p.endsWith('mente')) return 'g-adv';
  if (VERBOS.has(p) && SUBSTANTIVOS.has(p)){
    if (DETERMINANTES.has(anterior)) return 'g-subst';
    if (PRONOMES_SUJEITO.has(anterior)) return 'g-verbo';
    return null;
  }
  if (VERBOS.has(p)) return 'g-verbo';
  if (SUBSTANTIVOS.has(p)) return 'g-subst';
  if (ADJETIVOS.has(p)) return 'g-adj';
  if (p.length < 2) return null;
  if (terminaCom(p, SUF_SUBST)) return 'g-subst';
  if (terminaCom(p, SUF_ADJ)) return 'g-adj';
  if (!NAO_VERBO.has(p) && terminaCom(p, SUF_VERBO)) return 'g-verbo';
  return null;              // sem palpite: o que não se reconhece fica neutro
}

/* ═══════════════════════════════════════════════════════════
   2. Pedaços de texto
   ═══════════════════════════════════════════════════════════ */

function pd(t, c){ return { t, c: c || '' }; }

function escapar(t){
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function mais(pedaco, classe){
  return pedaco.c ? pedaco.c + ' ' + classe : classe;
}

/* Passa uma regra por cima dos pedaços ainda sem classificação.
   `montar` devolve os pedaços que cobrem exatamente o trecho
   casado — nem um caractere a mais, nem um a menos. */
function dividir(pedacos, re, montar){
  const saida = [];
  for (const p of pedacos){
    if (p.c || !p.t){ saida.push(p); continue; }
    const s = p.t;
    let ult = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(s))){
      if (m[0] === ''){ re.lastIndex++; continue; }
      if (m.index > ult) saida.push(pd(s.slice(ult, m.index)));
      for (const novo of montar(m)) if (novo.t) saida.push(novo);
      ult = m.index + m[0].length;
      re.lastIndex = ult;
    }
    if (ult < s.length) saida.push(pd(s.slice(ult)));
  }
  return saida;
}

/* Marcações em linha. Os sinais do Markdown continuam visíveis,
   apenas recuados — o texto nunca muda de tamanho. */
/* As cores do realce vão no próprio texto, com um emoji quadrado logo
   depois do ==, para o arquivo continuar legível em qualquer editor. */
const COR_GRIFO = { '🟥': 'vermelho', '🟧': 'laranja', '🟨': 'amarelo', '🟩': 'verde', '🟦': 'azul', '🟪': 'roxo' };

const REGRAS_INLINE = [
  // código entre crases — protegido de todo o resto
  [/(`+)([^`]+)\1/g, (m) => [pd(m[1],'mk t-cod'), pd(m[2],'t-cod'), pd(m[1],'mk t-cod')]],
  // [[ligação]] para outra nota, livro ou aula do Caderno
  [/\[\[([^\[\]\n]+)\]\]/g, (m) => [pd('[[','mk'), pd(m[1],'t-link t-wiki'), pd(']]','mk')]],
  // #etiqueta
  [/(^|[\s(])(#[A-Za-zÀ-ÖØ-öø-ÿ0-9_\/-]*[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_\/-]*)/g, (m) => [pd(m[1]), pd(m[2],'t-tag')]],
  // ==grifo== (o do Obsidian); ==🟥grifo== escolhe a cor, como no Obsidian 1.x
  [/==([🟥🟧🟨🟩🟦🟪]?)(?=\S)([^=\n]*?\S)==/gu, (m) => [pd('==','mk'), ...(m[1] ? [pd(m[1],'mk t-grifo-cor')] : []), pd(m[2],'t-grifo ' + (COR_GRIFO[m[1]] ? 'gr-' + COR_GRIFO[m[1]] : '')), pd('==','mk')]],
  // $equação$
  [/\$(?=[^\s$])([^$\n]*?[^\s$])\$(?!\d)/g, (m) => [pd('$','mk t-math'), pd(m[1],'t-math'), pd('$','mk t-math')]],
  // %%comentário%%: fica no arquivo, some na leitura e na exportação
  [/%%([^%\n]*)%%/g, (m) => [pd('%%','mk t-coment'), pd(m[1],'t-coment'), pd('%%','mk t-coment')]],
  // [^1]: chamada de nota de rodapé
  [/\[\^([^\]\s]+)\]/g, (m) => [pd('[^','mk t-nota'), pd(m[1],'t-nota'), pd(']','mk t-nota')]],
  // imagem e link
  [/(!?)\[([^\]\n]*)\]\(([^)\n]*)\)/g, (m) => [
      pd(m[1] + '[','mk'), pd(m[2],'t-link'), pd(']','mk'),
      pd('(','mk'), pd(m[3],'t-url'), pd(')','mk')]],
  // negrito
  [/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, (m) => [pd(m[1],'mk'), pd(m[2],'t-forte'), pd(m[1],'mk')]],
  // riscado
  [/~~(?=\S)([\s\S]*?\S)~~/g, (m) => [pd('~~','mk'), pd(m[1],'t-risco'), pd('~~','mk')]],
  // ênfase
  [/(^|[^*\w])\*(?=\S)([^*\n]*?\S)\*/g, (m) => [
      pd(m[1]), pd('*','mk'), pd(m[2],'t-enf'), pd('*','mk')]],
  [/(^|[^_\w])_(?=\S)([^_\n]*?\S)_/g, (m) => [
      pd(m[1]), pd('_','mk'), pd(m[2],'t-enf'), pd('_','mk')]]
];

function emLinha(bruto){
  let pedacos = [pd(bruto)];
  for (const [re, montar] of REGRAS_INLINE) pedacos = dividir(pedacos, re, montar);
  return pedacos;
}

/* Sinais do Markdown não recebem realce de palavra. */
function colorivel(c){
  return !/\b(?:mk|t-cod|t-url|t-hr)\b/.test(c);
}

function marcarPalavras(pedacos){
  const querClasse = prefs.classe !== 'nenhuma';
  if (!querClasse && !prefs.ortografia) return pedacos;

  const saida = [];
  for (const p of pedacos){
    if (!p.t || !colorivel(p.c)){ saida.push(p); continue; }
    const s = p.t;
    let ult = 0;
    RE_PALAVRA.lastIndex = 0;
    const ocorrencias = [...s.matchAll(RE_PALAVRA)];
    for (let i = 0; i < ocorrencias.length; i++){
      const m = ocorrencias[i];
      const baixa = m[0].toLowerCase();
      const anterior = i ? ocorrencias[i - 1][0].toLowerCase() : '';
      const extras = [];
      if (prefs.ortografia && ERROS.has(baixa)) extras.push('erro');
      if (querClasse){
        const g = classeGramatical(baixa, anterior);
        if (g && (prefs.classe === 'todas' || prefs.classe === g)) extras.push(g);
      }
      if (!extras.length) continue;
      if (m.index > ult) saida.push(pd(s.slice(ult, m.index), p.c));
      saida.push(pd(m[0], mais(p, extras.join(' '))));
      ult = m.index + m[0].length;
    }
    if (ult < s.length) saida.push(pd(s.slice(ult), p.c));
  }
  return saida;
}

function comClasse(pedacos, classe){
  return pedacos.map(p => pd(p.t, mais(p, classe)));
}

/* Uma linha inteira, já sabendo se está dentro de um bloco de código. */
function pedacosDaLinha(bruta, dentroDeCodigo){
  if (dentroDeCodigo) return [pd(bruta, 't-cod')];

  let m;
  if ((m = bruta.match(/^(\s*)(#{1,6})(\s+)(.*)$/))){
    const grau = Math.min(m[2].length, 3);
    const marca = `t-h t-h${grau}`;
    return marcarPalavras([
      pd(m[1]), pd(m[2], 'mk ' + marca), pd(m[3], marca),
      ...comClasse(emLinha(m[4]), marca)
    ]);
  }
  if ((m = bruta.match(/^(\s*)(>+)(\s*)(.*)$/))){
    return marcarPalavras([
      pd(m[1]), pd(m[2], 'mk'), pd(m[3]),
      ...comClasse(emLinha(m[4]), 't-cit')
    ]);
  }
  if ((m = bruta.match(/^(\s*)([-*+]|\d{1,9}[.)])(\s+)(.*)$/))){
    return marcarPalavras([
      pd(m[1]), pd(m[2], 't-lista'), pd(m[3]), ...emLinha(m[4])
    ]);
  }
  if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(bruta)){
    return [pd(bruta, 't-hr')];
  }
  return marcarPalavras(emLinha(bruta));
}

/* Acrescenta uma classe aos pedaços que caem (ou não caem) dentro
   de certas faixas do texto. Serve tanto para o recuo do foco
   quanto para os apontamentos da revisão — em ambos os casos, um
   pedaço é partido no ponto exato onde a faixa começa e termina. */
function aplicarFaixas(pedacos, ini, faixas, classe, inverter){
  if (!faixas.length && !inverter) return pedacos;

  const cortes = [];
  for (const [a, b] of faixas){ cortes.push(a, b); }

  const saida = [];
  let pos = ini;
  for (const p of pedacos){
    const fim = pos + p.t.length;
    if (!p.t){ saida.push(p); continue; }

    const pontos = [pos, ...cortes.filter(c => c > pos && c < fim).sort((x,y) => x - y), fim];
    for (let i = 0; i < pontos.length - 1; i++){
      const a = pontos[i], b = pontos[i + 1];
      if (a === b) continue;
      const dentro = faixas.some(([x, y]) => a >= x && b <= y);
      const marcar = inverter ? !dentro : dentro;
      saida.push(pd(p.t.slice(a - pos, b - pos), marcar ? mais(p, classe) : p.c));
    }
    pos = fim;
  }
  return saida;
}

const MARCA_CURSOR = '<span class="caret-mark" id="marcaCursor"></span>';

function renderizar(pedacos, ini, cursor){
  let html = '', pos = ini, posto = cursor === null;
  for (const p of pedacos){
    const fim = pos + p.t.length;
    if (!posto && cursor >= pos && cursor <= fim){
      const corte = cursor - pos;
      html += trecho(p.t.slice(0, corte), p.c) + MARCA_CURSOR + trecho(p.t.slice(corte), p.c);
      posto = true;
    } else {
      html += trecho(p.t, p.c);
    }
    pos = fim;
  }
  if (!posto) html += MARCA_CURSOR;
  return html;
}

function trecho(t, c){
  if (!t) return '';
  return c ? `<span class="${c}">${escapar(t)}</span>` : escapar(t);
}

/* ═══════════════════════════════════════════════════════════
   3. Modo Foco — onde recuar e onde permanecer nítido
   ═══════════════════════════════════════════════════════════ */

function regiaoAtiva(texto, cursor){
  const c = Math.max(0, Math.min(cursor, texto.length));

  if (prefs.escopo === 'paragrafo'){
    let ini = texto.lastIndexOf('\n\n', Math.max(0, c - 1));
    ini = ini === -1 ? 0 : ini + 2;
    let fim = texto.indexOf('\n\n', c);
    fim = fim === -1 ? texto.length : fim;
    return [ini, fim];
  }

  if (prefs.escopo === 'linha'){
    const ini = texto.lastIndexOf('\n', Math.max(0, c - 1)) + 1;
    let fim = texto.indexOf('\n', c);
    fim = fim === -1 ? texto.length : fim;
    return [ini, fim];
  }

  // frase — o padrão do iA Writer
  const limIni = texto.lastIndexOf('\n', Math.max(0, c - 1)) + 1;
  let limFim = texto.indexOf('\n', c);
  limFim = limFim === -1 ? texto.length : limFim;

  const linha = texto.slice(limIni, limFim);
  const rel = c - limIni;
  let ini = 0;
  const corte = /[.!?…:;](?:["'”’)\]]*)\s+/g;
  let m;
  while ((m = corte.exec(linha))){
    const fim = m.index + m[0].length;
    if (fim > rel) break;
    ini = fim;
  }
  corte.lastIndex = ini;
  const prox = corte.exec(linha);
  const fim = prox && prox.index + prox[0].length > rel
    ? prox.index + prox[0].length
    : linha.length;
  return [limIni + ini, limIni + Math.max(fim, ini)];
}

/* Depois que o overlay foi composto, o navegador já sabe onde a linha
   quebrou visualmente. Medimos os retângulos dos caracteres da linha
   lógica atual para manter nítida somente a fileira em que está o cursor. */
function regiaoLinhaVisual(texto, cursor){
  const iniLogico = texto.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
  let fimLogico = texto.indexOf('\n', cursor);
  if (fimLogico === -1) fimLogico = texto.length;
  const numero = texto.slice(0, iniLogico).split('\n').length - 1;
  const elemento = overlay.querySelector(`[data-linha="${numero}"]`);
  const tamanho = fimLogico - iniLogico;
  if (!elemento || !tamanho) return [iniLogico, fimLogico];

  function topoDoCaractere(indice){
    const walker = document.createTreeWalker(elemento, NodeFilter.SHOW_TEXT);
    let no, restante = indice;
    while ((no = walker.nextNode())){
      if (restante < no.data.length){
        const faixa = document.createRange();
        faixa.setStart(no, restante);
        faixa.setEnd(no, restante + 1);
        const rect = faixa.getClientRects()[0];
        return rect ? rect.top : null;
      }
      restante -= no.data.length;
    }
    return null;
  }

  const relativo = Math.min(Math.max(0, cursor - iniLogico), tamanho - 1);
  const topo = topoDoCaractere(relativo);
  if (topo === null) return [iniLogico, fimLogico];
  let a = relativo, b = relativo + 1;
  while (a > 0 && Math.abs(topoDoCaractere(a - 1) - topo) < 1) a--;
  while (b < tamanho && Math.abs(topoDoCaractere(b) - topo) < 1) b++;
  return [iniLogico + a, iniLogico + b];
}

/* ═══════════════════════════════════════════════════════════
   4. Revisão de estilo
   ═══════════════════════════════════════════════════════════ */

let apontamentos = [];
const proximaOcorrencia = new Map();
let alvoRevisao = null;

function revisar(texto){
  if (!prefs.estilo) return [];
  const achados = [];
  const ocorrencias = new Map();
  const rePalavra = /[A-Za-zÀ-ÖØ-öø-ÿ]{4,}/g;
  let m, total = 0;
  while ((m = rePalavra.exec(texto))){
    total++;
    const chave = m[0].toLocaleLowerCase('pt-BR');
    if (PALAVRAS_COMUNS.has(chave)) continue;
    if (!ocorrencias.has(chave)) ocorrencias.set(chave, []);
    ocorrencias.get(chave).push([m.index, m.index + m[0].length, m[0]]);
  }

  // A tolerância cresce com o documento; nunca se acusa menos de quatro usos.
  const limite = Math.max(4, Math.ceil(total / 75));
  for (const lista of ocorrencias.values()){
    if (lista.length < limite) continue;
    const [ini, fim, grafia] = lista[0];
    achados.push({
      ini, fim, palavra: grafia,
      faixas: lista.map(([a, b]) => [a, b]),
      msg: `Aparece ${lista.length} vezes.`
    });
  }

  const reFrase = /[^.!?…\n]+(?:[.!?…]+|$)/g;
  while ((m = reFrase.exec(texto))){
    const esquerda = m[0].search(/\S/);
    if (esquerda < 0) continue;
    const frase = m[0].trim();
    const n = (frase.match(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g) || []).length;
    const muletas = TROCAS_CONCISAS.reduce((s, [re]) => s + (frase.match(re) || []).length, 0);
    if (n < 32 && muletas < 2) continue;
    achados.push({
      ini: m.index + esquerda,
      fim: m.index + esquerda + frase.length,
      palavra: n >= 32 ? `Frase longa · ${n} palavras` : 'Frase prolixa',
      msg: `Sugestão de refundição: “${refundirFrase(frase)}”`
    });
  }
  achados.sort((a, b) => a.ini - b.ini || b.fim - a.fim);
  return achados;
}

function refundirFrase(frase){
  let nova = frase;
  for (const [re, troca] of TROCAS_CONCISAS) nova = nova.replace(re, troca);
  nova = nova
    .replace(/\b([A-Za-zÀ-ÖØ-öø-ÿ]{3,})(\s+\1\b)+/gi, '$1')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if ((nova.match(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g) || []).length >= 32){
    const antes = nova;
    nova = nova.replace(/,\s+(mas|porém|contudo|entretanto|e)\s+/i,
      (_, conector) => `. ${conector[0].toUpperCase()}${conector.slice(1)} `);
    nova = nova.replace(/;\s+/, '. ');
    // Sem um conectivo claro, a vírgula mais próxima do centro oferece
    // um ponto de partida menos arbitrário para duas frases respiráveis.
    if (nova === antes){
      const virgulas = [...nova.matchAll(/,\s+/g)];
      const meio = nova.length / 2;
      const corte = virgulas.sort((a, b) =>
        Math.abs(a.index - meio) - Math.abs(b.index - meio))[0];
      if (corte){
        const pos = corte.index;
        const seguinte = nova.slice(pos + corte[0].length);
        nova = nova.slice(0, pos) + '. ' +
          seguinte.replace(/^([a-zà-öø-ÿ])/, l => l.toLocaleUpperCase('pt-BR'));
      }
    }
  }
  nova = nova.replace(/^([a-zà-öø-ÿ])/, l => l.toLocaleUpperCase('pt-BR'));
  return nova || frase;
}

function renderRevisao(){
  const botao = $('#stRevisao');
  const n = apontamentos.length;

  botao.hidden = !prefs.estilo || n === 0;
  if (botao.hidden){ fecharRevisao(); return; }

  const aberto = $('#revisao').open;
  botao.innerHTML = `<b>${n}</b> ponto${n > 1 ? 's' : ''} de atenção`;
  $('#revConta').textContent = n.toLocaleString('pt-BR');
  if (aberto) preencherRevisao();
}

function preencherRevisao(){
  $('#revisaoLista').innerHTML = apontamentos.map((a, i) => `
    <button class="ponto" type="button" data-ponto="${i}">
      <span class="ponto-palavra">${escapar(a.palavra)}</span>
      <span class="ponto-texto">${escapar(a.msg)}</span>
    </button>`).join('');
}

/* A lista abre no meio da tela, como os outros pop-ups. O <dialog> e
   as funções abrirDialogo/fecharDialogo vêm do personalizar.js. */
function abrirRevisao(){
  if (!apontamentos.length) return;
  $('#stRevisao').setAttribute('aria-expanded', 'true');
  preencherRevisao();
  renderRevisao();
  const d = $('#revisao');
  if (!d.open) abrirDialogo(d);
  d.querySelector('.ponto')?.focus({ preventScroll: true });
}
function fecharRevisao(){
  $('#stRevisao').setAttribute('aria-expanded', 'false');
  const d = $('#revisao');
  if (d.open) fecharDialogo(d);
}

$('#stRevisao').onclick = () => {
  if (!$('#revisao').open) abrirRevisao(); else { fecharRevisao(); renderRevisao(); }
};
$('#revFechar').onclick = () => { fecharRevisao(); renderRevisao(); };
$('#revisaoLista').addEventListener('click', (e) => {
  const botao = e.target.closest('.ponto');
  if (!botao) return;
  const a = apontamentos[+botao.dataset.ponto];
  if (!a) return;
  const destinos = a.faixas || [[a.ini, a.fim]];
  const chave = a.faixas
    ? `palavra:${a.palavra.toLocaleLowerCase('pt-BR')}`
    : `trecho:${a.ini}:${a.fim}`;
  const indice = (proximaOcorrencia.get(chave) || 0) % destinos.length;
  const [ini, fim] = destinos[indice];
  proximaOcorrencia.set(chave, (indice + 1) % destinos.length);
  alvoRevisao = ini;
  // o pop-up sai antes: com ele aberto o editor está inerte
  const dRev = $('#revisao');
  if (dRev.open){ dRev.classList.remove('saindo'); dRev.close(); }
  $('#stRevisao').setAttribute('aria-expanded', 'false');
  editor.focus({ preventScroll:true });
  editor.setSelectionRange(ini, fim);
  desenhar();
  // Foco e seleção podem disparar uma rolagem nativa depois do clique.
  // Reposicionamos no quadro seguinte, quando o overlay e o layout terminaram.
  requestAnimationFrame(() => {
    rolarAte(ini);
    requestAnimationFrame(() => rolarAte(ini));
  });
});

/* Traz um ponto do texto para a área visível.
   O overlay repete o texto caractere por caractere, então dá para
   localizar qualquer posição percorrendo os nós de texto dele. */
function rolarAte(posicao){
  // O clique na revisão insere uma âncora de largura zero exatamente no
  // destino. Ela é mais confiável do que recontar nós com Markdown aninhado.
  const ancora = document.getElementById('marcaCursor');
  if (ancora){
    const caixa = ancora.getBoundingClientRect();
    const refer = scroller.getBoundingClientRect();
    const alvo = scroller.scrollTop + (caixa.top - refer.top) - scroller.clientHeight * 0.4;
    scroller.scrollTop = Math.max(0, alvo);
    return;
  }
  const passeio = document.createTreeWalker(overlay, NodeFilter.SHOW_TEXT);
  let contado = 0, no;
  while ((no = passeio.nextNode())){
    const fim = contado + no.length;
    if (posicao <= fim){
      const faixa = document.createRange();
      faixa.setStart(no, Math.max(0, posicao - contado));
      faixa.collapse(true);
      const caixa = faixa.getBoundingClientRect();
      const refer = scroller.getBoundingClientRect();
      const alvo = scroller.scrollTop + (caixa.top - refer.top) - scroller.clientHeight * 0.4;
      scroller.scrollTop = Math.max(0, alvo);
      return;
    }
    contado = fim;
  }
}

/* ═══════════════════════════════════════════════════════════
   5. Desenho do overlay
   ═══════════════════════════════════════════════════════════ */

let precisaCentrar = false;

function desenhar(){
  const texto = editor.value;
  const cursor = editor.selectionStart;
  if (typeof ultimoDesenho !== 'undefined') ultimoDesenho = cursor + ':' + editor.selectionEnd + ':' + texto.length;

  let fa = -1, fb = -1;
  const comFoco = prefs.escopo !== 'nenhum' && !prefs.visualizando;
  if (comFoco) [fa, fb] = regiaoAtiva(texto, cursor);

  apontamentos = revisar(texto);
  // buscar e substituir (personalizar.js): onde o termo aparece
  const achados = typeof achadosDaBusca === 'function' ? achadosDaBusca(texto) : [];
  const achadoAtual = achados.length && typeof achadoDaVez === 'function' ? achadoDaVez() : null;

  const linhas = texto.split('\n');
  function montarOverlay(){
    const saida = [];
    let base = 0, emCodigo = false;
    for (const [numeroLinha, linha] of linhas.entries()){
      const ini = base, fim = base + linha.length;
      base = fim + 1;
      const cerca = /^\s*(```|~~~)/.test(linha);
      let pedacos = cerca ? [pd(linha, 'mk t-cod')] : pedacosDaLinha(linha, emCodigo);
      if (cerca) emCodigo = !emCodigo;
      if (prefs.estilo && apontamentos.length){
        const faixas = apontamentos
          .flatMap(a => a.faixas || [[a.ini, a.fim]])
          .filter(([a, b]) => a < fim && b > ini);
        if (faixas.length) pedacos = aplicarFaixas(pedacos, ini, faixas, 'estilo', false);
      }
      if (achados.length){
        const aqui = achados.filter(([a, b]) => a < fim && b > ini);
        if (aqui.length) pedacos = aplicarFaixas(pedacos, ini, aqui, 'achado', false);
        if (achadoAtual && achadoAtual[0] < fim && achadoAtual[1] > ini) pedacos = aplicarFaixas(pedacos, ini, [achadoAtual], 'achado-atual', false);
      }
      if (comFoco) pedacos = aplicarFaixas(pedacos, ini, [[fa, fb]], 'dim', true);
      const posicaoMarca = alvoRevisao !== null
        ? alvoRevisao
        : (prefs.maquina ? cursor : null);
      const cursorAqui = posicaoMarca !== null && posicaoMarca >= ini && posicaoMarca <= fim;
      saida.push(`<span class="linha-fonte" data-linha="${numeroLinha}">` +
        renderizar(pedacos, ini, cursorAqui ? posicaoMarca : null) + '</span>');
    }
    overlay.innerHTML = saida.join('\n');
  }

  montarOverlay();
  if (comFoco && prefs.escopo === 'linha'){
    [fa, fb] = regiaoLinhaVisual(texto, cursor);
    montarOverlay();
  }
  desenharNumerosLinha(texto, cursor);

  atualizarNumeros(texto);
  atualizarDica(texto, cursor);
  renderRevisao();

  if (prefs.maquina && precisaCentrar){
    precisaCentrar = false;
    descerAteOCentro();
  }
}

/* Um verso é uma linha com texto que não seja título nem separador:
   o "# Soneto" no alto não entra na contagem do poema. */
const ehVerso = (linha) => !!linha.trim() && !/^\s{0,3}#{1,6}\s/.test(linha) && !/^\s*([-*_])(\s*\1){2,}\s*$/.test(linha);

function desenharNumerosLinha(texto, cursor){
  const st = $('#stPoeta');
  if (!prefs.poeta){
    numerosLinha.innerHTML = '';
    if (st) st.hidden = true;
    return;
  }
  const atual = texto.slice(0, cursor).split('\n').length - 1;
  const textos = texto.split('\n');
  let verso = 0, estrofe = 0, anteriorEraVerso = false;
  let versoAtual = 0, estrofeAtual = 0;
  const linhas = [...overlay.querySelectorAll('.linha-fonte')];
  const marcas = [];

  textos.forEach((t, indice) => {
    // O branco entre estrofes é estrutura, não verso: não recebe
    // número e tampouco interrompe a contagem contínua do poema.
    if (!ehVerso(t)){ anteriorEraVerso = false; return; }
    verso++;
    if (!anteriorEraVerso) estrofe++;
    anteriorEraVerso = true;
    const estaAtual = indice === atual;
    if (estaAtual){ versoAtual = verso; estrofeAtual = estrofe; }
    // Como numa edição de poesia, a margem permanece silenciosa:
    // marca-se cada quinto verso e, para orientação, o verso ativo.
    if ((estaAtual || verso % 5 === 0) && linhas[indice])
      marcas.push(`<span class="numero-linha${estaAtual ? ' atual' : ''}" style="top:${linhas[indice].offsetTop}px">${verso}</span>`);
  });
  numerosLinha.innerHTML = marcas.join('');

  // no rodapé: onde o cursor está dentro do poema
  if (st){
    st.hidden = !verso;
    const plural = (n, um, varios) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;
    st.innerHTML = versoAtual
      ? `verso <b>${versoAtual}</b> de ${verso} · estrofe <b>${estrofeAtual}</b> de ${estrofe}`
      : `<b>${plural(verso, 'verso', 'versos')}</b> · ${plural(estrofe, 'estrofe', 'estrofes')}`;
  }
}

/* Centraliza de uma vez: só quando o modo liga ou quando a folha
   muda de medida (fonte, corpo, coluna), porque aí a linha mudou de
   lugar sem ninguém ter mexido nela. */
const alvoDoCentro = (marca) => Math.max(0, marca.offsetTop - scroller.clientHeight / 2 + 12);
function centralizarCursor(){
  const marca = document.getElementById('marcaCursor');
  if (!marca) return;
  scroller.scrollTop = alvoDoCentro(marca);
}

/* O modo máquina de escrever, como a máquina de verdade: a folha só
   anda para a frente. Enquanto se digita (ou se desce com o teclado),
   a linha que passou do meio da tela leva a folha junto, num passo
   macio do tamanho de uma linha. Ela nunca volta para cima sozinha,
   e um clique ou uma seleção com o mouse não mexem em nada: dá para
   escolher qualquer linha sem a página fugir debaixo do cursor.
   A única exceção é a linha sumir do alto (atrás da barra): aí ela
   volta ao meio, para quem digita enxergar o que está escrevendo. */
function descerAteOCentro(){
  const marca = document.getElementById('marcaCursor');
  if (!marca) return;
  const alvo = alvoDoCentro(marca);
  const indo = descida ? descida.alvo : scroller.scrollTop;
  const topo = marca.offsetTop - scroller.scrollTop;
  const escondida = topo < (document.getElementById('bar')?.offsetHeight || 56) + 8;
  if (!escondida && alvo <= indo + 1) return;
  const longe = Math.abs(alvo - scroller.scrollTop) > scroller.clientHeight * 0.4;
  if (escondida || longe || matchMedia('(prefers-reduced-motion: reduce)').matches){
    descida = null;
    scroller.scrollTop = alvo;
    return;
  }
  rolarMacio(alvo);
}

/* O passo macio é feito à mão, quadro a quadro e medido pelo relógio:
   o scrollTo({behavior:'smooth'}) do navegador era cancelado a cada
   redesenho da folha e a página ficava parada. Se outra linha chega
   no meio do caminho, só o destino muda, sem recomeçar o movimento. */
let descida = null;
function rolarMacio(alvo){
  if (descida){ descida.alvo = alvo; return; }
  descida = { alvo, antes: performance.now() };
  const quadro = (agora) => {
    if (!descida) return;
    const dt = Math.min(64, agora - descida.antes);
    descida.antes = agora;
    const falta = descida.alvo - scroller.scrollTop;
    if (Math.abs(falta) < 0.6){ scroller.scrollTop = descida.alvo; descida = null; return; }
    scroller.scrollTop += falta * (1 - Math.exp(-dt / 55));
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);
}
// quem rola com a roda ou o dedo assume a página na hora
['wheel', 'touchstart'].forEach(ev => scroller.addEventListener(ev, () => { descida = null; }, { passive:true }));

/* ═══════════════════════════════════════════════════════════
   6. Números e dica do rodapé
   ═══════════════════════════════════════════════════════════ */

const CONTAGENS = [
  { rotulo:(n) => `${n === 1 ? 'palavra' : 'palavras'}`,
    calc:(t) => (t.trim() ? t.trim().split(/\s+/).length : 0) },
  { rotulo:(n) => `${n === 1 ? 'caractere' : 'caracteres'}`,
    calc:(t) => t.length },
  { rotulo:() => 'sem espaços',
    calc:(t) => t.replace(/\s/g,'').length },
  { rotulo:(n) => `${n === 1 ? 'frase' : 'frases'}`,
    calc:(t) => (t.match(/[^.!?…]+[.!?…]+/g) || []).length +
                (/[^.!?…\s][\s]*$/.test(t) ? 1 : 0) },
  { rotulo:(n) => `${n === 1 ? 'parágrafo' : 'parágrafos'}`,
    calc:(t) => t.split(/\n\s*\n/).filter(p => p.trim()).length }
];

function atualizarNumeros(texto){
  const modo = CONTAGENS[prefs.contagem];
  const n = modo.calc(texto);
  // o rótulo recebe o número de verdade; o HTML entra depois
  $('#stCont').innerHTML = `<b>${n.toLocaleString('pt-BR')}</b> ${modo.rotulo(n)}`;
  const palavras = texto.trim() ? texto.trim().split(/\s+/).length : 0;
  $('#stTempo').textContent = palavras ? Math.max(1, Math.round(palavras / (prefs.ppm || 200))) : 0;
}

/* Com o cursor em cima de uma palavra que a lista conhece, a forma
   correta aparece no rodapé — e clicar nela (ou Ctrl+;) faz a troca.
   Sem janela, sem menu, sem interromper a linha de raciocínio. */
let correcaoAtual = null;   // { ini, fim, errada, certa }

function atualizarDica(texto, cursor){
  const dica = $('#stDica');
  dica.hidden = true;
  correcaoAtual = null;
  if (!prefs.ortografia) return;

  const ini = acharInicioPalavra(texto, cursor);
  if (ini === -1) return;
  RE_PALAVRA.lastIndex = ini;
  const m = RE_PALAVRA.exec(texto);
  if (!m || m.index !== ini) return;

  const certa = ERROS.get(m[0].toLowerCase());
  if (!certa) return;

  correcaoAtual = { ini, fim: ini + m[0].length, errada: m[0], certa };
  dica.innerHTML = `${escapar(m[0])} → <b>${escapar(comOMesmoMolde(m[0], certa))}</b><kbd>${paraSO('Ctrl+;')}</kbd>`;
  dica.hidden = false;
}

/* "Concerteza" no começo da frase merece virar "Com certeza", e não
   "com certeza": a troca respeita a caixa da palavra original. */
function comOMesmoMolde(errada, certa){
  if (errada === errada.toUpperCase() && errada.length > 1) return certa.toUpperCase();
  if (errada[0] === errada[0].toUpperCase())
    return certa[0].toUpperCase() + certa.slice(1);
  return certa;
}

/* A troca passa por setRangeText para que o desfazer do navegador
   (Ctrl+Z) continue enxergando a correção como uma edição sua. */
function corrigirNoCursor(){
  if (!correcaoAtual) return false;
  const { ini, fim, errada, certa } = correcaoAtual;
  if (editor.value.slice(ini, fim) !== errada) return false;

  const nova = comOMesmoMolde(errada, certa);
  editor.focus();
  editor.setRangeText(nova, ini, fim, 'end');
  aoDigitar();
  avisar(`${errada} → ${nova}`);
  return true;
}

const RE_LETRA = new RegExp(`[${LETRA}'’-]`);

function acharInicioPalavra(texto, cursor){
  const ehLetra = (ch) => !!ch && RE_LETRA.test(ch);
  let i = cursor;
  if (!ehLetra(texto[i]) && !ehLetra(texto[i - 1])) return -1;
  while (i > 0 && ehLetra(texto[i - 1])) i--;
  return i;
}

/* ═══════════════════════════════════════════════════════════
   7. Markdown completo — visualização, exportação, impressão
   ═══════════════════════════════════════════════════════════ */

function paraHTML(md, raiz = true){
  md = md.replace(/\r\n?/g,'\n');
  /* Notas de rodapé: as definições "[^1]: texto" saem do corpo e vão
     para o fim, numeradas na ordem em que aparecem no texto. */
  const defs = new Map(), ordem = [];
  if (raiz){
    md = md.replace(/^\[\^([^\]\s]+)\]:[ \t]?(.*)$/gm, (_, id, t) => { defs.set(id, t); return '\u0001'; })
           .replace(/\n?\u0001/g, '');
    md.replace(/\[\^([^\]\s]+)\]/g, (_, id) => { if (!ordem.includes(id)) ordem.push(id); return ''; });
  }
  const numeroDaNota = (id) => ordem.indexOf(id) + 1;
  const linhas = md.split('\n');
  const out = [];
  let i = 0;

  const inline = (t) => {
    let s = escapar(t);
    const cofre = [];
    const guardar = (h) => `\u0000${cofre.push(h) - 1}\u0000`;
    s = s.replace(/(`+)([^`]+)\1/g, (_, c, x) => guardar(`<code>${x}</code>`));
    s = s.replace(/%%[^%\n]*%%/g, '');
    s = s.replace(/\[\^([^\]\s]+)\]/g, (_, id) => {
      const n = numeroDaNota(id);
      return n ? guardar(`<sup class="nr" id="nr-ref-${n}"><a href="#nr-${n}">${n}</a></sup>`) : `[^${id}]`;
    });
    s = s.replace(/==([🟥🟧🟨🟩🟦🟪]?)(?=\S)([^=\n]*?\S)==/gu, (_, e, t) => `<mark${COR_GRIFO[e] ? ` class="m-${COR_GRIFO[e]}"` : ''}>${t}</mark>`);
    s = s.replace(/\$(?=[^\s$])([^$\n]*?[^\s$])\$(?!\d)/g, (_, t) => guardar(`<span class="math">${t}</span>`));
    s = s.replace(/\[\[([^\[\]\n|]+)(?:\|([^\[\]\n]+))?\]\]/g,
      (_, alvo, rot) => guardar(`<a href="#" class="wikilink" data-nota="${alvo.replace(/"/g,'&quot;')}">${rot || alvo}</a>`));
    s = s.replace(/(^|[\s(])#([A-Za-zÀ-ÖØ-öø-ÿ0-9_\/-]*[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_\/-]*)/g,
      (_, a, t) => a + guardar(`<span class="tag-md">#${t}</span>`));
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
      (_, alt, url, t2) => guardar(`<img src="${url}" alt="${alt}"${t2 ? ` title="${t2}"` : ''}>`));
    s = s.replace(/\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
      (_, txt, url, t2) => guardar(`<a href="${url}"${t2 ? ` title="${t2}"` : ''}>${txt}</a>`));
    s = s.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '<strong>$2</strong>');
    s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
    s = s.replace(/(^|[^*\w])\*(?=\S)([^*\n]*?\S)\*/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^_\w])_(?=\S)([^_\n]*?\S)_/g, '$1<em>$2</em>');
    s = s.replace(/ {2,}$/,'<br>');
    return s.replace(/\u0000(\d+)\u0000/g, (_, k) => cofre[+k]);
  };

  while (i < linhas.length){
    const l = linhas[i];

    if (!l.trim()){ i++; continue; }

    // bloco de código
    let m = l.match(/^\s*(```|~~~)(.*)$/);
    if (m){
      const cerca = m[1], corpoCod = [];
      i++;
      while (i < linhas.length && !linhas[i].trim().startsWith(cerca)) corpoCod.push(linhas[i++]);
      i++;
      out.push(`<pre><code>${escapar(corpoCod.join('\n'))}</code></pre>`);
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)){ out.push('<hr>'); i++; continue; }

    // $$ equação em bloco $$
    if (/^\s*\$\$\s*$/.test(l)){
      const corpoEq = [];
      i++;
      while (i < linhas.length && !/^\s*\$\$\s*$/.test(linhas[i])) corpoEq.push(linhas[i++]);
      i++;
      out.push(`<div class="math math-bloco">${escapar(corpoEq.join('\n'))}</div>`);
      continue;
    }

    if ((m = l.match(/^\s*(#{1,6})\s+(.*?)\s*#*\s*$/))){
      const n = m[1].length;
      out.push(`<h${n}>${inline(m[2])}</h${n}>`);
      i++; continue;
    }

    // tabela
    if (/\|/.test(l) && i + 1 < linhas.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(linhas[i + 1])){
      const cel = (linha) => linha.replace(/^\s*\|/,'').replace(/\|\s*$/,'').split('|').map(c => c.trim());
      const cab = cel(l);
      i += 2;
      const corpoTab = [];
      while (i < linhas.length && /\|/.test(linhas[i]) && linhas[i].trim()) corpoTab.push(cel(linhas[i++]));
      out.push('<table><thead><tr>' + cab.map(c => `<th>${inline(c)}</th>`).join('') +
               '</tr></thead><tbody>' +
               corpoTab.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
               '</tbody></table>');
      continue;
    }

    // citação
    if (/^\s*>/.test(l)){
      const bloco = [];
      while (i < linhas.length && /^\s*>/.test(linhas[i])) bloco.push(linhas[i++].replace(/^\s*>\s?/,''));
      // > [!note] Título: um destaque (callout), como no Obsidian
      const cab = bloco[0].match(/^\[!(\w+)\][+-]?\s*(.*)$/);
      if (cab){
        const tipo = cab[1].toLowerCase();
        const NOMES = { note: 'Nota', tip: 'Dica', info: 'Informação', warning: 'Atenção', danger: 'Perigo', quote: 'Citação', example: 'Exemplo', question: 'Pergunta', success: 'Feito', abstract: 'Resumo', todo: 'Tarefa', bug: 'Erro', important: 'Importante', caution: 'Cuidado' };
        out.push(`<div class="callout callout-${escapar(tipo)}"><p class="callout-titulo">${inline(cab[2] || NOMES[tipo] || cab[1])}</p>${paraHTML(bloco.slice(1).join('\n'), false)}</div>`);
        continue;
      }
      out.push(`<blockquote>${paraHTML(bloco.join('\n'), false)}</blockquote>`);
      continue;
    }

    // listas
    if ((m = l.match(/^(\s*)([-*+]|\d{1,9}[.)])\s+/))){
      const ordenada = /\d/.test(m[2]);
      const itens = [];
      while (i < linhas.length){
        const mm = linhas[i].match(/^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/);
        if (!mm) break;
        if (/\d/.test(mm[2]) !== ordenada) break;
        const partes = [mm[3]];
        i++;
        while (i < linhas.length && linhas[i].trim() &&
               !/^(\s*)([-*+]|\d{1,9}[.)])\s+/.test(linhas[i]) &&
               !/^\s*(#{1,6}|>|```)/.test(linhas[i])){
          partes.push(linhas[i++].trim());
        }
        itens.push(`<li>${inline(partes.join(' '))}</li>`);
      }
      out.push(ordenada ? `<ol>${itens.join('')}</ol>` : `<ul>${itens.join('')}</ul>`);
      continue;
    }

    // parágrafo — preserva o recuo poético mesmo quando o HTML é
    // copiado sem a folha de estilos do Escritor.
    const par = [];
    while (i < linhas.length && linhas[i].trim() &&
           !/^\s*(#{1,6}\s|>|```|~~~)/.test(linhas[i]) &&
           !/^(\s*)([-*+]|\d{1,9}[.)])\s+/.test(linhas[i])){
      par.push(linhas[i++]);
    }
    const linhasPar = par.map(linha => {
      const inicio = (linha.match(/^ +/) || [''])[0].length;
      return '&nbsp;'.repeat(inicio) + inline(linha.slice(inicio));
    });
    out.push(`<p>${linhasPar.join('<br>')}</p>`);
  }

  if (raiz && ordem.length){
    out.push('<section class="notas-rodape"><hr><ol>' + ordem.map((id, k) =>
      `<li id="nr-${k + 1}">${inline(defs.get(id) || '')} <a href="#nr-ref-${k + 1}" aria-label="voltar ao texto">↩</a></li>`).join('') + '</ol></section>');
  }
  return out.join('\n');
}

/* Na leitura poética, cada linha do texto continua sendo um verso.
   Renderizar o poema inteiro como Markdown juntaria linhas vizinhas em
   parágrafos e apagaria a relação entre verso e número. */
function paraHTMLPoeta(md){
  let verso = 0;
  return md.replace(/\r\n?/g, '\n').split('\n').map(linha => {
    if (!linha.trim()){
      return '<div class="verso-preview vazio" aria-hidden="true"><span></span><span>&nbsp;</span></div>';
    }
    // título e separador não são versos: entram sem número
    if (!ehVerso(linha)) return `<div class="verso-preview"><span class="numero-preview"></span><span class="conteudo-preview">${paraHTML(linha)}</span></div>`;
    verso++;
    return `<div class="verso-preview"><span class="numero-preview">${verso}</span>` +
      `<span class="conteudo-preview">${paraHTML(linha)}</span></div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════
   8. Exportação
   ═══════════════════════════════════════════════════════════ */

/* Primeira linha com algum conteúdo, sem a marcação do Markdown.
   Serve ao rodapé das exportações; o nome do arquivo vem depois. */
function tituloLegivel(){
  const l = editor.value.split('\n').find(x => x.trim());
  if (!l) return '';
  return l.replace(/^#+\s*/,'').replace(/[*_`>[\]]/g,'')
          .trim().slice(0, 60).trim();
}

function tituloDoTexto(){
  return tituloLegivel()
          .replace(/[\\/:*?"<>|]/g,'-')
          .replace(/[.\s]+$/,'')          // sem ponto final grudado na extensão
          .trim() || 'documento';
}

/* ── assinatura do rodapé ───────────────────────
   Um filete curto abre o bloco; abaixo dele o título da obra em itálico,
   a data em versalete e, por fim, a marca: o próprio favicon do Escritor (o caderno com caneta)
   entre "Feito com" e o nome, levando ao endereço do aplicativo. */

const ESCRITOR_URL = 'https://grbrands.com.br/escritor';

/* O mesmo desenho de icons/favicon.svg (o caderno com caneta), embutido
   para viajar dentro do arquivo exportado. */
const MARCA_SVG =
  `<svg class="escritor-ic" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" ` +
  `role="img" focusable="false" fill="none" stroke="#0E0E10" stroke-width="2" ` +
  `stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/></svg>`;

/* O Word não desenha SVG: para o .doc o mesmo ícone vai em PNG. */
const MARCA_PNG =
  `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABmJLR0QA/wD/AP+gvaeTAAAGfklEQVR4nO2bWYwURRjH/1/1CAu7Xd09sEjEkxgTORISYoREVB5AwZtj1yMQeYBHiCH4ZDRqfPAgGOSJYCQmGkVAvDaKGKPGCFEjxmjURFAMR3B2p48B2WWmPlPDLuxOz9Ezszvb6+4vmaS7uqq6/3V8VfVVDTDG6IZqTdfSkpwhBF9DpJoH9YOIfndd98cakormZmemYeBqfZPL4diZM+mfAaiy70MVtLa2tnR3n99IhLXMmIYhggg7PM9dGyWulDLJTJuIaA2Aywc+5VPM2EnEL/q+31X0XYhIc7Mz2zD4fQDXogEw0y1BkP66XBzTdBYQ8R5dNxWyO81MK4Ig/VXhAxHlY6SU1xsGf94o8Roinl7uuWna9xLxgQjiNVN0XF1gtRQAAeItAJPQMPicEPiyvHi8A2BcFZmOI+LdlmU5VRWAZVnLAMxFw6DfmEWb67p/DaL4PqYohU0D3oYKSOnsAnhlQTADeIqIt3mel0aDqCC+G8Amw6DX9U0ux48CeB7A+IJ4J33fndarAREKwNY1kR9a+rHT911tdREf8bTM99Md/QOltDcAeLkwslJiVibTpYfISDZgajiItPGJtXgNEedbQyFC4KqL16hM6KVE6jxiLl6jlKqoTyDG1CNeQ2SsKhauFP6+GAf9sG3bVgobAJpx6VnIAOpHB4G+TFRKCNruuu5hxEi8lM5SgPcWMYInfN+9spgRTEhpfwtgTm3jNs0frEIYQvH6W5/zfe+JUBewbXtBbeI11KQUr0P8xZ8Sgl6KrQ0w6xd/V2nx6GEWK1zXdYsWgOu6eqFQYxPOd4HtqAMpnSVE2FVCfA8z2sqLT94JqN2lxaO92OKK4mAELctaxEwflqn55b6f/qhCze8pI35lELh6JRtWggpIaXMoEXG753m6turGcZyrczn+HsDkaj/+Us3n3tV2qET69iBw95VKLzDMZLO8uYT4fJ8vL17XvNpXRvzKcuKHvQB07RPh/kY3+9gUQDabty+JwnAiXl1OvGk6dw+G+Dh0gaWFAUT4qZx90eK1Y6O0eO36iia+2CiwUCm8AqDfKFCRFICtvu8+iypIJpMym1X/hC3/wJla4VAJqL1l+nxbELjvVfMdou/CNM3JSkEnnlmlt1gbsGekdB6p5sW5XG5RsWGP2eholPiCLpCYp8sBNcOLq4tPoeYPoDMIug4VBkrpPAhwGWufb/ZVi0d/A8RMR4lCQ341HKkiLjFjSZHwj3XjAGCYpjMPUEuFoHuYeXaJfHrFpz+o8ZsxoKlblvMCMw9wGkbksBBYWDjPLoVlWXOZ6bvwE37zwjfR4ghe6LrFo1hf11tehpG7aASZqYhFVluI6Jt8BkSp3nVEFhExTetxItIOy1rR4pcHQVpPn+siURiQyXT9AkD/8khphxIR0UHP8/SqrVasOtKmiPgh33fL+SW1rTgX23kAEdXiU8wCtMswaK7neQdKLaeltI9Laf9rWfYXyWRSe37iVwDZbEIvnTMRovYA+IwZGxMJMd330+3pdPpYsYjNza1ThYDewbpC3zPj1myWd1TdBRrB2bOpE6ZpryfCVm12Ch6fJEJHLoeOpqbEp6lUKoiSpxDnb2bGhIGhvLDqAmgJGcFwImaeZ1kW12oENUHgvjZx4uRPEonsOmZqEgIuoPZ7nvdDn8MyE6WN9CIEj2cO2fRxsRwGhwLLstqY6e3CcN93KZINaGlJzqxRvGbOBU/SyEP0XRDxdXXmVXY/P66IS5dZ7eeLZHCKQ/sxkgsgCIKUELgPgN41rWZRoJfDT/p++g2MQBL9b1zX1cdgZjXSKTrcCIxyBEY5AqMcgVFOIsLWWCgRs3hMSmfFUJ4PGI4CSCgFPQrMqTwKsvYf6l++nJTiNbZtD9r5gEYi4nY+oNEIjHJEXM4HxMEGZPWSNi6HpIZrKuwCeLryVFhtGZsK/08QER2TA2AWlyFmMIuiZ4sGowBO1b8P2Aj4jiKBJwbBK0wHAS48Lb5KSvsIc25bEASdGEZM05xEZKwHUGR3mkIbraEYqEBLi71MCOjTGCMOZjxQ6YwQRciHpLR1Sd6EEQUd8v30/EreLREhJ9Z7cXrvHiOHTiL1cBTXnoiSm+d5fyhFtwM4ivhzRClxm+d5kc4rGFFz7ek5d1pK89VcTnUT4QY9R0K80DPTzRMmjF+dTqeON+Kvszf2/nW2cG+voTCLjFLiz0ym89cqvdljjAHgP+/fCcPhm1K7AAAAAElFTkSuQmCC" ` +
  `width="13" height="13" alt="" border="0" ` +
  `style="border:0;vertical-align:middle">`;

/* O link do autor aceita o que a pessoa digitar: um e-mail vira
   mailto:, um endereço sem protocolo ganha https://. Só http, https e
   mailto saem daqui, para nada estranho entrar no arquivo. */
function linkDoAutor(v = prefs.autorLink){
  v = String(v || '').trim();
  if (!v || /\s/.test(v)) return '';
  if (/^mailto:/i.test(v)) return v;
  if (/^[^@/:]+@[^@/:]+\.[^@/:]+$/.test(v)) return 'mailto:' + v;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return '';
  return 'https://' + v.replace(/^\/+/, '');
}
const nomeDoAutor = () => String(prefs.autor || '').trim();

function dataPorExtenso(){
  return new Date().toLocaleDateString('pt-BR',
    { day: 'numeric', month: 'long', year: 'numeric' });
}

/* `paraWord` troca o SVG pelo PNG e a coluna flex por uma tabela: o Word
   não entende nem um nem outro. */
function assinaturaHTML(paraWord){
  const t = escapar(tituloLegivel());
  const data = escapar(dataPorExtenso());
  const autor = escapar(nomeDoAutor());
  const link = escapar(linkDoAutor());
  const feito = paraWord
    ? `Feito com ${MARCA_PNG} Escritor`
    : `Feito com${MARCA_SVG}Escritor`;   // o gap do flex faz os espaços

  /* No Word não há flex, ::after nem folha de estilo confiável: o filete
     vira uma tabelinha centrada e cada linha carrega o próprio estilo. */
  if (paraWord) return (
    `<table align="center" width="64" cellspacing="0" cellpadding="0" ` +
      `style="margin:34pt auto 15pt;border-collapse:collapse"><tr>` +
      `<td style="border:0;border-top:1pt solid #cfcfcf;padding:0;` +
      `font-size:1pt;line-height:1pt">&nbsp;</td></tr></table>` +
    (t ? `<p align="center" style="margin:0;font:italic 11.5pt Georgia,serif;color:#333">` +
         `${t}</p>` : '') +
    (autor ? `<p align="center" style="margin:5pt 0 0;font-family:Calibri,Arial,sans-serif;` +
      `font-size:10pt;color:#333">` +
      (link ? `<a href="${link}" style="color:#333;text-decoration:none">${autor}</a>` : autor) + `</p>` : '') +
    `<p align="center" style="margin:6pt 0 0;font-family:Calibri,Arial,sans-serif;` +
      `font-size:7.5pt;letter-spacing:1.4pt;color:#9a9a9a">${data.toUpperCase()}</p>` +
    `<p align="center" style="margin:13pt 0 0;font-family:Calibri,Arial,sans-serif;` +
      `font-size:8.5pt;color:#777">` +
      `<a href="${ESCRITOR_URL}" style="color:#777;text-decoration:none">${feito}</a></p>`
  );

  return `<footer class="assinatura">` +
    `<span class="assinatura-fio" aria-hidden="true"></span>` +
    (t ? `<span class="assinatura-obra">${t}</span>` : '') +
    (autor ? `<span class="assinatura-autor">${link ? `<a href="${link}">${autor}</a>` : autor}</span>` : '') +
    `<span class="assinatura-data">${data}</span>` +
    `<span class="assinatura-marca"><a href="${ESCRITOR_URL}">${feito}</a></span>` +
    `</footer>`;
}

function baixar(nome, conteudo, tipo){
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  avisar(`${nome} salvo`);
}

const CSS_EXPORT = `
:root{color-scheme:light}
body{max-width:38rem;margin:5rem auto;padding:0 1.4rem;
  font:18px/1.7 Georgia,"Iowan Old Style","Times New Roman",serif;color:#16181d;background:#fff}
h1,h2,h3,h4{font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;
  line-height:1.28;margin:2.1em 0 .7em}
h2{font-size:1.45em}h3{font-size:1.18em}
h1{font-family:Georgia,"Iowan Old Style","Times New Roman",serif;font-weight:400;
  font-size:2.05em;letter-spacing:-.005em;margin:0 0 1.5em}
h1::after{content:"";display:block;width:3.2rem;height:1px;background:#dcdfe4;margin-top:.72em}
p{margin:0 0 1.25em}
a{color:#0b5fff}code{font:.9em/1.5 ui-monospace,Menlo,Consolas,monospace;
  background:#f2f3f5;padding:.1em .35em;border-radius:4px}
pre{background:#f6f7f9;padding:1em 1.15em;border-radius:9px;overflow-x:auto}
pre code{background:none;padding:0}
blockquote{margin:0 0 1.25em;padding-left:1.15em;border-left:2px solid #d3d6dc;color:#4a4f57}
ul,ol{padding-left:1.4em}li{margin:.3em 0}
hr{border:0;border-top:1px solid #e9ebef;margin:2.4em 0}
mark{background:#fff1a8;color:inherit;padding:0 .12em;border-radius:3px}
mark.m-vermelho{background:#ffd0cc}mark.m-laranja{background:#ffe0bf}mark.m-verde{background:#d3f2d6}
mark.m-azul{background:#d4e6ff}mark.m-roxo{background:#e9dcff}
.math{font-family:"Cambria Math","STIX Two Math",Georgia,serif;font-style:italic}
.math-bloco{display:block;text-align:center;margin:1.2em 0;font-size:1.1em}
.callout{margin:0 0 1.25em;padding:.8em 1em;border-radius:10px;background:#f1f5ff;border-left:3px solid #4d7cfe}
.callout-titulo{margin:0 0 .3em;font-weight:600}
.callout-warning,.callout-caution{background:#fff6e5;border-color:#f0a020}
.callout-danger,.callout-bug{background:#ffefee;border-color:#e5484d}
.callout-tip,.callout-success{background:#ecfaef;border-color:#2fa24a}
sup.nr a{text-decoration:none;font-size:.75em}
.notas-rodape{margin-top:3em;font-size:.88em;color:#4a4f57}
.notas-rodape hr{width:4rem;margin:0 0 1em}
img{max-width:100%;border-radius:8px}
table{width:100%;border-collapse:collapse;font-size:.94em}
th,td{border:1px solid #e9ebef;padding:.45em .7em;text-align:left}
.assinatura{margin:5.5rem 0 1.5rem;
  display:flex;flex-direction:column;align-items:center;gap:.5em;text-align:center;
  font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;
  font-size:.8em;line-height:1.6;color:#8a9099}
.assinatura-fio{width:3.2rem;height:1px;background:#dcdfe4;margin-bottom:1.5rem}
.assinatura-obra{font:italic 1.16em/1.45 Georgia,"Iowan Old Style","Times New Roman",serif;
  color:#2f333b;max-width:24rem}
.assinatura-autor{font-size:1.06em;letter-spacing:.01em;color:#2f333b}
.assinatura-autor a{color:inherit;text-decoration:none;border-bottom:1px solid #d6d9de}
.assinatura-autor a:hover{border-color:#2f333b}
.assinatura-data{font-size:.82em;letter-spacing:.16em;text-transform:uppercase;color:#a3a9b1}
.assinatura-marca{margin-top:.95em;letter-spacing:.03em}
.assinatura-marca a{color:#6f7681;text-decoration:none;
  display:inline-flex;align-items:center;gap:.45em}
.assinatura-marca a:hover{color:#2f333b}
.assinatura .escritor-ic{flex:none;vertical-align:middle}
`;

async function exportar(tipo){
  const md = editor.value;
  const nome = tituloDoTexto();

  if (tipo === 'md')  return baixar(`${nome}.md`,  md, 'text/markdown;charset=utf-8');
  if (tipo === 'txt') return baixar(`${nome}.txt`,
    md.replace(/%%[^%\n]*%%/g,'').replace(/==[🟥🟧🟨🟩🟦🟪]?([^=\n]+)==/gu,'$1').replace(/^#{1,6}\s+/gm,'').replace(/(\*\*|__|~~|[*_`])/g,'')
      .replace(/^\s*>\s?/gm,'').replace(/\[([^\]]*)\]\([^)]*\)/g,'$1'),
    'text/plain;charset=utf-8');

  // imagens coladas moram no navegador: na exportação elas vão dentro do arquivo
  const embutir = async (h) => typeof embutirAnexos === 'function' ? embutirAnexos(h) : h;

  if (tipo === 'html'){
    return baixar(`${nome}.html`, await embutir(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${escapar(nome)}</title>` +
      (nomeDoAutor() ? `<meta name="author" content="${escapar(nomeDoAutor())}">` : '') +
      `<style>${CSS_EXPORT}</style></head>` +
      `<body>\n${paraHTML(md)}\n${assinaturaHTML()}\n</body></html>`),
      'text/html;charset=utf-8');
  }

  if (tipo === 'doc'){
    const doc =
      `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
      `xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8">` +
      `<title>${escapar(nome)}</title><style>@page{size:A4;margin:2.4cm 2.2cm}` +
      `body{font:12pt/1.65 Georgia,serif}` +
      `h2,h3{font-family:Calibri,Arial,sans-serif;color:#1a1a1a}` +
      `h1{font-family:Georgia,serif;font-weight:normal;font-size:21pt;color:#1a1a1a;` +
      `margin:0 0 18pt}` +
      `blockquote{margin-left:0;padding-left:12pt;border-left:2pt solid #999;color:#444}` +
      `code,pre{font-family:Consolas,monospace;font-size:10.5pt}` +
      `pre{background:#f4f4f4;padding:8pt}` +
      `table{border-collapse:collapse}th,td{border:.5pt solid #999;padding:4pt}` +
      `</style></head><body>${paraHTML(md)}${assinaturaHTML(true)}</body></html>`;
    return baixar(`${nome}.doc`, '﻿' + await embutir(doc), 'application/msword;charset=utf-8');
  }

  if (tipo === 'pdf'){
    prepararImpressao();
    if (typeof mostrarAnexos === 'function') await mostrarAnexos($('#printView'));
    // O endereço do arquivo no alto da página é do navegador, não daqui:
    // só a caixa "cabeçalhos e rodapés" do diálogo o remove — uma vez, e fica.
    avisar('Na janela de impressão, desmarque “cabeçalhos e rodapés”', 6000);
    window.print();
    return;
  }

  if (tipo === 'copy' || tipo === 'copyhtml'){
    const conteudo = tipo === 'copy' ? md : await embutir(paraHTML(md));
    try {
      await navigator.clipboard.writeText(conteudo);
      avisar(tipo === 'copy' ? 'Markdown copiado' : 'HTML copiado');
    } catch {
      avisar('Não foi possível copiar');
    }
  }
}

/* Também vale para o Ctrl+P do navegador: a folha de impressão
   nunca sai em branco. */
let tituloAntes = '';
function prepararImpressao(){
  $('#printView').innerHTML = paraHTML(editor.value) + assinaturaHTML();
  tituloAntes = document.title;
  // Evita que o cabeçalho automático do navegador repita o nome da obra.
  document.title = '';
}
window.addEventListener('beforeprint', prepararImpressao);
window.addEventListener('afterprint', () => {
  if (tituloAntes) document.title = tituloAntes;
});

/* ═══════════════════════════════════════════════════════════
   9. Aviso passageiro
   ═══════════════════════════════════════════════════════════ */

let relogioAviso;
function avisar(msg, ms = 1900){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('vivo');
  clearTimeout(relogioAviso);
  relogioAviso = setTimeout(() => t.classList.remove('vivo'), ms);
}

/* ═══════════════════════════════════════════════════════════
   9b. Folha: o pop-up modal
   ─────────────────────────────────────────────────────────
   O confirm() do navegador aparecia como caixa do sistema, com
   o endereço do site no cabeçalho e botões que não são os
   nossos — dentro de uma superfície de escrita isso quebra a
   ilusão inteira. No lugar dele entra a folha: o mesmo desenho
   do pop-up de busca dos outros apps da casa (Ctrl+K), com o
   fundo desfocado, o painel centrado e o chip "esc".

   Uma folha por vez. abrirFolha devolve uma promessa que se
   resolve com o data-valor do botão apertado, ou com null se
   a pessoa fechou pelo Esc, pelo X do fundo ou pelo Cancelar.
   ═══════════════════════════════════════════════════════════ */

const VERSAO = '2.3.0';
const REPO   = 'https://github.com/cesteduardo/escritor';

let folha = null, resolverFolha = null, focoAntesDaFolha = null;

function fecharFolha(valor = null){
  if (!folha || folha.hidden) return;
  folha.hidden = true;
  folha.textContent = '';
  document.documentElement.classList.remove('folha-aberta');
  /* devolve o foco a quem abriu: sem isto o Tab recomeçava do topo da
     página, e o cursor não voltava para o texto */
  if (focoAntesDaFolha && focoAntesDaFolha.focus) focoAntesDaFolha.focus();
  focoAntesDaFolha = null;
  const responder = resolverFolha;
  resolverFolha = null;
  if (responder) responder(valor);
}

function abrirFolha(html){
  if (!folha){
    folha = document.createElement('div');
    folha.className = 'folha';
    folha.hidden = true;
    document.body.appendChild(folha);
    /* só o fundo fecha; um clique dentro do painel não */
    folha.addEventListener('click', (e) => { if (e.target === folha) fecharFolha(null); });
  }
  fecharFolha(null);
  focoAntesDaFolha = document.activeElement;
  folha.innerHTML = html;
  folha.hidden = false;
  document.documentElement.classList.add('folha-aberta');

  const promessa = new Promise((resolve) => { resolverFolha = resolve; });
  folha.querySelectorAll('[data-valor]').forEach((b) => {
    b.onclick = () => fecharFolha(b.dataset.valor);
  });
  /* o foco vai para a ação principal, e não para o Cancelar: quem chegou
     aqui pelo teclado termina a frase com um Enter */
  const alvo = folha.querySelector('.principal') || folha.querySelector('button');
  if (alvo) alvo.focus();
  return promessa;
}

function focaveisDaFolha(){
  return [...folha.querySelectorAll('a[href],button,[tabindex]:not([tabindex="-1"])')];
}

const escapaHTML = (t) => String(t).replace(/[&<>"]/g,
  (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/* Uma pergunta de sim ou não. Devolve true só se a ação foi confirmada. */
async function perguntar({ titulo, texto, acao, cancelar = 'Cancelar' }){
  const escolha = await abrirFolha(
    '<div class="folha-painel" role="dialog" aria-modal="true" aria-label="' + escapaHTML(titulo) + '">' +
      '<div class="folha-topo">' +
        '<h2 class="folha-titulo">' + escapaHTML(titulo) + '</h2>' +
        '<kbd>esc</kbd>' +
      '</div>' +
      '<div class="folha-corpo"><p>' + escapaHTML(texto) + '</p></div>' +
      '<div class="folha-pe">' +
        '<button type="button" data-valor="">' + escapaHTML(cancelar) + '</button>' +
        '<button type="button" class="principal" data-valor="sim">' + escapaHTML(acao) + '</button>' +
      '</div>' +
    '</div>');
  return escolha === 'sim';
}

const OCTOCAT = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>';

/* O painel Sobre. Não é um menu: é uma folha, porque o texto aqui é para
   ser lido, não para ser escolhido. */
function abrirSobre(){
  return abrirFolha(
    '<div class="folha-painel folha-larga" role="dialog" aria-modal="true" aria-label="Sobre o Escritor">' +
      '<div class="folha-topo">' +
        '<h2 class="folha-titulo">Escritor</h2>' +
        '<span class="folha-versao">v' + VERSAO + '</span>' +
        '<kbd>esc</kbd>' +
      '</div>' +
      '<div class="folha-corpo">' +
        '<p>Um caderno de escrita e estudo em Markdown, no espírito do iA Writer: ' +
          'realce de sintaxe sem tirar o cursor do lugar, modo foco, revisão de ' +
          'ortografia e estilo, várias notas, grifo e notas de rodapé no botão direito, ' +
          'imagens coladas e gravação direta numa pasta do Obsidian.</p>' +
        '<p>É um projeto de <b>código aberto e sem fins lucrativos</b>. Não há conta, ' +
          'anúncio, cobrança nem rastreamento: o que você escreve fica no seu ' +
          'navegador e só sai dele quando você exporta ou salva na pasta.</p>' +
        '<a class="folha-link" href="' + REPO + '" target="_blank" rel="noopener noreferrer">' +
          OCTOCAT + '<b>cesteduardo/escritor</b><small>abrir ↗</small></a>' +
        '<p class="fraco" style="margin-top:.9rem">' +
          'As fontes do texto são as iA Writer (Duo, Mono e Quattro), sob licença Apache 2.0; ' +
          'a da interface é a Inter (OFL) e os ícones são do Lucide (ISC). ' +
          'Feito por GR Brands.</p>' +
      '</div>' +
      '<div class="folha-pe">' +
        '<button type="button" class="principal" data-valor="">Fechar</button>' +
      '</div>' +
    '</div>');
}

/* ═══════════════════════════════════════════════════════════
   10. Preferências e controles
   ═══════════════════════════════════════════════════════════ */

function salvarPrefs(){
  try { localStorage.setItem(CHAVE_PREFS, JSON.stringify(prefs)); } catch {}
}

const ROTULO_ESCOPO = {
  nenhum:'Foco', frase:'Frase', paragrafo:'Parágrafo', linha:'Linha'
};
const ROTULO_CLASSE = {
  nenhuma:'Realce', todas:'Classes', 'g-subst':'Substantivos',
  'g-verbo':'Verbos', 'g-adj':'Adjetivos', 'g-adv':'Advérbios', 'g-conj':'Conectivos'
};
const COR_TEMA = { claro:'#ffffff', papel:'#fbf8f1', sepia:'#f6f0e4', nevoa:'#eef1f4', escuro:'#191a1c', noite:'#0f1520', grafite:'#2a2b2f', contraste:'#000000' };
const CORPO_MIN = 14, CORPO_MAX = 28;

/* Ícones da barra: traço de 1,5 num quadro de 20, cantos redondos,
   no espírito dos SF Symbols. O rótulo vem ao lado e some no celular,
   onde o ícone sozinho já diz o que é. */
const ICONE = { foco: ICO.foco, realce: ICO.realce, ver: ICO.ver, escrever: ICO.escrever };
const rotuloBarra = (icone, texto) => ICONE[icone] + '<span class="rot">' + texto + '</span>';

function aplicarPrefs(){
  corpo.dataset.theme   = prefs.tema;
  corpo.dataset.fonte   = prefs.fonte;
  corpo.dataset.sintaxe = prefs.classe !== 'nenhuma' ? '1' : '0';
  corpo.dataset.orto    = prefs.ortografia ? '1' : '0';
  corpo.dataset.maquina = prefs.maquina ? '1' : '0';
  corpo.dataset.foco    = prefs.escopo !== 'nenhum' ? '1' : '0';
  corpo.dataset.poeta   = prefs.poeta ? '1' : '0';
  document.documentElement.style.setProperty('--tam', prefs.corpo + 'px');
  document.querySelector('meta[name=theme-color]').content = COR_TEMA[prefs.tema];

  const comFoco = prefs.escopo !== 'nenhum';
  $('#btnFoco').innerHTML = rotuloBarra('foco', ROTULO_ESCOPO[prefs.escopo]);
  $('#btnFoco').classList.toggle('ativo', comFoco || prefs.maquina);

  const comRealce = prefs.classe !== 'nenhuma';
  $('#btnRealce').innerHTML = rotuloBarra('realce', ROTULO_CLASSE[prefs.classe]);
  $('#btnRealce').classList.toggle('ativo', comRealce);

  $('#togVer').setAttribute('aria-pressed', prefs.visualizando);
  // lendo, o olho vira caneta: o botão mostra para onde ele leva
  $('#togVer').innerHTML = prefs.visualizando ? rotuloBarra('escrever', 'Escrever') : rotuloBarra('ver', 'Visualizar');
  $('#togVer').title = paraSO(prefs.visualizando ? 'Voltar a escrever (Ctrl+E)' : 'Visualizar (Ctrl+E)');
  $('#corpoAgora').textContent = prefs.corpo + 'px';
  $('#togPoeta').setAttribute('aria-pressed', String(prefs.poeta));
  regua.hidden = !prefs.poeta;

  // marcas de estado dentro dos menus
  $$('[data-escopo]').forEach(b => b.setAttribute('aria-checked', b.dataset.escopo === prefs.escopo));
  $$('[data-classe]').forEach(b => b.setAttribute('aria-checked', b.dataset.classe === prefs.classe));
  $$('button[data-tema]').forEach(b => b.setAttribute('aria-checked', b.dataset.tema === prefs.tema));
  $$('button[data-fonte]').forEach(b => b.setAttribute('aria-checked', b.dataset.fonte === prefs.fonte));
  $$('[data-alterna]').forEach(b => b.setAttribute('aria-checked', !!prefs[b.dataset.alterna]));

  // O corretor nativo do navegador é a fonte do sublinhado vermelho.
  editor.setAttribute('spellcheck', prefs.ortografia ? 'true' : 'false');

  if (typeof aplicarExtras === 'function') aplicarExtras();
  salvarPrefs();
}

function alternar(chave){
  prefs[chave] = !prefs[chave];
  aplicarPrefs();
  if (chave === 'maquina' && prefs.maquina) precisaCentrar = true;
  desenhar();
  if (chave === 'maquina' && prefs.maquina) centralizarCursor();
  if (!prefs.visualizando) editor.focus();
}

function definirVisualizacao(ativo){
  prefs.visualizando = ativo;
  $('#sheet').hidden = ativo;
  preview.hidden = !ativo;
  if (ativo){
    preview.classList.toggle('poeta', prefs.poeta);
    preview.innerHTML = prefs.poeta ? paraHTMLPoeta(editor.value) : paraHTML(editor.value);
    if (typeof mostrarAnexos === 'function') mostrarAnexos(preview);
    preview.querySelectorAll('a[href^="http"]').forEach(a => {
      a.target = '_blank'; a.rel = 'noopener noreferrer';
    });
    scroller.scrollTop = 0;
    fecharRevisao();
  }
  aplicarPrefs();
  if (!ativo){ desenhar(); editor.focus(); }
}

function definirCorpo(px){
  prefs.corpo = Math.min(CORPO_MAX, Math.max(CORPO_MIN, px));
  aplicarPrefs();
  if (prefs.poeta) desenhar();
  if (prefs.maquina) centralizarCursor();
}

/* ── régua de recuo ────────────────────────────────────────
   A textarea não possui formatação invisível por parágrafo. Para o
   recuo sobreviver ao arquivo e às exportações, a régua grava espaços
   reais no começo das linhas — o mesmo princípio do Tab do editor. */
function larguraEspaco(){
  const estilo = getComputedStyle(editor);
  const canvas = larguraEspaco.canvas || (larguraEspaco.canvas = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  ctx.font = `${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`;
  // o espaço entre letras soma em cada caractere, inclusive no espaço
  const extra = parseFloat(estilo.letterSpacing) || 0;
  return Math.max(4, ctx.measureText(' ').width + extra);
}

function colunasNoCursor(){
  const v = editor.value;
  const ini = v.lastIndexOf('\n', editor.selectionStart - 1) + 1;
  const branco = (v.slice(ini).match(/^[ \t]*/) || [''])[0];
  return [...branco].reduce((n, c) => n + (c === '\t' ? 4 : 1), 0);
}

function quantidadeLinhasSelecionadas(){
  const {selectionStart:a, selectionEnd:b, value:v} = editor;
  if (a === b) return 1;
  const trecho = v.slice(a, b);
  return Math.max(1, trecho.split('\n').length - (trecho.endsWith('\n') ? 1 : 0));
}

function atualizarRegua(){
  if (!prefs.poeta || regua.hidden) return;
  const passo = larguraEspaco();
  const max = Math.max(0, Math.min(40, Math.floor(reguaTrilho.clientWidth / passo) - 8));
  const coluna = Math.min(max, colunasNoCursor());
  reguaTrilho.style.setProperty('--passo-regua', passo + 'px');
  reguaCursor.style.left = (coluna * passo) + 'px';
  reguaCursor.setAttribute('aria-valuemax', String(max));
  reguaCursor.setAttribute('aria-valuenow', String(coluna));
  reguaNumero.max = String(max);
  reguaNumero.value = String(coluna);
  const linhas = quantidadeLinhasSelecionadas();
  reguaAlvo.textContent = linhas === 1 ? 'Linha atual' : `${linhas} versos`;

  const marcas = $('#reguaMarcas');
  marcas.innerHTML = '';
  for (let n = 0; n <= max; n += 4){
    const numero = document.createElement('span');
    numero.className = 'regua-numero';
    numero.textContent = n;
    numero.style.left = (n * passo) + 'px';
    marcas.appendChild(numero);
  }
}

function aplicarRecuo(coluna, devolverFoco = true){
  const v = editor.value;
  const a = editor.selectionStart;
  const b = editor.selectionEnd;
  const ini = v.lastIndexOf('\n', a - 1) + 1;
  const fimSelecao = b > a && v[b - 1] === '\n' ? b - 1 : b;
  const quebra = v.indexOf('\n', fimSelecao);
  const fim = quebra < 0 ? v.length : quebra;
  const bloco = v.slice(ini, fim);
  const novo = bloco.replace(/^[ \t]*/gm, ' '.repeat(coluna));
  editor.setRangeText(novo, ini, fim, 'select');
  if (a === b){
    const delta = novo.length - bloco.length;
    const cursor = Math.max(ini + coluna, a + delta);
    editor.setSelectionRange(cursor, cursor);
  }
  aoDigitar();
  if (devolverFoco) editor.focus();
  atualizarRegua();
}

function colunaDoPonteiro(event){
  const caixa = reguaTrilho.getBoundingClientRect();
  const passo = larguraEspaco();
  const max = Number(reguaCursor.getAttribute('aria-valuemax')) || 40;
  return Math.max(0, Math.min(max, Math.round((event.clientX - caixa.left) / passo)));
}

function iniciarArrasteRegua(event){
  if (event.button !== 0) return;
  event.preventDefault();
  const mover = e => {
    const coluna = colunaDoPonteiro(e);
    reguaCursor.style.left = (coluna * larguraEspaco()) + 'px';
    reguaNumero.value = String(coluna);
    reguaCursor.setAttribute('aria-valuenow', String(coluna));
  };
  const soltar = e => {
    window.removeEventListener('pointermove', mover);
    window.removeEventListener('pointerup', soltar);
    regua.classList.remove('arrastando');
    aplicarRecuo(colunaDoPonteiro(e));
  };
  regua.classList.add('arrastando');
  mover(event);
  window.addEventListener('pointermove', mover);
  window.addEventListener('pointerup', soltar);
}

reguaTrilho.addEventListener('pointerdown', iniciarArrasteRegua);
reguaNumero.addEventListener('input', () => {
  // Ao substituir um valor, o campo passa brevemente por vazio. Não
  // reponha zero nesse instante: o usuário ainda está digitando.
  if (reguaNumero.value === '') return;
  aplicarRecuo(
    Math.max(0, Math.min(Number(reguaNumero.max) || 40, Number(reguaNumero.value))),
    false
  );
});
reguaNumero.addEventListener('change', () => aplicarRecuo(
  Math.max(0, Math.min(Number(reguaNumero.max) || 40, Number(reguaNumero.value) || 0))
));
$('#reguaMenos').onclick = () => aplicarRecuo(Math.max(0, colunasNoCursor() - 4));
$('#reguaMais').onclick = () => aplicarRecuo(Math.min(
  Number(reguaCursor.getAttribute('aria-valuemax')) || 40, colunasNoCursor() + 4
));
$('#reguaZerar').onclick = () => aplicarRecuo(0);
reguaCursor.addEventListener('keydown', e => {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
  e.preventDefault();
  const atual = Number(reguaCursor.getAttribute('aria-valuenow')) || 0;
  const max = Number(reguaCursor.getAttribute('aria-valuemax')) || 40;
  const proximo = e.key === 'Home' ? 0
    : e.key === 'End' ? max
    : Math.max(0, Math.min(max, atual + (e.key === 'ArrowRight' ? 1 : -1)));
  aplicarRecuo(proximo);
});
window.addEventListener('resize', () => {
  atualizarRegua();
  desenharNumerosLinha(editor.value, editor.selectionStart);
});

/* ── ligações ─────────────────────────────────────────────── */

$('#togVer').onclick = () => definirVisualizacao(!prefs.visualizando);
$('#togPoeta').onclick = () => {
  prefs.poeta = !prefs.poeta;
  aplicarPrefs();
  desenhar();
  if (prefs.visualizando) definirVisualizacao(true);
  atualizarRegua();
  avisar(prefs.poeta ? 'Modo Poeta ativado' : 'Modo Poeta desativado');
  if (!prefs.visualizando) editor.focus();
};

/* ── Tela cheia ───────────────────────────────────────────────
   Some a moldura do navegador e sobra a folha. Funciona em três
   caminhos, do melhor para o possível:
   1. a API de tela cheia (computador, Android), com o prefixo webkit
      para o Safari do iPad;
   2. dentro do Caderno, quem vai para a tela cheia é a página de fora
      (o iframe sozinho não pode), e o estado é lido de lá;
   3. onde não existe API nenhuma (o Safari do iPhone), o modo imersivo:
      a barra e o rodapé saem e fica só um botão discreto para voltar. */
const docDaTela = (() => {
  try { if (PONTE && window.parent !== window && window.parent.document) return window.parent.document; } catch (e) {}
  return document;
})();
const elTelaCheia = () => docDaTela.fullscreenElement || docDaTela.webkitFullscreenElement || null;
const pedirTela = (el) => (el.requestFullscreen || el.webkitRequestFullscreen || null);
function telaAtiva(){ return !!elTelaCheia() || corpo.dataset.imersivo === '1'; }

function marcarTela(){
  const cheia = telaAtiva();
  corpo.dataset.tela = cheia ? '1' : '0';
  const titulo = cheia ? 'Sair da tela cheia' : 'Tela cheia';
  for (const b of $$('#btnTela, #btnTelaBarra')){
    b.setAttribute('aria-pressed', String(cheia));
    b.title = titulo + (b.id === 'btnTelaBarra' ? paraSO(' (Ctrl+Shift+F)') : '');
    b.setAttribute('aria-label', titulo);
  }
}
function definirImersivo(on){
  corpo.dataset.imersivo = on ? '1' : '0';
  marcarTela();
  if (on) avisar('Para sair, toque no botão do canto', 2600);
}
function alternarTela(){
  if (elTelaCheia()){
    (docDaTela.exitFullscreen || docDaTela.webkitExitFullscreen).call(docDaTela);
    return;
  }
  if (corpo.dataset.imersivo === '1'){ definirImersivo(false); return; }
  const el = docDaTela.documentElement;
  const pedir = pedirTela(el);
  if (!pedir){ definirImersivo(true); return; }
  try {
    const r = pedir.call(el, { navigationUI: 'hide' });
    if (r && r.catch) r.catch(() => definirImersivo(true));
  } catch (e) { definirImersivo(true); }
}
$('#btnTela').onclick = alternarTela;
$('#btnTelaBarra').onclick = alternarTela;
$('#telaSair').onclick = alternarTela;
// F11, Esc e o gesto do sistema mudam o estado sem passar pelo botão
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) docDaTela.addEventListener(ev, marcarTela);
marcarTela();

$('#stCont').onclick = () => {
  prefs.contagem = (prefs.contagem + 1) % CONTAGENS.length;
  salvarPrefs();
  atualizarNumeros(editor.value);
};

/* ── menus: pop-ups no meio da tela ───────────────────────────
   Cada menu da barra é um <dialog> aberto com showModal: vai para a
   camada de cima (o desfoque da barra não o prende), o resto da página
   fica inerte e o Esc fecha. A classe .aberto continua sendo o estado:
   quem quiser fechar os menus (a ponte, o painel Aa) só tira a classe,
   e o observador abaixo fecha o diálogo junto. */
const reduzMov = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function itensDoMenu(pop){ return [...pop.querySelectorAll('.mp-corpo button, .mp-abas button')].filter(b => !b.hidden && b.offsetParent !== null); }

/* Setas em qualquer direção: vai para o item mais perto daquele lado,
   olhando a posição real na tela. Serve para os cartões lado a lado do
   Foco, as duas colunas do Realce e a grade do Documento. */
function vizinhoNaDirecao(itens, atual, tecla){
  const a = atual.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let melhor = null, menor = Infinity;
  for (const b of itens){
    if (b === atual) continue;
    const r = b.getBoundingClientRect();
    const dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
    const ok = tecla === 'ArrowRight' ? dx > 4 : tecla === 'ArrowLeft' ? dx < -4 : tecla === 'ArrowDown' ? dy > 4 : dy < -4;
    if (!ok) continue;
    const horizontal = tecla === 'ArrowRight' || tecla === 'ArrowLeft';
    const d = horizontal ? Math.abs(dx) + Math.abs(dy) * 3 : Math.abs(dy) + Math.abs(dx) * 3;
    if (d < menor){ menor = d; melhor = b; }
  }
  return melhor;
}

/* Documento: as seções são abas; a pílula delas desliza (personalizar.js) */
let abaDoc = 'arquivo';
function mostrarAbaDoc(aba){
  abaDoc = aba;
  $$('#menuMais .mp-abas [data-aba]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.aba === aba)));
  $$('#menuMais .mp-pagina').forEach(pg => { pg.hidden = pg.dataset.aba !== aba; });
  if (typeof medirPilulas === 'function') medirPilulas();
}
$$('#menuMais .mp-abas [data-aba]').forEach(b => b.addEventListener('click', () => mostrarAbaDoc(b.dataset.aba)));
function fecharMenuPop(pop, animar){
  if (!pop.open) return;
  if (!animar || reduzMov()){ pop.classList.remove('saindo'); pop.close(); return; }
  if (pop.classList.contains('saindo')) return;
  pop.classList.add('saindo');
  const fim = () => { if (pop.classList.contains('saindo')){ pop.classList.remove('saindo'); pop.close(); } };
  pop.addEventListener('animationend', fim, { once: true });
  setTimeout(fim, 200);
}
function abrirMenu(menu){
  $$('.menu').forEach(m => { if (m !== menu) m.classList.remove('aberto'); });
  const pop = menu.querySelector('.menu-pop');
  menu.classList.add('aberto');
  pop.classList.remove('saindo');
  if (pop.id === 'popDoc' || menu.id === 'menuMais') mostrarAbaDoc(abaDoc);
  if (!pop.open) pop.showModal();
  /* O foco cai no item marcado (ou no primeiro), para as setas andarem a
     partir dele; mas ele só ACENDE com o teclado (:focus-visible). Aberto
     com o mouse, nada fica aceso até o ponteiro passar por cima. */
  const itens = itensDoMenu(pop).filter(b => !b.closest('.mp-abas'));
  const alvo = itens.find(b => b.getAttribute('aria-checked') === 'true') || itens[0];
  if (alvo) alvo.focus({ preventScroll: true });
  pop.scrollTop = 0;
  if (typeof medirPilulas === 'function') medirPilulas(true);
}
$$('.menu').forEach((menu) => {
  const pop = menu.querySelector('.menu-pop');
  menu.querySelector('.menu-btn').onclick = (e) => {
    e.stopPropagation();
    if (menu.classList.contains('aberto')) menu.classList.remove('aberto');
    else abrirMenu(menu);
  };
  new MutationObserver(() => {
    if (!menu.classList.contains('aberto')) fecharMenuPop(pop, true);
  }).observe(menu, { attributes: true, attributeFilter: ['class'] });
  pop.addEventListener('close', () => {
    menu.classList.remove('aberto');
    // fechou sem escolher nada (Esc, clique fora): o cursor volta ao texto
    const a = document.activeElement;
    if (!prefs.visualizando && (!a || a === document.body || a.closest('.menu'))) editor.focus({ preventScroll: true });
  });
  pop.addEventListener('cancel', (e) => { e.preventDefault(); menu.classList.remove('aberto'); });
  // um clique no fundo escuro (o próprio <dialog>) fecha
  pop.addEventListener('mousedown', (e) => { pop._fora = e.target === pop; });
  pop.addEventListener('click', (e) => {
    if (e.target === pop){ e.stopPropagation(); if (pop._fora) menu.classList.remove('aberto'); return; }
    const b = e.target.closest('button');
    // ligar e desligar deixa o menu aberto; escolher fecha
    if (!b || b.closest('[data-alterna], [data-fica], .linha-corpo')){ e.stopPropagation(); return; }
  });
  /* Escolher fecha o diálogo ANTES da ação: com ele aberto o resto da
     página está inerte, e a ação (focar a busca, abrir o sumário, o
     seletor de arquivo) não alcançaria nada. */
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.closest('[data-alterna], [data-fica], .linha-corpo')) return;
    menu.classList.remove('aberto');
    pop.classList.remove('saindo');
    if (pop.open) pop.close();
  }, true);
  pop.addEventListener('keydown', (e) => {
    const itens = itensDoMenu(pop);
    if (e.key === 'Home' || e.key === 'End'){
      e.preventDefault();
      itens[e.key === 'Home' ? 0 : itens.length - 1]?.focus();
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)){
      e.preventDefault();
      const atual = itens.includes(document.activeElement) ? document.activeElement : null;
      if (!atual){ itens[0]?.focus(); return; }
      // nas abas do Documento, esquerda e direita trocam de aba
      if (atual.closest('.mp-abas') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')){
        const abas = [...pop.querySelectorAll('.mp-abas [data-aba]')];
        const n = (abas.indexOf(atual) + (e.key === 'ArrowRight' ? 1 : -1) + abas.length) % abas.length;
        abas[n].focus(); abas[n].click();
        return;
      }
      vizinhoNaDirecao(itens, atual, e.key)?.focus();
      return;
    }
    if (e.key === 'Escape') return;           // o próprio <dialog> cuida
    if (e.ctrlKey || e.metaKey){ menu.classList.remove('aberto'); fecharMenuPop(pop, false); return; }
    e.stopPropagation();                      // as outras teclas ficam no menu
  });
});
document.addEventListener('click', () => $$('.menu').forEach(m => m.classList.remove('aberto')));

$$('[data-alterna]').forEach(b => b.onclick = () => alternar(b.dataset.alterna));
$$('[data-classe]').forEach(b => b.onclick = () => {
  prefs.classe = b.dataset.classe;
  aplicarPrefs(); desenhar(); editor.focus();
});
$$('[data-escopo]').forEach(b => b.onclick = () => {
  prefs.escopo = b.dataset.escopo;
  aplicarPrefs(); desenhar(); editor.focus();
});
$$('button[data-tema]').forEach(b => b.onclick = () => {
  prefs.tema = b.dataset.tema; aplicarPrefs();
  if (!prefs.visualizando) editor.focus();
});
$$('button[data-fonte]').forEach(b => b.onclick = () => {
  prefs.fonte = b.dataset.fonte; aplicarPrefs();
  if (prefs.poeta) desenhar();
  if (prefs.maquina) centralizarCursor();
  if (!prefs.visualizando) editor.focus();
});
$$('[data-exp]').forEach(b => b.onclick = () => exportar(b.dataset.exp));
$('#corpoMenos').onclick = () => definirCorpo(prefs.corpo - 1);
$('#corpoMais').onclick  = () => definirCorpo(prefs.corpo + 1);

/* ── arquivos ─────────────────────────────────────────────── */

function trocarTexto(novo, aviso){
  editor.value = novo;
  definirVisualizacao(false);
  guardarTexto();
  editor.setSelectionRange(0, 0);
  desenhar();
  scroller.scrollTop = 0;
  editor.focus();
  if (aviso) avisar(aviso);
}

$('#btnNovo').onclick = async () => {
  if (editor.value.trim() && !(await perguntar({
    titulo: 'Começar um documento novo?',
    texto: 'O texto que está na tela será descartado, e isso não pode ser desfeito. Se quiser guardá-lo, exporte ou salve na pasta antes.',
    acao: 'Descartar e começar'
  }))) return;
  trocarTexto('');
};

$('#btnGuia').onclick = async () => {
  const atual = editor.value.trim();
  if (atual === GUIA.trim()){ scroller.scrollTop = 0; return avisar('O guia já está aberto'); }
  if (atual && !(await perguntar({
    titulo: 'Abrir o guia do Escritor?',
    texto: 'O guia ocupa a tela toda, e o texto que está aqui será descartado. Se quiser guardá-lo, exporte ou salve na pasta antes.',
    acao: 'Abrir o guia'
  }))) return;
  trocarTexto(GUIA, 'Guia do Escritor');
};

/* O Sobre sai de dentro do menu da engrenagem, então o menu fecha antes:
   dois pop-ups abertos ao mesmo tempo é um a mais. */
$('#btnSobre').onclick = () => {
  $$('.menu').forEach(m => m.classList.remove('aberto'));
  abrirSobre();
};
$$('[data-versao]').forEach((n) => { n.textContent = 'v' + VERSAO; });

$('#btnAbrir').onclick = () => $('#fileInput').click();
$('#fileInput').onchange = (e) => {
  const f = e.target.files[0];
  if (f) abrirArquivo(f);
  e.target.value = '';
};

function abrirArquivo(file){
  const leitor = new FileReader();
  leitor.onload = () => trocarTexto(String(leitor.result).replace(/\r\n?/g,'\n'), `${file.name} aberto`);
  leitor.onerror = () => avisar('Não foi possível ler o arquivo');
  leitor.readAsText(file, 'utf-8');
}

['dragenter','dragover'].forEach(ev => document.addEventListener(ev, (e) => {
  if (![...e.dataTransfer.types].includes('Files')) return;
  e.preventDefault(); corpo.classList.add('soltando');
}));
['dragleave','drop'].forEach(ev => document.addEventListener(ev, (e) => {
  if (ev === 'dragleave' && e.relatedTarget) return;
  corpo.classList.remove('soltando');
}));
document.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files[0];
  if (!f) return;
  e.preventDefault();
  abrirArquivo(f);
});

/* ── atalhos ──────────────────────────────────────────────── */

function envolver(abre, fecha = abre){
  const { selectionStart:a, selectionEnd:b, value:v } = editor;
  const sel = v.slice(a, b);
  editor.setRangeText(abre + sel + fecha, a, b, 'end');
  if (a === b) editor.setSelectionRange(a + abre.length, a + abre.length);
  else editor.setSelectionRange(a + abre.length, b + abre.length);
  aoDigitar();
}

document.addEventListener('keydown', (e) => {
  const cmd = e.metaKey || e.ctrlKey;

  /* Com a folha aberta ela é a única coisa que ouve o teclado: sem isto um
     Ctrl+E trocaria a visualização por baixo do pop-up, e o Tab sairia do
     painel para os botões da barra. */
  if (folha && !folha.hidden){
    if (e.key === 'Escape'){ e.preventDefault(); fecharFolha(null); return; }
    if (e.key === 'Tab'){
      const alvos = focaveisDaFolha();
      if (!alvos.length) return;
      const i = alvos.indexOf(document.activeElement);
      const proximo = e.shiftKey
        ? (i <= 0 ? alvos.length - 1 : i - 1)
        : (i === alvos.length - 1 ? 0 : i + 1);
      e.preventDefault();
      alvos[proximo].focus();
      return;
    }
    if (cmd) e.preventDefault();
    return;
  }

  if (cmd && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f'){ e.preventDefault(); alternarTela(); return; }
  if (e.key === 'Escape' && corpo.dataset.imersivo === '1' && !$$('.menu.aberto').length){ definirImersivo(false); return; }
  if (e.key === 'Escape'){
    if ($$('.menu.aberto').length){ $$('.menu').forEach(m => m.classList.remove('aberto')); return; }
    if ($('#revisao').open){ fecharRevisao(); renderRevisao(); return; }
    if (prefs.visualizando) definirVisualizacao(false);
    return;
  }
  if (!cmd) return;

  const k = e.key.toLowerCase();

  if (k === 'b'){ e.preventDefault(); return envolver('**'); }
  if (k === 'i'){ e.preventDefault(); return envolver('_'); }
  /* Ctrl+K: ligação interna [[nota]], como no Obsidian. A lista de notas
     abre sozinha (o [[ dispara as sugestões). O link externo fica no
     botão direito. */
  if (k === 'k' && !e.shiftKey){
    e.preventDefault();
    const { selectionStart:a, selectionEnd:b, value:v } = editor;
    const sel = v.slice(a, b);
    inserirComoEdicao(a, b, '[[' + sel);
    const fim = editor.selectionStart;
    inserirComoEdicao(fim, fim, ']]');
    editor.setSelectionRange(fim, fim);
    editor.dispatchEvent(new Event('input'));
    return;
  }
  if (k === '/'){ e.preventDefault(); return envolver('%%'); }
  /* Com uma pasta do Obsidian ligada, Ctrl+S salva NELA: e o que o gesto
     quer dizer quando existe um lugar para salvar. Sem pasta, continua
     baixando o .md como sempre. */
  if (k === 's'){
    e.preventDefault();
    if (obsPasta) return void obsEscrever(true);
    return exportar('md');
  }
  if (k === 'o' && !e.shiftKey){ e.preventDefault(); return PONTE ? PONTE.trocar() : (typeof abrirNotas === 'function' ? abrirNotas() : $('#fileInput').click()); }
  if (k === 'h' && e.shiftKey){ e.preventDefault(); return envolver('=='); }
  if (k === 'e'){ e.preventDefault(); return definirVisualizacao(!prefs.visualizando); }
  if (k === 'd'){
    e.preventDefault();
    prefs.escopo = prefs.escopo === 'nenhum' ? 'frase' : 'nenhum';
    aplicarPrefs(); return desenhar();
  }
  if (k === 't' && !e.shiftKey){ e.preventDefault(); return alternar('maquina'); }
  if (k === 'g'){
    e.preventDefault();
    prefs.classe = prefs.classe === 'nenhuma' ? 'todas' : 'nenhuma';
    aplicarPrefs(); return desenhar();
  }
  if (k === 'p' && !e.shiftKey){ e.preventDefault(); return alternar('ortografia'); }
  if (k === 'r' && !e.shiftKey){ e.preventDefault(); return alternar('estilo'); }
  if (k === 'n' && e.altKey){ e.preventDefault(); return $('#btnNovo').click(); }
  if (e.key === ';'){
    e.preventDefault();
    if (!corrigirNoCursor()) avisar('nada a corrigir aqui');
    return;
  }
});

$('#stDica').onclick = () => corrigirNoCursor();

/* Tab dentro do editor recua/avança em vez de trocar de campo. */
editor.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  const { selectionStart:a, selectionEnd:b, value:v } = editor;
  if (a === b && !e.shiftKey){
    editor.setRangeText('\t', a, b, 'end');
  } else {
    const ini = v.lastIndexOf('\n', a - 1) + 1;
    const bloco = v.slice(ini, b);
    const novo = e.shiftKey
      ? bloco.replace(/^(\t| {1,4})/gm,'')
      : bloco.replace(/^/gm,'\t');
    editor.setRangeText(novo, ini, b, 'end');
    editor.setSelectionRange(ini, ini + novo.length);
  }
  aoDigitar();
});

/* Enter dá continuidade a listas e citações. */
editor.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey || e.metaKey || e.ctrlKey) return;
  const { selectionStart:a, value:v } = editor;
  if (a !== editor.selectionEnd) return;
  const ini = v.lastIndexOf('\n', a - 1) + 1;
  const linha = v.slice(ini, a);
  const m = linha.match(/^(\s*)([-*+]|(\d{1,9})[.)]|>)(\s+)(.*)$/);
  if (!m) return;
  e.preventDefault();
  if (!m[5].trim()){                       // item vazio encerra a lista
    editor.setRangeText('', ini, a, 'end');
    return aoDigitar();
  }
  const marcador = m[3] ? `${+m[3] + 1}${m[2].slice(-1)}` : m[2];
  editor.setRangeText(`\n${m[1]}${marcador}${m[4]}`, a, a, 'end');
  aoDigitar();
});

/* ═══════════════════════════════════════════════════════════
   10b. Pasta no Obsidian
   ─────────────────────────────────────────────────────────
   O Escritor roda no navegador e não tem acesso a discos: não
   dá para digitar um caminho como faz um aplicativo de mesa.
   O que existe é a File System Access API, em que VOCÊ escolhe
   a pasta uma vez, o navegador guarda a permissão e a partir
   daí o Markdown é escrito direto lá dentro, sem plugin e sem
   importar. Um vault do Obsidian é uma pasta comum, então
   apontar para dentro dele basta.

   A escolha (o handle) fica no IndexedDB, e não no
   localStorage: um handle é um objeto vivo do navegador e não
   sobrevive a virar texto. A permissão pode voltar como
   "prompt" depois de fechar o navegador; nesse caso só um
   clique pode reconfirmá-la, então a barra pede em vez de
   tentar sozinha.
   ═══════════════════════════════════════════════════════════ */

const OBS_DB = 'escritor-obsidian';
const OBS_STORE = 'handles';
const OBS_CHAVE = 'pasta';
/* Nome do arquivo em uso neste documento. Fica só na sessão: no dia seguinte
   quem manda é o título, e não um nome velho gravado. */
let obsArquivo = '';
let obsPasta = null;
let obsRelogio;

const obsSuportado = typeof window.showDirectoryPicker === 'function' && window.isSecureContext;

function obsBanco(){
  return new Promise((ok, erro) => {
    const req = indexedDB.open(OBS_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(OBS_STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
}

function obsGuardar(handle){
  return obsBanco().then(db => new Promise((ok, erro) => {
    const t = db.transaction(OBS_STORE, 'readwrite');
    t.objectStore(OBS_STORE).put(handle, OBS_CHAVE);
    t.oncomplete = () => ok();
    t.onerror = () => erro(t.error);
  })).catch(() => {});
}

function obsLer(){
  return obsBanco().then(db => new Promise((ok) => {
    const t = db.transaction(OBS_STORE, 'readonly');
    const req = t.objectStore(OBS_STORE).get(OBS_CHAVE);
    req.onsuccess = () => ok(req.result || null);
    req.onerror = () => ok(null);
  })).catch(() => null);
}

function obsApagar(){
  return obsBanco().then(db => new Promise((ok) => {
    const t = db.transaction(OBS_STORE, 'readwrite');
    t.objectStore(OBS_STORE).delete(OBS_CHAVE);
    t.oncomplete = () => ok();
    t.onerror = () => ok();
  })).catch(() => {});
}

/* pedir:false apenas CONSULTA. O navegador só aceita requestPermission dentro
   de um gesto do usuário, então a consulta serve para desenhar o painel e o
   pedido de verdade sai do clique. */
async function obsPermissao(handle, pedir){
  if (!handle || !handle.queryPermission) return 'granted';
  const opcoes = { mode: 'readwrite' };
  let estado = await handle.queryPermission(opcoes);
  if (estado === 'granted') return estado;
  if (!pedir) return estado;
  try { estado = await handle.requestPermission(opcoes); } catch { return 'denied'; }
  return estado;
}

function obsPintar(estado, texto){
  const linha = $('#obsEstado');
  if (!linha) return;
  linha.dataset.estado = estado;
  linha.textContent = texto;

  const ligada = estado === 'ligada';
  const temPasta = ligada || estado === 'espera';
  $('#obsEscolher').textContent = temPasta ? 'Trocar de pasta' : 'Escolher pasta';
  $('#obsEscolher').hidden = estado === 'sem-suporte';
  $('#obsSalvar').hidden = !ligada;
  $('#obsAuto').hidden = !ligada;
  $('#obsEsquecer').hidden = !temPasta;
  $('#obsDica').hidden = !ligada;
  $('#obsAuto').setAttribute('aria-checked', String(!!prefs.obsidianAuto));
  // (a engrenagem virou o painel Personalizar)
}

function obsDescrever(){
  if (!obsPasta) return obsPintar('vazio', 'Nenhuma pasta escolhida.');
  const alvo = obsArquivo || `${tituloDoTexto()}.md`;
  obsPintar('ligada', `${obsPasta.name} · ${alvo}`);
}

async function obsEscolherPasta(){
  if (!obsSuportado){
    avisar('este navegador não deixa o site escrever em pastas');
    return;
  }
  let handle;
  try {
    handle = await window.showDirectoryPicker({ id: 'escritor-obsidian', mode: 'readwrite' });
  } catch { return; }                       // o usuário desistiu do seletor
  if (await obsPermissao(handle, true) !== 'granted'){
    avisar('sem permissão para escrever nessa pasta');
    return;
  }
  obsPasta = handle;
  obsArquivo = '';
  await obsGuardar(handle);
  obsDescrever();
  avisar(`Obsidian: ${handle.name}`);
  /* Escolher a pasta já grava o documento, menos o guia de abertura: ligar a
     pasta pela primeira vez não pode despejar o manual do Escritor dentro do
     vault de alguém. */
  if (documentoSeu()) obsEscrever(true);
}

/* O texto é do usuário quando não está vazio e não é o guia de abertura.
   A mesma pergunta que guardarTexto() faz para marcar CHAVE_SEU. */
function documentoSeu(){
  const t = editor.value.trim();
  return !!t && t !== GUIA.trim();
}

/* Escreve o documento inteiro. `avisando` separa o salvamento que o usuário
   pediu (com recado na tela) do automático, que tem de ser silencioso. */
async function obsEscrever(avisando){
  if (!obsPasta) return false;
  if (await obsPermissao(obsPasta, false) !== 'granted'){
    obsPintar('espera', `${obsPasta.name} · toque em “Escolher pasta” para reautorizar`);
    if (avisando) avisar('o navegador precisa da pasta de novo');
    return false;
  }
  const nome = `${tituloDoTexto()}.md`;
  try {
    const arquivo = await obsPasta.getFileHandle(nome, { create: true });
    const fluxo = await arquivo.createWritable();
    await fluxo.write(semTituloRepetido(editor.value));
    await fluxo.close();
    if (typeof obsAnexos === 'function') await obsAnexos(obsPasta, editor.value);
  } catch {
    if (avisando) avisar('não deu para escrever na pasta');
    return false;
  }
  /* O arquivo segue o título. Trocando o título, o próximo salvamento cria
     outro arquivo e o anterior FICA onde está: apagar o trabalho de alguém
     por causa de uma linha editada não é decisão do editor. */
  const trocou = obsArquivo && obsArquivo !== nome;
  obsArquivo = nome;
  obsDescrever();
  if (avisando) avisar(trocou ? `agora em ${nome}` : `${nome} no Obsidian`);
  return true;
}

/* No Obsidian o TÍTULO da nota é o nome do arquivo. Como o nome do arquivo sai
   da primeira linha do texto, um `# Título` no corpo apareceria duas vezes na
   leitura: uma como nota, outra como cabeçalho. Aqui o H1 de abertura sai do
   que é gravado — e SÓ ele, e só quando é mesmo o título que virou nome do
   arquivo. O documento no editor não é tocado. */
function semTituloRepetido(texto){
  const linhas = texto.split('\n');
  let i = 0;
  while (i < linhas.length && !linhas[i].trim()) i++;   // pula folgas do começo
  const primeira = linhas[i];
  if (primeira === undefined) return texto;

  const h1 = primeira.match(/^#\s+(.*)$/);             // só H1, nunca ## ou ###
  if (!h1) return texto;
  if (h1[1].trim() !== tituloLegivel()) return texto;

  linhas.splice(0, i + 1);
  while (linhas.length && !linhas[0].trim()) linhas.shift();  // e a linha vazia que sobrava
  return linhas.join('\n');
}

function obsAgendar(){
  if (!prefs.obsidianAuto || !obsPasta || !documentoSeu()) return;
  clearTimeout(obsRelogio);
  obsRelogio = setTimeout(() => obsEscrever(false), 2500);
}

if (!obsSuportado){
  obsPintar('sem-suporte', 'Este navegador não deixa um site gravar em pastas. Use o Chrome ou o Edge, ou continue exportando o .md.');
  $('#obsTexto').textContent =
    'A gravação direta na pasta depende de um recurso que só existe em alguns navegadores.';
} else {
  obsLer().then(async (handle) => {
    if (!handle) return obsPintar('vazio', 'Nenhuma pasta escolhida.');
    obsPasta = handle;
    const estado = await obsPermissao(handle, false);
    if (estado === 'granted') obsDescrever();
    else obsPintar('espera', `${handle.name} · toque em “Escolher pasta” para reautorizar`);
  });
}

$('#obsEscolher').onclick = obsEscolherPasta;
$('#obsSalvar').onclick = () => obsEscrever(true);
$('#obsEsquecer').onclick = async () => {
  obsPasta = null; obsArquivo = '';
  clearTimeout(obsRelogio);
  await obsApagar();
  obsPintar('vazio', 'Nenhuma pasta escolhida.');
  avisar('pasta esquecida');
};
$('#obsAuto').onclick = (e) => {
  e.stopPropagation();                      // marcar não fecha o menu
  prefs.obsidianAuto = !prefs.obsidianAuto;
  salvarPrefs();
  $('#obsAuto').setAttribute('aria-checked', String(prefs.obsidianAuto));
  if (prefs.obsidianAuto && documentoSeu()) obsEscrever(false);
};

/* ═══════════════════════════════════════════════════════════
   11. Ciclo de vida
   ═══════════════════════════════════════════════════════════ */

let relogioSalvar;

function guardarTexto(){
  clearTimeout(relogioSalvar);
  $('#stSalvo').textContent = 'salvando…';
  relogioSalvar = setTimeout(() => {
    if (PONTE){ PONTE.salvar(editor.value); $('#stSalvo').textContent = 'salvo'; return; }
    try {
      localStorage.setItem(CHAVE_TEXTO, editor.value);
      // texto igual ao guia (ou em branco) não conta como documento seu
      const seu = editor.value.trim() && editor.value.trim() !== GUIA.trim();
      localStorage.setItem(CHAVE_SEU, seu ? '1' : '0');
      if (typeof notaGuardar === 'function') notaGuardar(editor.value, !!seu);
      $('#stSalvo').textContent = 'salvo';
    } catch {
      $('#stSalvo').textContent = 'sem espaço para salvar';
    }
  }, 420);
}

function esconderChrome(){ corpo.dataset.chrome = 'oculto'; }
function mostrarChrome(){ corpo.dataset.chrome = 'visivel'; }

function aoDigitar(){
  alvoRevisao = null;
  precisaCentrar = prefs.maquina;
  desenhar();
  guardarTexto();
  obsAgendar();
  esconderChrome();
}

editor.addEventListener('input', aoDigitar);

/* Mover o cursor com as setas ou com o mouse também recentraliza
   no modo máquina de escrever, e sempre redesenha o foco.
   Antes isso esperava a tecla SUBIR (keyup): entre apertar e soltar a
   seta o cursor já estava na linha nova e o destaque ainda na velha, e
   a linha de trás piscava. Agora quem avisa é o selectionchange, que
   dispara no mesmo instante em que o cursor anda; o redesenho vai para
   o próximo quadro e só acontece se o cursor de fato mudou de lugar. */
let ultimoDesenho = '';
let rafCursor = 0;
/* Só as teclas que andam para baixo levam a folha: subir com a seta,
   clicar ou arrastar o mouse mudam o cursor e deixam a página quieta. */
let desceuPeloTeclado = false;
const TECLAS_QUE_DESCEM = new Set(['ArrowDown', 'PageDown', 'Enter']);
editor.addEventListener('keydown', (e) => {
  desceuPeloTeclado = TECLAS_QUE_DESCEM.has(e.key) || (e.key === 'End' && (e.ctrlKey || e.metaKey));
});
editor.addEventListener('pointerdown', () => { desceuPeloTeclado = false; });
function redesenharCursor(){
  cancelAnimationFrame(rafCursor);
  rafCursor = requestAnimationFrame(() => {
    const chave = editor.selectionStart + ':' + editor.selectionEnd + ':' + editor.value.length;
    if (chave === ultimoDesenho) return;
    precisaCentrar = prefs.maquina && desceuPeloTeclado;
    desceuPeloTeclado = false;
    desenhar();
    atualizarRegua();
  });
}
document.addEventListener('selectionchange', () => { if (document.activeElement === editor) redesenharCursor(); });
['click', 'focus'].forEach(ev => editor.addEventListener(ev, redesenharCursor));

/* Clicar na folha sempre devolve o cursor ao texto — inclusive nas
   margens laterais e no branco abaixo da última linha, que não fazem
   parte da caixa de edição. Antes, um clique ali tirava o foco e o
   que se digitasse em seguida não chegava a lugar nenhum. */
scroller.addEventListener('pointerdown', (e) => {
  if (prefs.visualizando || e.target === editor) return;
  if (e.target.closest('a, button')) return;
  // No dedo o preventDefault engoliria o toque que abre o teclado:
  // ali basta chamar o foco e deixar o navegador cuidar do resto.
  if (e.pointerType !== 'mouse'){
    editor.focus();
    return;
  }
  e.preventDefault();                       // não perde a seleção atual
  editor.focus();
  // clique abaixo do texto: o cursor vai para o fim do documento
  const fim = editor.getBoundingClientRect().bottom - parseFloat(
    getComputedStyle(editor).paddingBottom || 0);
  if (e.clientY > fim) editor.setSelectionRange(editor.value.length, editor.value.length);
  desenhar();
});

/* Sair de um menu ou de um botão da barra também devolve o foco:
   ninguém clica em "Foco" para depois digitar no vazio. */
document.addEventListener('click', (e) => {
  if (prefs.visualizando) return;
  if (!e.target.closest('.bar, .stats, .revisao')) return;
  if (e.target.closest('#btnAbrir, #fileInput, .menu-btn, .menu-pop')) return;
  editor.focus({ preventScroll:true });
});

document.addEventListener('mousemove', mostrarChrome);
scroller.addEventListener('scroll', () => {
  corpo.dataset.scrolled = scroller.scrollTop > 4 ? '1' : '0';
});
window.addEventListener('resize', () => { if (prefs.maquina) descerAteOCentro(); });

/* A altura real da barra vira variável de CSS: no celular o painel
   suspenso nasce logo abaixo dela, tenha ela uma linha ou duas. */
const barra = $('#bar');
const medirBarra = () =>
  document.documentElement.style.setProperty('--barra-h', `${barra.offsetHeight}px`);
medirBarra();
if (window.ResizeObserver) new ResizeObserver(medirBarra).observe(barra);
else window.addEventListener('resize', medirBarra);

/* O teclado virtual não dispara `resize` em todos os navegadores: ele
   encolhe a janela visual. Sem isto, no celular a linha que se digita
   pode acabar escondida atrás do teclado. */
if (window.visualViewport){
  window.visualViewport.addEventListener('resize', () => {
    atualizarRegua();
    if (prefs.maquina) descerAteOCentro();
    else if (document.activeElement === editor) manterCursorVisivel();
  });
}

/* Rola o mínimo para que a linha do cursor volte a aparecer acima do
   teclado — sem saltos quando ela já está visível. */
function manterCursorVisivel(){
  const marca = document.getElementById('marcaCursor');
  if (!marca) return;
  const alvo = marca.getBoundingClientRect().bottom;
  const limite = (window.visualViewport?.height || window.innerHeight) - 24;
  if (alvo > limite) scroller.scrollTop += alvo - limite;
}
window.addEventListener('beforeunload', () => {
  if (PONTE){ clearTimeout(relogioSalvar); PONTE.salvar(editor.value); return; }
  try {
    localStorage.setItem(CHAVE_TEXTO, editor.value);
    const seu = editor.value.trim() && editor.value.trim() !== GUIA.trim();
    localStorage.setItem(CHAVE_SEU, seu ? '1' : '0');
  } catch {}
});

/* ═══════════════════════════════════════════════════════════
   12. O guia — também é o documento da primeira abertura
   ═══════════════════════════════════════════════════════════ */

const GUIA = paraSO(`# Guia do Escritor

Este é um editor para escrever e revisar textos sem distrações. Você pode apagar todo este conteúdo e começar a escrever: o seu texto é salvo automaticamente neste navegador.

## Notas

O Escritor guarda várias notas. O botão **Notas**, no canto esquerdo da barra (ou \`Ctrl+O\`), abre todas elas em cartões no meio da tela: procure, abra com \`Enter\`, crie uma **Nova nota** (\`Ctrl+Alt+N\`) ou apague, com **Desfazer** por alguns segundos. Não há barra lateral: a folha fica inteira para escrever.

No menu **⋯ Documento**, a aba **Arquivo** também abre arquivos \`.md\` e \`.txt\` do computador, cada um como uma nota nova. Arrastar um desses arquivos para a folha faz o mesmo.

**Ligações**: \`[[Título]]\` liga uma nota a outra. Ao escrever \`[[\` aparece a lista das suas notas; \`Ctrl+clique\` na ligação abre a nota citada (ou cria uma nova com aquele título).

As notas ficam neste navegador. Para guardar de verdade, ligue uma pasta do Obsidian (cada nota vira um arquivo) ou use **Exportar**.

## Escrever e formatar

Escreva normalmente na folha. Para formatar, use Markdown ou os atalhos:

- \`# Título\` cria um título; \`## Subtítulo\` cria um subtítulo.
- \`**texto**\` deixa o texto em **negrito**.
- \`_texto_\` cria *itálico*.
- \`- item\` cria uma lista.
- \`> trecho\` cria uma citação.
- \`[nome](https://endereco.com)\` cria um [link](https://exemplo.com).

Os sinais ficam visíveis durante a edição para você continuar no controle do texto. Use **Visualizar** quando quiser ver o resultado limpo e formatado.

## Botão direito

Clique com o botão direito no texto para formatar sem decorar atalhos. Abre um painel só, sem submenus:

- **No alto**: recortar, copiar, colar, colar sem formato e selecionar tudo.
- **Grifar** em sete cores (\`==🟥texto==\`, como no Obsidian).
- **Formatar**: negrito, itálico, riscado, código, equação, comentário oculto (\`%%assim%%\`, \`Ctrl+/\`) e limpar formatação.
- **Estudo**: link para nota (\`[[Título]]\`, \`Ctrl+K\`), link externo, nota de rodapé (a chamada \`[^1]\` fica no cursor e o texto vai para o fim), destaque (\`> [!note]\`), imagem, tabela e régua.
- **Parágrafo**: títulos de H1 a H6 (¶ volta a texto), listas, tarefas, citação, bloco de código e equação em bloco.

Em cima de uma ligação, de um link, de uma nota de rodapé ou de uma palavra com erro, o painel ganha, no alto, as ações daquele lugar.

## Imagens

Cole uma imagem (\`Ctrl+V\`) ou arraste um arquivo de imagem para a folha. Ela fica guardada no navegador e o texto recebe \`![](anexos/imagem….png)\`. A imagem aparece no **Visualizar**, vai dentro dos arquivos exportados e, com uma pasta do Obsidian ligada, é gravada em \`anexos\`, ao lado das notas.

## Foco

O menu **Foco** reduz visualmente tudo o que está fora do trecho atual. Ele não apaga nem modifica nada:

- **Frase** destaca apenas a frase onde está o cursor.
- **Parágrafo** destaca o parágrafo atual.
- **Linha** destaca somente a linha atual.
- **Desligado** devolve a mesma intensidade a todo o documento.

No mesmo menu, **Máquina de escrever** funciona como a máquina de verdade: a folha só anda para a frente. Quando a linha que você digita passa do meio da tela, o documento desce uma linha e ela volta ao centro. Clicar, selecionar com o mouse ou subir com as setas não mexe na página, então dá para escolher qualquer linha sem ela fugir.

## Realce e revisão

O menu **Realce** ajuda a encontrar problemas sem alterar o conteúdo automaticamente:

1. **Ortografia** — palavras suspeitas recebem um sublinhado vermelho. Quando houver uma correção conhecida, coloque o cursor sobre a palavra: a sugestão aparecerá no rodapé. Clique nela ou pressione \`Ctrl+;\` para substituir. Você pode desfazer com \`Ctrl+Z\`.
2. **Revisão de estilo** — marca palavras muito repetidas e frases longas ou prolixas com um traço âmbar. Para as frases, propõe uma refundição mais concisa, guiada pelo *mot juste*. A quantidade aparece no rodapé; clique nela para abrir a lista e depois clique em um aviso para ir ao trecho correspondente.
3. **Classes gramaticais** — colore uma categoria de palavras e recua as demais. Isso permite observar como o texto foi construído.

### O que são as classes gramaticais

- **Substantivos** dão nome a seres, objetos, lugares, sentimentos e ideias: “pessoa”, “casa”, “cidade”, “amor”.
- **Verbos** indicam ações, estados, mudanças ou fenômenos: “escrever”, “está”, “cresceu”, “chove”.
- **Adjetivos** atribuem características aos substantivos: “texto claro”, “cidade grande”, “pessoa feliz”.
- **Advérbios** modificam verbos, adjetivos ou outros advérbios e indicam circunstâncias como tempo, lugar, modo, intensidade, afirmação, negação ou dúvida: “ontem”, “aqui”, “rapidamente”, “muito”, “não”, “talvez”.
- **Conectivos** ligam palavras, orações e ideias, mostrando relações como adição, oposição, causa ou conclusão: “e”, “mas”, “porque”, “porém”, “portanto”.

Escolha uma classe por vez para analisá-la ou selecione **Todas as classes** para comparar as cores. A análise é uma ajuda visual: palavras ambíguas podem depender do contexto e ficam sem realce quando não há segurança.

## A barra e os menus

Em cima ficam **Notas**, **Foco** (o visor), **Realce** (o marca-texto), **Visualizar** (o olho, que vira caneta enquanto você lê), **Aa**, a tela cheia e o **⋯ Documento**. Os menus abrem no meio da tela, largos: as setas andam pelas opções em qualquer direção, \`Enter\` escolhe e \`Esc\` fecha. Nada acende sozinho, só o que está sob o ponteiro. Embaixo, o rodapé conta as palavras e o tempo de leitura, avisa os pontos de atenção e mostra se o texto está salvo.

## Personalizar — Aa

O botão **Aa** (ou \`Ctrl+,\`) abre o painel Personalizar no meio da tela. No alto, uma fileira de ícones leva a cada seção; a última, **Amostra**, mostra um trecho escrito com tudo o que você escolheu. Ele muda a aparência e o jeito de escrever, nunca o conteúdo:

- **Estilos prontos** trocam tudo de uma vez: Livro, Noturno, Concentração, Revisão e outros. Você também pode salvar a sua combinação com um nome.
- **Aparência**: oito papéis e o Automático, que segue o claro ou escuro do sistema; a cor de destaque, inclusive uma escolhida por você; a cor dos títulos e os sinais do Markdown.
- **Texto**: fonte, corpo, entrelinha, espaço entre letras e largura da coluna.
- **Escrita**, **Revisão** e **Tela e meta** reúnem o Foco, a máquina de escrever, a tipografia inteligente, a ortografia, as classes gramaticais, o rodapé e a meta de palavras.
- **Autoria** guarda o seu nome, do jeito que quiser assinar, e um link opcional (site, e-mail ou rede social). Eles assinam os arquivos exportados.

A busca no alto do painel (\`Ctrl+F\` com ele aberto) acha qualquer ajuste pelo nome. **Exportar ajustes** guarda tudo num arquivo .json, que **Importar** traz de volta em outro navegador.

## Visualizar

**Visualizar** troca a área de edição por uma leitura limpa: oculta os sinais do Markdown e mostra títulos, listas, links, negrito e itálico já formatados. Clique novamente ou pressione \`Ctrl+E\` para voltar a editar.

## Exportar

O menu **Exportar** cria uma cópia do documento no formato escolhido:

- **Markdown** preserva a marcação original.
- **Texto simples** salva somente os caracteres do documento.
- **HTML** cria uma página para abrir no navegador.
- **Word** cria um arquivo editável em programas compatíveis.
- **PDF** abre a impressão do navegador para salvar ou imprimir.

Também é possível copiar Markdown ou HTML para a área de transferência. O primeiro título do documento é usado como nome do arquivo.

No fim do HTML, do Word e do PDF vai uma assinatura discreta: o título da obra, o seu nome (se você preencheu a **Autoria** no Personalizar, e com link se deu um), a data e o “Feito com Escritor”.

## Pasta no Obsidian

A engrenagem guarda um ajuste só, e ele fica gravado nesta máquina: uma pasta de destino. Escolha qualquer pasta de dentro do seu vault e o Escritor passa a gravar o Markdown direto nela, sem plugin e sem importar nada. O Obsidian vê o arquivo aparecer.

- **Escolher pasta** abre o seletor do sistema. A permissão é pedida uma vez.
- **Salvar no Obsidian** grava o documento agora. Com uma pasta ligada, \`Ctrl+S\` faz o mesmo (sem pasta, ele continua baixando o \`.md\`).
- **Salvar sozinho enquanto escrevo** grava alguns segundos depois de você parar de digitar.
- **Esquecer a pasta** desfaz a ligação. Nada é apagado do disco.

O arquivo recebe o nome da primeira linha do texto, e no Obsidian o nome do arquivo JÁ É o título da nota. Por isso o \`# Título\` de abertura não é gravado dentro do arquivo: sem essa poda ele apareceria duas vezes na leitura, uma como nota e outra como cabeçalho. Sai só o primeiro, e só quando ele é mesmo o título; o documento aqui no editor continua inteiro.

Se você trocar o título, o próximo salvamento cria um arquivo novo e o anterior fica onde está.

A gravação direta em pastas depende de um recurso que hoje existe no Chrome e no Edge. Nos outros navegadores a engrenagem avisa, e a exportação em \`.md\` continua servindo.

## Rodapé

Na parte inferior, o Escritor mostra a quantidade de palavras, o tempo estimado de leitura, o estado do salvamento e o número de observações da revisão. Quando uma correção ortográfica estiver disponível, ela também aparece ali.

**Clique no contador** para ver outras medidas do texto. Cada clique passa para a seguinte, em ordem, e volta ao começo:

1. **palavras**
2. **caracteres** — tudo, inclusive espaços e quebras de linha
3. **sem espaços** — só os caracteres visíveis
4. **frases** — contadas pelos pontos finais, de interrogação, de exclamação e reticências
5. **parágrafos** — blocos separados por uma linha em branco

A contagem escolhida continua ali na próxima vez que você abrir o Escritor. O **tempo de leitura**, ao lado, é estimado em 200 palavras por minuto e não muda com o contador.

---

### Atalhos

| Atalho | O que faz |
| --- | --- |
| \`Ctrl+B\` | negrito |
| \`Ctrl+I\` | itálico |
| \`Ctrl+K\` | link |
| \`Ctrl+E\` | visualizar ou voltar a editar |
| \`Ctrl+D\` | ligar ou desligar o foco |
| \`Ctrl+T\` | máquina de escrever |
| \`Ctrl+G\` | classes gramaticais |
| \`Ctrl+P\` | ortografia |
| \`Ctrl+;\` | corrigir a palavra |
| \`Ctrl+R\` | revisão de estilo |
| \`Ctrl+S\` | exportar Markdown |
| \`Ctrl+O\` | abrir arquivo |
| \`Ctrl+Alt+N\` | novo documento |

O botão **?** na barra substitui temporariamente a folha por este guia. Se houver um texto seu aberto, o aplicativo pede confirmação antes.

---

### Se quiser tudo maior

O **Corpo**, no menu **Aa**, aumenta as letras do seu texto — e só elas. Para ampliar a tela inteira (a barra, o rodapé, as margens e o texto, tudo junto), use o zoom do próprio navegador:

- Segure \`Ctrl\` e pressione \`+\` para aumentar. Cada toque amplia mais um pouco; pode repetir.
- Segure \`Ctrl\` e pressione \`-\` para diminuir.
- Segure \`Ctrl\` e pressione \`0\` (o número zero) para voltar ao tamanho normal.

Também funciona segurar \`Ctrl\` e girar a roda do mouse. No Mac, troque \`Ctrl\` por \`⌘\`.

Na barra, ao lado do **⋯**, fica o botão de **tela cheia**, com os quatro cantos (ou \`Ctrl+Shift+F\`): ele esconde as abas e a barra de endereço do navegador e deixa só a folha. Clique de novo ou pressione \`Esc\` para voltar. No iPhone, onde o navegador não tem tela cheia, a barra e o rodapé saem e fica um botão discreto no canto para voltar.

O navegador guarda o zoom escolhido e o aplica sempre que você voltar ao Escritor, mesmo depois de fechar. Nada disso altera o documento: o arquivo salvo ou exportado sai igual, qualquer que seja o zoom da tela.
`);

/* ═══════════════════════════════════════════════════════════
   13. Primeira abertura
   ═══════════════════════════════════════════════════════════ */

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

/* Folha em branco não é começo de conversa: sem rascunho guardado
   — ou com um rascunho que só tem espaço em branco — quem abre o
   aplicativo encontra o guia. */
const guardado = localStorage.getItem(CHAVE_TEXTO);
const seuTexto = localStorage.getItem(CHAVE_SEU) === '1';

/* Enquanto você não tiver escrito nada seu, o guia é o documento de
   toda abertura — e não apenas da primeira. Assim ele não se perde
   por causa de um rascunho vazio deixado na sessão anterior, nem
   fica preso a uma versão antiga guardada no navegador. */
editor.value = PONTE ? PONTE.texto() : (seuTexto && guardado && guardado.trim()) ? guardado : GUIA;

aplicarPrefs();
if (prefs.visualizando) definirVisualizacao(true);
else desenhar();
requestAnimationFrame(atualizarRegua);

editor.focus();
editor.setSelectionRange(0, 0);
scroller.scrollTop = 0;
if (prefs.maquina) centralizarCursor();
