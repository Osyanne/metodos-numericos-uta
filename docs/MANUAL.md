# Manual de usuario

Aplicativo de Metodos Numericos — UTA, FISEI, Software Nivel 3.

Para instalarlo, ver el [README](../README.md). Este manual es para usarlo.

![Pantalla principal](capturas/01-pantalla-principal.png)

Arriba se elige el metodo. Debajo, la pantalla se arma en tarjetas numeradas
en el orden en que se usan: a la izquierda **1 · Datos** y los ajustes de
calculo; a la derecha **2 · Resultado**, la **Formula** del metodo y
**3 · Grafica y tabla**, con dos vistas: **Plano** e **Iteraciones**. En un
celular las tarjetas van una debajo de otra, en ese mismo orden.

El boton de la luna (o del sol), arriba a la derecha, cambia entre tema claro y
oscuro. La eleccion se recuerda; si nunca se toco, se sigue el tema del sistema.

## 1. Elegir el metodo

Los metodos estan agrupados por familia, en pestanas: **Raices**,
**Interpolacion**, **Integracion** y **EDO**. Cada familia tiene su color, que
tine los botones y los pasos mientras se trabaja en ella. Debajo de las
pestanas, un boton por metodo de esa familia; abajo aparece una linea que
explica que hace el elegido. Con el teclado, las flechas recorren las familias y
los metodos.

Al volver a una familia queda marcado el ultimo metodo que se uso en ella.

La tarjeta **Formula** muestra la formula del metodo en cuanto se elige, antes
de resolver, con la notacion de clase. En Runge-Kutta cambia segun el orden
(2 o 4) que se escriba en el formulario.

| Metodo | Sirve para |
|---|---|
| Newton-Raphson | encontrar una raiz de `f(x) = 0` |
| Von Mises | lo mismo, con la derivada congelada en el punto inicial |
| Interpolacion de Newton | armar el polinomio que pasa por unos puntos, y evaluarlo |
| Interpolacion de Lagrange | lo mismo, por polinomios base en vez de diferencias divididas |
| Punto Medio | aproximar una integral definida con rectangulos centrados |
| Método del Trapecio | aproximar una integral definida con segmentos rectos y trapecios |
| Método de Simpson | aproximar una integral definida con arcos de parabola |
| Runge-Kutta | resolver una EDO o un sistema de EDO |

**Cambiar de metodo borra lo que haya en pantalla.** Es a proposito: una tabla
que quedo de otro metodo se lee como si fuera del nuevo.

## 2. Cargar los datos

Hay dos formas.

**Con un ejercicio de ejemplo.** El desplegable "Ejercicio de ejemplo" carga un
problema completo de una sola vez: la funcion, el punto inicial, la precision,
el criterio de error, todo. Debajo aparece de donde salio ese ejercicio. Los
ejercicios del material del docente estan ahi, junto con ejercicios de
practica (los que empiezan con "Practica"), hasta sumar ocho por metodo.
Cada ejercicio de practica dice en su descripcion el valor exacto o el que
da la regla, para comparar.

**A mano.** El formulario se arma solo segun lo que el metodo pida. Las
casillas marcadas "opcional" se pueden dejar vacias y el metodo aplica su
criterio; las demas son obligatorias.

### Como escribir las funciones

Se escriben casi como en clase:

| Se escribe | Significa |
|---|---|
| `x^3` o `x**3` | x al cubo |
| `2x` | 2 por x |
| `exp(-x)` | e elevado a −x |
| `log(x)` | logaritmo natural (`ln`) |
| `sqrt(x)` | raiz cuadrada |
| `sin(x)`, `cos(x)`, `tan(x)` | trigonometricas |
| `pi`, `E` | las constantes |

Si algo esta mal escrito, el aplicativo lo dice en palabras —que falta un
parentesis, que uso un nombre que no existe— en vez de mostrar un error de
programa.

### Puntos, sistemas y derivadas

- **Los dos metodos de interpolacion** piden una tabla de puntos. El boton
  agrega filas. Una fila a medio llenar se rechaza: no se convierte en el punto
  (0, 0). **Los puntos se usan en el orden en que se cargaron**, sin ordenarlos
  por x: asi la tabla se puede comparar fila por fila con la del pizarron.
- **Interpolacion de Newton** tiene una casilla `variante`, opcional. Viene con
  `divididas`, y vacia usa lo mismo: **diferencias divididas**, que es lo que se
  ve en clase. Cada diferencia va en la fila de su ultimo punto, como en el
  pizarron, asi que los `a_i` del resumen se leen sobre la diagonal de la tabla.
  Las otras opciones (`auto`, `adelante`, `atras`) muestran la misma respuesta
  con otra tabla intermedia; `adelante` y `atras` necesitan que los x esten
  igualmente espaciados y lo avisan si no lo estan.
- **Interpolacion de Lagrange** no tiene variantes. Su tabla no son
  iteraciones: cada fila es un paso del procedimiento, con el numerador y el
  denominador de cada `L_i` escritos tal como se hacen a mano. Esas columnas
  llevan expresiones, no numeros, asi que el control de decimales no las toca.
- **Runge-Kutta** acepta un sistema. El boton agrega ecuaciones, y las
  incognitas se llaman `y1`, `y2`, ... Con una sola ecuacion la incognita se
  llama `y`. La malla se define con `h` y `n`, con `h` y `xf`, o con `n` y `xf`.
- **Punto Medio, Método del Trapecio y Método de Simpson** piden `f(x)`, los
  extremos `a`, `b` y el numero de subintervalos `n`. En los tres aparece
  arriba la integral que se va a resolver. Punto Medio evalua el centro de cada
  intervalo; Trapecio muestra sus extremos con peso 1 o 2 y los une con
  segmentos rectos.
- **Método de Simpson** pide `n` par, como el material. Con `n = 2` usa una
  sola parabola por `a`, el punto medio y `b`; con `n` mayor, `n` subintervalos
  y el punto medio de cada uno. La tabla nombra cada punto (`x0`, `m1`, `x1`,
  ...; `m` es la x con barra del material) y termina con la suma del corchete,
  que se multiplica por `(b − a)/(6n)`.
- **Newton-Raphson** deriva solo. Si se escribe la derivada en su casilla, usa
  esa. En las dos formas dice abajo cual uso.

## 3. Ajustar el calculo

Los ajustes van plegados en **Ajustes de calculo**, debajo de los datos. El
renglon plegado dice lo que esta vigente, por ejemplo
`tol 0.000001 · máx 50 · relativo %` (y `sin parar` si se destildo la casilla),
asi que un ejercicio de ejemplo que los cambie se nota sin abrirlos.

El control de **Decimales** no esta ahi sino en la tarjeta de Resultado, junto a
los numeros que cambia.

| Control | Que hace |
|---|---|
| **Decimales** | Cuantos decimales se muestran. **Solo afecta la pantalla**: no se recalcula nada, y se puede mover despues de resolver. |
| **Iteraciones maximas (n)** | Cuantas iteraciones como maximo. |
| **Tolerancia** | Cuando se considera alcanzada la precision. |
| **Criterio de error** | Absoluto, relativo o relativo porcentual. El porcentual es el que usa el docente en su tabla, y es el que viene por defecto. |
| **Parar al alcanzar la tolerancia** | Destildado, corre **exactamente n iteraciones** aunque ya haya convergido. Sirve para pedir "hasta la iteracion 5" y ver las cinco filas. |

## 4. Resolver

El boton **Resolver** calcula y llena la tarjeta de Resultado y las dos vistas
de la grafica. Antes de resolver, la tarjeta de Resultado lo indica con una
linea de ayuda.

El numero que se vino a buscar va primero y en grande: la raiz, el polinomio,
la integral o la `y` final, segun la familia. El resto del resumen va al lado,
mas chico.

Arriba del resultado aparece una insignia con el motivo por el que se
detuvo:

| Insignia | Significa |
|---|---|
| Alcanzo la tolerancia | Converge. |
| Solucion exacta | Cayo justo sobre la raiz. |
| Integracion completada | Runge-Kutta o una regla de integracion recorrio su malla. Es el final normal. |
| Completo las n iteraciones sin alcanzar la tolerancia | Se quedo sin iteraciones. Subir n o aflojar la tolerancia. |
| El metodo diverge | Se aleja en vez de acercarse. **No hay raiz**, y el aplicativo no inventa una. Debajo explica por que. |

Debajo van las notas: que derivada se uso, cuanto vale la derivada congelada,
por que se detuvo.

### La tabla de iteraciones

![Tabla de iteraciones](capturas/02-tabla-iteraciones.png)

Una fila por iteracion, con las columnas propias del metodo. La primera fila no
lleva error: no hay valor anterior con que compararla.

Una raya `—` significa que ese valor no existe. En Runge-Kutta y en las reglas
de integracion **toda** la columna de error es raya: un metodo de malla fija no
produce una estimacion de error por fila, y la nota lo explica.

### El plano

![Plano interactivo](capturas/03-plano.png)

Es un plano de verdad, no una imagen:

- **Rueda del mouse** para acercar y alejar.
- **Arrastrar el fondo** para mover.
- **Los circulos de color** son datos del problema y se pueden arrastrar (ver
  la seccion 6).
- **Doble clic** vuelve a la vista inicial.
- Con el plano **enfocado** (haciendo clic o con Tab): flechas para mover, `+`
  y `−` para el zoom, `Home` para volver al inicio.
- **Un clic** sobre un punto elige esa fila del recorrido (ver la seccion 5).
- **Ajustar** encuadra todo lo dibujado; **Vista inicial** vuelve al encuadre
  original.

Al acercarse, la curva **se recalcula**: se le piden puntos nuevos al nucleo en
el rango visible. No se ve quebrada al hacer zoom, y los valores son los mismos
que los de la tabla porque los calcula el mismo codigo.

## 5. Recorrer las iteraciones

![Recorrido en la iteracion 1 de Von Mises](capturas/04-recorrido.png)

La captura esta acercada a la raiz para que se vea el elemento de la
iteracion 1, resaltado, y los de las filas siguientes, tenues.

Despues de resolver, el aplicativo no solo muestra el final: se puede ir paso a
paso, como en el pizarron. Arriba del plano aparece una barra con cinco botones
y un deslizador; queda a la vista tambien en la pestana **Iteraciones**. Al resolver queda en la **ultima fila**; para volver a mirar
desde el principio se pulsa **Primera fila**.

| Control | Que hace |
|---|---|
| **Primera fila** (triangulo hacia la izquierda con una barra) | Va a la primera fila. |
| **Fila anterior** (doble triangulo hacia la izquierda) | Va a la fila anterior. |
| **Reproducir** (triangulo hacia la derecha) | Avanza solo, fila por fila, hasta el final y se detiene. Si ya estaba en la ultima, empieza desde la primera. El mismo boton pasa a **Pausar** (dos barras verticales) mientras corre. |
| **Fila siguiente** (doble triangulo hacia la derecha) | Va a la fila siguiente. |
| **Ultima fila** (triangulo hacia la derecha con una barra) | Va a la ultima fila. |
| **Deslizador** | Se arrastra hasta la fila que se quiera. Con el teclado: ← y → de a una fila, `Inicio` y `Fin` a los extremos. |

A la derecha del deslizador un rotulo dice donde se esta, con la misma palabra y
el mismo numero que la tabla: "iteracion 3 de 12" en las raices, "punto 2 de 4"
en interpolacion, Trapecio y Simpson, "subintervalo 5 de 10" en Punto Medio y
"paso 3 de 10" en Runge-Kutta. Von Mises con el ejercicio del docente va de la
iteracion 0 a la 12 y termina en "iteracion 12 de 12".

Tambien se puede elegir la fila sin la barra:

- **En la tabla**, con un clic en la fila (pestana **Iteraciones**).
- **En el plano**, con un clic sobre un punto, o sobre el rectangulo, el
  trapecio o la parabola de esa fila. Un clic es un toque corto: si se arrastra
  para mover la vista, no elige nada. Si no hay ningun elemento cerca, el clic
  no cambia la fila.

Una vez elegida la fila, todo se mueve junto:

- **En el plano** lo que ya paso (hasta la fila elegida) se ve normal; lo que
  viene despues se ve **tenue**, y el elemento de la fila elegida va
  **resaltado** con un anillo y un trazo mas grueso. Las curvas de referencia,
  como `f(x)`, el polinomio o la solucion exacta, se ven siempre. El resultado
  final (la raiz, el punto evaluado) queda tenue hasta llegar a la ultima fila.
  En Interpolacion de Lagrange, ademas, se dibuja la curva del termino de esa
  fila.
- **En la tabla** la fila elegida queda marcada con fondo de color y una barra a
  la izquierda; si la pestana **Iteraciones** esta abierta, se desplaza hasta
  ella al mover el recorrido.
- **Bajo el plano**, una **franja** repite los valores de esa fila, columna por
  columna, para leerlos sin buscar en la tabla.
- **En la tarjeta Formula**, debajo de la formula general, aparece la misma
  formula con los numeros de la fila: "En la iteracion n:" (o "En el punto n",
  "En el subintervalo n", "En el paso n") seguido de la sustitucion. Los numeros
  negativos van entre parentesis. En Runge-Kutta se escribe una linea por cada
  incognita del sistema. En Newton-Raphson y Von Mises, si la fila cae justo en
  la raiz (f(x) = 0) el metodo no avanza: en vez de la division se lee
  `raiz exacta: el metodo no avanza`.

Algunas cosas conviene saberlas:

- **Decimales no mueve la fila.** Cambiar los decimales solo reescribe los
  numeros de la franja y de la formula; el recorrido queda donde estaba.
- **Reproducir se detiene** al pulsar cualquier otro control del recorrido, al
  cambiar de metodo y al **Resolver** de nuevo o **Comparar metodos**. Resolver
  deja el recorrido en la ultima fila del resultado nuevo.
- **No hay barra** si el resultado tiene una sola fila (por ejemplo, cuando el
  punto inicial ya es la raiz) y tampoco mientras se muestra una comparacion: ahi
  el plano vuelve a dibujar todas las curvas, sin resaltar ninguna.
- **Recorrer no recalcula nada**: los numeros de la franja y de la formula son
  los que ya calculo el metodo, solo se muestran.
- Si un metodo diverge, tambien se puede recorrer; las filas con valores que no
  existen muestran una raya.

## 6. Arrastrar en el plano

![Arrastrando el x0 de Newton-Raphson](capturas/05-arrastre.png)

Despues de resolver, los datos del problema aparecen en el plano como
**circulos de color** que se pueden tomar con el mouse (o con el dedo) y mover:

| Familia | Que se arrastra |
|---|---|
| Raices | El valor inicial `x0`, sobre el eje x. |
| Interpolacion | Cada punto `P0`, `P1`... en cualquier direccion, y el `x` a evaluar sobre el eje x. |
| Integracion | Los extremos `a` y `b`, sobre el eje x. |
| EDO | La condicion inicial (`x0`, `y0`); en un sistema, una por incognita. |

Mientras se arrastra, el campo del formulario cambia a la vez y el metodo **se
vuelve a resolver en vivo**: el plano y el numero del resultado cambian varias
veces por segundo. La tabla, la franja y el recorrido esperan a que se suelte;
al soltar quedan en la ultima fila del resultado nuevo, como despues de
**Resolver**. En la captura, el `x0` de √2 se lleva de 1 a 0.6 y se ven las
tangentes nuevas.

- El valor se redondea a lo que se distingue en pantalla: con la vista
  inicial, a centesimos; acercandose aparecen mas decimales.
- El dato no sale de la vista. Para llevarlo mas lejos, alejar el zoom o
  escribirlo en el formulario.
- Un clic corto sobre un circulo no lo mueve: sigue eligiendo la fila de ese
  punto (seccion 5).
- Si el metodo no acepta el valor (por ejemplo `a` mas alla de `b`, dos puntos
  con la misma `x`, o una derivada que se anula), el dibujo anterior queda
  tenue y el motivo aparece bajo el plano. Al volver a un valor valido todo
  vuelve a la normalidad; si se suelta ahi, el dato vuelve al ultimo valor que
  funciono y un aviso lo explica.
- Todo lo que se hace arrastrando se puede hacer escribiendo en el formulario y
  pulsando **Resolver**.
- En la version en linea (GitHub Pages) Python corre en el navegador: el
  recalculo es mas lento y la pagina puede trabarse un instante mientras
  calcula.

## 7. Comparar metodos

**Comparar metodos** resuelve el mismo problema con todos los metodos que
reciben los mismos datos, y arma una tabla con iteraciones, resultado, error
final y estado. En el plano se superponen las curvas de convergencia.

El caso interesante es **Newton-Raphson contra Von Mises**: misma funcion, mismo
punto inicial, y se ve para que sirve congelar la derivada y lo que cuesta.

Menos iteraciones no siempre es mejor: un metodo puede converger rapido en un
punto y romperse en otro.

## 8. Exportar

**Exportar CSV** baja la tabla completa. **Exportar PDF** baja un documento con
el metodo, la funcion, los parametros, la tabla y el resultado.

Los numeros van **sin redondear**, con toda la precision con que se calcularon.
El control de decimales es de la pantalla: redondear al mostrar se puede
deshacer, redondear al guardar no.

## Preguntas que aparecen seguido

**Puse 6 decimales y la grafica no cambio.**
Correcto. Los decimales son de la pantalla. La grafica y el CSV usan los valores
completos.

**Runge-Kutta no me muestra el error.**
Tampoco deberia. Ver arriba.

**Dice que diverge, pero el ejercicio es del profesor.**
Puede ser las dos cosas. El ejercicio de la diapositiva 10 de `VON MISES.pdf`
diverge con Von Mises y converge con Newton-Raphson: es una propiedad del
metodo, no un error del aplicativo. Se explica en
[VALIDACION.md](VALIDACION.md).

**No me aparece la interfaz, solo datos.**
Se esta pidiendo una direccion de la API en vez de la raiz. Abrir
<http://127.0.0.1:8000>.

**Necesito internet para usarlo.**
No. No hay ninguna libreria externa: funciona con la maquina desconectada.
