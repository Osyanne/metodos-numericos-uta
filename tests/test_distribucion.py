"""Lo que hace falta para que el aplicativo corra en una maquina que no es esta.

La ruta soportada es **clonar el repositorio y ejecutarlo desde ahi**, no
instalar un paquete: `api/main.py` busca `web/` como hermana de `api/`, asi que
la interfaz solo aparece si el arbol del repositorio esta completo. Ver el
README.

Estas pruebas cubren las dos formas silenciosas de romper eso, que no se ven
corriendo el aplicativo en la maquina donde se escribio:

1. Importar algo que esta instalado aca por otra razon y no figura en
   `pyproject.toml`. En la maquina del docente ese import no existe.
2. Referenciar desde `index.html` un archivo que quedo sin agregar al
   repositorio. Aca abre igual porque el archivo esta en el disco.
"""
from __future__ import annotations

import ast
import re
import sys
import tomllib
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[1]
PRIMERA_PARTE = {"core", "api", "tests"}

# Paquetes cuyo nombre de import no coincide con el de la distribucion que se
# instala. `pip install fpdf2` deja un modulo llamado `fpdf`, y `fpdf` a secas
# es otro proyecto, abandonado. Comparar los nombres crudos daria un falso
# positivo aca y, peor, taparia el caso real el dia que aparezca.
IMPORT_A_DISTRIBUCION = {"fpdf": "fpdf2"}


def _distribucion_de(modulo: str) -> str:
    return IMPORT_A_DISTRIBUCION.get(modulo.lower(), modulo.lower())


def _dependencias_declaradas() -> set[str]:
    datos = tomllib.loads((RAIZ / "pyproject.toml").read_text(encoding="utf-8"))
    proyecto = datos["project"]
    crudas = list(proyecto["dependencies"])
    for extra in proyecto.get("optional-dependencies", {}).values():
        crudas.extend(extra)
    # "uvicorn[standard]>=0.32" -> "uvicorn"
    return {re.split(r"[<>=!\[; ]", linea)[0].strip().lower() for linea in crudas}


def _modulos_importados(paquetes: tuple[str, ...]) -> set[str]:
    encontrados: set[str] = set()
    for paquete in paquetes:
        for archivo in (RAIZ / paquete).rglob("*.py"):
            arbol = ast.parse(archivo.read_text(encoding="utf-8"), str(archivo))
            for nodo in ast.walk(arbol):
                if isinstance(nodo, ast.Import):
                    encontrados.update(a.name.split(".")[0] for a in nodo.names)
                elif isinstance(nodo, ast.ImportFrom) and nodo.level == 0:
                    if nodo.module:
                        encontrados.add(nodo.module.split(".")[0])
    return encontrados


def test_todo_lo_que_importa_el_aplicativo_esta_declarado():
    """Un import que anda aca y no esta en pyproject.toml revienta alla."""
    externos = {
        modulo
        for modulo in _modulos_importados(("core", "api"))
        if modulo not in sys.stdlib_module_names
        and modulo not in PRIMERA_PARTE
        and not modulo.startswith("_")
    }

    faltantes = {m for m in externos if _distribucion_de(m) not in _dependencias_declaradas()}

    assert not faltantes, (
        f"core/ y api/ importan {sorted(faltantes)}, que no figura en las "
        "dependencias de pyproject.toml. En una maquina limpia eso es un "
        "ModuleNotFoundError al arrancar."
    )


def test_las_pruebas_tambien_declaran_lo_que_usan():
    """Sin esto, `pip install -e .[dev]` en limpio no puede correr la suite."""
    externos = {
        modulo
        for modulo in _modulos_importados(("tests",))
        if modulo not in sys.stdlib_module_names
        and modulo not in PRIMERA_PARTE
        and not modulo.startswith("_")
    }

    faltantes = {m for m in externos if _distribucion_de(m) not in _dependencias_declaradas()}

    assert not faltantes, (
        f"tests/ importa {sorted(faltantes)}, que no esta en el extra 'dev'."
    )


@pytest.mark.parametrize("atributo", ["src", "href"])
def test_index_html_no_referencia_archivos_que_no_estan_en_el_repositorio(atributo):
    """Un archivo olvidado en el commit abre igual aca y falta en el clon."""
    web = RAIZ / "web"
    html = (web / "index.html").read_text(encoding="utf-8")

    referencias = [
        ruta
        for ruta in re.findall(rf'{atributo}="([^"]+)"', html)
        if ruta.startswith("/") and not ruta.startswith("//")
    ]

    assert referencias, f"index.html no referencia nada por {atributo}"

    faltantes = [ruta for ruta in referencias if not (web / ruta.lstrip("/")).is_file()]

    assert not faltantes, (
        f"index.html pide {faltantes}, que no existe en web/. En este disco "
        "puede abrir igual; en un clon del repositorio, no."
    )


def test_los_modulos_js_se_importan_entre_ellos_por_archivos_que_existen():
    """Lo mismo para la cadena de imports de los modulos ES."""
    web = RAIZ / "web"
    faltantes: list[str] = []

    for archivo in web.glob("*.js"):
        texto = archivo.read_text(encoding="utf-8")
        for destino in re.findall(r'from\s+"(\./[^"]+)"', texto):
            if not (web / destino.removeprefix("./")).is_file():
                faltantes.append(f"{archivo.name} -> {destino}")

    assert not faltantes, f"imports de JavaScript rotos: {faltantes}"


def test_la_interfaz_se_busca_al_lado_de_api_y_no_en_otro_lado():
    """Fija de donde sale `web/`, que es lo que ata el aplicativo al clon.

    Si esto cambia, la guia de instalacion del README deja de ser cierta y hay
    que reescribirla en el mismo commit.
    """
    from api import main

    assert main.WEB_DIR == main.PROJECT_ROOT / "web"
    assert main.WEB_DIR.is_dir()
    assert (main.WEB_DIR / "index.html").is_file()
