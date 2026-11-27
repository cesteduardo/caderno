/* =====================================================================
   Discoteca: um álbum de música clássica por dia
   ---------------------------------------------------------------------
   Só gravações de referência, das que entram em qualquer lista séria de
   "melhores de todos os tempos", de todos os tipos: canto gregoriano,
   renascença, barroco, sinfonia, concerto, piano, câmara, ópera, canção,
   música sacra, século XX e Villa-Lobos. A ordem alterna os tipos, para
   dois dias seguidos não caírem no mesmo; a lista recomeça quando acaba.
   Os 20 álbuns da trilha original do trajeto (de antes de 18/11/2026)
   estão todos aqui.

   c = compositor · w = obra · p = intérpretes · t = tipo · q = busca
   Os links abrem a busca do Spotify e do YouTube Music com compositor,
   obra e intérprete: chegam ao álbum sem depender de um endereço que muda.
   ===================================================================== */
'use strict';

const DISCOTECA = [
  { c: 'J. S. Bach', w: 'Variações Goldberg', p: 'Glenn Gould (1981)', t: 'Piano', q: 'Bach Goldberg Variations Glenn Gould 1981' },
  { c: 'Beethoven', w: 'Sinfonias nº 5 e nº 7', p: 'Carlos Kleiber, Filarmônica de Viena', t: 'Sinfonia', q: 'Beethoven Symphony 5 7 Carlos Kleiber Wiener Philharmoniker' },
  { c: 'Canto gregoriano', w: 'Chant', p: 'Monges de Santo Domingo de Silos', t: 'Música sacra', q: 'Chant Benedictine Monks Santo Domingo de Silos' },
  { c: 'Vivaldi', w: 'As Quatro Estações', p: 'Fabio Biondi, Europa Galante', t: 'Barroco', q: 'Vivaldi Four Seasons Fabio Biondi Europa Galante' },
  { c: 'Verdi', w: 'La traviata', p: 'Carlos Kleiber, Ileana Cotrubas, Plácido Domingo', t: 'Ópera', q: 'Verdi La traviata Carlos Kleiber Cotrubas Domingo' },
  { c: 'Chopin', w: 'Noturnos', p: 'Arthur Rubinstein', t: 'Piano', q: 'Chopin Nocturnes Arthur Rubinstein' },
  { c: 'Elgar', w: 'Concerto para violoncelo', p: 'Jacqueline du Pré, John Barbirolli, Sinfônica de Londres', t: 'Concerto', q: 'Elgar Cello Concerto Jacqueline du Pré Barbirolli' },
  { c: 'Mozart', w: 'Réquiem', p: 'Karl Böhm, Filarmônica de Viena', t: 'Música sacra', q: 'Mozart Requiem Karl Böhm Wiener Philharmoniker' },
  { c: 'Stravinsky', w: 'A Sagração da Primavera', p: 'Pierre Boulez, Orquestra de Cleveland', t: 'Século XX', q: 'Stravinsky Rite of Spring Boulez Cleveland Orchestra' },
  { c: 'J. S. Bach', w: 'Suítes para violoncelo', p: 'Yo-Yo Ma, "Six Evolutions"', t: 'Câmara', q: 'Bach Six Evolutions Cello Suites Yo-Yo Ma' },
  { c: 'Brahms', w: 'Sinfonia nº 4', p: 'Carlos Kleiber, Filarmônica de Viena', t: 'Sinfonia', q: 'Brahms Symphony 4 Carlos Kleiber Wiener Philharmoniker' },
  { c: 'Schubert', w: 'Winterreise', p: 'Dietrich Fischer-Dieskau, Gerald Moore', t: 'Canção', q: 'Schubert Winterreise Fischer-Dieskau Gerald Moore' },
  { c: 'Rachmaninoff', w: 'Concerto para piano nº 2', p: 'Sviatoslav Richter', t: 'Concerto', q: 'Rachmaninov Piano Concerto 2 Sviatoslav Richter' },
  { c: 'Palestrina', w: 'Missa Papae Marcelli', p: 'The Tallis Scholars', t: 'Renascença', q: 'Palestrina Missa Papae Marcelli Tallis Scholars' },
  { c: 'Schubert', w: 'Sonata para piano D. 960', p: 'Alfred Brendel', t: 'Piano', q: 'Schubert Piano Sonata D 960 Alfred Brendel' },
  { c: 'Mozart', w: 'As Bodas de Fígaro', p: 'Erich Kleiber, Filarmônica de Viena (1955)', t: 'Ópera', q: 'Mozart Le nozze di Figaro Erich Kleiber 1955' },
  { c: 'J. S. Bach', w: 'Concertos de Brandemburgo', p: 'Trevor Pinnock, The English Concert', t: 'Barroco', q: 'Bach Brandenburg Concertos Trevor Pinnock English Concert' },
  { c: 'Tchaikovsky', w: 'Sinfonia nº 6, "Patética"', p: 'Evgeny Mravinsky, Filarmônica de Leningrado', t: 'Sinfonia', q: 'Tchaikovsky Symphony 6 Pathetique Mravinsky Leningrad' },
  { c: 'Villa-Lobos', w: 'Bachianas Brasileiras', p: 'regidas pelo próprio Villa-Lobos', t: 'Brasil', q: 'Villa-Lobos Bachianas Brasileiras Villa-Lobos conducts' },
  { c: 'Debussy', w: 'Prelúdios', p: 'Krystian Zimerman', t: 'Piano', q: 'Debussy Préludes Krystian Zimerman' },
  { c: 'Fauré', w: 'Réquiem', p: 'Philippe Herreweghe', t: 'Música sacra', q: 'Fauré Requiem Philippe Herreweghe' },
  { c: 'Beethoven', w: 'Quartetos de cordas tardios', p: 'Quarteto Alban Berg', t: 'Câmara', q: 'Beethoven Late String Quartets Alban Berg Quartett' },
  { c: 'Beethoven', w: 'Concerto para piano nº 5, "Imperador"', p: 'Krystian Zimerman, Leonard Bernstein, Filarmônica de Viena', t: 'Concerto', q: 'Beethoven Piano Concerto 5 Emperor Zimerman Bernstein' },
  { c: 'Mahler', w: 'Sinfonia nº 2, "Ressurreição"', p: 'Otto Klemperer, Philharmonia', t: 'Sinfonia', q: 'Mahler Symphony 2 Resurrection Klemperer Philharmonia' },
  { c: 'Hildegard von Bingen', w: 'A Feather on the Breath of God', p: 'Gothic Voices, Emma Kirkby', t: 'Medieval', q: 'A Feather on the Breath of God Hildegard Gothic Voices' },
  { c: 'Satie', w: 'Gymnopédies e Gnossiennes', p: 'Pascal Rogé', t: 'Piano', q: 'Satie Gymnopédies Gnossiennes Pascal Rogé' },
  { c: 'Puccini', w: 'Tosca', p: 'Maria Callas, Victor de Sabata (1953)', t: 'Ópera', q: 'Puccini Tosca Callas de Sabata 1953' },
  { c: 'J. S. Bach', w: 'Missa em si menor', p: 'John Eliot Gardiner', t: 'Música sacra', q: 'Bach Mass in B minor John Eliot Gardiner' },
  { c: 'Dvořák', w: 'Sinfonia nº 9, "Do Novo Mundo"', p: 'István Kertész, Sinfônica de Londres', t: 'Sinfonia', q: 'Dvořák Symphony 9 New World Kertész London Symphony' },
  { c: 'Arvo Pärt', w: 'Tabula Rasa', p: 'Gidon Kremer, Keith Jarrett e outros (ECM)', t: 'Século XX', q: 'Arvo Pärt Tabula Rasa ECM' },
  { c: 'J. S. Bach', w: 'O Cravo Bem Temperado', p: 'Sviatoslav Richter', t: 'Piano', q: 'Bach Well-Tempered Clavier Sviatoslav Richter' },
  { c: 'Richard Strauss', w: 'Quatro Últimas Canções', p: 'Elisabeth Schwarzkopf, George Szell', t: 'Canção', q: 'Strauss Vier letzte Lieder Schwarzkopf Szell' },
  { c: 'Brahms', w: 'Concertos para piano nº 1 e nº 2', p: 'Emil Gilels, Eugen Jochum, Filarmônica de Berlim', t: 'Concerto', q: 'Brahms Piano Concertos Emil Gilels Eugen Jochum' },
  { c: 'Monteverdi', w: 'Vésperas da Beata Virgem (1610)', p: 'John Eliot Gardiner', t: 'Barroco', q: 'Monteverdi Vespro della Beata Vergine Gardiner' },
  { c: 'Beethoven', w: 'Sinfonia nº 9', p: 'Wilhelm Furtwängler, Festival de Bayreuth (1951)', t: 'Sinfonia', q: 'Beethoven Symphony 9 Furtwängler Bayreuth 1951' },
  { c: 'Chopin', w: 'Baladas', p: 'Krystian Zimerman', t: 'Piano', q: 'Chopin Ballades Krystian Zimerman' },
  { c: 'Allegri', w: 'Miserere', p: 'The Tallis Scholars', t: 'Renascença', q: 'Allegri Miserere Tallis Scholars' },
  { c: 'Mozart', w: 'Don Giovanni', p: 'Carlo Maria Giulini, Philharmonia (1959)', t: 'Ópera', q: 'Mozart Don Giovanni Giulini Philharmonia 1959' },
  { c: 'Beethoven', w: 'Concerto para violino', p: 'Jascha Heifetz, Charles Munch, Sinfônica de Boston', t: 'Concerto', q: 'Beethoven Violin Concerto Heifetz Munch Boston' },
  { c: 'Debussy', w: 'La Mer e Prélude à l’après-midi d’un faune', p: 'Herbert von Karajan, Filarmônica de Berlim', t: 'Sinfônico', q: 'Debussy La Mer Prélude à l\'après-midi d\'un faune Karajan Berliner' },
  { c: 'J. S. Bach', w: 'Sonatas e Partitas para violino solo', p: 'Nathan Milstein', t: 'Câmara', q: 'Bach Sonatas and Partitas solo violin Nathan Milstein' },
  { c: 'Rachmaninoff', w: 'Vésperas (Vigília Noturna)', p: 'Robert Shaw Festival Singers', t: 'Música sacra', q: 'Rachmaninov Vespers All-Night Vigil Robert Shaw Festival Singers' },
  { c: 'Mahler', w: 'Sinfonia nº 5', p: 'Herbert von Karajan, Filarmônica de Berlim', t: 'Sinfonia', q: 'Mahler Symphony 5 Karajan Berliner Philharmoniker' },
  { c: 'Schumann', w: 'Kinderszenen e Kreisleriana', p: 'Martha Argerich', t: 'Piano', q: 'Schumann Kinderszenen Kreisleriana Martha Argerich' },
  { c: 'Górecki', w: 'Sinfonia nº 3, "Das Canções Tristes"', p: 'Dawn Upshaw, David Zinman, London Sinfonietta', t: 'Século XX', q: 'Górecki Symphony 3 Sorrowful Songs Dawn Upshaw Zinman' },
  { c: 'Handel', w: 'Messias', p: 'John Eliot Gardiner, English Baroque Soloists', t: 'Barroco', q: 'Handel Messiah John Eliot Gardiner English Baroque Soloists' },
  { c: 'Mozart', w: 'Concertos para piano nº 20 e nº 21', p: 'Friedrich Gulda, Claudio Abbado, Filarmônica de Viena', t: 'Concerto', q: 'Mozart Piano Concertos 20 21 Friedrich Gulda Abbado' },
  { c: 'Wagner', w: 'Tristão e Isolda', p: 'Wilhelm Furtwängler, Kirsten Flagstad (1952)', t: 'Ópera', q: 'Wagner Tristan und Isolde Furtwängler Flagstad' },
  { c: 'Liszt', w: 'Sonata em si menor', p: 'Krystian Zimerman', t: 'Piano', q: 'Liszt Piano Sonata B minor Krystian Zimerman' },
  { c: 'Tallis', w: 'Spem in alium', p: 'The Tallis Scholars', t: 'Renascença', q: 'Tallis Spem in alium Tallis Scholars' },
  { c: 'Shostakovich', w: 'Sinfonia nº 5', p: 'Leonard Bernstein, Filarmônica de Nova York (1959)', t: 'Sinfonia', q: 'Shostakovich Symphony 5 Bernstein New York Philharmonic 1959' },
  { c: 'J. S. Bach', w: 'Paixão segundo São Mateus', p: 'Karl Richter, Münchener Bach-Chor (1958)', t: 'Música sacra', q: 'Bach Matthäus-Passion Karl Richter 1958' },
  { c: 'Ravel', w: 'Daphnis et Chloé', p: 'Charles Munch, Sinfônica de Boston', t: 'Sinfônico', q: 'Ravel Daphnis et Chloé Charles Munch Boston' },
  { c: 'Grieg e Schumann', w: 'Concertos para piano', p: 'Radu Lupu, André Previn, Sinfônica de Londres', t: 'Concerto', q: 'Grieg Schumann Piano Concertos Radu Lupu Previn' },
  { c: 'Beethoven', w: 'Sonatas Patética, Ao luar e Appassionata', p: 'Wilhelm Kempff', t: 'Piano', q: 'Beethoven Pathétique Moonlight Appassionata Wilhelm Kempff' },
  { c: 'Haydn', w: 'A Criação', p: 'Herbert von Karajan, Filarmônica de Berlim (1969)', t: 'Música sacra', q: 'Haydn Die Schöpfung Karajan 1969' },
  { c: 'Bruckner', w: 'Sinfonia nº 8', p: 'Herbert von Karajan, Filarmônica de Viena (1988)', t: 'Sinfonia', q: 'Bruckner Symphony 8 Karajan Wiener Philharmoniker 1988' },
  { c: 'J. S. Bach', w: 'Cantatas BWV 82 e 199', p: 'Lorraine Hunt Lieberson, Craig Smith', t: 'Canção', q: 'Bach Cantatas BWV 82 199 Lorraine Hunt Lieberson' },
  { c: 'Bizet', w: 'Carmen', p: 'Teresa Berganza, Plácido Domingo, Claudio Abbado', t: 'Ópera', q: 'Bizet Carmen Berganza Domingo Abbado' },
  { c: 'Josquin des Prez', w: 'Missa Pange lingua', p: 'The Tallis Scholars', t: 'Renascença', q: 'Josquin Missa Pange lingua Tallis Scholars' },
  { c: 'Saint-Saëns', w: 'Sinfonia nº 3, "Com Órgão"', p: 'Charles Munch, Sinfônica de Boston', t: 'Sinfonia', q: 'Saint-Saëns Symphony 3 Organ Charles Munch Boston' },
  { c: 'Holst', w: 'Os Planetas', p: 'Adrian Boult, Filarmônica de Londres', t: 'Sinfônico', q: 'Holst The Planets Adrian Boult London Philharmonic' },
  { c: 'Mozart', w: 'Sinfonias nº 40 e nº 41, "Júpiter"', p: 'Karl Böhm, Filarmônica de Berlim', t: 'Sinfonia', q: 'Mozart Symphonies 40 41 Jupiter Karl Böhm Berliner' },
];

const spotifyBusca = q => 'https://open.spotify.com/search/' + encodeURIComponent(q);
const ytMusicBusca = q => 'https://music.youtube.com/search?q=' + encodeURIComponent(q);
/* q: termos de busca no título original (os serviços indexam assim) */
const buscaAlbum = a => a.q || `${a.c} ${a.w} ${a.p.replace(/["“”]/g, '').replace(/\(.*?\)/g, '')}`.replace(/\s+/g, ' ').trim();

/* álbum do dia: conta os dias desde 1º/1/2026, sem depender do fuso */
function albumDoDia(k){
  const [y, m, d] = k.split('-').map(Number);
  const dia = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 864e5);
  const n = DISCOTECA.length, i = ((dia % n) + n) % n;
  return { ...DISCOTECA[i], i, n };
}
