// Portada: una tarjeta por metodo, agrupadas por familia. Todo sale de la
// lista que da la API (nombre y descripcion incluidos): un metodo nuevo
// aparece solo, sin tocar este archivo.

import { ICONOS } from "./iconos.js";

// `familias`: { clave: { nombre, icono } }; `familiaDe(metodo)` da la clave.
// Cada tarjeta es un enlace real a "#/metodo/<slug>".
export function dibujarRejilla(raiz, metodos, familias, familiaDe) {
  raiz.innerHTML = "";
  const grupos = new Map();
  for (const metodo of metodos) {
    const clave = familiaDe(metodo);
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(metodo);
  }
  for (const [clave, lista] of grupos) {
    const { nombre, icono } = familias[clave];
    const grupo = document.createElement("section");
    grupo.className = "grupo";
    grupo.dataset.familia = clave;
    const titulo = document.createElement("h3");
    titulo.id = `grupo-${clave}`;
    titulo.innerHTML = `<span class="grupo-icono">${ICONOS[icono] ?? ""}</span>`;
    titulo.append(nombre);
    grupo.setAttribute("aria-labelledby", titulo.id);
    const ul = document.createElement("ul");
    ul.className = "grupo-tarjetas";
    for (const metodo of lista) {
      const li = document.createElement("li");
      const enlace = document.createElement("a");
      enlace.className = "tarjeta-metodo";
      enlace.href = `#/metodo/${encodeURIComponent(metodo.slug)}`;
      enlace.dataset.slug = metodo.slug;
      const nom = document.createElement("strong");
      nom.textContent = metodo.name;
      const desc = document.createElement("span");
      desc.className = "tarjeta-descripcion";
      desc.textContent = metodo.description ?? "";
      enlace.append(nom, desc);
      li.append(enlace);
      ul.append(li);
    }
    grupo.append(titulo, ul);
    raiz.append(grupo);
  }
}
