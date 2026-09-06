# Informe — Aplicativo de Metodos Numericos

Universidad Tecnica de Ambato · Facultad de Ingenieria en Sistemas, Electronica
e Industrial · Carrera de Software, Nivel 3.

Asignatura: **Metodos Numericos** (UTA-FISEI-SF-MP-UB-03-01).
Docentes: Ing. Henry Cumbal, Dr. Victor Penafiel.

Repositorio: <https://github.com/Osyanne/metodos-numericos-uta>

---

## 1. Objetivo

Construir un aplicativo que resuelva los ejercicios de la asignatura mostrando
**todas las iteraciones**, con precision ajustable y graficacion, y que pueda
crecer para cubrir los aproximadamente diez metodos del semestre.

El primer parcial cubre cuatro: Newton-Raphson, Von Mises, Interpolacion de
Newton y Runge-Kutta.

No hubo especificacion escrita ni rubrica —el docente confirmo que no existe—,
asi que los requisitos se acordaron en clase y se dejaron por escrito en
[ESPECIFICACION.md](ESPECIFICACION.md), versionados junto al codigo. Ese
documento cumple la funcion que habria cumplido la rubrica.

## 2. Los cuatro metodos

### Newton-Raphson

Parte de una aproximacion `x₀` y en cada paso traza la tangente a la curva,
tomando como siguiente aproximacion el punto donde esa tangente corta el eje x:

```
x(i+1) = xᵢ − f(xᵢ) / f'(xᵢ)
```

Converge rapido, pero se vuelve problematico donde `f'(xᵢ)` se acerca a cero: la
tangente se aplana y la siguiente aproximacion se dispara lejos.

El aplicativo **deriva solo**, mostrando que derivada uso, y tambien acepta que
el usuario escriba la derivada a mano (R10).

### Von Mises

Es una variante de Newton-Raphson que **congela la derivada en el punto
inicial**:

```
x(i+1) = xᵢ − f(xᵢ) / f'(x₀)
```

Geometricamente, en vez de trazar una tangente nueva en cada paso, traza
**paralelas a la primera tangente**. Converge mas lento, pero no se rompe cuando
la derivada se acerca a cero en el camino.

> **Nota metodologica.** Al empezar se asumio que "Von Mises" era el metodo de
> las potencias para autovalores, que es el nombre con el que aparece en buena
> parte de la bibliografia. Fue un error, y obligo a rehacer parte del diseno:
> se habia previsto que algun metodo del parcial recibiria matrices. Se
> corrigio contra el material del docente (`VON MISES.pdf`). Ninguno de los
> cuatro metodos del parcial usa matrices.

Esta confusion tiene una consecuencia practica: si por descuido se recalcula la
derivada en cada paso, el metodo **sigue convergiendo y sigue pareciendo
correcto** —da una raiz valida, sin errores— pero deja de coincidir con los
numeros de clase. Por eso hay una prueba especifica que distingue las dos
tablas.

### Interpolacion de Newton

Construye el polinomio de menor grado que pasa por un conjunto de puntos, por
diferencias divididas, y lo entrega **expandido** (R8), no como producto de
factores.

Se implementaron las **cuatro variantes** —divididas, diferencias hacia
adelante, hacia atras y automatica— porque no se confirmo cual espera el
docente. El polinomio resultante es el mismo en todas; lo que cambia es la
tabla intermedia que se muestra. Hay una prueba que verifica justamente esa
equivalencia.

### Runge-Kutta

Resuelve `y' = f(x, y)` avanzando sobre una malla de paso fijo. Se
implementaron los ordenes **2 (Heun)** y **4 (clasico)**, con 4 por defecto, y
admite **sistemas de ecuaciones** (R9): las componentes se evaluan
simultaneamente en cada etapa, que es lo que distingue resolver un sistema de
resolver dos ecuaciones por separado.

La malla se define con `h` y `n`, con `h` y `xf`, o con `n` y `xf`.

## 3. Arquitectura

El aplicativo tiene tres capas y una regla que las ordena: **el nucleo es el
unico que hace matematica**.

```
core/     nucleo numerico puro, sin nada de web
api/      capa HTTP (FastAPI), traduce entre JSON y el nucleo
web/      interfaz en el navegador, sin librerias externas
```

### Por que la interfaz no calcula nada

La interfaz **nunca evalua `f(x)`**. Cuando el usuario hace zoom en el plano y
la curva necesita mas puntos, se los pide al nucleo por `POST /api/plot/sample`.

Podria parecer mas simple evaluar la expresion en JavaScript. El problema es que
serian **dos analizadores de expresiones distintos**, y dos analizadores pueden
discrepar justo en lo que el docente revisa: en como interpretan `2x`, o `x^3`,
o el orden de las operaciones. Un mismo ejercicio daria un numero en la tabla y
otro en la grafica.

### Como se agrega un metodo

Crear un archivo en `core/methods/`, construir un `MethodSpec` y registrarlo.
El registro lo descubre solo al importar el paquete, y **la interfaz dibuja el
formulario a partir de los campos que el metodo declara**, sin saber de que
metodo se trata.

Eso cumple R3, y no como promesa: `tests/test_extensibilidad.py` escribe un
metodo nuevo en disco, recarga el registro y verifica que aparezca en la API con
sus campos y resolviendo, sin haber tocado ningun archivo existente.

### Decisiones que vale la pena justificar

**`decimals` es formato, no calculo.** Los datos viajan con toda su precision y
se redondean al mostrarlos. Redondear al guardar degradaria la grafica, el CSV y
el remuestreo del zoom, y **no se puede deshacer**. Hay una prueba parametrizada
que compara `decimals=2` contra `decimals=10` en los cuatro metodos y verifica
que los valores calculados sean identicos.

**Sin librerias externas en el navegador.** El aplicativo tiene que funcionar
sin internet para poder demostrarlo en el laboratorio. El plano cartesiano esta
dibujado a mano sobre Canvas.

**Se ejecuta desde una copia del repositorio**, no como paquete instalado: la
interfaz vive en `web/`, al lado de `api/`. Si esa carpeta falta, el servidor no
arranca y lo dice, en vez de levantar una API sin pantalla.

## 4. Validacion

El detalle esta en [VALIDACION.md](VALIDACION.md). En resumen:

| | |
|---|---|
| Pruebas de Python | **197**, todas en verde |
| Pruebas de navegador (Playwright) | **35**, todas en verde |
| Instalacion probada en limpio | clon nuevo, entorno virgen, 197 en verde y la interfaz sirviendo |

La vara principal es la **tabla del docente**: `f(x) = e⁻ˣ − ln(x)` con `x₀ = 1`.
El aplicativo la reproduce fila por fila, columna por columna, incluida la de
error.

![Tabla de iteraciones](capturas/02-tabla-iteraciones.png)

La distincion que se cuido en todas las pruebas: **ningun numero esperado se
obtuvo corriendo el aplicativo**. Salen del material del docente, de una
solucion analitica conocida, de un ejercicio resuelto a mano, o son propiedades
que tienen que cumplirse siempre. Escribir en la prueba lo que el codigo ya
devolvia congela tambien el error.

### Dos hallazgos que valen mas que las pruebas que pasan

**El ejercicio propuesto de la diapositiva 10 diverge, y esta bien que diverja.**
`4x³ − 18x² + 12x − 6 = 0` con `x₀ = 1.165`: la unica raiz real esta en
3.81699684, donde `f'` vale +49.6 contra los −13.65 congelados en el punto
inicial. El factor de amplificacion queda cerca de 4.6, muy por encima de 1, y
la sucesion se aleja. El aplicativo lo reporta con la causa escrita y **no
inventa una raiz**. Newton-Raphson resuelve el mismo ejercicio sin problema: el
obstaculo es del metodo, no del enunciado.

**Runge-Kutta no reporta error por iteracion, y esa columna vacia es la
respuesta correcta.** Lo que se mostraba era la diferencia entre `y(i+1)` e
`yᵢ`, que mide cuanto cambio la solucion entre pasos y no cuanto se equivoca.
Con el oscilador `y₁' = y₂`, `y₂' = −y₁` esa columna llegaba a **342 %** justo
donde la solucion cruza el cero, mientras el error verdadero contra `cos(1.6)`
era de **1.3 × 10⁻⁶**.

![Plano con un sistema de dos EDO](capturas/03-plano.png)

## 5. Limitaciones

Se declaran en vez de esconderse.

1. **Runge-Kutta no estima el error por iteracion.** Hacerlo bien requiere
   resolver otra vez con la mitad del paso y comparar, y antes hay que decidir
   si se estima error local o global y como agregarlo en un sistema. Se dejo
   fuera de este parcial por eso, no por olvido.
2. **Los metodos 5 a 10 no estan implementados.** La arquitectura para
   agregarlos si, y esta ejercitada con una prueba que la usa de verdad.
3. **Interpolacion trae las cuatro variantes** porque no se confirmo cual se
   espera. Sobra codigo, pero no falta.

## 6. Preguntas abiertas al docente

1. **¿La divergencia del ejercicio de la diapositiva 10 es a proposito?** El
   aplicativo la reporta correctamente, con la causa. Saber si el ejercicio
   busca eso cambia como se presenta en la sustentacion.
2. **¿Que variante de Interpolacion de Newton espera ver**, divididas o
   diferencias finitas? No bloquea: estan las cuatro.

## 7. Conclusiones

El aplicativo cumple los once requisitos acordados, cada uno con la prueba que
lo respalda en [VALIDACION.md](VALIDACION.md).

Lo que mas costo no fue implementar los metodos, sino **darse cuenta de cuando
un resultado correcto se estaba presentando mal**. Los tres casos que aparecieron
—la raiz dibujada sobre un ejercicio que diverge, el 342 % de una solucion
exacta al sexto decimal, y una tabla que reaparecia bajo el nombre de otro
metodo— tenian en comun que el calculo estaba bien y la pantalla mentia. Ninguno
lo detecto la suite de pruebas del nucleo; los tres aparecieron al revisar la
salida contra lo que el usuario iba a entender.

De ahi la decision de que la columna de error de Runge-Kutta quede **vacia**. Un
numero que nadie puede interpretar es peor que ningun numero: invita a leerlo
como si significara algo.

## Referencias

- Material de clase: `VON MISES.pdf`, diapositivas 7 y 10.
- Silabo de Metodos Numericos, UTA-FISEI-SF-MP-UB-03-01.
- Documentacion tecnica del proyecto: [ESPECIFICACION.md](ESPECIFICACION.md),
  [CONTRATO.md](CONTRATO.md), [VALIDACION.md](VALIDACION.md),
  [MANUAL.md](MANUAL.md).
