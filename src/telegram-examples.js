// Shared by the browser preview and the server: examples never use live readings.
export const telegramExamples={
 test:{label:'Comprobar conexión',detail:'Tu cuenta puede recibir mensajes del bot.'},
 yellow:{label:'🟡 Aviso amarillo',detail:'Nivel de ejemplo: 70 cm.\nSe alcanzó el umbral amarillo del ejemplo.'},
 red:{label:'🔴 Alerta roja',detail:'Nivel de ejemplo: 90 cm.\nSe alcanzó el umbral rojo del ejemplo.'},
 error:{label:'🛠️ Error del sensor',detail:'El sensor del ejemplo no proporciona una lectura válida.\nNo interpretes el cero como nivel real.'},
 normal:{label:'🟢 Recuperación a normal',detail:'Nivel de ejemplo: 25 cm.\nLa lectura del ejemplo volvió al rango normal.'}
};
export function telegramExampleMessage(kind='test'){
 const example=telegramExamples[kind];if(!Object.hasOwn(telegramExamples,kind))throw Error('Tipo de prueba no válido.');
 return ['PRUEBA · '+example.label,'Hackeando las inundaciones','Estación de ejemplo · Datos simulados',example.detail,'No es una alerta real. No modifica las mediciones, la calibración ni el historial de tus estaciones.'].join('\n\n');
}
