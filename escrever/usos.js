/* ═══════════════════════════════════════════════════════════
   Escritor · usos
   ─────────────────────────────────────────────────────────
   Palavras que existem, mas estão no lugar da outra: os quatro
   porquês, senão e se não, demais e de mais, a fim e afim, onde e
   aonde, mas e mais, mal e mau, tampouco e tão pouco, ao encontro de
   e de encontro a. O dicionário não pega nenhuma delas, porque todas
   estão escritas certo.

   Cada regra só dispara quando o contexto deixa claro qual das duas
   era a certa. Na dúvida, fica quieta: um alarme falso custa mais
   que um erro que passa (o mesmo critério da lista ERROS do app.js).

   acharUsos(texto, cursor) devolve [{ ini, fim, certa, dica, msg }]:
   o trecho a trocar, a forma certa, um lembrete curto para o rodapé
   e a explicação inteira para o botão direito.
   ═══════════════════════════════════════════════════════════ */

const USOS = (() => {
  const L = 'A-Za-zÀ-ÖØ-öø-ÿ';
  const A = `(?<![${L}])`;          // borda antes
  const D = `(?![${L}])`;           // borda depois
  const lista = (s) => new Set(s.trim().split(/\s+/));

  /* Artigos que pedem o substantivo: o porquê, do porquê, pelo porquê.
     Ficam de fora "este", "outro", "um", "meu": em "Escolhi este porque
     é melhor" ou "Usei o meu porque o seu quebrou" eles são pronomes. */
  const DET = lista(`o os do dos no nos pelo pelos ao aos`);
  /* verbos de pergunta indireta: não sei por que, explique por que */
  const INDAGA = lista(`sei sabe sabem sabia sabiam saber sabemos soube souberam saiba
    entendo entende entendem entendi entendeu entender entenda compreendo compreende compreender
    pergunto pergunta perguntam perguntou perguntei perguntar perguntamos pergunte
    explica explicar explicou explique explico explicam esclarecer esclareceu esclarece
    descobrir descobri descobriu descobre imagino imagina imaginar imaginam
    diga digam dizer disse disseram diz dizem conta contar contou conte contam
    mostrar mostra mostrou mostre revela revelar revelou justificar justifica justificou
    questiono questiona questionar questionou indaga indagar indagou investigar investiga
    vejo veja ver vê viu entendesse soubesse`);
  /* o porquê do "pelo qual": o motivo por que, a razão por que */
  const MOTIVO = lista(`motivo motivos razão razões causa causas caminho caminhos rua ruas estrada
    estradas ponte pontes túnel porta portas lugar lugares situação situações momento momentos
    fase fases processo processos luta lutas crise crises dificuldades apuros mudanças etapas
    isso eis daí aí ideal ideais`);
  /* verbos e nomes que regem "por": passar por, lutar por, optar por */
  const REGE_POR = /^(pass|lut|opt|esper|torc|anse|clam|zel|troc|substitu|cham|procur|começ|termin|interess|apaixon|respons|preocup|sofr|morr|orient|guiad|movid|tomad|pag|venc|cobr|vot|ped|reza|agradec|desculp)/;
  const SUJ_OU_VERBO = lista(`eu tu ele ela nós vós eles elas você vocês a gente
    não já ainda sempre nunca só também me te se lhe nos
    estava estou está estão estavam tinha tenho tem têm tinham era é são eram foi fui foram
    precisava preciso precisa queria quero quer gostava gosto gosta sabia sei sabe
    achei acho achava pensei penso pensava vi vejo senti sinto sentia fiquei fico ficava`);
  const NEGA = /(?<![A-Za-zÀ-ÖØ-öø-ÿ])(não|nem|nunca|jamais|nada|ninguém|nenhum|nenhuma)(?![A-Za-zÀ-ÖØ-öø-ÿ])/i;

  /* futuro do subjuntivo e afins: se não for, se não tiver, se não chover */
  const SE_COND = lista(`for forem formos tiver tiverem tivermos houver houverem puder puderem pudermos
    quiser quiserem quisermos der derem fizer fizerem vier vierem souber souberem estiver estiverem
    chover conseguir conseguirem chegar chegarem vier couber disser disserem trouxer trouxerem
    vir virem fosse fossem tivesse tivessem houvesse pudesse quisesse soubesse estivesse
    der fizesse viesse quiser for`);
  const NAO_VERBO_R = lista(`melhor pior maior menor amor por mulher qualquer senhor favor valor lugar mar ar
    colher prazer poder dever ser ter mais`);

  /* "Esse tema é afim ao outro" está certo: o "ser" fica de fora. */
  const ESTAR_FICAR = lista(`estou tô to tou está tá estava estavam estamos estão estive esteve estiveram
    estar estiver estivesse esteja fico fica ficou fiquei ficam ficar ficava ficamos
    ando anda andava`);

  const PARADO = lista(`mora moram morava moravam moro moramos morar fica ficam ficava ficavam fico ficar
    está estão estava estavam estou estamos estar vive vivem vivia vivo viver trabalha trabalham
    trabalhava trabalho estuda estudam estudava estudo nasceu nasci nasce nasceram guardou guardei
    guardo guarda guardaram deixou deixei deixo deixaram colocou coloquei coloco coloca colocaram
    pôs botou botei encontra encontro encontrou encontrei achou achei acha acho comprou comprei
    compra compro é são era eram mora dorme dormiu dormi dormem esconde escondeu escondi`);
  const MOVIMENTO = lista(`vai vão vou vamos iremos irá irão ia iam ir chega chegou chegam chegaram chegar
    chegamos leva levou levam levar levamos dirige dirigiu dirigem dirigir corre correu correm correr
    retorna retornou voltar volta voltou voltam`);
  const INFINITIVO = /^[a-zà-ú]{2,}(ar|er|ir|or|ôr)$/;

  const INTENSO = lista(`bom boa bons boas lindo linda lindos lindas legal legais bonito bonita caro cara
    caros caras longe cedo tarde rápido rápida devagar grande grandes pequeno pequena forte fraco
    alto alta baixo baixa muito fala falou falei falam come comeu comi comem bebe bebeu bebi bebem
    trabalha trabalhou trabalhei pensa pensou pensei demorou demora demoram cansado cansada chato
    chata difícil fácil feliz triste quente frio fria gostoso gostosa bem mal sério séria lento
    lenta pesado pesada esperto esperta bobo boba fofo fofa incrível perfeito perfeita`);

  const MAL_VERBOS = lista(`passou passei passa passo passam passando passar estou está estava estão
    estavam ficou fiquei fica ficam ficando dormi dormiu dorme dormimos dormindo comi comeu come comendo
    fez faz feito feita feitos feitas ouviu ouvi ouço ouve escuto escuta vejo vê enxergo enxerga
    escreve escreveu escrevi escrito escrita fala falou falei falando cheira cheirou sente sentiu senti
    sinto tratou trata tratado tratada educado educada pago paga pagou interpretou interpreta
    entendido entendida visto vista explicado explicada acabou acabado começou começado
    canta cantou toca tocou dirige dirigiu joga jogou saiu`);
  const NOMES_MAU = lista(`exemplo exemplos hábito hábitos humor gosto caráter tempo negócio negócios
    aluno alunos motorista motoristas uso cheiro sinal presságio pagador pagadores elemento elementos
    olhado agouro jeito momento menino menina profissional profissionais funcionário funcionários
    resultado resultados desempenho comportamento comportamentos trabalho atendimento serviço`);

  const NOMES_ACORDO = `(?:minhas?|suas?|nossas?|tuas?|meus?|seus?|nossos?|teus?|essas?|esses?|estas?|estes?)?\\s*(?:ideia|ideias|expectativa|expectativas|anseio|anseios|desejo|desejos|necessidade|necessidades|interesse|interesses|objetivo|objetivos|proposta|propostas|opinião|opiniões|pensamento|pensamentos|vontade|vontades|sonho|sonhos|demanda|demandas|valores|propósito|propósitos|princípios|missão|visão|plano|planos|meta|metas|pedido|pedidos|gosto|gostos)`;
  const NOMES_CHOQUE = `(?:um|uma|o|a)?\\s*(?:muro|muros|parede|paredes|poste|postes|chão|árvore|árvores|carro|carros|caminhão|ônibus|pedra|pedras|rochas?|grade|portão|vidro|mureta|meio-fio|calçada|barranco|morro|pilar|coluna)`;

  const DE_PARA_A = { de: 'a', da: 'à', do: 'ao', das: 'às', dos: 'aos' };
  const A_PARA_DE = { a: 'de', 'à': 'da', ao: 'do', 'às': 'das', aos: 'dos' };

  /* Regras de expressão: o trecho a trocar vem no grupo "x"; o resto é
     contexto. certa pode ser texto ou função do casamento. */
  const R = (fonte) => new RegExp(fonte, 'gid');
  const REGRAS = [
    /* ── senão / se não ── */
    { re: R(`${A}(?<x>senão)\\s+(?<v>[${L}]+)${D}`), teste: (m) => {
        const v = m.groups.v.toLowerCase();
        return SE_COND.has(v) || (/(arem|erem|irem|armos|ermos|irmos)$/.test(v));
      }, certa: 'se não', dica: 'condição: caso não',
      msg: '“Se não”, separado, é condição (caso não): “Se não chover, iremos à praia.” “Senão”, junto, quer dizer caso contrário: “Estude, senão vai reprovar.”' },
    { re: R(`${A}(?<x>senão)\\s+(?:me|te|nos)\\s+(?:engano|enganas|engana|enganamos|falha|falhe|falhar)${D}`),
      certa: 'se não', dica: 'condição: caso não',
      msg: '“Se não me engano” é condição (caso eu não me engane), por isso separado.' },
    { re: R(`,\\s*(?<x>se não)\\s+(?:vai|vou|vão|vamos|irá|irão|iremos|você\\s+vai|a\\s+gente\\s+vai|eu\\s+vou)${D}`),
      certa: 'senão', dica: 'caso contrário',
      msg: '“Senão”, junto, quer dizer caso contrário, do contrário: “Estude, senão vai reprovar.” “Se não”, separado, é condição: “Se não chover…”.' },
    { re: R(`${A}(?:outra\\s+coisa|nada\\s+mais|outro|outra)\\s+(?<x>se não)\\s+(?<v>[${L}]+)${D}`),
      teste: (m) => !SE_COND.has(m.groups.v.toLowerCase()),
      certa: 'senão', dica: 'a não ser',
      msg: '“Senão”, junto, também quer dizer a não ser: “Não fez outra coisa senão reclamar.”' },

    /* ── demais / de mais ── */
    { re: R(`${A}nada\\s+(?<x>demais)${D}`), certa: 'de mais', dica: 'o oposto de “de menos”',
      msg: '“De mais”, separado, é o oposto de “de menos”: “Não vejo nada de mais nisso.” “Demais”, junto, é muito ou os outros: “Ela fala demais.”' },
    { re: R(`${A}(?:os|as|aos|às|dos|das|pelos|pelas|nos|nas)\\s+(?<x>de mais)${D}`), certa: 'demais', dica: 'os outros',
      msg: '“Os demais”, junto, quer dizer os outros: “Os demais alunos saíram.”' },
    { re: R(`${A}(?<p>[${L}]+)\\s+(?<x>de mais)${D}`), teste: (m) => INTENSO.has(m.groups.p.toLowerCase()),
      certa: 'demais', dica: 'muito',
      msg: '“Demais”, junto, quer dizer muito: “Ela fala demais.” “De mais”, separado, é o oposto de “de menos”: “nada de mais”.' },

    /* ── a fim / afim ── */
    { re: R(`${A}(?<x>afim)\\s+de${D}`), certa: 'a fim', dica: 'finalidade ou vontade',
      msg: '“A fim de”, separado, indica finalidade ou vontade: “Estou a fim de descansar.” “Afim”, junto, é adjetivo (semelhante): “ideias afins”.' },
    { re: R(`${A}(?<e>[${L}]+)\\s+(?<x>afim)${D}(?!\\s+de${D})`), teste: (m) => ESTAR_FICAR.has(m.groups.e.toLowerCase()),
      certa: 'a fim', dica: 'estar a fim',
      msg: '“Estar a fim” (com vontade) se escreve separado. “Afim”, junto, é adjetivo: “ideias afins”.' },
    { re: R(`${A}(?<x>a fins)(?=\\s*(?:[.,;:!?…)]|$))`), certa: 'afins', dica: 'semelhantes',
      msg: '“Afins”, junto, é adjetivo (semelhantes, com afinidade): “Temos ideias afins.”' },

    /* ── mas / mais ── */
    { re: R(`,\\s*(?<x>mais)\\s+(?:não|nunca|nem|eu|tu|ele|ela|nós|eles|elas|você|vocês|isso|aquilo|também|sim|agora|depois|infelizmente|felizmente|mesmo\\s+assim|acabou|acabei|acabamos|o\\s+problema|a\\s+verdade)${D}`),
      certa: 'mas', dica: 'porém',
      msg: '“Mas” indica oposição (porém): “Tentei, mas não consegui.” “Mais” é quantidade, o oposto de “menos”.' },
    { re: R(`${A}cada\\s+vez\\s+(?<x>mas)${D}`), certa: 'mais', dica: 'o oposto de “menos”',
      msg: '“Mais” é intensidade ou soma, o oposto de “menos”: “cada vez mais”.' },
    { re: R(`${A}(?<x>mas)\\s+ou\\s+menos${D}`), certa: 'mais', dica: 'o oposto de “menos”',
      msg: '“Mais ou menos”: “mais” é o oposto de “menos”.' },
    { re: R(`${A}nunca\\s+(?<x>mas)${D}`), certa: 'mais', dica: 'nunca mais',
      msg: '“Nunca mais”: aqui é intensidade, então “mais”.' },
    { re: R(`(?<![,;]\\s*)${A}(?<x>mas)\\s+(?:de\\s+\\d|tarde${D}(?!\\s+demais))`), certa: 'mais', dica: 'o oposto de “menos”',
      msg: '“Mais” é quantidade ou tempo, o oposto de “menos”: “mais de 10”, “mais tarde”. “Mas” quer dizer porém.' },
    { re: R(`${A}(?:o|a|os|as)\\s+(?<x>mas)\\s+(?<j>[${L}]+)${D}`),
      teste: (m) => { const j = m.groups.j.toLowerCase(); return /(ante|ível|ável|oso|osa|ico|ica|ado|ada|ido|ida)$/.test(j) || /^(importante|bonito|bonita|novo|nova|velho|velha|alto|alta|baixo|baixa|legal|difícil|fácil|rápido|rápida|lindo|linda|forte|caro|cara|barato|barata|perto|longe)$/.test(j); },
      certa: 'mais', dica: 'superlativo',
      msg: '“O mais importante”: é intensidade, então “mais”. “Mas” quer dizer porém.' },

    /* ── mal / mau ── */
    { re: R(`${A}(?<v>[${L}]+)\\s+(?:muito\\s+|tão\\s+|bem\\s+)?(?<x>mau)${D}`), teste: (m) => MAL_VERBOS.has(m.groups.v.toLowerCase()),
      certa: 'mal', dica: 'o oposto de “bem”',
      msg: '“Mal” é o oposto de “bem”: “Ele passou mal ontem.” “Mau” é o oposto de “bom”: “um mau exemplo”.' },
    { re: R(`${A}(?<x>mal)\\s+(?<n>[${L}]+)${D}`), teste: (m) => NOMES_MAU.has(m.groups.n.toLowerCase()),
      certa: (m) => /s$/i.test(m.groups.n) && m.groups.n.toLowerCase() !== 'ônibus' ? 'maus' : 'mau', dica: 'o oposto de “bom”',
      msg: '“Mau” é o oposto de “bom”: “Ele é um mau exemplo.” “Mal” é o oposto de “bem”: “passou mal”.' },

    /* ── tampouco / tão pouco ── */
    { re: R(`(?:[,;]\\s*|${A}(?:e|nem)\\s+)(?<x>tão pouco)\\s+(?<v>[${L}]+)${D}`),
      teste: (m, frase, antes) => {
        if (!NEGA.test(antes)) return false;
        const v = m.groups.v.toLowerCase();
        if (/^(tempo|dinheiro|espaço|esforço|caso|que|quanto|assim|a|o|as|os|de|para|da|do)$/.test(v)) return false;
        return /^(eu|tu|ele|ela|nós|eles|elas|você|vocês|me|se|te|lhe|isso|aquilo)$/.test(v)
          || /^(fiz|fez|faço|faz|fui|foi|vou|vai|tive|teve|tenho|tem|sei|sabe|disse|diz|pude|pôde|quis|quer|vi|viu|li|leu|dei|deu|pus|pôs|trouxe)$/.test(v)
          || /(ei|ou|iu|eu|am|em|ava|avam|ia|iam|ar|er|ir)$/.test(v);
      },
      certa: 'tampouco', dica: 'também não',
      msg: '“Tampouco”, junto, quer dizer também não: “Não estudei, tampouco fiz o trabalho.” “Tão pouco”, separado, é quantidade muito pequena.' },
    { re: R(`${A}(?:por|com|de|para)\\s+(?<x>tampouco)${D}`), certa: 'tão pouco', dica: 'quantidade pequena',
      msg: '“Tão pouco”, separado, é quantidade muito pequena: “por tão pouco”. “Tampouco” quer dizer também não.' },
    { re: R(`${A}(?<x>tampouco)\\s+(?:tempo|dinheiro|espaço|esforço|caso)${D}`), certa: 'tão pouco', dica: 'quantidade pequena',
      msg: '“Tão pouco”, separado, é quantidade muito pequena: “tão pouco tempo”. “Tampouco” quer dizer também não.' },
    { re: R(`${A}(?<x>tampouco)(?=\\s*(?:[.!?…]|$))`), teste: (m, frase, antes) => !NEGA.test(antes),
      certa: 'tão pouco', dica: 'quantidade pequena',
      msg: '“Tão pouco”, separado, é quantidade muito pequena: “Ele dormiu tão pouco.” “Tampouco”, junto, quer dizer também não.' },

    /* ── ao encontro de / de encontro a ── */
    { re: R(`${A}(?<x>de\\s+encontro\\s+(?<p>a|à|às|ao|aos))\\s+${NOMES_ACORDO}${D}`),
      certa: (m) => 'ao encontro ' + A_PARA_DE[m.groups.p.toLowerCase()], dica: 'a favor, concordando',
      msg: 'Confira o sentido. “Ao encontro de” é concordar, ir a favor: “Sua ideia vai ao encontro da minha.” “De encontro a” é ir contra, chocar-se: “O carro foi de encontro ao muro.”' },
    { re: R(`${A}(?<x>ao\\s+encontro\\s+(?<p>de|da|do|das|dos))\\s+${NOMES_CHOQUE}${D}`),
      certa: (m) => 'de encontro ' + DE_PARA_A[m.groups.p.toLowerCase()], dica: 'chocar-se com',
      msg: '“De encontro a” é chocar-se, ir contra: “O carro foi de encontro ao muro.” “Ao encontro de” é ir a favor, concordar.' },
    { re: R(`${A}(?<x>ao\\s+encontro\\s+(?<p>a|à|às|ao|aos))${D}`),
      certa: (m) => 'ao encontro ' + A_PARA_DE[m.groups.p.toLowerCase()], dica: 'a favor: ao encontro de',
      msg: 'Ou “ao encontro de” (a favor, concordando) ou “de encontro a” (contra, chocando-se). As duas não se misturam.' },
    { re: R(`${A}(?<x>de\\s+encontro\\s+(?<p>de|da|do|das|dos))${D}`),
      certa: (m) => 'de encontro ' + DE_PARA_A[m.groups.p.toLowerCase()], dica: 'contra: de encontro a',
      msg: 'Ou “de encontro a” (contra, chocando-se) ou “ao encontro de” (a favor, concordando). As duas não se misturam.' },
  ];

  /* Os quatro porquês e onde/aonde dependem do que vem antes e depois;
     ficam numa varredura própria, palavra por palavra. */
  function porques(t, achar){
    const re = new RegExp(`${A}(?:por\\s+qu[eê]|porqu[eê]s?)${D}`, 'gi');
    let m;
    while ((m = re.exec(t))){
      const ini = m.index, fim = ini + m[0].length;
      const forma = m[0].toLowerCase().replace(/\s+/g, ' ');
      const ctx = contexto(t, ini, fim);
      const { antes1, depois1, depoisChar, inicioFrase, pergunta, fimDaFrase } = ctx;
      // "Fi-lo porque quis": o "o" do hífen é pronome, não artigo
      const det = DET.has(antes1) && !ctx.antesHifen;
      const ponha = (certa, dica, msg) => achar(ini, fim, certa, dica, msg);

      if (forma === 'porques'){
        ponha('porquês', 'substantivo', '“Porquês”, junto e com acento, é o substantivo: “os porquês da questão”.');
        continue;
      }
      if (forma === 'porquês') continue;
      // o porquê, um porquê: substantivo, junto e com acento
      if (det){
        if (forma !== 'porquê') ponha('porquê', 'substantivo: o porquê',
          '“Porquê”, junto e com acento, é substantivo e vem com artigo: “Não entendi o porquê da decisão.”');
        continue;
      }
      if (forma === 'porquê'){
        if (fimDaFrase) ponha('por quê', 'no fim da pergunta',
          '“Por quê”, separado e com acento, fecha a frase: “Você saiu por quê?” “Porquê”, junto, só como substantivo: “o porquê”.');
        // "(por que, porque, porquê)": a palavra citada, não usada
        else if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(depoisChar)) continue;
        else if ((inicioFrase && pergunta) || INDAGA.has(antes1)) ponha('por que', 'pergunta: por que',
          '“Por que”, separado, faz a pergunta: “Por que você saiu?”, “Não sei por que ele saiu.” “Porquê”, junto e com acento, só como substantivo.');
        else ponha('porque', 'explica a causa',
          '“Porque”, junto e sem acento, explica a causa (pois): “Saí porque estava cansado.” “Porquê” com acento só como substantivo: “o porquê”.');
        continue;
      }
      if (forma === 'por quê'){
        if (!fimDaFrase && /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(depoisChar)) ponha('por que', 'acento só no fim',
          '“Por quê” leva acento só no fim da frase. No começo ou no meio, “por que”: “Por que você saiu?”');
        continue;
      }
      if (forma === 'por que'){
        if (fimDaFrase){
          ponha('por quê', 'no fim, com acento', '“Por quê”, separado e com acento, fecha a frase: “Você saiu por quê?”, “Não sei por quê.”');
          continue;
        }
        if (inicioFrase || pergunta) continue;
        if (INDAGA.has(antes1) || MOTIVO.has(antes1) || REGE_POR.test(antes1)) continue;
        if (/^(razão|motivo|causa|razões|motivos)$/.test(depois1)) continue;
        // por que explicando a causa: "Fui embora por que estava cansado."
        if (SUJ_OU_VERBO.has(depois1) && (ctx.antesChar === ',' || /(ei|ou|iu|eu|i|amos|emos|imos|ava|ia|o|a|e)$/.test(antes1)))
          ponha('porque', 'explica a causa',
            '“Porque”, junto, explica a causa e equivale a pois: “Saí porque estava cansado.” “Por que”, separado, é pergunta: “Por que você saiu?”');
        continue;
      }
      if (forma === 'porque'){
        if (/^\s*\?/.test(t.slice(fim, fim + 3))){
          ponha('por quê', 'no fim da pergunta', '“Por quê”, separado e com acento, fecha a pergunta: “Você saiu por quê?”');
          continue;
        }
        if (inicioFrase && pergunta){
          ponha('por que', 'pergunta: por que', '“Por que”, separado, faz a pergunta: “Por que você saiu?” “Porque”, junto, é resposta: “Porque estava cansado.”');
          continue;
        }
        if (/^(razão|motivo|causa|razões|motivos)$/.test(depois1)){
          ponha('por que', 'por que razão', '“Por que razão”: aqui é “pelo qual”, separado.');
          continue;
        }
        if (/^(motivo|motivos|razão|razões|causa|causas)$/.test(antes1)){
          ponha('por que', 'pelo qual', '“O motivo por que” equivale a “o motivo pelo qual”, separado.');
          continue;
        }
        const indireta = /^(pergunto|pergunta|perguntou|perguntei|perguntar|perguntam|questiono|questiona|questionou|explique|explicar|esclarecer|descobrir|imagino|compreender|entender)$/.test(antes1)
          || (/^(sei|sabe|sabem|sabia|sabiam|saber|entendo|entendi|entende|entendeu|sabemos)$/.test(antes1) && new RegExp(`(?:não|ninguém|nunca|nem)\\s+[${L}]+\\s*$`, 'i').test(ctx.antes));
        if (indireta){
          ponha(fimDaFrase ? 'por quê' : 'por que', 'pergunta indireta',
            'Pergunta indireta também é separada: “Não sei por que ele saiu.” “Porque”, junto, explica a causa.');
        }
      }
    }
  }

  function ondes(t, achar){
    const re = new RegExp(`${A}(aonde|onde)${D}`, 'gi');
    let m;
    while ((m = re.exec(t))){
      const ini = m.index, fim = ini + m[0].length;
      const forma = m[0].toLowerCase();
      const ctx = contexto(t, ini, fim);
      const prox = ctx.depois.slice(0, 4);
      if (forma === 'aonde'){
        const i = prox.slice(0, 3).findIndex(w => PARADO.has(w));
        if (i < 0) continue;
        if (prox.slice(0, 4).some(w => MOVIMENTO.has(w))) continue;
        achar(ini, fim, 'onde', 'lugar fixo',
          '“Onde” é lugar fixo, permanência: “Onde você mora?” “Aonde” é destino, com verbos de movimento: “Aonde você vai?”');
      } else {
        if (/^(de|por|para|pra|até|daí|aí)$/.test(ctx.antes1)) continue;
        const i = prox.slice(0, 3).findIndex(w => MOVIMENTO.has(w));
        if (i < 0) continue;
        const depoisDoVerbo = prox[i + 1] || '';
        if (INFINITIVO.test(depoisDoVerbo) || /^(ser|ter|ver|pôr|dar|estar|ficar|morar)$/.test(depoisDoVerbo)) continue;
        if (/^(ia|iam|ir)$/.test(prox[i]) && !ctx.pergunta) continue;
        achar(ini, fim, 'aonde', 'destino, movimento',
          '“Aonde” indica destino, com verbos de movimento (ir a, chegar a): “Aonde você vai?” “Onde” é lugar fixo: “Onde você mora?”');
      }
    }
  }

  /* O que cerca o trecho: a palavra antes e as de depois, e a frase. */
  function contexto(t, ini, fim){
    let a = ini;
    while (a > 0 && !/[.!?…\n]/.test(t[a - 1])) a--;
    let b = fim;
    while (b < t.length && !/[.!?…\n]/.test(t[b])) b++;
    const fechaCom = t[b] || '';
    const antes = t.slice(a, ini);
    const depois = t.slice(fim, b);
    const palavrasAntes = antes.match(new RegExp(`[${L}]+`, 'g')) || [];
    const palavrasDepois = (depois.match(new RegExp(`[${L}]+(?:-[${L}]+)*`, 'g')) || []).map(w => w.toLowerCase());
    return {
      antes, depois: palavrasDepois,
      antes1: (palavrasAntes[palavrasAntes.length - 1] || '').toLowerCase(),
      depois1: palavrasDepois[0] || '',
      antesChar: (antes.match(/\S(?=\s*$)/) || [''])[0],
      antesHifen: new RegExp(`-[${L}]+\\s*$`).test(antes),
      depoisChar: (depois.match(/\S/) || [''])[0],
      inicioFrase: !/\S/.test(antes.replace(/^[\s"“'‘(—–-]+/, '')) || /^[\s"“'‘(—–-]*$/.test(antes),
      pergunta: fechaCom === '?',
      fimDaFrase: /^[\s"”'’)]*(?:[.!?…:;]|$)/.test(t.slice(fim, b + 1)) && !/[A-Za-zÀ-ÖØ-öø-ÿ0-9]/.test(depois),
    };
  }

  /* Trechos que não são texto corrido: código, ligações, links,
     comentários e endereços viram espaços (as posições não mudam). */
  function limpar(texto){
    const branco = (s) => s.replace(/[^\n]/g, ' ');
    return texto
      .replace(/```[\s\S]*?(?:```|$)/g, branco)
      .replace(/`[^`\n]*`/g, branco)
      .replace(/\[\[[^\]\n]*\]\]/g, branco)
      .replace(/\]\([^)\n]*\)/g, branco)
      .replace(/%%[^%\n]*%%/g, branco)
      .replace(/https?:\/\/\S+/g, branco)
      .replace(/\$[^$\n]+\$/g, branco);
  }

  function acharUsos(texto, cursor = -1){
    const t = limpar(texto);
    const achados = [];
    const vistos = new Set();
    const achar = (ini, fim, certa, dica, msg) => {
      const chave = ini + ':' + fim;
      if (vistos.has(chave)) return;
      vistos.add(chave);
      achados.push({ ini, fim, errada: texto.slice(ini, fim), certa, dica, msg });
    };
    porques(t, achar);
    ondes(t, achar);
    for (const r of REGRAS){
      r.re.lastIndex = 0;
      let m;
      while ((m = r.re.exec(t))){
        if (m[0] === ''){ r.re.lastIndex++; continue; }
        const [ini, fim] = m.indices.groups.x;
        // a vírgula do contexto pode ter consumido o começo do próximo
        r.re.lastIndex = Math.max(m.index + 1, fim);
        if (r.teste){
          let a = ini;
          while (a > 0 && !/[.!?…\n]/.test(t[a - 1])) a--;
          if (!r.teste(m, t.slice(a, fim), t.slice(a, ini))) continue;
        }
        const certa = typeof r.certa === 'function' ? r.certa(m) : r.certa;
        achar(ini, fim, certa, r.dica, r.msg);
      }
    }
    /* A frase que ainda está sendo escrita espera o ponto final: sem
       isso o "por que" do começo de uma pergunta seria marcado antes
       de o ponto de interrogação chegar. */
    let filtrados = achados;
    if (cursor >= 0){
      filtrados = achados.filter(u => {
        let b = u.fim;
        while (b < t.length && !/[.!?…\n]/.test(t[b])) b++;
        const fechada = b < t.length && t[b] !== '\n';
        if (fechada) return true;
        let a = u.ini;
        while (a > 0 && !/[.!?…\n]/.test(t[a - 1])) a--;
        return !(cursor >= a && cursor <= b);
      });
    }
    return filtrados.sort((x, y) => x.ini - y.ini);
  }

  return { acharUsos };
})();

const acharUsos = USOS.acharUsos;
