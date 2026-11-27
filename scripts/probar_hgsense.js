/* Pruebas de humo de js/core/hgsense.js. Uso: node scripts/probar_hgsense.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ruta = path.join(__dirname, '..', 'js', 'core', 'hgsense.js');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ruta, 'utf8'), ctx, { filename: ruta });
const H = ctx.window.G4G && ctx.window.G4G.hgsense;
if (!H) { console.error('FALLO: hgsense.js no definió window.G4G.hgsense'); process.exit(1); }

let fallos = 0;
function caso(nombre, fn) {
  try { fn(); console.log('ok     ' + nombre); }
  catch (e) { fallos++; console.log('FALLO  ' + nombre + ' -> ' + e.message); }
}
function igual(real, esperado, msg) { if (real !== esperado) throw new Error((msg || '') + ' esperado ' + esperado + ', obtenido ' + real); }
function cerca(real, esperado, tol, msg) { if (!(Math.abs(real - esperado) <= tol)) throw new Error((msg || '') + ' esperado ~' + esperado + ' (+-' + tol + '), obtenido ' + real); }

caso('1. agua limpia RGB(234,194,32) => ~1,3 ppb, verde', () => {
  const r = H.analizarRgb(234, 194, 32, 'agua');
  cerca(r.ppb, 1.3, 0.1, 'ppb');
  igual(r.semaforo, 'verde', 'semaforo');
});

caso('2. efluente RGB(235,212,102) => ~44 ppb, rojo', () => {
  const r = H.analizarRgb(235, 212, 102, 'agua');
  cerca(r.ppb, 44.4, 0.5, 'ppb');
  igual(r.semaforo, 'rojo', 'semaforo');
});

caso('3. lodo: factor x10 y semaforo propio', () => {
  const agua = H.analizarRgb(235, 204, 64, 'agua'), lodo = H.analizarRgb(235, 204, 64, 'lodo');
  cerca(lodo.ppb, agua.ppb * 10, 1e-9, 'x10');
  cerca(lodo.ppb, 209.3, 1, 'ppb lodo');
  igual(lodo.semaforo, 'rojo', 'semaforo lodo');
  igual(H.semaforo('lodo', H.analizarRgb(234, 194, 32, 'lodo').ppb), 'verde', 'lodo limpio');
});

caso('4. ceros y valores extremos no producen NaN ni fallan', () => {
  const hsv = H.rgbToHsv(0, 0, 0);
  igual(hsv.h, 0, 'h'); igual(hsv.s, 0, 's'); igual(hsv.v, 0, 'v');
  igual(H.estimarPpb({ s: 87.2, matriz: 'agua' }).ppb, 0, 'blanco => 0 ppb');
  igual(H.estimarPpb({ s: 100, matriz: 'lodo' }).ppb, 0, 'S mayor que el blanco => 0 ppb');
  const r = H.promedioRoi({ data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4 }, 0, 0, 50);
  igual(r.n, 16, 'recorte a los bordes');
  igual(r.r + r.g + r.b, 0, 'promedio de ceros');
  igual(H.semaforo('agua', NaN), null, 'NaN');
  igual(H.calidadRoi(0, 0, 0).ok, false, 'negro no es valido');
  igual(H.calidadRoi(235, 195, 30).ok, true, 'blanco de referencia es valido');
  igual(H.calidadRoi(250, 250, 240).ok, true, 'liquido casi transparente es valido');
  let lanzo = false; try { H.estimarPpb({ s: 50, matriz: 'aire' }); } catch (e) { lanzo = true; }
  igual(lanzo, true, 'matriz invalida debe lanzar error');
});

caso('5. limites 5/20 (agua) y 50/170 (lodo)', () => {
  const a = (p) => H.semaforo('agua', p), l = (p) => H.semaforo('lodo', p);
  igual(a(4.99), 'verde', 'agua 4,99'); igual(a(5), 'amarillo', 'agua 5'); igual(a(20), 'amarillo', 'agua 20'); igual(a(20.01), 'rojo', 'agua 20,01');
  igual(l(49.99), 'verde', 'lodo 49,99'); igual(l(50), 'amarillo', 'lodo 50'); igual(l(170), 'amarillo', 'lodo 170'); igual(l(170.01), 'rojo', 'lodo 170,01');
  igual(/no son límites legales/.test(H.UMBRALES.fuente), true, 'los umbrales se declaran como cortes de campo, no límites legales');
  igual(H.CALIBRACION.estado, 'referencial', 'calibracion');
});

console.log(fallos ? '\n' + fallos + ' caso(s) con fallo.' : '\nTodos los casos pasaron.');
process.exit(fallos ? 1 : 0);
