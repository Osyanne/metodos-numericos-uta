"""Pruebas de Interpolacion de Newton contra el contrato congelado."""
from __future__ import annotations

import math

import pytest
import sympy

from core.config import SolveConfig
from core.expression import parse
from core.registry import all_methods, clear, get, load_methods
from core.types import MethodError, PlotKind, StopReason
from tests.casos_referencia import NEWTON_DIVIDIDAS_RESUELTO as DOCENTE


@pytest.fixture
def metodo():
    """Recarga el registro porque cada prueba debe ser independiente."""
    clear()
    load_methods(force=True)
    yield get("interpolacion-newton")
    clear()


def resolver(metodo, **params):
    return metodo.solve(params, SolveConfig(decimals=8))


def _sin_tipografia(forma: str) -> str:
    return "".join(
        caracter for caracter in forma.lower() if caracter not in " *[]"
    )


def resolver_docente(metodo):
    """El ejercicio resuelto en clase, sin elegir variante."""
    return resolver(
        metodo,
        points=[list(punto) for punto in DOCENTE["puntos"]],
        x=DOCENTE["x"],
    )


# ---------- el ejercicio resuelto del docente ----------

def test_la_tabla_del_docente_lleva_cada_dividida_en_la_fila_de_su_ultimo_punto(
    metodo,
):
    """Asi esta en las diapositivas 5 y 7, y asi los a_i caen en la diagonal.

    La tabla se compara fila por fila contra el pizarron: una diferencia bien
    calculada pero puesta en otra fila tambien es un error.
    """
    resultado = resolver_docente(metodo)

    esperada = [{"x": x, "y": y} for x, y in DOCENTE["puntos"]]
    for indices, valor in DOCENTE["divididas"].items():
        esperada[indices[-1]][f"dd{len(indices) - 1}"] = valor

    assert [fila.values for fila in resultado.iterations] == esperada


def test_la_forma_de_newton_y_los_a_i_son_los_del_docente(metodo):
    resultado = resolver_docente(metodo)

    assert resultado.result["coeficientes"] == list(DOCENTE["a_i"])
    # Mismos terminos, mismos factores y en el mismo orden. Lo que se ignora es
    # la tipografia: la diapositiva usa corchetes y mayusculas, y el aplicativo
    # escribe el * explicito para que el parser la pueda releer.
    assert _sin_tipografia(resultado.result["polinomio_newton"]) == _sin_tipografia(
        DOCENTE["forma_de_newton"]
    )


def test_el_polinomio_expandido_y_el_valor_son_los_del_docente(metodo):
    resultado = resolver_docente(metodo)
    x = sympy.Symbol("x")

    expandido = sympy.Poly(sympy.sympify(resultado.result["polinomio"]), x)
    assert [float(c) for c in expandido.all_coeffs()] == list(DOCENTE["coeficientes"])
    assert resultado.result["grado"] == DOCENTE["grado"]
    assert resultado.result["valor"] == pytest.approx(DOCENTE["valor"])


# ---------- forma de Newton y coeficientes a_i ----------

def test_el_resultado_lleva_las_claves_en_el_orden_del_contrato(metodo):
    resultado = resolver_docente(metodo)

    assert list(resultado.result) == [
        "polinomio",
        "polinomio_newton",
        "coeficientes",
        "valor",
        "grado",
        "variante_usada",
    ]
    assert isinstance(resultado.result["polinomio_newton"], str)
    assert all(type(a) is float for a in resultado.result["coeficientes"])


@pytest.mark.parametrize(
    ("points", "forma"),
    [
        # Cada a_i negativo va entre parentesis, tambien a_0. Con una abscisa
        # negativa el binomio sale con el signo resuelto, y (x - 0) no se
        # reduce a x, igual que en la diapositiva 7.
        (
            [[-3.0, -2.0], [0.0, 4.0], [1.0, 2.0]],
            "(-2) + 2*(x + 3) + (-1)*(x + 3)*(x - 0)",
        ),
        # Abscisas y coeficientes no enteros se escriben sin redondear.
        ([[0.5, 1.0], [2.0, 4.0]], "1 + 2*(x - 0.5)"),
        # El ejemplo de docs/CONTRATO.md. Si cambia, hay que cambiar el doc.
        (
            [[1.0, 0.0], [4.0, 1.386294], [6.0, 1.791759]],
            "0 + 0.462098*(x - 1) + (-0.0518731)*(x - 1)*(x - 4)",
        ),
        ([[0.0, 0.0], [3.0, 1.0]], "0 + 0.3333333333333333*(x - 0)"),
    ],
)
def test_la_forma_de_newton_conserva_los_factores_en_el_orden_ingresado(
    metodo, points, forma
):
    resultado = resolver(metodo, points=points, x=0.0)

    assert resultado.result["polinomio_newton"] == forma


@pytest.mark.parametrize(
    "points",
    [
        [[1.0, 2.0], [0.0, 4.0], [-3.0, -2.0]],
        [[-1.0, 4.0], [0.5, 0.25], [3.0, 7.0], [4.5, 20.5]],
        [[2.5, -1.25], [-0.75, 3.0], [1.0, 0.1], [4.0, 2.2], [-2.0, 0.0]],
    ],
)
def test_la_forma_de_newton_es_el_mismo_polinomio_que_el_expandido(metodo, points):
    """Si las dos formas difieren, una de las dos esta mal escrita."""
    resultado = resolver(metodo, points=points, x=0.0)
    newton = parse(resultado.result["polinomio_newton"])
    expandido = parse(resultado.result["polinomio"])

    for x in [p[0] for p in points] + [-5.0, 0.3, 7.0]:
        assert newton.evaluar(x=x) == pytest.approx(
            expandido.evaluar(x=x), rel=1e-9, abs=1e-9
        )


def test_los_a_i_y_la_forma_de_newton_no_dependen_de_la_variante(metodo):
    """La variante cambia la tabla que se muestra, no el polinomio."""
    params = {
        "points": [[-2.0, 7.0], [-1.0, 2.0], [0.0, 1.0], [1.0, 4.0]],
        "x": 0.25,
    }

    resultados = [
        resolver(metodo, **params, variante=variante)
        for variante in ("auto", "divididas", "adelante", "atras")
    ]

    assert len({tuple(r.result["coeficientes"]) for r in resultados}) == 1
    assert len({r.result["polinomio_newton"] for r in resultados}) == 1


@pytest.mark.parametrize("variante", ["adelante", "atras"])
def test_con_diferencias_finitas_avisa_de_donde_salen_los_a_i(metodo, variante):
    """Con una tabla de diferencias finitas, los a_i no estan en ninguna celda.

    Con (0,1), (1,2), (2,5) el resumen dice a_2 = 1 y la tabla hacia adelante
    muestra un 2: sin una nota, parece que uno de los dos esta mal.
    """
    resultado = resolver(
        metodo,
        points=[[0.0, 1.0], [1.0, 2.0], [2.0, 5.0]],
        x=3.0,
        variante=variante,
    )

    assert any("diferencias divididas" in nota for nota in resultado.notes)


@pytest.mark.parametrize("h", [0.5, -0.5])
def test_la_relacion_que_cita_la_nota_de_adelante_se_cumple(metodo, h):
    """a_k = (diferencia adelante k de la fila 0) / (k! * h^k), tambien con h < 0."""
    ys = [2.0, -1.0, 0.5, 3.0]
    resultado = resolver(
        metodo,
        points=[[1.0 + i * h, y] for i, y in enumerate(ys)],
        x=0.0,
        variante="adelante",
    )
    fila0 = resultado.iterations[0].values

    for k in range(1, len(ys)):
        assert resultado.result["coeficientes"][k] == pytest.approx(
            fila0[f"delta{k}"] / (math.factorial(k) * h**k)
        )


def test_con_divididas_la_tabla_ya_muestra_los_a_i_y_no_hay_nota(metodo):
    assert resolver_docente(metodo).notes == []


def test_auto_con_paso_variable_muestra_la_misma_tabla_que_divididas(metodo):
    """`auto` solo elige la variante; la tabla de divididas es una sola."""
    params = {"points": [[1.0, 0.0], [4.0, 1.386294], [6.0, 1.791759]], "x": 2.0}

    auto = resolver(metodo, **params, variante="auto")
    divididas = resolver(metodo, **params, variante="divididas")

    assert auto.result["variante_usada"] == "divididas"
    assert [fila.values for fila in auto.iterations] == [
        fila.values for fila in divididas.iterations
    ]
    assert auto.iterations[0].values == {"x": 1.0, "y": 0.0}


def test_los_a_i_viajan_sin_redondear_aunque_se_pidan_dos_decimales(metodo):
    """`decimals` es formato: el redondeo lo hace la interfaz al mostrar."""
    resultado = metodo.solve(
        {"points": [[1.0, 0.0], [4.0, 1.386294], [6.0, 1.791759]], "x": 2.0},
        SolveConfig(decimals=2),
    )

    assert resultado.result["coeficientes"] == [0.0, 0.462098, -0.0518731]


@pytest.mark.parametrize(
    ("points", "a_i"),
    [
        pytest.param(
            [[0.1, 0.2], [0.2, 0.3], [0.3, 0.5]],
            [0.2, 1.0, 5.0],
            id="decimales",
        ),
        # Puntos de 1 + x + x^2, asi que a_2 = 1 exacto. Restando floats, la
        # tabla mostraba 0.99997788 al lado de un polinomio con 1*x**2.
        pytest.param(
            [[0.0, 1.0], [1e-6, 1.000001000001], [2e-6, 1.000002000004]],
            [1.0, 1.000001, 1.0],
            id="abscisas-muy-juntas",
        ),
    ],
)
def test_la_diagonal_de_la_tabla_son_exactamente_los_a_i(metodo, points, a_i):
    """La tabla, los a_i y el polinomio salen de las mismas diferencias.

    Si la tabla se calcula aparte en float, en cuanto las restas pierden
    cifras la pantalla muestra un a_i y el resultado usa otro.
    """
    resultado = resolver(metodo, points=points, x=0.0, variante="divididas")
    diagonal = [
        resultado.iterations[k].values[clave]
        for k, clave in enumerate(["y", "dd1", "dd2"])
    ]

    assert diagonal == resultado.result["coeficientes"] == a_i


def test_registra_el_metodo_con_sus_tres_entradas(metodo):
    assert metodo in all_methods()
    assert [campo.name for campo in metodo.inputs] == ["points", "x", "variante"]


def test_sin_variante_usa_divididas_aunque_los_puntos_sean_equiespaciados(metodo):
    """Con paso constante, `auto` elegiria diferencias hacia adelante.

    El docente usa solo diferencias divididas, asi que eso es lo que tiene que
    salir cuando nadie elige una variante.
    """
    resultado = resolver(metodo, points=[[0.0, 1.0], [1.0, 2.0], [2.0, 5.0]], x=3.0)

    assert resultado.result["variante_usada"] == "divididas"
    assert [columna.key for columna in resultado.columns] == ["x", "y", "dd1", "dd2"]


def test_el_campo_variante_trae_divididas_por_defecto(metodo):
    """Es el valor con el que la interfaz llena la casilla."""
    variante = next(campo for campo in metodo.inputs if campo.name == "variante")

    assert variante.default == "divididas"
    assert variante.required is False


def test_caso_resuelto_a_mano_devuelve_polinomio_expandido(metodo):
    resultado = resolver(
        metodo,
        points=[[0.0, 1.0], [1.0, 2.0], [2.0, 5.0]],
        x=3.0,
        variante="auto",
    )

    expresion = sympy.sympify(resultado.result["polinomio"])
    assert expresion == sympy.expand(expresion)
    assert sympy.Poly(expresion, sympy.Symbol("x")) == sympy.Poly(
        sympy.Symbol("x") ** 2 + 1,
        sympy.Symbol("x"),
    )
    assert resultado.result == {
        "polinomio": resultado.result["polinomio"],
        "polinomio_newton": "1 + 1*(x - 0) + 1*(x - 0)*(x - 1)",
        "coeficientes": [1.0, 1.0, 1.0],
        "valor": pytest.approx(10.0),
        "grado": 2,
        "variante_usada": "adelante",
    }
    assert resultado.converged is True
    assert resultado.stop_reason is StopReason.EXACT


def test_polinomio_devuelto_pasa_por_todos_los_puntos(metodo):
    puntos = [[-1.0, 4.0], [0.5, 0.25], [3.0, 7.0], [4.5, 20.5]]
    resultado = resolver(
        metodo,
        points=puntos,
        x=2.0,
        variante="divididas",
    )
    polinomio = parse(resultado.result["polinomio"])

    for xi, yi in puntos:
        assert polinomio.evaluar(x=xi) == pytest.approx(yi, abs=1e-10)


def test_las_cuatro_variantes_dan_el_mismo_polinomio(metodo):
    params = {
        "points": [[-2.0, 7.0], [-1.0, 2.0], [0.0, 1.0], [1.0, 4.0]],
        "x": 0.25,
    }

    resultados = {
        variante: resolver(metodo, **params, variante=variante)
        for variante in ("auto", "divididas", "adelante", "atras")
    }

    assert len({r.result["polinomio"] for r in resultados.values()}) == 1
    assert resultados["auto"].result["variante_usada"] == "adelante"
    assert resultados["divididas"].result["variante_usada"] == "divididas"
    assert resultados["adelante"].result["variante_usada"] == "adelante"
    assert resultados["atras"].result["variante_usada"] == "atras"


def test_cada_familia_muestra_su_tabla_y_conserva_el_orden(metodo):
    puntos = [[2.0, 5.0], [1.0, 2.0], [0.0, 1.0]]

    divididas = resolver(
        metodo, points=puntos, x=1.5, variante="divididas"
    )
    adelante = resolver(metodo, points=puntos, x=1.5, variante="adelante")
    atras = resolver(metodo, points=puntos, x=1.5, variante="atras")

    assert [fila.values["x"] for fila in divididas.iterations] == [2.0, 1.0, 0.0]
    assert [columna.key for columna in divididas.columns] == ["x", "y", "dd1", "dd2"]
    assert [columna.key for columna in adelante.columns] == [
        "x", "y", "delta1", "delta2"
    ]
    assert [columna.key for columna in atras.columns] == [
        "x", "y", "nabla1", "nabla2"
    ]
    # Cada diferencia dividida en la fila de su ultimo punto, como el docente.
    assert [fila.values for fila in divididas.iterations] == [
        {"x": 2.0, "y": 5.0},
        {"x": 1.0, "y": 2.0, "dd1": 3.0},
        {"x": 0.0, "y": 1.0, "dd1": 1.0, "dd2": 1.0},
    ]
    assert adelante.iterations[0].values == {
        "x": 2.0, "y": 5.0, "delta1": -3.0, "delta2": 2.0
    }
    assert atras.iterations[2].values == {
        "x": 0.0, "y": 1.0, "nabla1": -1.0, "nabla2": 2.0
    }
    assert all(fila.error is None for fila in divididas.iterations)


def test_auto_usa_divididas_si_el_paso_no_es_constante(metodo):
    resultado = resolver(
        metodo,
        points=[[1.0, 0.0], [4.0, math.log(4.0)], [6.0, math.log(6.0)]],
        x=2.0,
        variante="auto",
    )

    assert resultado.result["variante_usada"] == "divididas"
    assert resultado.result["valor"] == pytest.approx(0.56584435, abs=1e-8)


@pytest.mark.parametrize("variante", ["adelante", "atras"])
def test_diferencias_finitas_requieren_paso_constante(metodo, variante):
    with pytest.raises(MethodError, match="paso constante|equiespaciados"):
        resolver(
            metodo,
            points=[[0.0, 1.0], [1.0, 2.0], [3.0, 10.0]],
            x=2.0,
            variante=variante,
        )


@pytest.mark.parametrize(
    ("points", "mensaje"),
    [
        ([[0.0, 1.0]], "dos puntos"),
        ([[0.0, 1.0], [0.0, 2.0]], "repetida|distintas"),
        ([[0.0, 1.0], [1.0, float("inf")]], "finito"),
    ],
)
def test_rechaza_tablas_que_no_definen_un_polinomio(metodo, points, mensaje):
    with pytest.raises(MethodError, match=mensaje):
        resolver(metodo, points=points, x=0.5, variante="divididas")


def test_rechaza_una_variante_desconocida(metodo):
    with pytest.raises(MethodError, match="variante"):
        resolver(
            metodo,
            points=[[0.0, 1.0], [1.0, 2.0]],
            x=0.5,
            variante="central",
        )


def test_polinomio_cero_es_un_interpolante_valido_de_grado_cero(metodo):
    resultado = resolver(
        metodo,
        points=[[0.0, 0.0], [1.0, 0.0]],
        x=0.25,
        variante="auto",
    )

    assert resultado.result["polinomio"] == "0"
    assert resultado.result["grado"] == 0
    assert resultado.result["valor"] == 0.0


def test_no_descarta_un_coeficiente_pequeno_que_cambia_los_datos(metodo):
    resultado = resolver(
        metodo,
        points=[[0.0, 0.0], [1.0, 1e-15]],
        x=1.0,
        variante="auto",
    )
    polinomio = parse(resultado.result["polinomio"])

    assert resultado.result["grado"] == 1
    assert polinomio.evaluar(x=1.0) == pytest.approx(1e-15, abs=1e-25)


@pytest.mark.parametrize(
    "params",
    [
        {"points": [[False, 0.0], [1.0, 1.0]], "x": 0.5},
        {"points": [[0.0, 0.0], [1.0, 1.0]], "x": True},
        {"points": [[0.0, 0.0], [1.0, 1.0]], "x": float("inf")},
    ],
)
def test_rechaza_booleanos_y_x_no_finito(metodo, params):
    with pytest.raises(MethodError, match="numero|finito"):
        resolver(metodo, **params, variante="auto")


def test_grafica_incluye_curva_punto_evaluado_y_remuestreo(metodo):
    resultado = resolver(
        metodo,
        points=[[0.0, 1.0], [1.0, 2.0], [2.0, 5.0]],
        x=1.5,
        variante="auto",
    )

    assert resultado.plot is not None
    assert resultado.plot.kind is PlotKind.INTERPOLATION
    assert set(resultado.plot.series) == {"points", "curve", "evaluated"}
    assert resultado.plot.series["points"] == [[0.0, 1.0], [1.0, 2.0], [2.0, 5.0]]
    assert resultado.plot.series["evaluated"] == {
        "x": 1.5,
        "y": pytest.approx(3.25),
    }
    assert len(resultado.plot.series["curve"]["x"]) == 201
    assert resultado.plot.resample is not None
    assert resultado.plot.resample.expression == resultado.result["polinomio"]
    assert resultado.plot.resample.domain == (0.0, 2.0)
