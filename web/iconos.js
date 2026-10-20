// Iconos de la interfaz, en SVG dentro del codigo: la pagina tiene que andar
// sin internet, asi que no se cargan de ningun CDN.
//
// Trazos tomados de Tabler Icons (https://tabler.io/icons), licencia MIT,
// Copyright (c) 2020-2024 Pawel Kuna.

const svg = (trazos) =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
  `stroke-linejoin="round" aria-hidden="true" focusable="false">${trazos}</svg>`;

export const ICONOS = {
  funcion: svg(
    '<path d="M3 19a2 2 0 0 0 2 2c2 0 2 -4 3 -9s1 -9 3 -9a2 2 0 0 1 2 2"/>' +
    '<path d="M5 12h6"/><path d="M15 12l6 6"/><path d="M15 18l6 -6"/>',
  ),
  target: svg(
    '<path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>' +
    '<path d="M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0"/>' +
    '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/>',
  ),
  "chart-dots": svg(
    '<path d="M3 3v18h18"/><path d="M7 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>' +
    '<path d="M17 7a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>' +
    '<path d="M12 15a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>' +
    '<path d="M10.16 10.62l2.34 2.88"/><path d="M15.088 13.328l2.837 -4.586"/>',
  ),
  "chart-area-line": svg(
    '<path d="M4 19l4 -6l4 2l4 -5l4 4l0 5l-16 0"/><path d="M4 12l3 -4l4 2l5 -6l4 4"/>',
  ),
  "wave-sine": svg(
    '<path d="M21 12h-2c-.894 0 -1.662 -.857 -1.761 -2c-.296 -3.45 -.749 -6 -2.749 -6' +
    's-2.5 3.582 -2.5 8s-.5 8 -2.5 8s-2.452 -2.547 -2.749 -6c-.1 -1.147 -.867 -2 ' +
    '-1.763 -2h-2"/>',
  ),
  moon: svg(
    '<path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"/>',
  ),
  sun: svg(
    '<path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/>' +
    '<path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7"/>',
  ),
  "player-play": svg('<path d="M7 4v16l13 -8z"/>'),
  "circle-check": svg(
    '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M9 12l2 2l4 -4"/>',
  ),
};
