# CTS Strasbourg

## Presentación

Esta integración trae a Gladys los **tranvías y autobuses de Estrasburgo** (CTS, Compagnie des Transports Strasbourgeois). Da los **próximos pasos en tiempo real** en las paradas que elijas (tres en el formulario, hasta 7 más con un botón), filtrados por línea y dirección, y el **tráfico de las líneas** que sigues: servicio normal, alterado, muy alterado, con los avisos de tráfico de la CTS (incidencias, obras, información). Cada parada y cada línea se convierte en un dispositivo para mostrar en un panel y usar en escenas.

Los datos proceden de la **API oficial en tiempo real de la CTS** (SIRI-lite), bajo la Licence Ouverte 2.0. Necesita un **token personal**, gratuito: la CTS abre el acceso a su portal open data a petición. Los nombres y códigos de las paradas y líneas proceden de los horarios abiertos de la CTS (GTFS), leídos una vez por semana: buscar una parada no gasta ninguna petición.

Cada parada seguida es una petición por lectura, cada minuto por defecto; el tráfico se lee cada 5 minutos. La integración guarda cada respuesta mientras la API la declara válida, y hace una pausa de 5 minutos si la API pide reducir el ritmo. De noche, mientras ninguna parada anuncie nada en los próximos 45 minutos, las paradas se leen cada 10 minutos.

Un paso se **sigue en tiempo real** cuando la CTS sabe dónde está el vehículo; si no, es el **horario teórico**, marcado «(teórico)» (una estrella en el widget). La API no da retrasos ni viajes suprimidos: la integración nunca los inventa.

Es una integración **cloud**: contacta `api.cts-strasbourg.eu` (con tu token y los códigos de tus paradas) y `opendata.cts-strasbourg.eu` (los horarios abiertos). Nada más sale de tu red.

La integración se escribió a partir de la descripción publicada de la API (swagger.json); aún no se ha probado con un token real. Tus comentarios son bienvenidos.

## Requisitos

- Gladys Assistant 5.3.0 o posterior.
- Un token personal de la API de la CTS: solicita el acceso al portal open data por correo a `open-data@cts-strasbourg.fr`, con unas palabras sobre tu uso (por ejemplo «domótica Gladys Assistant»), y copia el token mostrado en tu cuenta open data.

## Configuración

| Campo                  | Qué escribir                                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Token                  | El token de tu cuenta open data de la CTS. Guardado como secreto, nunca escrito en los registros.                             |
| Parada 1, 2, 3         | El nombre de la parada («Homme de Fer», «Gare Centrale») o su código: «275» para toda la parada, «275A» para un andén.        |
| Línea                  | Solo esta línea: «A», «C1», «2», o un modo solo: «tram», «bus». Vacío: todas las líneas de la parada.                         |
| Dirección              | Solo los destinos que contienen estas palabras: «Illkirch», «Illkirch \| Lixenbuhl». Vacío: ambos sentidos.                   |
| Líneas seguidas        | Las líneas cuyo tráfico sigues, separadas por comas: «A, C, 2, C1» (hasta 10). Un dispositivo por línea.                      |
| Lectura de las paradas | Cada 30 segundos, cada minuto (por defecto), cada 2 minutos o cada 5 minutos.                                                 |
| Idioma de los textos   | Nombres de los dispositivos, resúmenes y salidas de las escenas, e idioma de los avisos de tráfico (francés, inglés, alemán). |

El botón **Buscar una parada** da las paradas que contienen unas palabras, con sus códigos: «Homme de Fer [275] (275A, 275B, 275C, 275D)». El número designa toda la parada, en todos los sentidos; con su letra, un solo andén. **Probar la conexión** lee las paradas y líneas de la CTS, cada parada seguida y el tráfico de inmediato, e indica qué respondió.

Más paradas que las tres del formulario (casa, trabajo, colegio…): **Añadir una parada** toma los mismos tres campos — parada, línea, dirección — y sigue hasta 7 paradas más. **Listar las paradas** muestra todas las paradas seguidas, numeradas; **Quitar una parada** toma ese número (o el nombre). Las paradas añadidas se guardan en la configuración de Gladys, así que siguen sus copias de seguridad.

## Uso

### Dispositivos

En la pestaña **Descubrir**, crea los dispositivos que quieras:

- **CTS \<parada\>**: el próximo paso como texto («A → Illkirch Graffenstaden · 3 min»), la espera del próximo paso y del siguiente (minutos), y el número de avisos de tráfico en curso sobre las líneas de la parada (incluidos los de toda la red). De noche, sin pasos, las esperas conservan su último valor.
- **CTS tranvía A**, **CTS línea 2**: el tráfico de la línea como texto («Alterado: Tram C : accident à Esplanade») y su número de avisos de tráfico en curso.

### Tráfico de las líneas

El estado de una línea es su aviso en curso más grave: una **incidencia** la deja alterada (muy alterada cuando la CTS la marca urgente), una **incidencia prevista** alterada, unas **obras** alterada o muy alterada cuando desvían o interrumpen la línea, una **información** deja el servicio normal. Un aviso sobre toda la red cuenta para cada línea. Los textos de la CTS existen en francés, inglés y alemán (en francés para el español).

### Widgets del panel

![El widget de salidas CTS en Homme de Fer y el widget del tráfico (ilustración generada, no una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-cts-strasbourg/main/docs/assets/widgets.es.png)

- **Salidas**: los próximos pasos de una parada, en compacto. Una fila por línea y destino, con sus próximos pasos seguidos («3 · 9 min»); una estrella marca un horario solo teórico. El ajuste **Trayectos mostrados** fija el número de filas. Elige una parada seguida, o escribe cualquier parada (y una línea) en los ajustes del widget: tal parada cuesta una petición más en cada actualización, como mucho cada minuto. Con **Varias paradas**, un solo widget muestra varios dispositivos de parada.
- **Tráfico CTS**: el estado de las líneas seguidas (o de las líneas escritas en los ajustes, o las líneas de tranvía si no se sigue ninguna), y luego sus avisos en curso y próximos. Toca una tarjeta para el texto completo.

### Escenas

Disparadores, una vez por cambio (la primera lectura solo sirve de referencia):

- **CTS: salida en breve**: un tranvía o autobús en una parada seguida sale dentro de 2, 3, 5, 10, 15 o 20 minutos.
- **CTS: línea alterada**: una línea seguida pasa a alterada o muy alterada.
- **CTS: fin de la incidencia**: una línea seguida que estaba alterada vuelve a la normalidad.
- **CTS: nuevo aviso de tráfico**: un nuevo aviso sobre una línea seguida, las líneas de una parada seguida o toda la red; filtros por tipo (incidencia, incidencia prevista, obras, información) y prioridad. Una actualización vuelve a disparar cuando la CTS pide notificarla.

Cada uno da una frase lista, `{{triggerEvent.data.summary}}`, y sus valores (línea, destino, hora, título, texto, periodo…). Las acciones **CTS: próximas salidas** y **CTS: tráfico de una línea** devuelven el mismo tipo de valores, para ponerlos en un mensaje o probarlos en una condición.

Ejemplos:

- Cuando el tranvía A hacia Illkirch sale de Homme de Fer dentro de 5 minutos → poner la lámpara de la entrada en verde.
- Cuando el tranvía C pasa a alterado → enviar el resumen a tu teléfono antes de salir.
- Cada día laborable a las 7:30 → leer los próximos pasos de tu parada y hacer que el altavoz de la cocina los anuncie.

### Transporte

Solo cloud: los datos vienen de internet. Solo se piden a la API las paradas que sigues, una a una, y el tráfico de la red cada 5 minutos.

## Solución de problemas

- **«Escribe el token»**: falta el token; solicita el acceso en `open-data@cts-strasbourg.fr` y pega el token de tu cuenta open data en la configuración.
- **«La API de la CTS rechaza el token»**: compruébalo (sin espacios antes ni después); la integración no vuelve a preguntar hasta que se guarde la configuración.
- **«La API de la CTS pide reducir el ritmo»**: la API respondió 429; las lecturas se reanudan tras 5 minutos. Sigue menos paradas o elige un intervalo más largo.
- **«Desconocido o ambiguo»**: usa **Buscar una parada** y copia el nombre exacto o un código.
- **«(teórico)» tras un paso**: la CTS no sigue ese vehículo en tiempo real; la hora es la de los horarios.
- **Ningún paso**: de noche la red duerme; las paradas se leen cada 10 minutos.
- **Para informar de un problema**: pulsa **Diagnóstico** y copia las líneas que empiezan por «CTS diagnostic» de la pestaña Registros (el token no figura en ellas) en un issue de GitHub o una respuesta en el foro, con las versiones de Gladys y de la integración.
