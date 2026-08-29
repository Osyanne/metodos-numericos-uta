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

Provisional donde lo diga: depende de respuestas del docente que estan en
[ESPECIFICACION.md](ESPECIFICACION.md).

### newton-raphson

```json
{ "fx": "x**3 - 2*x - 5", "x0": 2.0, "dfx": null }
```

`dfx` en `null` significa que la derivada la calcula el aplicativo. Si el
docente pide que la ingrese el usuario, llega como string. **Provisional.**

### interpolacion-newton

```json
{ "points": [[1.0, 0.0], [4.0, 1.386294], [6.0, 1.791759]], "x": 2.0 }
```

Los puntos van en el orden en que el usuario los cargo, sin ordenar. La
variante (diferencias divididas o finitas) esta sin confirmar. **Provisional.**

### von-mises

```json
{ "matrix": [[4, 1, 0], [1, 3, 1], [0, 1, 2]], "vector": [1.0, 1.0, 1.0] }
```

Matriz cuadrada en row-major. `vector` es el vector inicial; si viene vacio se
usa el de unos. **Provisional.**

### runge-kutta

```json
{ "fxy": "x + y", "x0": 0.0, "y0": 1.0, "h": 0.1, "xf": 0.5 }
```

Con `xf` presente el numero de pasos sale de `(xf - x0) / h`, recortado por
`max_iterations`. Sin `xf`, se corren `max_iterations` pasos. **Provisional.**

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

## plot.series segun plot.kind

Lo construye `core/plots.py`. La interfaz no lee otras claves que estas.

| kind | series |
|------|--------|
| `funcion_raiz` | `{"curve": {"x": [], "y": []}, "root": {"x", "y"} \| null, "iterates": [{"n", "x", "y"}]}` |
| `interpolacion` | `{"points": [[x, y]], "curve": {"x": [], "y": []}, "evaluated": {"x", "y"} \| null}` |
| `convergencia` | `{"n": [], "error": []}` (misma longitud; error admite null) |
| `solucion_edo` | `{"solution": {"x": [], "y": []}, "exact": {"x": [], "y": []} \| null}` |

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
