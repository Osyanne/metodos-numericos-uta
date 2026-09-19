# Validacion

Que se comprobo, contra que, y donde esta la evidencia.

El docente confirmo que **no hay rubrica**. Este documento cumple esa funcion:
deja por escrito que se acordo, como se verifica cada cosa y de donde sale cada
numero. Se versiona junto al codigo, asi que una afirmacion de aca siempre
corresponde a la version del aplicativo que la acompana.

Al 2026-09-18: **250 pruebas de Python** y **38 de navegador**, todas en verde.

```bash
pytest --ignore=tests/e2e     # 250
npx playwright test           # 38
```

## De donde salen los numeros

Esta es la distincion que mas importa, porque cambia el peso de cada prueba.

| Origen | Que significa | Donde |
|---|---|---|
| **Material del docente** | Tablas y ejercicios resueltos de `VON MISES.pdf` y de las diapositivas de interpolacion de Newton y de Lagrange. El aplicativo los reproduce digito por digito. Si estos numeros no dan, el metodo esta mal. | `tests/casos_referencia.py`, `tests/casos_referencia_lagrange.py` |
| **Solucion analitica** | El resultado exacto se conoce por matematica, no por haberlo corrido. Se compara contra el, con una tolerancia declarada. | `test_rk4_aproxima_una_solucion_analitica_conocida`, `test_el_oscilador_no_muestra_errores_absurdos_al_cruzar_el_cero` |
| **Resuelto a mano** | Ejercicio calculado a mano en papel antes de escribir el codigo. | `test_caso_resuelto_a_mano_devuelve_polinomio_expandido` |
| **Propiedad** | No fija un numero: fija una relacion que tiene que cumplirse siempre. | `test_las_cuatro_variantes_dan_el_mismo_polinomio`, `test_la_forma_de_newton_es_el_mismo_polinomio_que_el_expandido` |

**Lo que no cuenta como validacion:** correr el aplicativo, mirar la salida y
escribir esa salida en la prueba. Eso solo congela lo que el codigo ya hacia,
incluido el error. Ninguna prueba de este repositorio se escribio asi.

Los casos de referencia **se agregan, nunca se cambian**. Son los numeros del
docente: si una prueba falla contra ellos, lo que esta mal es el codigo.

## El caso de referencia principal

`f(x) = e⁻ˣ − ln(x)`, `x₀ = 1`, derivada congelada `f'(1) = −1.36787944`.
De `VON MISES.pdf`, diapositiva 7.

| i | xᵢ | f(xᵢ) | x(i+1) | \|eᵣ\| % |
|---|-----|-------|--------|---------|
| 0 | 1 | 0.36787944 | 1.26894142 | — |
| 1 | 1.26894142 | 0.042946035 | 1.30033749 | 2.4144554 |
| 2 | 1.30033749 | 0.00981599 | 1.307513555 | 0.54883309 |

El aplicativo reproduce las tres filas completas, con sus tres columnas y su
columna de error: `test_reproduce_la_tabla_del_docente_fila_por_fila`.

Verificado tambien sobre una instalacion limpia recien clonada: la primera
iteracion devuelve `1.26894142`.

## Matriz de requisitos

Cada requisito de `ESPECIFICACION.md`, con la prueba que lo respalda.

| # | Requisito | Como se comprueba | Evidencia |
|---|---|---|---|
| R1 | Alrededor de 10 metodos en el semestre | Los cinco del parcial, con la arquitectura ejercitada para el sexto | `test_los_cuatro_metodos_del_parcial_siguen_estando` |
| R2 | Los cinco del primer parcial | Cada uno con su archivo de pruebas | `test_newton_raphson.py`, `test_von_mises.py`, `test_newton_interpolation.py`, `test_lagrange_interpolation.py`, `test_runge_kutta.py` |
| R3 | La arquitectura se expande | Se escribe un metodo nuevo en disco y aparece en el registro, en la API y con sus campos, **sin tocar ningun archivo existente** | `test_extensibilidad.py` (3 pruebas) |
| R4 | 6 decimales por defecto, ajustable | Rango 2..12, recorte de valores invalidos, y que cambiar decimales **no cambie el calculo** | `test_decimales_por_defecto_son_seis`, `test_decimales_se_recortan_al_rango_permitido`, `test_los_decimales_no_cambian_los_valores_calculados` |
| R5 | Calculo hasta cualquier iteracion n | Con `stop_on_tolerance=False` corren las n iteraciones, **incluso si cae sobre una raiz exacta** | `test_config_permite_correr_n_exacto_sin_parar_por_tolerancia`, `test_una_raiz_exacta_no_recorta_las_n_iteraciones_pedidas` |
| R6 | Tabla con todas las iteraciones | Cada metodo declara sus columnas; el CSV baja la tabla completa y sin redondear | `test_las_columnas_son_las_de_la_tabla_del_docente`, `test_csv_descarga_la_tabla_real_completa_y_sin_redondear` |
| R7 | Graficacion | Las cuatro clases de grafica, con sus claves de contrato, y el remuestreo al hacer zoom | `test_grafica_de_raiz_...`, `test_grafica_de_interpolacion_...`, `test_grafica_de_edo_...`, `test_grafica_de_convergencia_...` |
| R8 | Polinomio expandido | El ejercicio resuelto de las diapositivas de Newton (tabla celda por celda, `a_i`, forma de Newton y `P(-4) = -8`), un caso resuelto a mano, y la propiedad de que las cuatro variantes dan el mismo polinomio | `test_la_tabla_del_docente_lleva_cada_dividida_en_la_fila_de_su_ultimo_punto`, `test_la_forma_de_newton_y_los_a_i_son_los_del_docente`, `test_el_polinomio_expandido_y_el_valor_son_los_del_docente`, `test_caso_resuelto_a_mano_devuelve_polinomio_expandido`, `test_las_cuatro_variantes_dan_el_mismo_polinomio` |
| R12 | Interpolacion de Lagrange | Los tres ejercicios de las diapositivas, cada `L_i` por separado, y que coincida con Newton sobre los mismos puntos | `test_lagrange_interpolation.py` (25 pruebas), `test_coincide_con_la_interpolacion_de_newton` |
| R9 | Runge-Kutta con sistemas, y h o n | Sistema de dos EDO contra la solucion analitica; las formas de definir la malla | `test_resuelve_un_sistema_evaluando_las_componentes_simultaneamente`, `test_acepta_las_formas_del_contrato_para_h_n_y_xf` |
| R10 | La app deriva sola o acepta la derivada | Las dos vias dan el mismo resultado, y el aplicativo dice cual derivada uso | `test_deriva_sola_y_lo_dice`, `test_la_derivada_a_mano_da_el_mismo_resultado` |
| R11 | Los tres criterios de error, configurables | Los tres implementados; el porcentual reproduce la columna del docente | `test_error_absoluto_y_relativo`, `test_error_relativo_porcentual_reproduce_la_tabla_del_docente` |

## Lagrange: por que no alcanza con comparar el polinomio final

El primer ejercicio del docente es `(0,1), (1,3), (2,0)`, y ahi **`y_2 = 0`**.
Eso quiere decir que el tercer termino de la suma se anula entero: un `L_2`
equivocado —con un signo cambiado, o saltando el factor que no debia— **da
exactamente el mismo polinomio final**. Comparar solo `result.polinomio` dejaria
pasar ese error.

Por eso las pruebas comparan **cada `L_i` por separado** contra el de la
diapositiva, y ademas verifican la propiedad que los define: `L_i` vale 1 en
`x_i` y 0 en todos los demas puntos.

La otra red es cruzada: `test_coincide_con_la_interpolacion_de_newton` corre los
dos metodos sobre los mismos puntos y exige el mismo polinomio. No dice cual
esta mal si difieren; dice que hay que mirar.

## Las celdas de texto se verifican de punta a punta

La tabla de Lagrange lleva expresiones, y esa clase de dato atravesaba **cuatro
eslabones** que la convertian en `null` cada uno por su cuenta. Verificar solo
el nucleo habria dejado la tabla en blanco en la pantalla con todas las pruebas
en verde. Hay una prueba por eslabon:

| Eslabon | Prueba |
|---|---|
| Nucleo | `test_una_celda_de_texto_llega_entera_a_la_interfaz` |
| El plano **no** se afloja | `test_el_muestreo_del_plano_sigue_siendo_solo_numerico` |
| Exportacion CSV y PDF | `test_csv_exporta_las_celdas_de_texto_tal_cual`, `test_pdf_exporta_las_celdas_de_texto` |
| Navegador | `Lagrange muestra las expresiones de cada L(i), no guiones` |

## Von Mises: la trampa que se verifica a proposito

Von Mises **congela la derivada en x₀**: `x(i+1) = xᵢ − f(xᵢ)/f'(x₀)`.

Si se recalcula la derivada en cada paso, esto se convierte en Newton-Raphson.
Y lo peligroso es que **sigue convergiendo y sigue pareciendo correcto**: da una
raiz valida, sin errores, solo que con otros numeros que los de la clase. Un
error asi no se nota mirando la pantalla.

Por eso hay una prueba que distingue las dos tablas, y una que fija el valor de
la derivada congelada: `test_la_derivada_congelada_vale_lo_que_dice_el_docente`.

## El ejercicio propuesto que diverge

`4x³ − 18x² + 12x − 6 = 0` con `x₀ = 1.165`, de la diapositiva 10.

**Diverge, y es correcto que diverja.** La unica raiz real esta en 3.81699684.
Ahi `f'` vale +49.6, contra los −13.65 congelados en el punto inicial: el factor
de amplificacion por iteracion queda cerca de 4.6, muy por encima de 1, asi que
la sucesion se aleja en vez de acercarse.

El aplicativo lo reporta como divergencia **con la causa escrita**, y no inventa
una raiz: ni en el resultado ni en la grafica. Ese ultimo punto es el que estuvo
mal hasta esta version — el plano marcaba una "raiz" en x = −1.58e+301.

Como contraste util para la sustentacion, Newton-Raphson **si** resuelve el
mismo ejercicio y encuentra la raiz: el problema es del metodo, no del enunciado.

- `test_el_ejercicio_de_la_diapositiva_10_diverge`
- `test_cuando_diverge_la_grafica_tampoco_marca_una_raiz`
- `test_newton_raphson_si_resuelve_ese_mismo_ejercicio`

**Queda por preguntarle al docente si la divergencia es a proposito.**

## Runge-Kutta: por que la columna de error va vacia

Un metodo de paso unico **no produce una estimacion de error por iteracion**.

Lo que se mostraba era la diferencia entre `y(i+1)` e `yᵢ`, que mide cuanto
cambio la solucion entre pasos, no cuanto se equivoca. Son cosas distintas: una
solucion que cambia poco puede estar muy lejos de la verdadera, y una que cambia
mucho puede ser exacta.

Con el oscilador `y₁' = y₂`, `y₂' = −y₁` desde `(0, 1)` —cuya solucion es
`(sen x, cos x)`— esa columna llegaba a **342 %** en el paso 16, justo donde la
solucion cruza el cero, mientras el error verdadero contra `cos(1.6)` era de
**1.3 × 10⁻⁶**. En pantalla eso se lee como que el programa esta roto.

Para estimar la exactitud de verdad hay que resolver otra vez con la mitad del
paso y comparar. Eso no esta implementado y **se decidio no implementarlo para
este parcial**: obliga a definir si se estima error local o global y como
agregarlo en un sistema, y son decisiones de diseno que no caben antes de la
entrega. La columna va vacia y una nota lo explica en pantalla.

## Comprobado desde el navegador

Las 38 pruebas de Playwright manejan la interfaz de verdad contra el servidor
real. Cubren lo que romperia la demostracion:

- Resolver los cinco metodos y ver la tabla con sus columnas.
- **Cambiar de metodo no resucita el resultado anterior**, ni siquiera moviendo
  el control de decimales.
- Una respuesta que llega tarde no se pinta sobre el metodo que el usuario
  eligio despues.
- El sistema de dos EDO dibuja sus dos series y muestra la columna de error
  vacia.
- Exportar CSV y PDF de verdad, incluida la descarga.
- Zoom, paneo, teclado, y que el remuestreo le pida los puntos al nucleo.
- Que los cinco formularios y el plano entren a 320 y a 360 px.

## Instalacion verificada en limpio

Procedimiento completo corrido sobre un clon nuevo, en un entorno virgen, con
la version de los cuatro primeros metodos. Se vuelve a correr sobre la version
que se entregue:

| Paso | Resultado |
|---|---|
| Clonar el repositorio | 15 entradas, arbol completo |
| Entorno virtual desde CPython 3.12.13 | creado |
| `pip install -e ".[dev]"` | sin errores |
| Importar las seis dependencias | todas |
| `pytest --ignore=tests/e2e` | **197 en verde** |
| `GET /` | 200, con la interfaz |
| Los siete modulos de `web/` | 200 cada uno |
| `GET /api/methods` | 200, 4 metodos |
| `POST solve` sobre el caso del docente | 200, `x₁ = 1.26894142` |
| `POST export/csv` | 200 |

Ademas hay cuatro pruebas que cuidan esto de forma permanente
(`tests/test_distribucion.py`): que todo lo que el codigo importa este declarado
en `pyproject.toml`, y que ningun archivo referenciado desde la interfaz falte
en el repositorio. Las dos cosas funcionan igual en la maquina donde se escribio
el codigo y fallan en la de quien clona, que es lo que las hace peligrosas.

## Limitaciones declaradas

Se dejan escritas en vez de esconderlas.

1. **Runge-Kutta no estima el error por iteracion.** Explicado arriba.
2. **El aplicativo se ejecuta desde una copia del repositorio**, no como paquete
   instalado: `web/` se busca al lado de `api/`. Si falta, el servidor no
   arranca y lo dice, en vez de servir una pantalla en blanco.
3. **Interpolacion de Newton trae cuatro variantes** aunque el docente usa solo
   diferencias divididas, que son el default. El polinomio es el mismo en todas;
   cambia la tabla.
4. **Los metodos 6 a 10 no estan.** La arquitectura para agregarlos si, y esta
   ejercitada con una prueba.
