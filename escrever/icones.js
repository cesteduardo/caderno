/* ═══════════════════════════════════════════════════════════
   Ícones do Escritor: Lucide
   ───────────────────────────────────────────────────────────
   Um pacote só para o aplicativo inteiro (barra, menus, painéis e
   botão direito): ícones de traço, 24×24, pintados com a cor do
   texto em volta. O traço e as pontas são definidos no CSS
   (.ico-l, [data-ico] svg), para todos ficarem iguais.
   Lucide v0.460.0, licença ISC: https://lucide.dev
   ═══════════════════════════════════════════════════════════ */
'use strict';
const ICO = {
 "estilos": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z\"/><path d=\"M20 3v4\"/><path d=\"M22 5h-4\"/><path d=\"M4 17v2\"/><path d=\"M5 18H3\"/></svg>",
 "aparencia": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"13.5\" cy=\"6.5\" r=\".5\" fill=\"currentColor\"/><circle cx=\"17.5\" cy=\"10.5\" r=\".5\" fill=\"currentColor\"/><circle cx=\"8.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\"/><circle cx=\"6.5\" cy=\"12.5\" r=\".5\" fill=\"currentColor\"/><path d=\"M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z\"/></svg>",
 "texto": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><polyline points=\"4 7 4 4 20 4 20 7\"/><line x1=\"9\" x2=\"15\" y1=\"20\" y2=\"20\"/><line x1=\"12\" x2=\"12\" y1=\"4\" y2=\"20\"/></svg>",
 "escrita": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 20h9\"/><path d=\"M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z\"/></svg>",
 "revisao": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m6 16 6-12 6 12\"/><path d=\"M8 12h8\"/><path d=\"m16 20 2 2 4-4\"/></svg>",
 "tela": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"20\" height=\"14\" x=\"2\" y=\"3\" rx=\"2\"/><line x1=\"8\" x2=\"16\" y1=\"21\" y2=\"21\"/><line x1=\"12\" x2=\"12\" y1=\"17\" y2=\"21\"/></svg>",
 "obsidian": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 3h12l4 6-10 13L2 9Z\"/><path d=\"M11 3 8 9l4 13 4-13-3-6\"/><path d=\"M2 9h20\"/></svg>",
 "atalhos": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M10 8h.01\"/><path d=\"M12 12h.01\"/><path d=\"M14 8h.01\"/><path d=\"M16 12h.01\"/><path d=\"M18 8h.01\"/><path d=\"M6 8h.01\"/><path d=\"M7 16h10\"/><path d=\"M8 12h.01\"/><rect width=\"20\" height=\"16\" x=\"2\" y=\"4\" rx=\"2\"/></svg>",
 "amostra": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>",
 "notas": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"7\" height=\"7\" x=\"3\" y=\"3\" rx=\"1\"/><rect width=\"7\" height=\"7\" x=\"14\" y=\"3\" rx=\"1\"/><rect width=\"7\" height=\"7\" x=\"14\" y=\"14\" rx=\"1\"/><rect width=\"7\" height=\"7\" x=\"3\" y=\"14\" rx=\"1\"/></svg>",
 "foco": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M3 7V5a2 2 0 0 1 2-2h2\"/><path d=\"M17 3h2a2 2 0 0 1 2 2v2\"/><path d=\"M21 17v2a2 2 0 0 1-2 2h-2\"/><path d=\"M7 21H5a2 2 0 0 1-2-2v-2\"/></svg>",
 "realce": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m9 11-6 6v3h9l3-3\"/><path d=\"m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4\"/></svg>",
 "ver": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>",
 "escrever": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 20h9\"/><path d=\"M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z\"/></svg>",
 "ligacoes": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9 17H7A5 5 0 0 1 7 7h2\"/><path d=\"M15 7h2a5 5 0 1 1 0 10h-2\"/><line x1=\"8\" x2=\"16\" y1=\"12\" y2=\"12\"/></svg>",
 "tela-cheia": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 3H5a2 2 0 0 0-2 2v3\"/><path d=\"M21 8V5a2 2 0 0 0-2-2h-3\"/><path d=\"M3 16v3a2 2 0 0 0 2 2h3\"/><path d=\"M16 21h3a2 2 0 0 0 2-2v-3\"/></svg>",
 "tela-sair": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 3v3a2 2 0 0 1-2 2H3\"/><path d=\"M21 8h-3a2 2 0 0 1-2-2V3\"/><path d=\"M3 16h3a2 2 0 0 1 2 2v3\"/><path d=\"M16 21v-3a2 2 0 0 1 2-2h3\"/></svg>",
 "menu-mais": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"19\" cy=\"12\" r=\"1\"/><circle cx=\"5\" cy=\"12\" r=\"1\"/></svg>",
 "nova": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\"/><path d=\"M14 2v4a2 2 0 0 0 2 2h4\"/><path d=\"M9 15h6\"/><path d=\"M12 18v-6\"/></svg>",
 "abrir": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\"/></svg>",
 "buscar": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M14 4a2 2 0 0 1 2-2\"/><path d=\"M16 10a2 2 0 0 1-2-2\"/><path d=\"M20 2a2 2 0 0 1 2 2\"/><path d=\"M22 8a2 2 0 0 1-2 2\"/><path d=\"m3 7 3 3 3-3\"/><path d=\"M6 10V5a3 3 0 0 1 3-3h1\"/><rect x=\"2\" y=\"14\" width=\"8\" height=\"8\" rx=\"2\"/></svg>",
 "sumario": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M21 12h-8\"/><path d=\"M21 6H8\"/><path d=\"M21 18h-8\"/><path d=\"M3 6v4c0 1.1.9 2 2 2h3\"/><path d=\"M3 10v6c0 1.1.9 2 2 2h3\"/></svg>",
 "poeta": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12.67 19a2 2 0 0 0 1.416-.588l6.154-6.172a6 6 0 0 0-8.49-8.49L5.586 9.914A2 2 0 0 0 5 11.328V18a1 1 0 0 0 1 1z\"/><path d=\"M16 8 2 22\"/><path d=\"M17.5 15H9\"/></svg>",
 "guia": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 7v14\"/><path d=\"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z\"/></svg>",
 "sobre": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4\"/><path d=\"M12 8h.01\"/></svg>",
 "md": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\"/><path d=\"M14 2v4a2 2 0 0 0 2 2h4\"/><path d=\"M10 9H8\"/><path d=\"M16 13H8\"/><path d=\"M16 17H8\"/></svg>",
 "txt": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\"/><path d=\"M14 2v4a2 2 0 0 0 2 2h4\"/><path d=\"M9 13v-1h6v1\"/><path d=\"M12 12v6\"/><path d=\"M11 18h2\"/></svg>",
 "html": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\"/><path d=\"M2 12h20\"/></svg>",
 "doc": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m18 5-2.414-2.414A2 2 0 0 0 14.172 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2\"/><path d=\"M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z\"/><path d=\"M8 18h1\"/></svg>",
 "pdf": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\"/><path d=\"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6\"/><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\" rx=\"1\"/></svg>",
 "copiar": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\"/><path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\"/></svg>",
 "imagem": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\"/><circle cx=\"9\" cy=\"9\" r=\"2\"/><path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\"/></svg>",
 "salvar": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z\"/><path d=\"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7\"/><path d=\"M7 3v4a1 1 0 0 0 1 1h7\"/></svg>",
 "documento": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\"/><path d=\"M14 2v4a2 2 0 0 0 2 2h4\"/><path d=\"M10 9H8\"/><path d=\"M16 13H8\"/><path d=\"M16 17H8\"/></svg>",
 "recortar": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"6\" cy=\"6\" r=\"3\"/><path d=\"M8.12 8.12 12 12\"/><path d=\"M20 4 8.12 15.88\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><path d=\"M14.8 14.8 20 20\"/></svg>",
 "colar": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M15 2H9a1 1 0 0 0-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1Z\"/><path d=\"M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2M16 4h2a2 2 0 0 1 2 2v2M11 14h10\"/><path d=\"m17 10 4 4-4 4\"/></svg>",
 "colar-texto": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\"/><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"/><path d=\"M9 12v-1h6v1\"/><path d=\"M11 17h2\"/><path d=\"M12 11v6\"/></svg>",
 "tudo": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M5 3a2 2 0 0 0-2 2\"/><path d=\"M19 3a2 2 0 0 1 2 2\"/><path d=\"M21 19a2 2 0 0 1-2 2\"/><path d=\"M5 21a2 2 0 0 1-2-2\"/><path d=\"M9 3h1\"/><path d=\"M9 21h1\"/><path d=\"M14 3h1\"/><path d=\"M14 21h1\"/><path d=\"M3 9v1\"/><path d=\"M21 9v1\"/><path d=\"M3 14v1\"/><path d=\"M21 14v1\"/><line x1=\"7\" x2=\"15\" y1=\"8\" y2=\"8\"/><line x1=\"7\" x2=\"17\" y1=\"12\" y2=\"12\"/><line x1=\"7\" x2=\"13\" y1=\"16\" y2=\"16\"/></svg>",
 "negrito": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8\"/></svg>",
 "italico": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><line x1=\"19\" x2=\"10\" y1=\"4\" y2=\"4\"/><line x1=\"14\" x2=\"5\" y1=\"20\" y2=\"20\"/><line x1=\"15\" x2=\"9\" y1=\"4\" y2=\"20\"/></svg>",
 "riscado": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M16 4H9a3 3 0 0 0-2.83 4\"/><path d=\"M14 12a4 4 0 0 1 0 8H6\"/><line x1=\"4\" x2=\"20\" y1=\"12\" y2=\"12\"/></svg>",
 "sublinhado": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 4v6a6 6 0 0 0 12 0V4\"/><line x1=\"4\" x2=\"20\" y1=\"20\" y2=\"20\"/></svg>",
 "link": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\"/><path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\"/></svg>",
 "link-externo": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M15 3h6v6\"/><path d=\"M10 14 21 3\"/><path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\"/></svg>",
 "lista": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M3 12h.01\"/><path d=\"M3 18h.01\"/><path d=\"M3 6h.01\"/><path d=\"M8 12h13\"/><path d=\"M8 18h13\"/><path d=\"M8 6h13\"/></svg>",
 "lista-num": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M10 12h11\"/><path d=\"M10 18h11\"/><path d=\"M10 6h11\"/><path d=\"M4 10h2\"/><path d=\"M4 6h1v4\"/><path d=\"M6 18H4c0-1 2-2 2-3s-1-1.5-2-1\"/></svg>",
 "tarefa": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"3\" y=\"5\" width=\"6\" height=\"6\" rx=\"1\"/><path d=\"m3 17 2 2 4-4\"/><path d=\"M13 6h8\"/><path d=\"M13 12h8\"/><path d=\"M13 18h8\"/></svg>",
 "citacao": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M17 6H3\"/><path d=\"M21 12H8\"/><path d=\"M21 18H8\"/><path d=\"M3 12v6\"/></svg>",
 "titulo": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 12h12\"/><path d=\"M6 20V4\"/><path d=\"M18 20V4\"/></svg>",
 "paragrafo": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M13 4v16\"/><path d=\"M17 4v16\"/><path d=\"M19 4H9.5a4.5 4.5 0 0 0 0 9H13\"/></svg>",
 "codigo": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><polyline points=\"16 18 22 12 16 6\"/><polyline points=\"8 6 2 12 8 18\"/></svg>",
 "bloco-codigo": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M10 9.5 8 12l2 2.5\"/><path d=\"m14 9.5 2 2.5-2 2.5\"/><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/></svg>",
 "equacao": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2\"/></svg>",
 "equacao-bloco": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M16 8.9V7H8l4 5-4 5h8v-1.9\"/></svg>",
 "comentario": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M10 17H7l-4 4v-7\"/><path d=\"M14 17h1\"/><path d=\"M14 3h1\"/><path d=\"M19 3a2 2 0 0 1 2 2\"/><path d=\"M21 14v1a2 2 0 0 1-2 2\"/><path d=\"M21 9v1\"/><path d=\"M3 9v1\"/><path d=\"M5 3a2 2 0 0 0-2 2\"/><path d=\"M9 3h1\"/></svg>",
 "limpar": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 7V4h16v3\"/><path d=\"M5 20h6\"/><path d=\"M13 4 8 20\"/><path d=\"m15 15 5 5\"/><path d=\"m20 15-5 5\"/></svg>",
 "nota-rodape": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m4 19 8-8\"/><path d=\"m12 19-8-8\"/><path d=\"M20 12h-4c0-1.5.442-2 1.5-2.5S20 8.334 20 7.002c0-.472-.17-.93-.484-1.29a2.105 2.105 0 0 0-2.617-.436c-.42.239-.738.614-.899 1.06\"/></svg>",
 "tabela": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 3v18\"/><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M3 9h18\"/><path d=\"M3 15h18\"/></svg>",
 "destaque": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/><path d=\"M8 12a2 2 0 0 0 2-2V8H8\"/><path d=\"M14 12a2 2 0 0 0 2-2V8h-2\"/></svg>",
 "regua": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><line x1=\"3\" x2=\"21\" y1=\"12\" y2=\"12\"/><polyline points=\"8 8 12 4 16 8\"/><polyline points=\"16 16 12 20 8 16\"/></svg>",
 "inserir": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M8 12h8\"/><path d=\"M12 8v8\"/></svg>",
 "formatar": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 20h16\"/><path d=\"m6 16 6-12 6 12\"/><path d=\"M8 12h8\"/></svg>",
 "grifo": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m9 11-6 6v3h9l3-3\"/><path d=\"m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4\"/></svg>",
 "editar": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\"/><path d=\"m15 5 4 4\"/></svg>",
 "abrir-link": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7 7h10v10\"/><path d=\"M7 17 17 7\"/></svg>",
 "etiqueta": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z\"/><circle cx=\"7.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\"/></svg>",
 "seta": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m9 18 6-6-6-6\"/></svg>",
 "desfazer": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9 14 4 9l5-5\"/><path d=\"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11\"/></svg>",
 "apagar": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M3 6h18\"/><path d=\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\"/><path d=\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\"/><line x1=\"10\" x2=\"10\" y1=\"11\" y2=\"17\"/><line x1=\"14\" x2=\"14\" y1=\"11\" y2=\"17\"/></svg>",
 "mais": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M5 12h14\"/><path d=\"M12 5v14\"/></svg>",
 "busca": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.3-4.3\"/></svg>",
 "pasta": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\"/></svg>",
 "ok": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M20 6 9 17l-5-5\"/></svg>",
 "aviso": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4\"/><path d=\"M12 8h.01\"/></svg>",
 "relogio": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><polyline points=\"12 6 12 12 16 14\"/></svg>",
 "x": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M18 6 6 18\"/><path d=\"m6 6 12 12\"/></svg>",
 "voltar": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m15 18-6-6 6-6\"/></svg>",
 "ir": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><polyline points=\"15 10 20 15 15 20\"/><path d=\"M4 4v7a4 4 0 0 0 4 4h12\"/></svg>"
};

/* <i data-ico="nome"></i> vira o desenho na hora em que a página abre */
function pintarIcones(raiz = document){
  raiz.querySelectorAll('[data-ico]').forEach(i => { if (!i.firstChild && ICO[i.dataset.ico]) i.innerHTML = ICO[i.dataset.ico]; });
}
const ico = (nome) => ICO[nome] || '';
