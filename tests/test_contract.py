"""Pruebas del contrato congelado.

Si algo de aca se pone rojo, los dos carriles estan rotos, no uno.
"""
from __future__ import annotations

import math

import pytest

from core.config import SolveConfig
from core.errors import ErrorCriterion, approx_error, true_error, within_tolerance
from core.precision import (
    DEFAULT_DECIMALS,
    MAX_DECIMALS,
    MIN_DECIMALS,
    clamp_decimals,
    format_value,
    round_value,
)
from core.registry import all_methods, clear, get, register
from core.types import (
    Column,
    FieldKind,
    InputField,
    MethodSpec,
    PlotKind,
    StopReason,
)


# ---------- precision ----------

def test_decimales_por_defecto_son_seis():
    assert DEFAULT_DECIMALS == 6


def test_decimales_se_recortan_al_rango_permitido():
    assert clamp_decimals(0) == MIN_DECIMALS
    assert clamp_decimals(99) == MAX_DECIMALS
    assert clamp_decimals(None) == DEFAULT_DECIMALS
    assert clamp_decimals(4) == 4


def test_formato_rellena_con_ceros_hasta_los_decimales_pedidos():
    assert format_value(1.5, 6) == "1.500000"
    assert format_value(1.5, 2) == "1.50"


def test_redondeo_no_revienta_con_infinito_ni_nan():
    assert round_value(float("inf"), 6) == float("inf")
    assert math.isnan(round_value(float("nan"), 6))


# ---------- criterios de error ----------

def test_primera_iteracion_no_tiene_error():
    assert approx_error(1.0, None) is None
    assert within_tolerance(None, 1.0) is False


def test_error_relativo_porcentual():
    # de 2.0 a 2.5: |0.5 / 2.5| * 100 = 20 %
    assert approx_error(2.5, 2.0, ErrorCriterion.RELATIVE_PERCENT) == pytest.approx(20.0)


def test_error_absoluto_y_relativo():
    assert approx_error(2.5, 2.0, ErrorCriterion.ABSOLUTE) == pytest.approx(0.5)
    assert approx_error(2.5, 2.0, ErrorCriterion.RELATIVE) == pytest.approx(0.2)


def test_error_verdadero_contra_valor_exacto():
    assert true_error(3.1, 3.0, ErrorCriterion.ABSOLUTE) == pytest.approx(0.1)


def test_division_por_cero_da_infinito_no_excepcion():
    assert approx_error(0.0, 1.0, ErrorCriterion.RELATIVE) == float("inf")


# ---------- configuracion ----------

def test_config_recorta_decimales_invalidos():
    assert SolveConfig(decimals=99).decimals == MAX_DECIMALS


def test_config_rechaza_n_invalido():
    with pytest.raises(ValueError):
        SolveConfig(max_iterations=0)


def test_config_permite_correr_n_exacto_sin_parar_por_tolerancia():
    cfg = SolveConfig(max_iterations=7, stop_on_tolerance=False)
    assert cfg.max_iterations == 7
    assert cfg.stop_on_tolerance is False


# ---------- registro ----------

@pytest.fixture
def registro_limpio():
    clear()
    yield
    clear()


def _spec(slug: str = "demo") -> MethodSpec:
    return MethodSpec(
        slug=slug,
        name="Demo",
        unit="U1",
        family="raices",
        inputs=[InputField("fx", "f(x)", FieldKind.EXPRESSION)],
        solve=lambda params, cfg: None,
    )


def test_registrar_y_recuperar(registro_limpio):
    register(_spec())
    assert get("demo").name == "Demo"


def test_no_se_puede_registrar_dos_veces_el_mismo_slug(registro_limpio):
    register(_spec())
    with pytest.raises(ValueError):
        register(_spec())


def test_metodo_inexistente_lista_los_disponibles(registro_limpio):
    register(_spec("newton-raphson"))
    with pytest.raises(KeyError, match="newton-raphson"):
        get("no-existe")


def test_los_metodos_salen_ordenados_por_unidad(registro_limpio):
    register(_spec("b"))
    register(MethodSpec("a", "A", "U3", "edo", [], lambda p, c: None))
    assert [s.slug for s in all_methods()] == ["b", "a"]


# ---------- tipos ----------

def test_columna_y_motivo_de_parada_son_serializables():
    assert Column("xi", "xi").numeric is True
    assert StopReason.TOLERANCE.value == "tolerancia_alcanzada"


# ---------- el registro se puede recargar (bug de cache) ----------

def test_load_methods_registra_todo_lo_que_encuentra(registro_limpio):
    """El auto-descubrimiento es el requisito de expansion (R3): agregar un
    metodo es dejar un archivo en core/methods/ y nada mas.

    Se cuenta contra los modulos que hay en el paquete, no contra un numero
    escrito a mano, para que siga valiendo a medida que crezca a diez metodos.
    """
    import pkgutil

    import core.methods
    from core.registry import load_methods

    load_methods(force=True)

    modulos = {
        m.name
        for m in pkgutil.iter_modules(core.methods.__path__)
        if not m.name.startswith("_")
    }
    assert len(all_methods()) == len(modulos)


def test_load_methods_force_es_una_recarga_completa(registro_limpio):
    """force=True vacia el registro antes de releer los archivos.

    Sin eso, dos recargas seguidas revientan por slug duplicado: la purga del
    cache hace que los modulos se vuelvan a ejecutar y que sus register()
    corran otra vez sobre un registro que todavia los tenia.
    """
    from core.registry import load_methods

    register(_spec("fantasma"))
    load_methods(force=True)

    assert "fantasma" not in {s.slug for s in all_methods()}

    load_methods(force=True)  # dos veces seguidas no puede fallar


def test_load_methods_force_descarta_los_modulos_cacheados(registro_limpio):
    import sys
    import types as tipos_py

    from core.registry import load_methods

    load_methods()
    sys.modules["core.methods.zzz_centinela"] = tipos_py.ModuleType(
        "core.methods.zzz_centinela"
    )

    load_methods(force=True)

    assert "core.methods.zzz_centinela" not in sys.modules, (
        "sin purgar el cache, un clear() seguido de load_methods() deja el "
        "registro vacio para siempre"
    )


# ---------- JSON valido ----------

def test_infinito_y_nan_se_vuelven_null():
    from core.serialization import finite_or_none

    assert finite_or_none(float("inf")) is None
    assert finite_or_none(float("-inf")) is None
    assert finite_or_none(float("nan")) is None
    assert finite_or_none(None) is None
    assert finite_or_none("no es numero") is None
    assert finite_or_none(2.5) == 2.5


def test_una_fila_con_error_infinito_sale_serializable():
    import json

    from core.serialization import jsonable_iteration
    from core.types import Iteration

    fila = jsonable_iteration(
        Iteration(n=3, values={"xi": 1.0, "fxi": float("nan")}, error=float("inf"))
    )

    assert fila == {"n": 3, "values": {"xi": 1.0, "fxi": None}, "error": None}
    # allow_nan=False es lo que hace el navegador al parsear
    assert json.dumps(fila, allow_nan=False)


# ---------- forma de las series de graficas ----------

def test_grafica_de_raiz_tiene_las_claves_del_contrato():
    from core import plots

    spec = plots.function_root([0, 1], [-1, 1], root=0.5, iterates=[(1, 0.4, -0.2)])

    assert spec.kind is PlotKind.FUNCTION_ROOT
    assert set(spec.series) == {"curve", "root", "iterates"}
    assert spec.series["curve"] == {"x": [0, 1], "y": [-1, 1]}
    assert spec.series["root"] == {"x": 0.5, "y": 0.0}
    assert spec.series["iterates"] == [{"n": 1, "x": 0.4, "y": -0.2}]


def test_grafica_de_interpolacion_tiene_las_claves_del_contrato():
    from core import plots

    spec = plots.interpolation([(1, 2), (3, 4)], [1, 2, 3], [2, 3, 4], evaluated=(2, 3))

    assert set(spec.series) == {"points", "curve", "evaluated"}
    assert spec.series["points"] == [[1.0, 2.0], [3.0, 4.0]]
    assert spec.series["evaluated"] == {"x": 2, "y": 3}


def test_grafica_de_convergencia_tiene_las_claves_del_contrato():
    from core import plots

    spec = plots.convergence([0, 1], [None, 4.5])

    assert set(spec.series) == {"n", "error"}
    assert len(spec.series["n"]) == len(spec.series["error"])


def test_grafica_de_edo_admite_solucion_exacta_ausente():
    from core import plots

    spec = plots.ode_solution([0, 0.1], [1, 1.1])

    assert set(spec.series) == {"solution", "exact"}
    assert spec.series["exact"] is None


def test_grafica_de_edo_con_solucion_exacta():
    from core import plots

    spec = plots.ode_solution([0, 0.1], [1, 1.1], [0, 0.1], [1, 1.105])

    assert spec.series["exact"] == {"x": [0, 0.1], "y": [1, 1.105]}


# ---------- el criterio de error coincide con el del docente ----------

def test_error_relativo_porcentual_reproduce_la_tabla_del_docente():
    """La tabla de VON MISES.pdf calcula |e_r| con x_{i+1} en el denominador.

    Si esta prueba se pone roja, todos los resultados del aplicativo van a
    diferir de los del docente aunque los metodos esten bien programados.
    """
    from tests.casos_referencia import VON_MISES_EXP_LOG

    for fila in VON_MISES_EXP_LOG["filas"]:
        calculado = approx_error(
            fila.xi_siguiente, fila.xi, ErrorCriterion.RELATIVE_PERCENT
        )
        if fila.error_relativo_porcentual is None:
            continue
        assert calculado == pytest.approx(
            fila.error_relativo_porcentual, abs=1e-6
        ), f"fila i={fila.i}"


def test_la_primera_fila_de_la_tabla_del_docente_no_lleva_error():
    from tests.casos_referencia import VON_MISES_EXP_LOG

    assert VON_MISES_EXP_LOG["filas"][0].error_relativo_porcentual is None


# ---------- muestreo para el plano interactivo ----------

def test_muestreo_devuelve_dos_listas_de_la_misma_longitud():
    from core.sampling import sample

    xs, ys = sample("x**2", x_min=-2.0, x_max=2.0, puntos=5)

    assert len(xs) == len(ys) == 5
    assert xs[0] == pytest.approx(-2.0)
    assert xs[-1] == pytest.approx(2.0)
    assert ys[2] == pytest.approx(0.0)


def test_muestreo_marca_con_none_donde_la_funcion_no_esta_definida():
    """1/x en x = 0. La interfaz corta la linea ahi en vez de unir los lados:
    si no, aparece una raya vertical falsa en la asintota."""
    from core.sampling import sample

    xs, ys = sample("1/x", x_min=-1.0, x_max=1.0, puntos=3)

    assert ys[1] is None
    assert ys[0] is not None and ys[2] is not None


def test_muestreo_rechaza_un_rango_invertido():
    from core.sampling import sample
    from core.types import MethodError

    with pytest.raises(MethodError, match="invertido|vacio"):
        sample("x", x_min=5.0, x_max=1.0)


def test_muestreo_rechaza_pedir_demasiados_puntos():
    from core.sampling import sample
    from core.types import MethodError

    with pytest.raises(MethodError, match="limite"):
        sample("x", x_min=0.0, x_max=1.0, puntos=999_999)


def test_muestreo_de_una_expresion_invalida_falla_como_metodo():
    from core.sampling import sample
    from core.types import MethodError

    with pytest.raises(MethodError):
        sample("gamma(x)", x_min=0.0, x_max=1.0)


def test_la_grafica_de_raiz_puede_llevar_datos_de_remuestreo():
    from core import plots
    from core.types import Resample

    spec = plots.function_root(
        [0, 1], [-1, 1], root=0.5,
        resample=Resample(expression="x**2 - 0.25", domain=(-5.0, 5.0)),
    )

    assert spec.resample is not None
    assert spec.resample.expression == "x**2 - 0.25"
    assert spec.resample.variables == ("x",)


def test_la_grafica_de_edo_no_lleva_remuestreo():
    """La solucion de una EDO son puntos discretos que salieron de un h dado.
    Ahi el zoom reescala; no hay mas resolucion sin volver a resolver."""
    from core import plots

    assert plots.ode_solution([0, 0.1], [1, 1.1]).resample is None
