# Validacion

Que se comprobo, contra que, y donde esta la evidencia.

El docente confirmo que **no hay rubrica**. Este documento cumple esa funcion:
deja por escrito que se acordo, como se verifica cada cosa y de donde sale cada
numero. Se versiona junto al codigo, asi que una afirmacion de aca siempre
corresponde a la version del aplicativo que la acompana.

Verificacion local actual: **339 pruebas de Python**, **172 de navegador** y
**5 del sitio de GitHub Pages**, todas en verde. La referencia historica de 2026-09-18, previa a Trapecio,
tenia 275 y 39 respectivamente. En el total de navegador no entra la prueba de
las capturas del manual, que solo corre a pedido (`CAPTURAS=1`).

```bash
pytest --ignore=tests/e2e     # 339
npx playwright test           # 172
npx playwright test --config playwright.pages.config.js   # 5, necesita internet
```

## De donde salen los numeros

Esta es la distincion que mas importa, porque cambia el peso de cada prueba.

| Origen | Que significa | Donde |
|---|---|---|
| **Material del docente** | Tablas y ejercicios resueltos de `VON MISES.pdf`, las diapositivas de interpolacion y los materiales de integracion. El aplicativo los reproduce digito por digito. Si estos numeros no dan, el metodo esta mal. | `tests/casos_referencia.py`, `tests/casos_referencia_lagrange.py`, `tests/test_punto_medio.py`, `tests/test_trapecio.py` y `tests/test_simpson.py` |
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
| R1 | Alrededor de 10 metodos en el semestre | Los seis del parcial, mas Trapecio y Simpson como extension de U1, con la arquitectura ejercitada para seguir creciendo | `test_los_cuatro_metodos_del_parcial_siguen_estando` |
| R2 | Los seis del primer parcial | Cada uno con su archivo de pruebas | `test_newton_raphson.py`, `test_von_mises.py`, `test_newton_interpolation.py`, `test_lagrange_interpolation.py`, `test_punto_medio.py`, `test_runge_kutta.py` |
| R3 | La arquitectura se expande | Se escribe un metodo nuevo en disco y aparece en el registro, en la API y con sus campos, **sin tocar ningun archivo existente** | `test_extensibilidad.py` (3 pruebas) |
| R4 | 6 decimales por defecto, ajustable | Rango 2..12, recorte de valores invalidos, y que cambiar decimales **no cambie el calculo** | `test_decimales_por_defecto_son_seis`, `test_decimales_se_recortan_al_rango_permitido`, `test_los_decimales_no_cambian_los_valores_calculados` |
| R5 | Calculo hasta cualquier iteracion n | Con `stop_on_tolerance=False` corren las n iteraciones, **incluso si cae sobre una raiz exacta** | `test_config_permite_correr_n_exacto_sin_parar_por_tolerancia`, `test_una_raiz_exacta_no_recorta_las_n_iteraciones_pedidas` |
| R6 | Tabla con todas las iteraciones | Cada metodo declara sus columnas; el CSV baja la tabla completa y sin redondear | `test_las_columnas_son_las_de_la_tabla_del_docente`, `test_csv_descarga_la_tabla_real_completa_y_sin_redondear` |
| R7 | Graficacion | Las cinco clases de grafica, con sus claves de contrato, y el remuestreo al hacer zoom; integracion dibuja rectangulos, trapecios o arcos de parabola segun corresponda | `test_grafica_de_raiz_...`, `test_grafica_de_interpolacion_...`, `test_grafica_de_edo_...`, `test_grafica_de_convergencia_...`, `test_grafica_es_de_tipo_integracion_con_rectangulos_y_curva`, `test_grafica_muestra_trapecios_y_la_curva`, `test_grafica_muestra_una_parabola_por_subintervalo` |
| R8 | Polinomio expandido | El ejercicio resuelto de las diapositivas de Newton (tabla celda por celda, `a_i`, forma de Newton y `P(-4) = -8`), un caso resuelto a mano, y la propiedad de que las cuatro variantes dan el mismo polinomio | `test_la_tabla_del_docente_lleva_cada_dividida_en_la_fila_de_su_ultimo_punto`, `test_la_forma_de_newton_y_los_a_i_son_los_del_docente`, `test_el_polinomio_expandido_y_el_valor_son_los_del_docente`, `test_caso_resuelto_a_mano_devuelve_polinomio_expandido`, `test_las_cuatro_variantes_dan_el_mismo_polinomio` |
| R12 | Interpolacion de Lagrange | Los tres ejercicios de las diapositivas, cada `L_i` por separado, y que coincida con Newton sobre los mismos puntos | `test_lagrange_interpolation.py` (25 pruebas), `test_coincide_con_la_interpolacion_de_newton` |
| R13 | Metodo del Trapecio (U1) | El ejemplo del material con `exp(x^4)`, `[-1, 1]`, `n = 5`; puntos, pesos, suma y trapecios de la grafica | `test_trapecio.py` |
| R14 | Metodo de Simpson (U1) | Los dos casos del material con `sqrt(5 + x^3)` en `[0, 1]` (`n = 2` y `n = 4`), corchete e integral; puntos, pesos y parabolas de la grafica; y que coincida con `(Trapecio + 2 * Punto Medio) / 3` sobre la misma malla | `test_simpson.py`, `test_coincide_con_trapecio_y_punto_medio_combinados` |
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

Las 129 pruebas de Playwright manejan la interfaz de verdad contra el servidor
real (mas una que solo regenera las capturas del manual, a pedido). Cubren lo que romperia la demostracion:

- Resolver los siete metodos y ver la tabla con sus columnas.
- **Cargar y resolver cada ejercicio del desplegable** por la interfaz. Los
  de practica se comparan ademas contra su valor esperado, sacado de una
  formula cerrada o de la regla aplicada a mano (`presets.spec.js`). Cada
  metodo tiene que ofrecer al menos ocho.
- **Cambiar de metodo no resucita el resultado anterior**, ni siquiera moviendo
  el control de decimales.
- Una respuesta que llega tarde no se pinta sobre el metodo que el usuario
  eligio despues.
- El sistema de dos EDO dibuja sus dos series y muestra la columna de error
  vacia.
- Exportar CSV y PDF de verdad, incluida la descarga.
- Zoom, paneo, teclado, y que el remuestreo le pida los puntos al nucleo.
- Que los siete formularios y el plano entren a 320 y a 360 px.

## La interfaz por tarjetas

`tests/e2e/interfaz.spec.js` (21 pruebas) fija lo que la persona ve y toca en
la pantalla nueva:

- Las familias salen en el orden de la API, cada pestana muestra solo sus
  metodos, al volver a una familia queda marcado el ultimo metodo usado, las
  flechas del teclado cambian de familia, y una familia que la interfaz no
  conoce cae en "Otros" sin romper nada.
- El tema claro y oscuro alterna, se recuerda al recargar, repinta el plano con
  los colores nuevos, sigue al sistema si nunca se eligio, y funciona aunque el
  navegador bloquee el almacenamiento.
- Los ajustes plegados muestran lo vigente, se actualizan al cargar un
  ejercicio y llevan la flecha que indica que se abren; antes de resolver se ve la invitacion, y al cambiar de metodo el
  resumen queda vacio.
- El valor principal es la raiz, el polinomio, la integral o la `y`, segun la
  familia.
- Cada metodo tiene su formula, la de Runge-Kutta cambia con el orden (tambien
  si se escribe `2.0`), y un metodo sin formula oculta la tarjeta.
- Con colores forzados (contraste alto de Windows) se sigue viendo que familia
  y que metodo estan marcados.
- A 375 px no hay desplazamiento horizontal, los datos van antes que el
  resultado, y ni un polinomio largo ni una formula desbordan su tarjeta.

El contraste de cada par de colores se midio con la formula de WCAG 2.x, en los
dos temas: 106 pares, todos por encima del minimo. Entran los de la barra del
recorrido: el texto de la fila marcada de la tabla sobre su fondo, la barra de
esa fila, el anillo del elemento actual sobre el plano y el texto tenue sobre el
fondo de cada familia. Al medirlos, el texto tenue del tema oscuro no llegaba a
4.5:1 sobre los fondos de Interpolacion, Integracion y Otros (4.32, 4.48 y
4.41) y se aclaro de `#8a90a6` a `#9096ab`, con el mismo tono. Los dos bloques
del tema oscuro (el del boton y el del sistema) son iguales, y la medicion lo
comprueba.

Una excepcion deliberada: lo tenue del recorrido (las filas que todavia no
llegaron) se dibuja con el color de las iteraciones al 25% sobre el fondo del
plano, y eso da solo 1.37:1 en el tema claro y 1.65:1 en el oscuro. Se midio y
se acepta: son elementos de contexto, no texto ni datos que haya que leer, el
elemento de la fila elegida va a plena intensidad (3.87:1 y 7.67:1) y el 25% lo
fija el diseno del recorrido.

| Tema | Texto (minimo 4.5:1) | Bordes de controles y curvas del plano (minimo 3:1) |
|---|---|---|
| Claro | el mas bajo, 4.58:1 (texto tenue sobre el fondo de Raices) | el mas bajo, 3.13:1 (borde de los campos) |
| Oscuro | el mas bajo, 4.66:1 (texto tenue sobre el fondo de Interpolacion) | el mas bajo, 3.13:1 (borde de los campos) |

Tambien se recorrio la pagina solo con teclado: el foco sigue el orden de
lectura y siempre se ve. En la barra del recorrido, Tab llega a los cinco
botones y al deslizador en ese orden; Enter y Espacio activan cada boton (y
Reproducir pasa a Pausar sin perder el foco); en el deslizador, las flechas
mueven una fila, `Inicio` y `Fin` van a los extremos, y el contorno de foco se
ve en los dos temas.

## Comprobado en la version en linea

El sitio de GitHub Pages corre el nucleo con Pyodide, sin servidor. Antes de
cada publicacion, `tests/pages/sitio.spec.js` arma el sitio, lo sirve como
archivos estaticos bajo `/metodos-numericos-uta/` (la misma subcarpeta que usa
Pages) y verifica con Python corriendo en el navegador:

- Los 56 ejercicios del desplegable, por la interfaz, con sus valores esperados.
- El remuestreo del zoom, incluido el hueco de `1/x` en cero.
- Los errores con el mismo codigo y mensaje que en local: 422 de un metodo,
  404 de un metodo inexistente y 422 de un pedido invalido.
- La exportacion a CSV y PDF desde los botones.
- Que no quede ningun error en la consola.

Si alguna falla, el workflow no publica. `tests/test_pages.py` fija ademas que
el sitio lleve todo el codigo de `core/` y `api/`, que el puente cargue antes
que `app.js` y que la interfaz no use rutas absolutas, que en Pages apuntarian
fuera del proyecto.

## Instalacion verificada en limpio

Procedimiento completo corrido el 2026-09-18 sobre un clon nuevo, en un
entorno virgen, con la version de los seis metodos:

| Paso | Resultado |
|---|---|
| Clonar el repositorio | 13 entradas, arbol completo |
| Entorno virtual desde CPython 3.12.13 | creado |
| `pip install -e ".[dev]"` | sin errores |
| Importar las seis dependencias | todas |
| `pytest --ignore=tests/e2e` | **275 en verde** |
| `GET /` | 200, con la interfaz |
| Los ocho archivos de `web/` | 200 cada uno |
| `GET /api/methods` | 200, 6 metodos |
| `POST solve` sobre el caso del docente | 200, `x₁ = 1.26894142` |
| `POST solve` sobre el ejercicio de Newton | 200, `P(-4) = -8` |
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
4. **Quedan metodos por incorporar hasta completar la decena.** La arquitectura
   para agregarlos esta ejercitada con una prueba.
