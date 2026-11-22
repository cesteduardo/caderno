# Escritor 2.7.2

Um caderno de escrita e estudo em Markdown, no espírito do [iA Writer](https://ia.net/writer): folha limpa, barra que some enquanto você escreve, Markdown realçado sem transformar o texto. A versão 2.0 transforma a folha única num caderno: várias notas, grifo e notas de rodapé no botão direito, imagens coladas, pasta do Obsidian e uma interface inteira redesenhada no estilo do macOS e do GNOME.

Abra `index.html` no navegador. Não há build, dependência nem servidor; funciona offline, com as fontes e os ícones incluídos.

```bash
# opcional, se preferir servir por HTTP
python3 -m http.server 8000
```

Na primeira abertura aparece o **Guia do Escritor**, um texto que explica o aplicativo escrito nele mesmo. A primeira coisa que você escrever vira uma nota sua.

---

## Na 2.7

- **Sons do teclado (2.7.1):** uma seção nova no Personalizar, **Sons**, faz cada tecla soar como um teclado mecânico, com **gravações reais** de sete switches: os lineares **Vermelho** (Gateron Red Ink), **Amarelo** (Alpaca), **Preto** (Cherry MX Black) e **Creamy** (NovelKeys Cream), os táteis **Marrom** (Cherry MX Brown) e **Roxo** (Holy Panda) e o clicky **Azul** (Cherry MX Blue). Cada fileira do teclado tem a sua gravação, o Espaço, o Enter e o Backspace têm as deles, e soltar a tecla toca a volta. Escolher um switch já liga o som; segurar a tecla não repete. O volume é próprio do Escritor, e o menu **Ferramentas** liga e desliga sem fechar.
- As gravações são do [kbsim](https://github.com/tplai/kbsim), de Thomas Lai, sob licença MIT (cópia em `sons/LICENCA-kbsim.md`). Não há gravação aberta do Gateron Yellow; o Amarelo usa a do Alpaca, outro linear liso. Os arquivos de um switch só são baixados quando ele é escolhido (uns 45 KB).
- A 2.7.0 gerava os sons por síntese no navegador e foi trocada: não soava como teclado de verdade.
- **Na 2.7.2** o som sai mais rápido: cada gravação começa direto na batida (o MP3 trazia até 22 ms mudos antes dela), a tecla toca sem esperar nada depois que o switch carregou, e o áudio já acorda no primeiro clique, então nem a primeira tecla atrasa.

## Na 2.6

- **Porquês e outras trocas:** o corretor agora também acha palavras que existem, mas estão no lugar da outra. São os quatro porquês (por que, porque, por quê, porquê) e as expressões que mudam de sentido conforme a escrita: senão e se não, demais e de mais, a fim e afim, onde e aonde, mas e mais, mal e mau, tampouco e tão pouco, ao encontro de e de encontro a. Elas ganham um ondulado azul (o vermelho continua para palavra que não existe). Com o cursor em cima, o rodapé mostra a troca e um lembrete curto da regra, e `Ctrl+;` troca. O botão direito traz a troca e a explicação inteira, com exemplo. Cada regra só dispara quando o contexto deixa claro qual forma era a certa; a frase que você ainda está escrevendo espera o ponto final. As regras ficam em `usos.js`.
- **Pop-ups padronizados (2.6.1):** todos seguem o modelo das Notas: o **X** em cima e, no rodapé, para que o pop-up serve à esquerda e **Esc fechar** à direita. Valem para Foco, Realce, Ferramentas, Documento, Personalizar, Sumário, Pontos de atenção, Comentários, Notas, as perguntas de confirmação, o Sobre e o painel de Ligações do Caderno. O Esc fecha mesmo com algo escrito na busca, e as perguntas e o Sobre trocaram o chip "esc" pelo X. E um defeito antigo saiu: às vezes o Personalizar ou as Notas abriam e fechavam sozinhos logo em seguida, porque o fechar anterior deixava um ouvinte de animação armado, e a animação de entrada da abertura seguinte o disparava.
- **Visualizar com peso de verdade:** a leitura "um pouco mais cheia" da 2.5 era um traço desenhado por cima da letra, o que só a duplicava. Saiu. O Visualizar usa agora as iA Writer **variáveis** (o mesmo desenho, com peso de 400 a 700) no peso 460, levemente mais encorpado que a escrita. Na fonte Sans vai a Inter Medium; a Legível só tem 400 e 700 e fica no 400.
- **Máquina de escrever:** a marca invisível que a máquina põe no cursor era um `inline-block`, e isso abria um ponto de quebra no meio da palavra. Perto do fim da linha, a palavra pulava de linha só no desenho, e a seleção (por letra, por palavra) deixava de cair em cima das letras. Agora a marca não interfere na quebra. E a folha passou a acompanhar a **ponta** da seleção, e não o começo: com `Shift+↓` ou `Ctrl+Shift+→` a seleção não some mais embaixo da tela, e depois de `Ctrl+A` e uma seta o cursor volta para a vista. Clique, duplo clique, triplo clique, arrastar e `Ctrl+A` continuam sem mexer na página.

## Na 2.5

- **Corretor ortográfico de verdade:** antes o sublinhado vermelho vinha do corretor do navegador, que só funciona com um dicionário de português instalado no sistema. Sem ele, "onibus" passava sem marca. Agora o Escritor traz o próprio corretor: o **Hunspell** (o do LibreOffice e do Firefox) em WebAssembly, com o dicionário **VERO** de português do Brasil, rodando num Web Worker para a digitação nunca esperar. Ele carrega sozinho ao abrir (cerca de 1,3 MB comprimido, guardado para funcionar offline).
  - A palavra que você ainda está digitando não é julgada; o sublinhado aparece quando você sai dela.
  - Com o cursor numa palavra errada, a primeira sugestão aparece no rodapé (`Ctrl+;` troca). O botão direito mostra até três sugestões e **Adicionar ao dicionário**, que guarda a palavra neste navegador.
  - Siglas (ONU, PDF), nomes com maiúscula no meio (WhatsApp, iPhone), ligações `[[…]]`, etiquetas, notas e equações ficam de fora. Palavras do dia a dia que o VERO de 2013 não conhece (ok, e-mail, app, podcast, Instagram…) passam sem sublinhado.
  - A lista de erros clássicos (`concerteza`, `excessão`…) continua, com a troca certa na frente.
  - Com o corretor próprio ligado, o do navegador sai, para não haver dois sublinhados. Se o próprio não abrir, o do navegador volta.
- **Comentários à vista:** o `%%comentário%%` continua fora da exportação, mas agora dá para encontrá-los. O rodapé conta quantos há; clicar ali, **Ferramentas → Comentários** ou `Ctrl+Shift+/` abre a lista no meio da tela, cada um com o trecho em volta e a linha, e clicar leva até ele, já selecionado. No **Visualizar**, cada comentário vira um pequeno balão no lugar onde está, que se abre para baixo ao passar o mouse ou tocar.
- **Engrenagem das Ferramentas:** na barra, entre a tela cheia e o **⋯**, uma engrenagem abre as **Ferramentas** (Buscar e substituir, Sumário, Comentários, Modo Poeta, Tela cheia e Tamanho da tela). O **⋯ Documento** ficou com três abas: Arquivo, Exportar e Ajuda.
- **Mesmo tamanho sempre:** Ferramentas e Documento abrem com a mesma largura e a mesma altura, e trocar de aba no Documento não estica nem encolhe a janela (as páginas ficam empilhadas e a altura é a da maior).
- **Tamanho da tela (zoom):** nas Ferramentas, **−** e **+** ampliam a interface inteira nos mesmos degraus do zoom do navegador, de 50% a 300% (175% está lá), e **100%** volta ao normal. Fica guardado neste aparelho. Como o navegador não deixa um site mudar o zoom dele, é o `zoom` do CSS na página toda; as contas que misturam medidas de tela com rolagem (máquina de escrever, botão direito, sugestões de `[[`, régua do Poeta) e as alturas em `vh` foram corrigidas para ele.
- **Leitura um pouco mais cheia:** no **Visualizar**, a letra fica levemente mais encorpada do que na escrita (trocado na 2.6 pelo peso da fonte variável).
- **Menus sem texto vazando:** o fundo dos pop-ups da barra e do botão direito ficou quase opaco; no Firefox, quando o desfoque não era desenhado, o texto de trás aparecia através deles.

## Na 2.4

- **Lixeira das notas:** no painel de Notas, um seletor **Notas | Lixeira**. Apagar uma nota manda ela para a Lixeira (o **Desfazer** de alguns segundos continua no lugar do cartão). Lá ela fica por 30 dias, mostrando quando foi apagada e quantos dias faltam, com **Restaurar** e **Apagar de vez**. **Esvaziar lixeira** pede um segundo clique para confirmar. A busca procura também na lixeira, e `Enter` restaura a escolhida.
- **Crédito no Sobre:** "Desenvolvido por GR Brands." saiu do parágrafo das licenças e virou uma linha própria, separada por um fio, com o símbolo da GR Brands e link para grbrands.com.br.
- **Atalhos na linha dos botões:** nos pop-ups, a tecla fica ao lado do interruptor e centrada com ele (Máquina de escrever, Ortografia, Revisão de estilo), e o `Ctrl+G` foi para a ficha "Desligado" das classes. No Personalizar, o `Ctrl+D` fica ao lado do seletor do Modo Foco e o `Ctrl+G` na fileira das classes. No celular eles somem.
- **Contornos inteiros:** os anéis de seleção que encostavam na borda de um grupo (o papel Automático, por exemplo) eram cortados. Agora nada corta contorno nenhum, e a folga entre a miniatura e o anel segue a cor do fundo. Conferido com uma varredura automática em todas as seções, nas Notas, nos pop-ups e no botão direito.
- **Favicon novo de verdade:** o endereço do ícone ganhou a versão, para o navegador trocar o favicon antigo guardado. Desde a 2.4.1 ele não clareia mais quando a aba está selecionada no tema escuro: é sempre o mesmo traço escuro.

## Na 2.3

- **Sexta fonte, Legível:** a **Atkinson Hyperlegible**, do Braille Institute, desenhada para ser lida sem esforço (letras que não se confundem, como l, I e 1). Com ela as fontes fecham duas fileiras de três no Personalizar. Ênfase e títulos pela cor, como na Serifa e na Inter.
- **Campos mais altos e com um contorno só:** busca, nome, link, meta e listas cresceram, e o foco virou uma borda nítida na cor de destaque, sem o halo borrado nem o contorno dobrado.
- **Controles maiores em todos os pop-ups:** seletores, botões, fichas e textos do Personalizar, do Foco, do Realce, do Documento e do botão direito ficaram um pouco maiores, para ler e acertar com mais facilidade.
- **Ícone novo:** o caderno com caneta, o mesmo das Notas do Super Caderno, virou o favicon do Escritor, a marca do "Feito com Escritor" nos arquivos exportados e o ícone das Notas.
- **Notas sem contornos bugados:** cada estado do cartão (nota aberta, escolha pelo teclado, mouse em cima, clique) agora soma a sua camada sem apagar as outras. O anel da escolha só aparece quando se usa o teclado.
- **Nota nova pelo teclado:** abrindo as Notas com `Ctrl+O` e criando uma nota, o que se digitava se perdia. Agora o cursor volta à folha.

## Na 2.2

- **Autoria:** uma seção nova no Personalizar, como o "Set up Authorship" do iA Writer. Você escreve o seu nome do jeito que quiser assinar e, se quiser, um link (site, e-mail ou rede social). Na exportação para HTML, Word e PDF o nome entra na assinatura do fim, logo abaixo do título da obra, como link. O HTML também leva `<meta name="author">`. O “Feito com Escritor” continua. Um e-mail vira `mailto:`, um endereço sem `https://` ganha o protocolo, e qualquer outro tipo de link é recusado (o campo fica vermelho). A seção mostra uma prévia ao vivo, e o nome viaja junto em **Exportar ajustes**, mas o **Voltar ao padrão** não o apaga.
- **Grifar encaixado:** no botão direito, as sete cores viraram fichas na mesma grade das colunas, iguais às de H1 a H6, e o atalho fica ao lado de "Grifar".

## Na 2.1

- **Botão direito num painel só:** a barra de Recortar/Copiar/Colar da 2.0 no alto, o grifo em sete cores e três colunas alinhadas (Formatar, Estudo, Parágrafo) com tudo o que o menu do Obsidian tinha.
- **Máquina de escrever que só desce:** a folha anda para a frente enquanto se digita; clicar e selecionar não mexem na página.
- **Realce alinhado:** as duas colunas do pop-up começam e terminam juntas.
- **Ícone do Obsidian** na seção Obsidian do Personalizar.
- **Personalizar e Notas no desenho do RefBox:** janela do tamanho do conteúdo, título, busca e abas na mesma superfície, abas dividindo a largura por igual, ajustes em linhas soltas (nome à esquerda, controle à direita) e tudo na mesma margem.

## O que há de novo na 2.0

### Notas, sem barra lateral
O botão **Notas** (ou `Ctrl+O`) abre um pop-up no meio da tela com todas as suas notas em cartões: título, começo do texto, quando foi mexida, quantas palavras tem e quantas outras notas a citam. Dá para procurar, abrir com `Enter`, criar uma **Nova nota** (`Ctrl+Alt+N`) e apagar, com **Desfazer** por alguns segundos. Não existe barra lateral: a ideia é a folha inteira para escrever, e o arquivo de verdade morar no Obsidian.

**Ligações entre notas.** `[[Título]]` liga uma nota a outra, como no Obsidian. Escrever `[[` (ou `Ctrl+K`) abre a lista das suas notas; `Ctrl+clique` na ligação, ou um clique nela no Visualizar, abre a nota citada, e cria uma nova com aquele título se ela ainda não existir.

Quem vinha da 1.x não perde nada: o documento único de antes vira a primeira nota na primeira abertura.

### Botão direito: um painel só
Clicar com o botão direito no texto abre, ao lado do mouse, um painel largo que junta o menu da 2.0 com o do Obsidian, sem submenus para caçar:

| Parte | O que tem |
| --- | --- |
| **Barra do alto** | Recortar, Copiar, Colar (também traz imagens), **Sem formato** (`Ctrl+Shift+V`) e **Tudo** (`Ctrl+A`) |
| **Grifar** | sete cores numa fileira: a padrão do tema e vermelho, laranja, amarelo, verde, azul e roxo, gravadas como no Obsidian (`==🟥texto==`) |
| **Formatar** | negrito, itálico, riscado, código, equação, comentário (`Ctrl+/`), limpar formatação |
| **Estudo** | link para nota `[[nota]]` (`Ctrl+K`), link externo, nota de rodapé, destaque (callout), imagem, tabela, régua horizontal |
| **Parágrafo** | fichas H1 a H6 e ¶ (texto), lista, lista numerada, lista de tarefas, citação, bloco de código, equação em bloco |

As três colunas têm sete linhas cada, alinhadas umas com as outras. Pelo teclado, as setas andam pelo painel como numa grade, Enter escolhe e Esc fecha.

No alto, em pílulas, aparece o que depende de onde está o cursor: sobre uma ligação, **Abrir**; sobre um link, **Abrir link**, **Editar link** e **Copiar URL**; sobre uma nota de rodapé, **Ir para a nota** e **Excluir nota e referência**; sobre uma palavra da lista de erros, **Trocar por** a forma certa.

O realce colorido é gravado como no Obsidian, com um emoji logo depois do `==` (`==🟥texto==`), para o arquivo continuar legível em qualquer editor. No Visualizar ele aparece na cor certa, o destaque (`> [!note]`) vira uma caixa e as equações saem em itálico matemático.

No celular, o toque longo continua mostrando o menu do sistema, que já sabe selecionar.

### Imagens coladas
Cole uma imagem (`Ctrl+V`), arraste um arquivo de imagem para a folha ou use **Inserir imagem** no menu Documento. A imagem fica guardada no navegador e o texto recebe `![](anexos/imagem-….png)`. Ela aparece no **Visualizar**, vai **dentro** dos arquivos exportados (HTML, Word, PDF e Copiar HTML) e, com uma pasta do Obsidian ligada, é gravada em `anexos/`, ao lado das notas.

### Menus no meio da tela, largos
Tudo abre como pop-up central, deitado para os lados:

- **Foco:** as quatro maneiras (Desligado, Frase, Parágrafo, Linha) em cartões lado a lado, cada um com um desenho do que fica nítido, e a Máquina de escrever logo abaixo.
- **Realce:** a revisão (ortografia e estilo) numa coluna e as classes gramaticais na outra, cada uma com a bolinha da sua cor.
- **Documento:** quatro abas (**Arquivo, Exportar, Ferramentas, Ajuda**) com uma grade de ícones.

Todo pop-up tem um **×** para fechar (além do `Esc` e do clique fora), e toda busca fica no meio, logo abaixo do título. Nos menus nada acende sozinho: só o que está sob o ponteiro ou sob as setas do teclado, sempre com o mesmo véu de cor. A pílula que desliza fica só onde as opções correm da esquerda para a direita, como nos seletores e nas abas.

### Personalizar
O painel **Aa** (`Ctrl+,`) segue o desenho de ajustes do RefBox: título no centro, × no canto, a busca centralizada e uma fileira de ícones (Estilos, Aparência, Texto, Escrita, Revisão, Tela e meta, **Autoria**, Obsidian, Atalhos e **Amostra**). Cada ícone mostra a sua seção, com bastante espaço; a busca junta as seções e mostra tudo o que bate. A **Amostra** é uma aba inteira: um trecho grande, escrito com tudo o que você escolheu.

A seção **Obsidian** virou um módulo de verdade: estado da pasta, escolher, salvar agora, esquecer, salvar sozinho enquanto escreve e um passo a passo de como funciona.

### Um pacote de ícones só, e a letra Inter
Todos os ícones (barra, menus, Personalizar, botão direito) vêm do **Lucide**, um pacote aberto de ícones de traço, com o mesmo traço e as mesmas pontas em todo lugar. A exceção é a seção Obsidian, que usa a marca do próprio Obsidian (do Simple Icons, CC0). A interface inteira usa a **Inter**. As cores dos quadradinhos do Personalizar continuam as mesmas.

### Correções
- **Modo Foco:** a linha anterior piscava ao passar para a próxima. O destaque só era redesenhado quando a tecla subia; agora anda no mesmo instante que o cursor.
- **Modo Poeta:** o título não conta mais como verso, os números da margem ficaram legíveis e o rodapé mostra “verso 4 de 8 · estrofe 1 de 2”.
- **Seletores:** um clique em qualquer lugar da página reaplicava a fonte e puxava o cursor para o texto.

---

## O que mais tem

**Foco.** Recua tudo o que não é o trecho atual: Frase, Parágrafo ou Linha (a linha visual na tela, inclusive quando um parágrafo quebra pela largura). A **Intensidade do foco** (leve, médio, forte) fica no Personalizar.

**Máquina de escrever.** Como a máquina de verdade, a folha só anda para a frente: quando a linha que você digita passa do meio da tela, o documento desce uma linha, num passo macio, e ela volta ao centro. Clicar numa linha, selecionar com o mouse ou subir com as setas não mexe na página, então dá para escolher qualquer trecho sem ele fugir (2.0.1).

**Ortografia.** Um risco vermelho embaixo da palavra que não existe, sem nada por cima do texto. O corretor é próprio (Hunspell com o dicionário VERO, num Web Worker) e não depende do navegador, mais uma lista de erros clássicos (`concerteza`, `derrepente`, `apartir`…). Com o cursor numa palavra errada, a forma certa aparece no rodapé; clicar nela ou `Ctrl+;` faz a troca, e `Ctrl+Z` desfaz. O botão direito traz até três sugestões e **Adicionar ao dicionário** (2.5).

**Revisão de estilo.** Repetições, frases longas e vícios ganham um pontilhado âmbar. O rodapé conta os pontos; clicar abre a lista no meio da tela e leva a cada ocorrência.

**Classes gramaticais.** Pinta uma classe por vez (substantivos, verbos, adjetivos, advérbios, conectivos) ou todas, e recua o resto. É uma heurística, não um analisador: o que é ambíguo fica sem cor.

**Visualizar.** Esconde os sinais do Markdown e mostra o texto formatado, com grifos, notas de rodapé numeradas e imagens, numa letra um pouco mais cheia que a da escrita. Os comentários viram balões discretos. Lendo, o olho da barra vira caneta para voltar a escrever.

**Comentários.** `Ctrl+/` (ou o botão direito) guarda um comentário entre `%%`, que não sai na exportação. O rodapé conta quantos há e `Ctrl+Shift+/` abre a lista de todos, com o trecho em volta.

**Tamanho da tela.** Nas Ferramentas (a engrenagem), de 50% a 300%, como o zoom do navegador.

**Tela cheia.** Botão na barra ou `Ctrl+Shift+F`. No computador, no Android e no iPad usa a tela cheia do navegador; no iPhone, onde ela não existe, entra um modo imersivo com um botão discreto para sair.

**Modo Poeta.** Régua de recuo para os versos, numeração editorial na margem (a cada cinco versos e o verso atual) e contagem de versos e estrofes no rodapé.

**Buscar e substituir** (`Ctrl+F`, `Ctrl+H`), **Sumário** (`Ctrl+Shift+O`), **metas de palavras**, **ritmo de leitura**, **estilos prontos e salvos**, **cor de destaque própria**, papel **automático** (claro de dia, escuro à noite) e **exportar/importar** os ajustes num `.json`.

**Exportar.** Markdown, texto simples, HTML, Word, PDF (pela impressão), copiar Markdown ou HTML. O nome do arquivo sai do título.

**Obsidian.** Escolha uma pasta do seu cofre e o Escritor grava cada nota como `.md` direto nela, sem plugin. O título vira o nome do arquivo; trocando o título, nasce um arquivo novo e o antigo fica. Funciona no Chrome e no Edge (é preciso a API de pastas do navegador).

---

## Atalhos

No Mac, troque `Ctrl` por `⌘`, `Alt` por `⌥` e `Shift` por `⇧`. O próprio aplicativo já mostra os atalhos do jeito de cada sistema.

| Atalho | O que faz |
| --- | --- |
| `Ctrl+O` | notas |
| `Ctrl+Alt+N` | nova nota |
| `Ctrl+,` | personalizar |
| `Ctrl+B` / `Ctrl+I` | negrito, itálico |
| `Ctrl+K` | ligação para outra nota `[[…]]` |
| `Ctrl+Shift+H` | realçar (grifo) |
| `Ctrl+/` | comentário oculto |
| `Ctrl+Shift+/` | lista de comentários |
| `Ctrl+E` | visualizar / voltar a escrever |
| `Ctrl+D` | modo foco |
| `Ctrl+T` | máquina de escrever |
| `Ctrl+G` | classes gramaticais |
| `Ctrl+P` | ortografia |
| `Ctrl+R` | revisão de estilo |
| `Ctrl+;` | corrigir a palavra sob o cursor |
| `Ctrl+F` / `Ctrl+H` | buscar / substituir |
| `Ctrl+Shift+O` | sumário |
| `Ctrl+Shift+F` | tela cheia |
| `Ctrl+S` | salvar no Obsidian (ou baixar o .md) |
| `Esc` | fecha menus e painéis |

---

## Como funciona por dentro

O texto vive numa `<textarea>` com a cor transparente. Logo abaixo dela, um `<div>` espelha o mesmo conteúdo já realçado, com **exatamente** a mesma métrica: mesma fonte, corpo, entrelinha, espaçamento entre letras, padding e quebra de linha. Você vê o texto realçado, mas o cursor, a seleção e o desfazer continuam sendo os **nativos do navegador**. O sublinhado da ortografia é desenhado no espelho, com o resultado do corretor próprio.

A regra que sustenta tudo: **o realce nunca altera a quantidade de caracteres**. Os sinais do Markdown (`#`, `**`, `==`) continuam lá, apenas recuados em cinza. Por isso o texto nunca pula e o cursor nunca desalinha. O grifo, por exemplo, é só uma cor de fundo atrás das letras.

Cada linha é quebrada em **pedaços** (um trecho de texto com suas classes). Foco, revisão, ortografia e classes gramaticais partem o pedaço onde começam e somam uma classe; emendar os pedaços devolve a linha original, caractere por caractere.

O corretor (`orto/`) roda num Web Worker: o Hunspell em WebAssembly abre o `.aff` e o `.dic` do VERO uma vez e responde em lote. O desenho nunca espera por ele. Palavra ainda não conferida conta como certa e vai para a fila; quando a resposta chega, a folha é redesenhada com o sublinhado, e cada palavra é conferida uma vez só.

---

## As fontes e os ícones

As três fontes da iA (**Duo**, **Mono** e **Quattro**) são livres (Apache 2.0, [github.com/iaolo/iA-Fonts](https://github.com/iaolo/iA-Fonts)) e vêm embutidas em `fontes/`. Um título em negrito só pode existir aqui se o negrito ocupar exatamente a mesma largura do texto normal; por isso o padrão é a **Duo**, que tem negrito e itálico de mesma largura.

| Fonte | Negrito | Itálico | No Escritor |
| --- | --- | --- | --- |
| **Duo** | mesma largura | mesma largura | padrão, negrito e itálico reais |
| **Mono** | mesma largura | mesma largura | monoespaçada de verdade |
| **Quattro** | mesma largura | 3,6% mais larga | ênfase marcada pela cor |
| **Serifa**, **Inter** e **Legível** | não usa | não usa | ênfase e títulos pela cor |

A interface usa a **Inter** (SIL Open Font License 1.1), também em `fontes/`. Os ícones são do **Lucide** (licença ISC, [lucide.dev](https://lucide.dev)), em `icones.js`. A **Legível** é a Atkinson Hyperlegible (SIL Open Font License 1.1, Braille Institute). O corretor é o **Hunspell** (MPL/GPL/LGPL) em WebAssembly, pelo **hunspell-asm** (MIT), com o dicionário **VERO 3.2** de português do Brasil (LGPLv3/MPL), em `orto/`. As licenças estão em `fontes/LICENSE.md`, `fontes/LICENSE-INTER.md`, `fontes/LICENSE-ATKINSON.md`, `fontes/LICENSE-VERO.md` e `orto/LICENSE.md`.

---

## Onde as coisas ficam

| Arquivo | Conteúdo |
| --- | --- |
| `index.html` | a página: barra, menus, painéis, notas, botão direito |
| `style.css` | fontes, papéis, cores, interface, impressão |
| `app.js` | pedaços, foco, gramática, ortografia, estilo, Markdown, exportação, guia, menus |
| `usos.js` | as trocas de uso: os porquês, mas e mais, mal e mau, onde e aonde… |
| `personalizar.js` | o painel Aa, estilos, sumário, buscar e substituir, pílulas |
| `estudo.js` | notas e ligações, botão direito, imagens coladas |
| `icones.js` | os ícones Lucide |
| `ponte.js` | a ligação com o [Caderno](https://cesteduardo.github.io/caderno/) (só age lá dentro) |
| `orto/` | o corretor: Hunspell em WebAssembly, o worker e o dicionário VERO |
| `fontes/` | iA Writer (estáticas e variáveis), Inter e Atkinson em `woff2`, com as licenças |

As notas, o texto aberto e as preferências ficam no `localStorage` do navegador (`escritor:notas`, `escritor:texto`, `escritor:prefs`, e as palavras que você ensinou ao corretor em `escritor:dicionario`); as imagens ficam no IndexedDB (`escritor-anexos`). Trocar de navegador ou limpar os dados do site apaga tudo: para guardar de verdade, ligue uma pasta do Obsidian ou exporte.

Projeto de código aberto e sem fins lucrativos, feito por GR Brands.
