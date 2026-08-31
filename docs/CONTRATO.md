# Contrato entre carriles

CONGELADO. Los dos carriles programan contra este documento. Cambiar algo de
aca rompe el otro carril, asi que se acuerda antes de tocarlo.

## Peticion

`POST /api/methods/{slug}/solve`

```json
{
  "params": { },
  "decimals": 6,
  "max_iterations": 50,
  "tolerance": 1e-6,
  "error_criterion": "relativo_porcentual",
  "stop_on_tolerance": true
}
```

`max_iterations` es la n que pide el docente. Con `stop_on_tolerance` en `false`
el metodo corre exactamente n iteraciones aunque ya haya convergido, que es lo
que hace falta cuando el ejercicio pide "la iteracion 7".

`error_criterion` acepta `absoluto`, `relativo` o `relativo_porcentual`.

## params de cada metodo

Ya confirmados con el docente. Lo que sigue abierto esta marcado.

### newton-raphson

```json
{ "fx": "x**3 - 2*x - 5", "x0": 2.0, "dfx": null }
```

`x_{i+1} = x_i - f(x_i) / f'(x_i)`

`dfx` en `null` es el caso normal: **la derivada la calcula el aplicativo**.
El campo existe para que el usuario tambien pueda escribirla a mano, que es
la segunda forma que pidio el docente.

### von-mises

```json
{ "fx": "exp(-x) - log(x)", "x0": 1.0, "dfx": null }
```

`x_{i+1} = x_i - f(x_i) / f'(x_0)`

Misma entrada que Newton-Raphson: **no es el metodo de las potencias para
autovalores**, es la variante de Newton-Raphson que congela la derivada en el
punto inicial. Sirve cuando `f'(x_i)` se acerca a cero y Newton-Raphson se
vuelve inestable; geometricamente traza paralelas a la primera tangente.

**El error tipico de implementacion:** el algoritmo del docente reasigna
`x_0 = x` en cada paso pero la derivada la deja en `f'(x_00)`, el x_0 original.
Si se recalcula la derivada con el x_0 actualizado, esto se convierte en
Newton-Raphson y los numeros dejan de coincidir con los de clase. La derivada
se evalua **una sola vez, antes del bucle**.

Caso de referencia con la tabla del docente en `tests/casos_referencia.py`.

### interpolacion-newton

```json
{
  "points": [[1.0, 0.0], [4.0, 1.386294], [6.0, 1.791759]],
  "x": 2.0,
  "variante": "auto"
}
```

Los puntos van en el orden en que el usuario los cargo, sin reordenar.

**El docente pide el polinomio expandido**, asi que `result` lleva:

```json
{
  "polinomio": "-0.0518731*x**2 + 0.462098*x - 0.410225",
  "valor": 0.565446,
  "grado": 2,
  "variante_usada": "divididas"
}
```

**`variante` acepta cuatro valores.** No sabemos cual espera ver el docente, y
la tabla de iteraciones se ve distinta segun cual sea, asi que estan las dos
familias y el aplicativo elige sola por defecto:

| valor | que hace |
|-------|----------|
| `auto` | por defecto. Si los x estan igualmente espaciados usa `adelante`; si no, `divididas`. |
| `divididas` | diferencias divididas. Caso general, funciona siempre. |
| `adelante` | diferencias finitas hacia adelante (Newton-Gregory). Exige x equiespaciados. |
| `atras` | diferencias finitas hacia atras. Exige x equiespaciados. |

Pedir `adelante` o `atras` con puntos no equiespaciados es `MethodError`
explicando que esa variante necesita paso constante.

El polinomio resultante es **el mismo** en las cuatro: por n+1 puntos pasa un
unico polinomio de grado n. Lo que cambia es la tabla que se muestra. Por eso
`variante_usada` viaja en el resultado, para que la interfaz pueda decir cual
salio.

### runge-kutta

Una sola ecuacion:

```json
{ "fxy": "x + y", "x0": 0.0, "y0": 1.0, "h": 0.1, "n": 5, "orden": 4 }
```

Sistema de ecuaciones (lo pidio el docente):

```json
{ "fxy": ["y2", "-y1"], "x0": 0.0, "y0": [1.0, 0.0], "h": 0.1, "n": 10, "orden": 4 }
```

En un sistema, `fxy` es una lista de expresiones y `y0` una lista de la misma
longitud. Las variables disponibles son `x` mas `y1`, `y2`, ... segun cuantas
ecuaciones haya. En una sola ecuacion la variable es `y`.

**Paso o numero de pasos, cualquiera de los dos** (lo pidio el docente).
Se aceptan `h`, `n` y `xf` en estas combinaciones:

| Viene | Se calcula |
|-------|-----------|
| `h` y `n` | `xf = x0 + n*h` |
| `h` y `xf` | `n = round((xf - x0) / h)` |
| `n` y `xf` | `h = (xf - x0) / n` |
| solo `h` | `n = max_iterations` |

Si vienen los tres y no son consistentes: `MethodError`, sin adivinar.

`orden` acepta 2 (Heun) o 4 (Runge-Kutta clasico). Por defecto 4. El docente
no confirmo cual quiere, asi que estan los dos. **Abierto.**

## Respuesta

```json
{
  "method": "newton-raphson",
  "columns": [
    {"key": "xi", "label": "xi", "numeric": true},
    {"key": "fxi", "label": "f(xi)", "numeric": true}
  ],
  "iterations": [
    {"n": 0, "values": {"xi": 2.0, "fxi": -1.0}, "error": null},
    {"n": 1, "values": {"xi": 2.1, "fxi": 0.061}, "error": 4.761905}
  ],
  "result": {"raiz": 2.094551},
  "converged": true,
  "stop_reason": "tolerancia_alcanzada",
  "decimals": 6,
  "plot": { },
  "notes": []
}
```

Reglas duras:

- `columns` manda sobre `iterations`: la tabla se dibuja recorriendo `columns`
  y buscando esa `key` en `values`. Una key que no este en `columns` no se muestra.
- La iteracion 0 siempre tiene `error: null`. No hay valor anterior con que compararla.
- **Ningun numero puede ser `Infinity` ni `NaN`.** JSON no los admite y
  `JSON.parse` los rechaza. Todo valor pasa por `core.serialization.finite_or_none`,
  que los convierte en `null`. La interfaz muestra `null` como `—` y busca la
  explicacion en `stop_reason` y `notes`.
- `stop_reason` es uno de: `tolerancia_alcanzada`, `n_iteraciones_completadas`,
  `solucion_exacta`, `divergio`, `fallo`.

## Graficas: un plano interactivo, no una imagen

El docente lo pidio **tipo GeoGebra**: plano cartesiano con ejes, cuadricula,
zoom con la rueda y paneo arrastrando. Eso tiene una consecuencia tecnica que no
es obvia.

Al hacer zoom, la curva **se tiene que recalcular en el rango visible**. Si se
dibujan siempre los mismos puntos que vinieron en la respuesta, al acercarse se
ve una linea quebrada en vez de una curva.

Quien evalua es siempre el nucleo. Si la interfaz evaluara por su cuenta harian
falta dos parsers, y dos parsers pueden discrepar justo en lo que el docente
califica.

### plot.series segun plot.kind

Lo construye `core/plots.py`. La interfaz no lee otras claves que estas.

| kind | series | remuestrea? |
|------|--------|-------------|
| `funcion_raiz` | `{"curve": {"x": [], "y": []}, "root": {"x", "y"} \| null, "iterates": [{"n", "x", "y"}]}` | si |
| `interpolacion` | `{"points": [[x, y]], "curve": {"x": [], "y": []}, "evaluated": {"x", "y"} \| null}` | si |
| `convergencia` | `{"n": [], "error": []}` (misma longitud; error admite null) | no |
| `solucion_edo` | `{"solution": {"x": [], "components": [{"name", "y": []}]}, "exact": igual \| null}` | no |

`convergencia` y `solucion_edo` no remuestrean porque son **puntos discretos**:
salieron de correr el metodo con un paso y un numero de iteraciones dados. No hay
mas resolucion que obtener sin volver a resolver. Ahi el zoom reescala la vista.

`solucion_edo` lleva **una componente por incognita**, con la misma forma tanto
para una sola ecuacion (una componente llamada `y`) como para un sistema (`y1`,
`y2`, ...). La interfaz dibuja una linea por componente sin tener que saber si
atras hay un sistema. Lo pide R9: Runge-Kutta resuelve sistemas.

### El bloque `resample`

Las graficas que si remuestrean llevan:

```json
"resample": {
  "expression": "exp(-x) - log(x)",
  "variables": ["x"],
  "domain": [0.1, 5.0]
}
```

Si `resample` es `null`, la interfaz solo reescala lo que ya tiene.

### POST /api/plot/sample

```json
{ "expression": "exp(-x) - log(x)", "variables": ["x"],
  "x_min": 0.5, "x_max": 2.0, "points": 400 }
```

Respuesta:

```json
{ "x": [0.5, 0.503, ...], "y": [1.299, 1.294, ..., null, ...] }
```

Lo resuelve `core.sampling.sample`, que ya esta hecho y probado. La ruta solo
traduce JSON.

**`y` lleva `null` donde la funcion no esta definida, y ahi la linea se corta.**
No se unen los dos lados: si se unen, `1/x` se dibuja con una raya vertical falsa
cruzando la asintota y `tan(x)` queda irreconocible.

Rango invertido, expresion invalida o pedir mas de 5000 puntos: `MethodError`,
que sale como 422.

### Como construirlo sin morir en el intento

Conviene hacerlo en dos etapas, porque la primera ya es entregable:

1. **Plano estatico.** Ejes, cuadricula, la curva con los puntos que vinieron en
   la respuesta, la raiz y los iterados marcados. Sin zoom.
2. **Interactivo.** Zoom con la rueda, paneo arrastrando, y al soltar se pide un
   muestreo nuevo del rango visible. Conviene pedir un rango mas ancho que el
   visible para que un paneo chico no dispare otra peticion, y esperar unos
   150 ms antes de pedir.

Canvas plano alcanza y sobra; no hace falta una libreria de graficas para esto,
y una libreria de charts no sirve porque estan pensadas para series de datos, no
para funciones. Sea cual sea la decision, tiene que funcionar **sin internet**:
nada traido de un CDN.

## Errores

Un fallo con causa matematica es `MethodError` y sale como **HTTP 422** con el
mensaje tal cual, que tiene que explicar la causa en terminos del problema:

```json
{"detail": "La derivada se anula en x = 1.0, el metodo no puede continuar."}
```

Metodo inexistente: **404**. Params invalidos o incompletos: **422**.
Cualquier otra excepcion es un bug: **500**, y no se le muestra al usuario.

## Arranque del registro

`api/main.py` expone `create_app(cargar_metodos: bool = True)`. En produccion
llama a `registry.load_methods()` al arrancar. Las pruebas de la API construyen
la app con `cargar_metodos=False` y registran los metodos falsos que necesiten,
para no depender de los metodos reales.

En pruebas, despues de `registry.clear()` hay que usar
`registry.load_methods(force=True)`: sin `force` el cache de imports de Python
hace que no se vuelva a registrar nada.
