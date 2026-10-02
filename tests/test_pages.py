"""El sitio de GitHub Pages se arma con lo que hay en el repositorio.

Pages sirve el aplicativo bajo /metodos-numericos-uta/, no en la raiz, y sin
servidor de Python: el nucleo corre en el navegador desde codigo.zip. Estas
pruebas no levantan un navegador (eso lo hace tests/pages/sitio.spec.js); fijan
lo que, si se rompe, deja el sitio en blanco sin que falle nada en local.
"""
from __future__ import annotations

import importlib.util
import re
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]

# pages/ no es un paquete del aplicativo: se carga por ruta.
_spec = importlib.util.spec_from_file_location("construir", RAIZ / "pages" / "construir.py")
construir = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(construir)


def test_el_sitio_lleva_la_interfaz_el_puente_y_el_codigo(tmp_path):
    sitio = construir.construir(tmp_path / "sitio")

    for archivo in (RAIZ / "web").iterdir():
        if archivo.name != ".gitkeep":
            assert (sitio / archivo.name).is_file(), f"falta {archivo.name}"
    assert (sitio / "puente.js").is_file()
    assert (sitio / ".nojekyll").is_file()

    with zipfile.ZipFile(sitio / "codigo.zip") as zf:
        empaquetados = set(zf.namelist())
    esperados = {
        archivo.relative_to(RAIZ).as_posix()
        for paquete in ("core", "api")
        for archivo in (RAIZ / paquete).rglob("*.py")
    }
    assert empaquetados == esperados


def test_el_puente_se_carga_antes_que_app_js(tmp_path):
    """app.js pide la lista de metodos apenas arranca: fetch ya tiene que
    estar reemplazado, o ese pedido sale a la red y da 404."""
    html = (construir.construir(tmp_path / "sitio") / "index.html").read_text(encoding="utf-8")
    assert html.index('src="puente.js"') < html.index('src="app.js"')
    # web/ queda intacto: la version local no sabe nada del puente.
    assert "puente.js" not in (RAIZ / "web" / "index.html").read_text(encoding="utf-8")


def test_la_interfaz_no_usa_rutas_absolutas():
    """En Pages, "/app.js" apunta a la raiz del dominio y no al proyecto."""
    web = RAIZ / "web"
    html = (web / "index.html").read_text(encoding="utf-8")
    assert not re.findall(r'(?:src|href)="/(?!/)', html)
    for archivo in web.glob("*.js"):
        texto = archivo.read_text(encoding="utf-8")
        assert not re.findall(r'["`]/api/', texto), f"{archivo.name} pide /api/ absoluto"
