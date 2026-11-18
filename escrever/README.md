# Escritor 2.1

Um caderno de escrita e estudo em Markdown, no espírito do [iA Writer](https://ia.net/writer): folha limpa, barra que some enquanto você escreve, Markdown realçado sem transformar o texto. A versão 2.0 transforma a folha única num caderno: várias notas, grifo e notas de rodapé no botão direito, imagens coladas, pasta do Obsidian e uma interface inteira redesenhada no estilo do macOS e do GNOME.

Abra `index.html` no navegador. Não há build, dependência nem servidor; funciona offline, com as fontes e os ícones incluídos.

```bash
# opcional, se preferir servir por HTTP
python3 -m http.server 8000
```

Na primeira abertura aparece o **Guia do Escritor**, um texto que explica o aplicativo escrito nele mesmo. A primeira coisa que você escrever vira uma nota sua.

---

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
O painel **Aa** (`Ctrl+,`) segue o desenho de ajustes do RefBox: título no centro, × no canto, a busca centralizada e uma fileira de ícones (Estilos, Aparência, Texto, Escrita, Revisão, Tela e meta, Obsidian, Atalhos e **Amostra**). Cada ícone mostra a sua seção, com bastante espaço; a busca junta as seções e mostra tudo o que bate. A **Amostra** é uma aba inteira: um trecho grande, escrito com tudo o que você escolheu.

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

**Ortografia.** Um risco vermelho embaixo da palavra suspeita, sem nada por cima do texto. Usa o dicionário pt-BR do navegador e uma lista própria de erros clássicos (`concerteza`, `derrepente`, `apartir`…). Com o cursor numa delas, a forma certa aparece no rodapé; clicar nela ou `Ctrl+;` faz a troca, e `Ctrl+Z` desfaz.

**Revisão de estilo.** Repetições, frases longas e vícios ganham um pontilhado âmbar. O rodapé conta os pontos; clicar abre a lista no meio da tela e leva a cada ocorrência.

**Classes gramaticais.** Pinta uma classe por vez (substantivos, verbos, adjetivos, advérbios, conectivos) ou todas, e recua o resto. É uma heurística, não um analisador: o que é ambíguo fica sem cor.

**Visualizar.** Esconde os sinais do Markdown e mostra o texto formatado, com grifos, notas de rodapé numeradas e imagens. Lendo, o olho da barra vira caneta para voltar a escrever.

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

O texto vive numa `<textarea>` com a cor transparente. Logo abaixo dela, um `<div>` espelha o mesmo conteúdo já realçado, com **exatamente** a mesma métrica: mesma fonte, corpo, entrelinha, espaçamento entre letras, padding e quebra de linha. Você vê o texto realçado, mas o cursor, a seleção, o desfazer e o corretor continuam sendo os **nativos do navegador**.

A regra que sustenta tudo: **o realce nunca altera a quantidade de caracteres**. Os sinais do Markdown (`#`, `**`, `==`) continuam lá, apenas recuados em cinza. Por isso o texto nunca pula e o cursor nunca desalinha. O grifo, por exemplo, é só uma cor de fundo atrás das letras.

Cada linha é quebrada em **pedaços** (um trecho de texto com suas classes). Foco, revisão, ortografia e classes gramaticais partem o pedaço onde começam e somam uma classe; emendar os pedaços devolve a linha original, caractere por caractere.

---

## As fontes e os ícones

As três fontes da iA (**Duo**, **Mono** e **Quattro**) são livres (Apache 2.0, [github.com/iaolo/iA-Fonts](https://github.com/iaolo/iA-Fonts)) e vêm embutidas em `fontes/`. Um título em negrito só pode existir aqui se o negrito ocupar exatamente a mesma largura do texto normal; por isso o padrão é a **Duo**, que tem negrito e itálico de mesma largura.

| Fonte | Negrito | Itálico | No Escritor |
| --- | --- | --- | --- |
| **Duo** | mesma largura | mesma largura | padrão, negrito e itálico reais |
| **Mono** | mesma largura | mesma largura | monoespaçada de verdade |
| **Quattro** | mesma largura | 3,6% mais larga | ênfase marcada pela cor |
| **Serifa** e **Inter** | não usa | não usa | ênfase e títulos pela cor |

A interface usa a **Inter** (SIL Open Font License 1.1), também em `fontes/`. Os ícones são do **Lucide** (licença ISC, [lucide.dev](https://lucide.dev)), em `icones.js`. As licenças estão em `fontes/LICENSE.md` e `fontes/LICENSE-INTER.md`.

---

## Onde as coisas ficam

| Arquivo | Conteúdo |
| --- | --- |
| `index.html` | a página: barra, menus, painéis, notas, botão direito |
| `style.css` | fontes, papéis, cores, interface, impressão |
| `app.js` | pedaços, foco, gramática, ortografia, estilo, Markdown, exportação, guia, menus |
| `personalizar.js` | o painel Aa, estilos, sumário, buscar e substituir, pílulas |
| `estudo.js` | notas e ligações, botão direito, imagens coladas |
| `icones.js` | os ícones Lucide |
| `ponte.js` | a ligação com o [Caderno](https://cesteduardo.github.io/caderno/) (só age lá dentro) |
| `fontes/` | iA Writer e Inter em `woff2`, com as licenças |

As notas, o texto aberto e as preferências ficam no `localStorage` do navegador (`escritor:notas`, `escritor:texto`, `escritor:prefs`); as imagens ficam no IndexedDB (`escritor-anexos`). Trocar de navegador ou limpar os dados do site apaga tudo: para guardar de verdade, ligue uma pasta do Obsidian ou exporte.

Projeto de código aberto e sem fins lucrativos, feito por GR Brands.
