/* =====================================================================
   Pílula que desliza: a mesma da barra do topo em todo controle de
   alternar (segmentados, abas da Rotina, filtros dos Planos, abas da
   lateral do leitor, Aa, Foco...).
   ---------------------------------------------------------------------
   Muitos desses controles são redesenhados inteiros a cada clique
   (replaceChildren), então a pílula nova nasce onde a antiga estava
   (posição guardada por "chave" do controle) e só então desliza até a
   escolha nova. Um MutationObserver acha controles novos sozinho.
   ===================================================================== */
'use strict';
const PIL_SEL = '.seg, .subnav, .filters, .rl-abas';
const PIL_ATIVO = ':scope > :is(.on, [aria-pressed="true"], [aria-selected="true"], [aria-current="page"])';
const pilUltima = new Map();

function pilChave(el, i){ return (el.id || el.className.replace(/\bcom-pilula\b/, '').trim()) + '#' + i; }

function pilulas(){
  const vistos = {};
  document.querySelectorAll(PIL_SEL).forEach(el => {
    if (!el.offsetParent) return;                       // escondido: nada a medir
    const base = el.className.replace(/\bcom-pilula\b/, '').trim();
    vistos[base] = (vistos[base] || 0) + 1;
    const chave = pilChave(el, vistos[base]);
    let p = el.querySelector(':scope > .pilula');
    const nova = !p;
    if (nova){
      p = document.createElement('span');
      p.className = 'pilula'; p.setAttribute('aria-hidden', 'true');
      el.classList.add('com-pilula');
      el.prepend(p);
    }
    const a = el.querySelector(PIL_ATIVO);
    if (!a){ p.style.opacity = '0'; return; }
    const pos = { x: a.offsetLeft, y: a.offsetTop, w: a.offsetWidth, h: a.offsetHeight };
    const antes = pilUltima.get(chave);
    const poe = q => { p.style.width = q.w + 'px'; p.style.height = q.h + 'px'; p.style.transform = `translate(${q.x}px,${q.y}px)`; p.style.opacity = '1'; };
    if (nova){
      p.style.transition = 'none';
      poe(antes || pos);
      void p.offsetWidth;                                // aplica antes de animar
      p.style.transition = '';
      if (antes) requestAnimationFrame(() => poe(pos));
    } else poe(pos);
    pilUltima.set(chave, pos);
  });
}

let pilRaf = 0;
const pilAgenda = () => { if (!pilRaf) pilRaf = requestAnimationFrame(() => { pilRaf = 0; pilulas(); }); };
new MutationObserver(muts => {
  for (const m of muts){
    const t = m.target;
    if (t.nodeType === 1 && (t.closest(PIL_SEL) || t.querySelector?.(PIL_SEL))){ pilAgenda(); return; }
  }
}).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-pressed', 'aria-selected', 'aria-current', 'hidden'] });
addEventListener('resize', pilAgenda);
document.fonts && document.fonts.ready.then(pilAgenda);
pilAgenda();
