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

const prefs = Object.assign({
  escopo: 'nenhum', maquina: false, classe: 'nenhuma',
  ortografia: true, estilo: true, tema: 'claro', fonte: 'duo',
  corpo: 18, contagem: 0, visualizando: false, poeta: false
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
const REGRAS_INLINE = [
  // código entre crases — protegido de todo o resto
  [/(`+)([^`]+)\1/g, (m) => [pd(m[1],'mk t-cod'), pd(m[2],'t-cod'), pd(m[1],'mk t-cod')]],
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

  const aberto = $('#revisao').hidden === false;
  botao.textContent = `${n} ponto${n > 1 ? 's' : ''} de atenção ${aberto ? '↓' : '↑'}`;
  if (aberto) preencherRevisao();
}

function preencherRevisao(){
  $('#revisaoLista').innerHTML = apontamentos.map((a, i) => `
    <button class="ponto" type="button" data-ponto="${i}">
      <span class="ponto-palavra">${escapar(a.palavra)}</span>
      <span class="ponto-texto">${escapar(a.msg)}</span>
    </button>`).join('');
}

function abrirRevisao(){
  if (!apontamentos.length) return;
  $('#revisao').hidden = false;
  $('#stRevisao').setAttribute('aria-expanded', 'true');
  preencherRevisao();
  renderRevisao();
}
function fecharRevisao(){
  $('#revisao').hidden = true;
  $('#stRevisao').setAttribute('aria-expanded', 'false');
}

$('#stRevisao').onclick = () => {
  if ($('#revisao').hidden) abrirRevisao(); else { fecharRevisao(); renderRevisao(); }
};
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

  let fa = -1, fb = -1;
  const comFoco = prefs.escopo !== 'nenhum' && !prefs.visualizando;
  if (comFoco) [fa, fb] = regiaoAtiva(texto, cursor);

  apontamentos = revisar(texto);

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
    centralizarCursor();
  }
}

function desenharNumerosLinha(texto, cursor){
  if (!prefs.poeta){
    numerosLinha.innerHTML = '';
    return;
  }
  const atual = texto.slice(0, cursor).split('\n').length - 1;
  const textos = texto.split('\n');
  let verso = 0;

  numerosLinha.innerHTML = [...overlay.querySelectorAll('.linha-fonte')]
    .map((linha, indice) => {
      // O branco entre estrofes é estrutura, não verso: não recebe
      // número e tampouco interrompe a contagem contínua do poema.
      if (!textos[indice].trim()) return '';
      verso++;

      const estaAtual = indice === atual;
      // Como numa edição de poesia, a margem permanece silenciosa:
      // marca-se cada quinto verso e, para orientação, o verso ativo.
      if (!estaAtual && verso % 5 !== 0) return '';
      return `<span class="numero-linha${estaAtual ? ' atual' : ''}" ` +
        `style="top:${linha.offsetTop}px">${verso}</span>`;
    }).join('');
}

function centralizarCursor(){
  const marca = document.getElementById('marcaCursor');
  if (!marca) return;
  const alvo = marca.offsetTop - scroller.clientHeight / 2 + 12;
  scroller.scrollTop = Math.max(0, alvo);
}

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
  $('#stTempo').textContent = palavras ? Math.max(1, Math.round(palavras / 200)) : 0;
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
  dica.innerHTML = `${escapar(m[0])} → <b>${escapar(comOMesmoMolde(m[0], certa))}</b><kbd>Ctrl+;</kbd>`;
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

function paraHTML(md){
  const linhas = md.replace(/\r\n?/g,'\n').split('\n');
  const out = [];
  let i = 0;

  const inline = (t) => {
    let s = escapar(t);
    const cofre = [];
    const guardar = (h) => `\u0000${cofre.push(h) - 1}\u0000`;
    s = s.replace(/(`+)([^`]+)\1/g, (_, c, x) => guardar(`<code>${x}</code>`));
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
      out.push(`<blockquote>${paraHTML(bloco.join('\n'))}</blockquote>`);
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

/* ── assinatura do rodapé ──────────────────────────────────
   Título e data, centralizados e discretos, ao pé da página;
   abaixo, só a folha — que leva ao Escritor. */

const ESCRITOR_URL = 'https://cesteduardo.github.io/escritor/';

const FOLHA_SVG =
  `<svg class="folha" viewBox="0 0 20 20" width="15" height="15" aria-label="Escritor" ` +
  `role="img" fill="none" stroke="currentColor" stroke-width="1.15" ` +
  `stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="M11.5 2.5H5.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V6.5z"/>` +
  `<path d="M11.5 2.5V6.5h4"/></svg>`;

function dataPorExtenso(){
  return new Date().toLocaleDateString('pt-BR',
    { day: 'numeric', month: 'long', year: 'numeric' });
}

/* `glifo` troca o desenho por um caractere onde SVG não chega (Word). */
function assinaturaHTML(glifo){
  const t = tituloLegivel();
  const marca = glifo || FOLHA_SVG;

  // O Word não faz flex: a assinatura centralizada vira uma tabela.
  if (glifo) return `<hr class="assinatura-filete">` +
    `<table class="assinatura"><tr><td align="center">${escapar(t)}<br>` +
    `${escapar(dataPorExtenso())}<br>` +
    `<a href="${ESCRITOR_URL}">Escrito no ${marca}</a></td></tr></table>`;

  return `<footer class="assinatura">` +
    `<span class="assinatura-data">${escapar(dataPorExtenso())}</span>` +
    `<span class="assinatura-marca"><a href="${ESCRITOR_URL}">Escrito no ${marca}</a></span>` +
    `<span class="assinatura-obra">${escapar(t)}</span>` +
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
h1{font-size:1.9em;margin-top:0}h2{font-size:1.45em}h3{font-size:1.18em}
p{margin:0 0 1.25em}
a{color:#0b5fff}code{font:.9em/1.5 ui-monospace,Menlo,Consolas,monospace;
  background:#f2f3f5;padding:.1em .35em;border-radius:4px}
pre{background:#f6f7f9;padding:1em 1.15em;border-radius:9px;overflow-x:auto}
pre code{background:none;padding:0}
blockquote{margin:0 0 1.25em;padding-left:1.15em;border-left:2px solid #d3d6dc;color:#4a4f57}
ul,ol{padding-left:1.4em}li{margin:.3em 0}
hr{border:0;border-top:1px solid #e9ebef;margin:2.4em 0}
img{max-width:100%;border-radius:8px}
table{width:100%;border-collapse:collapse;font-size:.94em}
th,td{border:1px solid #e9ebef;padding:.45em .7em;text-align:left}
.assinatura{margin:4.5rem 0 1rem;padding-top:1rem;
  display:flex;flex-direction:column;align-items:center;gap:.25em;text-align:center;
  border-top:1px solid #e9ebef;
  font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;
  font-size:.78em;line-height:1.6;color:#8a9099}
.assinatura-data{text-align:center;font-variant-numeric:oldstyle-nums}
.assinatura-obra{order:-1;text-align:center;color:#5b6069;letter-spacing:.02em}
.assinatura-marca a{color:inherit;text-decoration:none;
  display:inline-flex;align-items:center;gap:.4em}
.assinatura-marca a:hover{color:#3d434c}
.assinatura .folha{vertical-align:middle;opacity:.85}
`;

async function exportar(tipo){
  const md = editor.value;
  const nome = tituloDoTexto();

  if (tipo === 'md')  return baixar(`${nome}.md`,  md, 'text/markdown;charset=utf-8');
  if (tipo === 'txt') return baixar(`${nome}.txt`,
    md.replace(/^#{1,6}\s+/gm,'').replace(/(\*\*|__|~~|[*_`])/g,'')
      .replace(/^\s*>\s?/gm,'').replace(/\[([^\]]*)\]\([^)]*\)/g,'$1'),
    'text/plain;charset=utf-8');

  if (tipo === 'html'){
    return baixar(`${nome}.html`,
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${escapar(nome)}</title><style>${CSS_EXPORT}</style></head>` +
      `<body>\n${paraHTML(md)}\n${assinaturaHTML()}\n</body></html>`,
      'text/html;charset=utf-8');
  }

  if (tipo === 'doc'){
    const doc =
      `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
      `xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8">` +
      `<title>${escapar(nome)}</title><style>@page{size:A4;margin:2.4cm 2.2cm}` +
      `body{font:12pt/1.65 Georgia,serif}` +
      `h1,h2,h3{font-family:Calibri,Arial,sans-serif;color:#1a1a1a}` +
      `blockquote{margin-left:0;padding-left:12pt;border-left:2pt solid #999;color:#444}` +
      `code,pre{font-family:Consolas,monospace;font-size:10.5pt}` +
      `pre{background:#f4f4f4;padding:8pt}` +
      `table{border-collapse:collapse}th,td{border:.5pt solid #999;padding:4pt}` +
      // o Word não desenha SVG: a folha vira glifo
      `.assinatura-filete{margin-top:36pt;border:0;border-top:.5pt solid #ccc}` +
      `table.assinatura{width:100%;margin-top:8pt;text-align:center;` +
      `font-family:Calibri,Arial,sans-serif;font-size:9pt;color:#777}` +
      `table.assinatura td{border:0;padding:0}` +
      `table.assinatura a{color:#777;text-decoration:none}` +
      `</style></head><body>${paraHTML(md)}${assinaturaHTML('🗎')}</body></html>`;
    return baixar(`${nome}.doc`, '﻿' + doc, 'application/msword;charset=utf-8');
  }

  if (tipo === 'pdf'){
    prepararImpressao();
    // O endereço do arquivo no alto da página é do navegador, não daqui:
    // só a caixa "cabeçalhos e rodapés" do diálogo o remove — uma vez, e fica.
    avisar('Na janela de impressão, desmarque “cabeçalhos e rodapés”', 6000);
    window.print();
    return;
  }

  if (tipo === 'copy' || tipo === 'copyhtml'){
    const conteudo = tipo === 'copy' ? md : paraHTML(md);
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
const COR_TEMA = { claro:'#ffffff', sepia:'#f6f0e4', escuro:'#191a1c' };
const CORPO_MIN = 14, CORPO_MAX = 28;

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
  $('#btnFoco').textContent = ROTULO_ESCOPO[prefs.escopo];
  $('#btnFoco').classList.toggle('ativo', comFoco || prefs.maquina);

  const comRealce = prefs.classe !== 'nenhuma';
  $('#btnRealce').textContent = ROTULO_CLASSE[prefs.classe];
  $('#btnRealce').classList.toggle('ativo', comRealce);

  $('#togVer').setAttribute('aria-pressed', prefs.visualizando);
  // o trecho em .so-largo some nas telas estreitas: "Visualizar" → "Vis"
  $('#togVer').innerHTML = prefs.visualizando
    ? 'Editar' : 'Vis<span class="so-largo">ualizar</span>';
  $('#corpoAgora').textContent = prefs.corpo + 'px';
  $('#togPoeta').setAttribute('aria-pressed', String(prefs.poeta));
  regua.hidden = !prefs.poeta;

  // marcas de estado dentro dos menus
  $$('[data-escopo]').forEach(b => b.setAttribute('aria-checked', b.dataset.escopo === prefs.escopo));
  $$('[data-classe]').forEach(b => b.setAttribute('aria-checked', b.dataset.classe === prefs.classe));
  $$('[data-tema]').forEach(b => b.setAttribute('aria-checked', b.dataset.tema === prefs.tema));
  $$('[data-fonte]').forEach(b => b.setAttribute('aria-checked', b.dataset.fonte === prefs.fonte));
  $$('[data-alterna]').forEach(b => b.setAttribute('aria-checked', !!prefs[b.dataset.alterna]));

  // O corretor nativo do navegador é a fonte do sublinhado vermelho.
  editor.setAttribute('spellcheck', prefs.ortografia ? 'true' : 'false');

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
  return Math.max(4, ctx.measureText(' ').width);
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

/* Tela cheia: some a moldura do navegador e sobra a folha.
   Onde a API não existe (iOS), o botão nem aparece. */
const btnTela = $('#btnTela');
if (!document.documentElement.requestFullscreen){
  btnTela.hidden = true;
} else {
  btnTela.onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen()
           .catch(() => avisar('O navegador não permitiu a tela cheia'));
  };
  // F11 e Esc mudam o estado sem passar pelo botão: seguimos o evento
  document.addEventListener('fullscreenchange', () => {
    const cheia = !!document.fullscreenElement;
    document.body.dataset.tela = cheia ? '1' : '0';
    btnTela.setAttribute('aria-pressed', String(cheia));
    btnTela.title = cheia ? 'Sair da tela cheia' : 'Tela cheia';
    btnTela.setAttribute('aria-label', btnTela.title);
  });
}

$('#stCont').onclick = () => {
  prefs.contagem = (prefs.contagem + 1) % CONTAGENS.length;
  salvarPrefs();
  atualizarNumeros(editor.value);
};

// menus
$$('.menu').forEach((menu) => {
  menu.querySelector('.menu-btn').onclick = (e) => {
    e.stopPropagation();
    const jaAberto = menu.classList.contains('aberto');
    $$('.menu').forEach(m => m.classList.remove('aberto'));
    menu.classList.toggle('aberto', !jaAberto);
  };
  // um menu só se fecha quando a escolha é única
  menu.querySelector('.menu-pop').onclick = (e) => {
    if (e.target.closest('[data-alterna]') || e.target.closest('.linha-corpo')) e.stopPropagation();
  };
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
$$('[data-tema]').forEach(b => b.onclick = () => {
  prefs.tema = b.dataset.tema; aplicarPrefs();
  if (!prefs.visualizando) editor.focus();
});
$$('[data-fonte]').forEach(b => b.onclick = () => {
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

$('#btnNovo').onclick = () => {
  if (editor.value.trim() && !confirm('Começar um documento novo? O texto atual será descartado.')) return;
  trocarTexto('');
};

$('#btnGuia').onclick = () => {
  const atual = editor.value.trim();
  if (atual === GUIA.trim()){ scroller.scrollTop = 0; return avisar('O guia já está aberto'); }
  if (atual && !confirm('Abrir o guia do Escritor? O texto atual será descartado.')) return;
  trocarTexto(GUIA, 'Guia do Escritor');
};

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

  if (e.key === 'Escape'){
    if ($$('.menu.aberto').length){ $$('.menu').forEach(m => m.classList.remove('aberto')); return; }
    if (!$('#revisao').hidden){ fecharRevisao(); renderRevisao(); return; }
    if (prefs.visualizando) definirVisualizacao(false);
    return;
  }
  if (!cmd) return;

  const k = e.key.toLowerCase();

  if (k === 'b'){ e.preventDefault(); return envolver('**'); }
  if (k === 'i'){ e.preventDefault(); return envolver('_'); }
  if (k === 'k'){
    e.preventDefault();
    const { selectionStart:a, selectionEnd:b, value:v } = editor;
    const sel = v.slice(a, b) || 'texto';
    editor.setRangeText(`[${sel}](url)`, a, b, 'end');
    editor.setSelectionRange(a + sel.length + 3, a + sel.length + 6);
    return aoDigitar();
  }
  if (k === 's'){ e.preventDefault(); return exportar('md'); }
  if (k === 'o' && !e.shiftKey){ e.preventDefault(); return $('#fileInput').click(); }
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
   11. Ciclo de vida
   ═══════════════════════════════════════════════════════════ */

let relogioSalvar;

function guardarTexto(){
  clearTimeout(relogioSalvar);
  $('#stSalvo').textContent = 'salvando…';
  relogioSalvar = setTimeout(() => {
    try {
      localStorage.setItem(CHAVE_TEXTO, editor.value);
      // texto igual ao guia (ou em branco) não conta como documento seu
      const seu = editor.value.trim() && editor.value.trim() !== GUIA.trim();
      localStorage.setItem(CHAVE_SEU, seu ? '1' : '0');
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
  esconderChrome();
}

editor.addEventListener('input', aoDigitar);

/* Mover o cursor com as setas ou com o mouse também recentraliza
   no modo máquina de escrever, e sempre redesenha o foco. */
['keyup','click','select','focus'].forEach(ev =>
  editor.addEventListener(ev, () => {
    precisaCentrar = prefs.maquina;
    desenhar();
    atualizarRegua();
  }));

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
  if (e.target.closest('#btnAbrir, #fileInput, .menu-btn')) return;
  editor.focus({ preventScroll:true });
});

document.addEventListener('mousemove', mostrarChrome);
scroller.addEventListener('scroll', () => {
  corpo.dataset.scrolled = scroller.scrollTop > 4 ? '1' : '0';
});
window.addEventListener('resize', () => { if (prefs.maquina) centralizarCursor(); });

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
    if (prefs.maquina) centralizarCursor();
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
  try {
    localStorage.setItem(CHAVE_TEXTO, editor.value);
    const seu = editor.value.trim() && editor.value.trim() !== GUIA.trim();
    localStorage.setItem(CHAVE_SEU, seu ? '1' : '0');
  } catch {}
});

/* ═══════════════════════════════════════════════════════════
   12. O guia — também é o documento da primeira abertura
   ═══════════════════════════════════════════════════════════ */

const GUIA = `# Guia do Escritor

Este é um editor para escrever e revisar textos sem distrações. Você pode apagar todo este conteúdo e começar a escrever: o seu texto é salvo automaticamente neste navegador.

## Documentos

No canto superior esquerdo ficam dois comandos:

- **Novo documento** — limpa a folha para começar outro texto. Se já houver conteúdo, o aplicativo pede confirmação antes de descartá-lo.
- **Abrir** — abre um arquivo Markdown (\`.md\`) ou texto simples (\`.txt\`) que esteja no seu computador. Você também pode arrastar um desses arquivos para a folha.

O salvamento automático protege o rascunho ao fechar ou atualizar a página, mas fica somente neste navegador. Para guardar uma cópia permanente ou enviar o texto a alguém, use **Exportar**.

## Escrever e formatar

Escreva normalmente na folha. Para formatar, use Markdown ou os atalhos:

- \`# Título\` cria um título; \`## Subtítulo\` cria um subtítulo.
- \`**texto**\` deixa o texto em **negrito**.
- \`_texto_\` cria *itálico*.
- \`- item\` cria uma lista.
- \`> trecho\` cria uma citação.
- \`[nome](https://endereco.com)\` cria um [link](https://exemplo.com).

Os sinais ficam visíveis durante a edição para você continuar no controle do texto. Use **Visualizar** quando quiser ver o resultado limpo e formatado.

## Foco

O menu **Foco** reduz visualmente tudo o que está fora do trecho atual. Ele não apaga nem modifica nada:

- **Frase** destaca apenas a frase onde está o cursor.
- **Parágrafo** destaca o parágrafo atual.
- **Linha** destaca somente a linha atual.
- **Desligado** devolve a mesma intensidade a todo o documento.

No mesmo menu, **Máquina de escrever** mantém a linha atual perto do centro da tela. O documento se move enquanto você digita, diminuindo a necessidade de acompanhar o cursor com os olhos.

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

## Aparência — Aa

O menu **Aa** muda apenas a aparência, nunca o conteúdo:

- **Fonte** escolhe entre Duo, Mono e Quattro.
- **Corpo** aumenta ou diminui o tamanho das letras.
- **Papel** troca entre os temas Claro, Sépia e Escuro.

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

Ao lado de **Modo Poeta** há ainda o botão de **tela cheia**, com os quatro cantos: ele esconde as abas e a barra de endereço do navegador e deixa só a folha. Clique de novo — ou pressione \`Esc\` — para voltar.

O navegador guarda o zoom escolhido e o aplica sempre que você voltar ao Escritor, mesmo depois de fechar. Nada disso altera o documento: o arquivo salvo ou exportado sai igual, qualquer que seja o zoom da tela.
`;

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
editor.value = (seuTexto && guardado && guardado.trim()) ? guardado : GUIA;

aplicarPrefs();
if (prefs.visualizando) definirVisualizacao(true);
else desenhar();
requestAnimationFrame(atualizarRegua);

editor.focus();
editor.setSelectionRange(0, 0);
scroller.scrollTop = 0;
if (prefs.maquina) centralizarCursor();
