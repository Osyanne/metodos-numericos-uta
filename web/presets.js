// Casos completos para la demostracion. Las fuentes distinguen el material
// docente de los ejemplos del contrato y las pruebas; no se calculan valores
// numericos en el navegador ni se modifican los datos de referencia Python.

const CONFIG_RAICES = {
  decimals: 8,
  max_iterations: 50,
  tolerance: 0.000001,
  error_criterion: "relativo_porcentual",
  stop_on_tolerance: true,
};

const CONFIG_MALLA = { ...CONFIG_RAICES, decimals: 6, stop_on_tolerance: false };

export const PRESETS = [
  {
    id: "newton-clasico",
    metodo: "newton-raphson",
    nombre: "Ejemplo clásico · x³ − 2x − 5",
    fuente: "docs/CONTRATO.md y tests/test_newton_raphson.py",
    descripcion: "Ejemplo clásico del contrato: x₀ = 2. La derivada la calcula el aplicativo.",
    params: { fx: "x^3 - 2*x - 5", x0: 2, dfx: null },
    config: { ...CONFIG_RAICES },
  },
  {
    id: "von-mises-docente",
    metodo: "von-mises",
    nombre: "Docente · e⁻ˣ − ln(x)",
    fuente: "VON MISES.pdf, diapositiva 7; tests/casos_referencia.py",
    descripcion: "Caso resuelto del docente: x₀ = 1, con la derivada congelada en el punto inicial.",
    params: { fx: "exp(-x) - log(x)", x0: 1, dfx: null },
    config: { ...CONFIG_RAICES },
  },
  {
    id: "von-mises-divergente",
    metodo: "von-mises",
    nombre: "Docente · ejercicio divergente",
    fuente: "VON MISES.pdf, diapositiva 10; tests/casos_referencia.py",
    descripcion: "Ejercicio propuesto: 4x³ − 18x² + 12x − 6, x₀ = 1.165. Con Von Mises diverge; se muestra la causa.",
    params: { fx: "4*x**3 - 18*x**2 + 12*x - 6", x0: 1.165, dfx: null },
    config: { ...CONFIG_RAICES },
  },
  {
    id: "interpolacion-logaritmo",
    metodo: "interpolacion-newton",
    nombre: "Ejemplo del contrato · ln(2)",
    fuente: "docs/CONTRATO.md",
    descripcion: "Interpola los puntos (1, 0), (4, 1.386294) y (6, 1.791759) en x = 2, con diferencias divididas.",
    params: { points: [[1, 0], [4, 1.386294], [6, 1.791759]], x: 2, variante: "divididas" },
    config: { ...CONFIG_RAICES },
  },
  {
    id: "interpolacion-cuadratica",
    metodo: "interpolacion-newton",
    nombre: "Demo · puntos equiespaciados",
    fuente: "tests/test_newton_interpolation.py",
    descripcion: "Caso de prueba resuelto a mano: (0, 1), (1, 2), (2, 5). Evalúa en x = 3 y elige diferencias hacia adelante.",
    params: { points: [[0, 1], [1, 2], [2, 5]], x: 3, variante: "auto" },
    config: { ...CONFIG_RAICES },
  },
  {
    id: "runge-kutta-escalar",
    metodo: "runge-kutta",
    nombre: "Ejemplo del contrato · y′ = x + y",
    fuente: "docs/CONTRATO.md",
    descripcion: "Ecuación escalar: y(0) = 1, h = 0.1, cinco pasos hasta x = 0.5, Runge-Kutta de orden 4.",
    params: { fxy: "x + y", x0: 0, y0: 1, h: 0.1, n: 5, xf: null, orden: 4 },
    config: { ...CONFIG_MALLA },
  },
  {
    id: "runge-kutta-sistema",
    metodo: "runge-kutta",
    nombre: "Demo · oscilador de dos EDO",
    fuente: "tests/test_runge_kutta.py; demostración hasta x = 1.6 en HANDOFF.md",
    descripcion: "Sistema y₁′ = y₂, y₂′ = −y₁; y₁(0) = 1, y₂(0) = 0. Dieciséis pasos de 0.1 para observar el cruce por cero.",
    params: { fxy: ["y2", "-y1"], x0: 0, y0: [1, 0], h: 0.1, n: 16, xf: null, orden: 4 },
    config: { ...CONFIG_MALLA },
  },
];

export function presetsPara(slug) {
  return PRESETS.filter(preset => preset.metodo === slug);
}
