// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, widget contents, scene
// summaries, messages of the Configuration screen. Vocabulary of the Gladys
// interface (appareil / Gerät / dispositivo, scène / Szene / escena) and of
// public transport (arrêt, ligne, passage, info trafic). The names of stops
// and lines and the destinations stay as the CTS writes them; the traffic
// messages come in French, English or German (French for Spanish).
// -----------------------------------------------------------------------------

import { minutesLeft } from './departures.js';

const BRAND = 'CTS';
import { formatTime } from './time.js';

const LANGUAGES = ['en', 'fr', 'de', 'es'];
const TEXTS = {
  stopDeviceName: {
    en: 'CTS {stop}',
    fr: 'CTS {stop}',
    de: 'CTS {stop}',
    es: 'CTS {stop}',
  },
  featureNext: {
    en: 'Next passage',
    fr: 'Prochain passage',
    de: 'Nächste Abfahrt',
    es: 'Próximo paso',
  },
  featureWait: {
    en: 'Wait',
    fr: 'Attente',
    de: 'Wartezeit',
    es: 'Espera',
  },
  featureFollowing: {
    en: 'Wait for the following one',
    fr: 'Attente du suivant',
    de: 'Wartezeit der folgenden',
    es: 'Espera del siguiente',
  },
  featureMessages: {
    en: 'Traffic messages of its lines',
    fr: 'Infos trafic de ses lignes',
    de: 'Verkehrsmeldungen ihrer Linien',
    es: 'Avisos de tráfico de sus líneas',
  },
  featureStatus: {
    en: 'Traffic',
    fr: 'Trafic',
    de: 'Verkehr',
    es: 'Tráfico',
  },
  featureLineMessages: {
    en: 'Traffic messages',
    fr: 'Infos trafic',
    de: 'Verkehrsmeldungen',
    es: 'Avisos de tráfico',
  },
  tramLineLabel: {
    en: 'Tram {line}',
    fr: 'Tram {line}',
    de: 'Tram {line}',
    es: 'Tranvía {line}',
  },
  busLineLabel: {
    en: 'Line {line}',
    fr: 'Ligne {line}',
    de: 'Linie {line}',
    es: 'Línea {line}',
  },
  tramDeviceName: {
    en: 'CTS tram {line}',
    fr: 'CTS tram {line}',
    de: 'CTS Tram {line}',
    es: 'CTS tranvía {line}',
  },
  busDeviceName: {
    en: 'CTS line {line}',
    fr: 'CTS ligne {line}',
    de: 'CTS Linie {line}',
    es: 'CTS línea {line}',
  },
  state_unknown: {
    en: 'Unknown',
    fr: 'Inconnu',
    de: 'Unbekannt',
    es: 'Desconocido',
  },
  state_normal: {
    en: 'Normal service',
    fr: 'Trafic normal',
    de: 'Normaler Betrieb',
    es: 'Servicio normal',
  },
  state_info: {
    en: 'Information',
    fr: 'Information',
    de: 'Information',
    es: 'Información',
  },
  state_disrupted: {
    en: 'Disrupted',
    fr: 'Perturbé',
    de: 'Gestört',
    es: 'Alterado',
  },
  state_major: {
    en: 'Heavily disrupted',
    fr: 'Très perturbé',
    de: 'Stark gestört',
    es: 'Muy alterado',
  },
  kind_disruption: {
    en: 'Disruption',
    fr: 'Perturbation',
    de: 'Störung',
    es: 'Incidencia',
  },
  kind_planned_disruption: {
    en: 'Planned disruption',
    fr: 'Perturbation prévue',
    de: 'Geplante Störung',
    es: 'Incidencia prevista',
  },
  kind_works: {
    en: 'Works',
    fr: 'Travaux',
    de: 'Bauarbeiten',
    es: 'Obras',
  },
  kind_information: {
    en: 'Information',
    fr: 'Information',
    de: 'Information',
    es: 'Información',
  },
  stateWithTitle: {
    en: '{state}: {title}',
    fr: '{state} : {title}',
    de: '{state}: {title}',
    es: '{state}: {title}',
  },
  upcomingState: {
    en: 'Coming',
    fr: 'À venir',
    de: 'Demnächst',
    es: 'Próximamente',
  },
  wholeNetwork: {
    en: 'the whole network',
    fr: 'tout le réseau',
    de: 'das gesamte Netz',
    es: 'toda la red',
  },
  wholeNetworkShort: {
    en: 'Network',
    fr: 'Réseau',
    de: 'Netz',
    es: 'Red',
  },
  noPassage: {
    en: 'No passage announced',
    fr: 'Aucun passage annoncé',
    de: 'Keine Abfahrt angekündigt',
    es: 'Ningún paso anunciado',
  },
  minutesValue: {
    en: '{n} min',
    fr: '{n} min',
    de: '{n} Min.',
    es: '{n} min',
  },
  approaching: {
    en: 'Approaching',
    fr: 'À l’approche',
    de: 'Fährt ein',
    es: 'Llegando',
  },
  inMinutes: {
    en: 'in {n} min',
    fr: 'dans {n} min',
    de: 'in {n} Min.',
    es: 'dentro de {n} min',
  },
  atTime: {
    en: 'at {time}',
    fr: 'à {time}',
    de: 'um {time}',
    es: 'a las {time}',
  },
  scheduledMark: {
    en: '(timetable)',
    fr: '(théorique)',
    de: '(Fahrplan)',
    es: '(teórico)',
  },
  summarySoon: {
    en: '{line} towards {destination} leaves {stop} in {minutes} min ({time}).',
    fr: '{line} vers {destination} passe à {stop} dans {minutes} min ({time}).',
    de: '{line} Richtung {destination} fährt an {stop} in {minutes} Min. ab ({time}).',
    es: '{line} hacia {destination} pasa por {stop} dentro de {minutes} min ({time}).',
  },
  summarySoonScheduled: {
    en: '{line} towards {destination} leaves {stop} in {minutes} min ({time}, timetable).',
    fr: '{line} vers {destination} passe à {stop} dans {minutes} min ({time}, horaire théorique).',
    de: '{line} Richtung {destination} fährt an {stop} in {minutes} Min. ab ({time}, laut Fahrplan).',
    es: '{line} hacia {destination} pasa por {stop} dentro de {minutes} min ({time}, horario teórico).',
  },
  summaryMessage: {
    en: 'CTS {kind} ({lines}): {title}',
    fr: 'CTS {kind} ({lines}) : {title}',
    de: 'CTS {kind} ({lines}): {title}',
    es: 'CTS {kind} ({lines}): {title}',
  },
  summaryMessageUpdated: {
    en: 'CTS {kind} updated ({lines}): {title}',
    fr: 'CTS {kind} mise à jour ({lines}) : {title}',
    de: 'CTS {kind} aktualisiert ({lines}): {title}',
    es: 'CTS {kind} actualizada ({lines}): {title}',
  },
  summaryDisrupted: {
    en: '{line}: {state}.',
    fr: '{line} : {state}.',
    de: '{line}: {state}.',
    es: '{line}: {state}.',
  },
  summaryDisruptedTitle: {
    en: '{line}: {state}. {title}',
    fr: '{line} : {state}. {title}',
    de: '{line}: {state}. {title}',
    es: '{line}: {state}. {title}',
  },
  summaryRestored: {
    en: '{line}: back to normal ({state}).',
    fr: '{line} : retour à la normale ({state}).',
    de: '{line}: wieder normal ({state}).',
    es: '{line}: vuelta a la normalidad ({state}).',
  },
  summaryLineState: {
    en: '{line}: {state}. {title}',
    fr: '{line} : {state}. {title}',
    de: '{line}: {state}. {title}',
    es: '{line}: {state}. {title}',
  },
  summaryLineStateOnly: {
    en: '{line}: {state}.',
    fr: '{line} : {state}.',
    de: '{line}: {state}.',
    es: '{line}: {state}.',
  },
  outputNext: {
    en: 'Next passage at {stop}: {line} towards {destination} {when}.',
    fr: 'Prochain passage à {stop} : {line} vers {destination} {when}.',
    de: 'Nächste Abfahrt an {stop}: {line} Richtung {destination} {when}.',
    es: 'Próximo paso en {stop}: {line} hacia {destination} {when}.',
  },
  outputFollowing: {
    en: 'The following one {when}.',
    fr: 'Le suivant {when}.',
    de: 'Die folgende {when}.',
    es: 'El siguiente {when}.',
  },
  outputNone: {
    en: 'No passage announced at {stop}.',
    fr: 'Aucun passage annoncé à {stop}.',
    de: 'Keine Abfahrt an {stop} angekündigt.',
    es: 'Ningún paso anunciado en {stop}.',
  },
  readAt: {
    en: 'read at {time}',
    fr: 'lu à {time}',
    de: 'gelesen um {time}',
    es: 'leído a las {time}',
  },
  updatedAt: {
    en: 'CTS · updated at {time}',
    fr: 'CTS · mis à jour à {time}',
    de: 'CTS · aktualisiert um {time}',
    es: 'CTS · actualizado a las {time}',
  },
  timetableStar: {
    en: '* timetable only',
    fr: '* horaire théorique',
    de: '* nur Fahrplan',
    es: '* horario teórico',
  },
  minutesShort: {
    en: 'min',
    fr: 'min',
    de: 'Min.',
    es: 'min',
  },
  trafficTitle: {
    en: 'CTS traffic',
    fr: 'Trafic CTS',
    de: 'CTS Verkehrslage',
    es: 'Tráfico CTS',
  },
  periodFromTo: {
    en: '{start} → {end}',
    fr: '{start} → {end}',
    de: '{start} → {end}',
    es: '{start} → {end}',
  },
  periodFrom: {
    en: 'from {start}',
    fr: 'depuis {start}',
    de: 'seit {start}',
    es: 'desde {start}',
  },
  noMessage: {
    en: 'No traffic message under way.',
    fr: 'Aucune info trafic en cours.',
    de: 'Keine aktuelle Verkehrsmeldung.',
    es: 'Ningún aviso de tráfico en curso.',
  },
  widgetNoStop: {
    en: 'No stop is followed: add one on the Configuration screen of the integration, or type one in the widget settings.',
    fr: 'Aucun arrêt n’est suivi : ajoutez-en un dans l’écran Configuration de l’intégration, ou saisissez-en un dans les réglages du widget.',
    de: 'Keine Haltestelle wird verfolgt: Füge eine im Konfigurationsbildschirm der Integration hinzu oder gib eine in den Widget-Einstellungen ein.',
    es: 'No se sigue ninguna parada: añade una en la pantalla Configuración de la integración, o escribe una en los ajustes del widget.',
  },
  widgetNoLine: {
    en: 'No line or stop is followed: add a line or a stop on the Configuration screen of the integration, or type lines in the widget settings.',
    fr: 'Aucune ligne ni aucun arrêt n’est suivi : ajoutez une ligne ou un arrêt dans l’écran Configuration de l’intégration, ou saisissez des lignes dans les réglages du widget.',
    de: 'Keine Linie und keine Haltestelle wird verfolgt: Füge im Konfigurationsbildschirm der Integration eine Linie oder Haltestelle hinzu oder gib Linien in den Widget-Einstellungen ein.',
    es: 'No se sigue ninguna línea ni parada: añade una línea o una parada en la pantalla Configuración de la integración, o escribe líneas en los ajustes del widget.',
  },
  statusNoKey: {
    en: 'Enter the token of the CTS API on the Configuration screen (ask for access to the open data portal at open-data@cts-strasbourg.fr).',
    fr: 'Saisissez le jeton de l’API de la CTS dans l’écran Configuration (accès au portail open data à demander à open-data@cts-strasbourg.fr).',
    de: 'Gib das Token der CTS-API im Konfigurationsbildschirm ein (Zugang zum Open-Data-Portal bei open-data@cts-strasbourg.fr anfragen).',
    es: 'Escribe el token de la API de la CTS en la pantalla Configuración (acceso al portal open data a solicitar en open-data@cts-strasbourg.fr).',
  },
  statusAuth: {
    en: 'The CTS API refuses the token: check it on the Configuration screen.',
    fr: 'L’API de la CTS refuse le jeton : vérifiez-le dans l’écran Configuration.',
    de: 'Die CTS-API lehnt das Token ab: Prüfe es im Konfigurationsbildschirm.',
    es: 'La API de la CTS rechaza el token: compruébalo en la pantalla Configuración.',
  },
  statusThrottled: {
    en: 'The CTS API asks to slow down: readings resume at {time}.',
    fr: 'L’API de la CTS demande de ralentir : reprise des lectures à {time}.',
    de: 'Die CTS-API bittet um weniger Anfragen: Abfragen ab {time}.',
    es: 'La API de la CTS pide reducir el ritmo: las lecturas se reanudan a las {time}.',
  },
  statusUnreachable: {
    en: 'The CTS API does not answer ({detail}). Next try in {minutes} min.',
    fr: 'L’API de la CTS ne répond pas ({detail}). Nouvel essai dans {minutes} min.',
    de: 'Die CTS-API antwortet nicht ({detail}). Neuer Versuch in {minutes} Min.',
    es: 'La API de la CTS no responde ({detail}). Nuevo intento dentro de {minutes} min.',
  },
  statusConnected: {
    en: 'Connected to the CTS: {stops} stop(s) read every {interval} s, {lines} line(s) followed.',
    fr: 'Connecté à la CTS : {stops} arrêt(s) lus toutes les {interval} s, {lines} ligne(s) suivie(s).',
    de: 'Mit der CTS verbunden: {stops} Haltestelle(n) alle {interval} s gelesen, {lines} Linie(n) verfolgt.',
    es: 'Conectado a la CTS: {stops} parada(s) leídas cada {interval} s, {lines} línea(s) seguida(s).',
  },
  statusNotFound: {
    en: 'Unknown or ambiguous: {names}.',
    fr: 'Inconnu ou ambigu : {names}.',
    de: 'Unbekannt oder mehrdeutig: {names}.',
    es: 'Desconocido o ambiguo: {names}.',
  },
  statusNothing: {
    en: 'Token saved. Add a stop or a line on the Configuration screen.',
    fr: 'Jeton enregistré. Ajoutez un arrêt ou une ligne dans l’écran Configuration.',
    de: 'Token gespeichert. Füge im Konfigurationsbildschirm eine Haltestelle oder Linie hinzu.',
    es: 'Token guardado. Añade una parada o una línea en la pantalla Configuración.',
  },
  linesUnknown: {
    en: 'Lines unknown to the CTS: {names}.',
    fr: 'Lignes inconnues de la CTS : {names}.',
    de: 'Der CTS unbekannte Linien: {names}.',
    es: 'Líneas desconocidas para la CTS: {names}.',
  },
  testNetworkOk: {
    en: 'Stops and lines of the CTS read: {stops} stops, {lines} lines',
    fr: 'Arrêts et lignes de la CTS lus : {stops} arrêts, {lines} lignes',
    de: 'Haltestellen und Linien der CTS gelesen: {stops} Haltestellen, {lines} Linien',
    es: 'Paradas y líneas de la CTS leídas: {stops} paradas, {lines} líneas',
  },
  testStopsError: {
    en: 'Stop list: {error}',
    fr: 'Liste des arrêts : {error}',
    de: 'Haltestellenliste: {error}',
    es: 'Lista de paradas: {error}',
  },
  testTraffic: {
    en: 'traffic: {count} message(s) on the network',
    fr: 'trafic : {count} message(s) sur le réseau',
    de: 'Verkehr: {count} Meldung(en) im Netz',
    es: 'tráfico: {count} aviso(s) en la red',
  },
  testTrafficError: {
    en: 'traffic: {error}',
    fr: 'trafic : {error}',
    de: 'Verkehr: {error}',
    es: 'tráfico: {error}',
  },
  testStop: {
    en: '{stop}: {count} passage(s), next {next}',
    fr: '{stop} : {count} passage(s), prochain {next}',
    de: '{stop}: {count} Abfahrt(en), nächste {next}',
    es: '{stop}: {count} paso(s), próximo {next}',
  },
  testStopError: {
    en: '{stop}: {error}',
    fr: '{stop} : {error}',
    de: '{stop}: {error}',
    es: '{stop}: {error}',
  },
  testNoStop: {
    en: 'no stop followed yet',
    fr: 'aucun arrêt suivi pour l’instant',
    de: 'noch keine Haltestelle verfolgt',
    es: 'aún no se sigue ninguna parada',
  },
  unknownEntry: {
    en: 'unknown or ambiguous: {name}',
    fr: 'inconnu ou ambigu : {name}',
    de: 'unbekannt oder mehrdeutig: {name}',
    es: 'desconocido o ambiguo: {name}',
  },
  errorUnreachable: {
    en: 'the CTS API does not answer',
    fr: 'l’API de la CTS ne répond pas',
    de: 'die CTS-API antwortet nicht',
    es: 'la API de la CTS no responde',
  },
  errorBusy: {
    en: 'the CTS server is busy, try again in a moment',
    fr: 'le serveur de la CTS est occupé, réessayez dans un instant',
    de: 'der CTS-Server ist ausgelastet, versuche es gleich noch einmal',
    es: 'el servidor de la CTS está ocupado, inténtalo de nuevo en un momento',
  },
  errorAuth: {
    en: 'the token is refused',
    fr: 'le jeton est refusé',
    de: 'das Token wird abgelehnt',
    es: 'el token es rechazado',
  },
  errorThrottled: {
    en: 'the CTS API asks to slow down',
    fr: 'l’API de la CTS demande de ralentir',
    de: 'die CTS-API bittet um weniger Anfragen',
    es: 'la API de la CTS pide reducir el ritmo',
  },
  errorNoKey: {
    en: 'no token: enter it on the Configuration screen',
    fr: 'pas de jeton : saisissez-le dans l’écran Configuration',
    de: 'kein Token: Gib es im Konfigurationsbildschirm ein',
    es: 'sin token: escríbelo en la pantalla Configuración',
  },
  errorInvalid: {
    en: 'the CTS API refuses the request',
    fr: 'l’API de la CTS refuse la requête',
    de: 'die CTS-API lehnt die Anfrage ab',
    es: 'la API de la CTS rechaza la petición',
  },
  errorNetwork: {
    en: 'the stops and lines of the CTS cannot be read',
    fr: 'les arrêts et lignes de la CTS ne peuvent pas être lus',
    de: 'die Haltestellen und Linien der CTS können nicht gelesen werden',
    es: 'las paradas y líneas de la CTS no se pueden leer',
  },
  searchTooShort: {
    en: 'Type at least two letters of the stop name.',
    fr: 'Saisissez au moins deux lettres du nom de l’arrêt.',
    de: 'Gib mindestens zwei Buchstaben des Haltestellennamens ein.',
    es: 'Escribe al menos dos letras del nombre de la parada.',
  },
  searchNone: {
    en: 'No stop matches "{query}".',
    fr: 'Aucun arrêt ne correspond à « {query} ».',
    de: 'Keine Haltestelle passt zu „{query}“.',
    es: 'Ninguna parada coincide con «{query}».',
  },
  searchFound: {
    en: 'Type the name, or a code in brackets (the number: every side; with its letter: one side):\n{list}',
    fr: 'Saisissez le nom, ou un code entre crochets (le nombre : tous les quais ; avec sa lettre : un seul quai) :\n{list}',
    de: 'Gib den Namen oder einen Code in Klammern ein (die Zahl: alle Steige; mit Buchstabe: ein Steig):\n{list}',
    es: 'Escribe el nombre, o un código entre corchetes (el número: todos los andenes; con su letra: un solo andén):\n{list}',
  },
  searchMore: {
    en: '… and {n} more: add words to the name.',
    fr: '… et {n} autres : ajoutez des mots au nom.',
    de: '… und {n} weitere: Füge dem Namen Wörter hinzu.',
    es: '… y {n} más: añade palabras al nombre.',
  },
  stopAdded: {
    en: 'Stop added: {name}. {count} stop(s) followed. Its device is offered in the Discover tab.',
    fr: 'Arrêt ajouté : {name}. {count} arrêt(s) suivi(s). Son appareil est proposé dans l’onglet Découvrir.',
    de: 'Haltestelle hinzugefügt: {name}. {count} Haltestelle(n) verfolgt. Ihr Gerät wird im Tab Entdecken angeboten.',
    es: 'Parada añadida: {name}. {count} parada(s) seguida(s). Su dispositivo se ofrece en la pestaña Descubrir.',
  },
  stopAlreadyFollowed: {
    en: '{name} is already followed.',
    fr: '{name} est déjà suivi.',
    de: '{name} wird bereits verfolgt.',
    es: '{name} ya se sigue.',
  },
  stopsFull: {
    en: 'Already {max} stops added: remove one first.',
    fr: 'Déjà {max} arrêts ajoutés : retirez-en un d’abord.',
    de: 'Bereits {max} Haltestellen hinzugefügt: entferne zuerst eine.',
    es: 'Ya hay {max} paradas añadidas: quita una primero.',
  },
  stopRemoved: {
    en: 'Stop removed: {name}. Delete its device in Gladys if you no longer want it.',
    fr: 'Arrêt retiré : {name}. Supprimez son appareil dans Gladys si vous n’en voulez plus.',
    de: 'Haltestelle entfernt: {name}. Lösche ihr Gerät in Gladys, wenn du es nicht mehr brauchst.',
    es: 'Parada quitada: {name}. Borra su dispositivo en Gladys si ya no lo quieres.',
  },
  stopRemoveUnknown: {
    en: 'No added stop matches "{query}": type its number given by "List the stops".',
    fr: 'Aucun arrêt ajouté ne correspond à « {query} » : saisissez son numéro donné par « Lister les arrêts ».',
    de: 'Keine hinzugefügte Haltestelle passt zu „{query}“: gib ihre Nummer aus „Haltestellen auflisten“ ein.',
    es: 'Ninguna parada añadida coincide con «{query}»: escribe su número dado por «Listar las paradas».',
  },
  stopRemoveAmbiguous: {
    en: 'Several added stops match "{query}": type the number given by "List the stops".',
    fr: 'Plusieurs arrêts ajoutés correspondent à « {query} » : saisissez le numéro donné par « Lister les arrêts ».',
    de: 'Mehrere hinzugefügte Haltestellen passen zu „{query}“: gib die Nummer aus „Haltestellen auflisten“ ein.',
    es: 'Varias paradas añadidas coinciden con «{query}»: escribe el número dado por «Listar las paradas».',
  },
  stopInForm: {
    en: '{name} is stop {slot} of the form: empty its field, then save the configuration.',
    fr: '{name} est l’arrêt {slot} du formulaire : videz son champ, puis enregistrez la configuration.',
    de: '{name} ist Haltestelle {slot} des Formulars: leere ihr Feld und speichere dann die Konfiguration.',
    es: '{name} es la parada {slot} del formulario: vacía su campo y guarda la configuración.',
  },
  stopsNone: {
    en: 'No stop followed yet: fill in a stop of the form or press "Add a stop".',
    fr: 'Aucun arrêt suivi pour l’instant : remplissez un arrêt du formulaire ou appuyez sur « Ajouter un arrêt ».',
    de: 'Noch keine Haltestelle verfolgt: fülle eine Haltestelle im Formular aus oder drücke „Haltestelle hinzufügen“.',
    es: 'Aún no se sigue ninguna parada: rellena una parada del formulario o pulsa «Añadir una parada».',
  },
  stopsList: {
    en: '{count} stop(s) followed:\n{list}',
    fr: '{count} arrêt(s) suivi(s) :\n{list}',
    de: '{count} Haltestelle(n) verfolgt:\n{list}',
    es: '{count} parada(s) seguida(s):\n{list}',
  },
  stopFromForm: {
    en: 'form, stop {slot}',
    fr: 'formulaire, arrêt {slot}',
    de: 'Formular, Haltestelle {slot}',
    es: 'formulario, parada {slot}',
  },
  stopUnknownMark: {
    en: 'unknown or ambiguous',
    fr: 'inconnu ou ambigu',
    de: 'unbekannt oder mehrdeutig',
    es: 'desconocido o ambiguo',
  },
  diagnosticDone: {
    en: 'Diagnostic written to the Logs tab ({count} line(s) starting with "CTS diagnostic"). The token is not in it.',
    fr: 'Diagnostic écrit dans l’onglet Journaux ({count} ligne(s) commençant par « CTS diagnostic »). Le jeton n’y figure pas.',
    de: 'Diagnose in den Tab Protokolle geschrieben ({count} Zeile(n), beginnend mit „CTS diagnostic“). Das Token steht nicht darin.',
    es: 'Diagnóstico escrito en la pestaña Registros ({count} línea(s) que empiezan por «CTS diagnostic»). El token no figura en él.',
  },
};

/**
 * @description Whether a value is a supported language.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language, its placeholders filled.
 * @param {string} key - A TEXTS key.
 * @param {string} language - The language (English when unknown).
 * @param {object} [values] - The placeholder values.
 * @returns {string} The text.
 * @example
 * t('inMinutes', 'fr', { n: 3 }); // -> 'dans 3 min'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[isLanguage(language) ? language : 'en'] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    values[name] === undefined || values[name] === null ? '' : String(values[name]),
  );
}

/**
 * @description A text in the four languages.
 * @param {string} key - A TEXTS key.
 * @param {object|Function} [values] - The values, or `(language) => values`.
 * @returns {object} `{ en, fr, de, es }`.
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
}

/**
 * @description When a passage comes, in a sentence: "in 3 min", "at 10:32".
 * @param {object} passage - The passage.
 * @param {object} options - `{ language, now, timeZone }`.
 * @returns {string} The words.
 */
function passageWhen(passage, { language, now, timeZone }) {
  const minutes = minutesLeft(passage, now);
  if (minutes >= 60) {
    return t('atTime', language, { time: formatTime(passage.at, timeZone) });
  }
  return minutes === 0
    ? t('approaching', language).toLowerCase()
    : t('inMinutes', language, { n: minutes });
}

/**
 * @description The short time of a passage, as on the screens of the stops:
 * "3 min", "10:32", "Approaching".
 * @param {object} passage - The passage.
 * @param {object} options - `{ language, now, timeZone }`.
 * @returns {string} The time.
 */
function passageShort(passage, { language, now, timeZone }) {
  const minutes = minutesLeft(passage, now);
  if (minutes >= 60) {
    return formatTime(passage.at, timeZone);
  }
  return minutes === 0 ? t('approaching', language) : t('minutesValue', language, { n: minutes });
}

/**
 * @description One line for a passage: "A → Illkirch · 3 min", "(timetable)"
 * when it is not followed live.
 * @param {object|null} passage - The passage, null when none.
 * @param {object} options - `{ language, now, timeZone }`.
 * @returns {string} The text.
 */
function passageText(passage, options) {
  if (!passage) {
    return t('noPassage', options.language);
  }
  const head = passage.destination ? `${passage.line} → ${passage.destination}` : passage.line;
  const mark = passage.realtime ? '' : ` ${t('scheduledMark', options.language)}`;
  return `${head} · ${passageShort(passage, options)}${mark}`;
}

/**
 * @description How a line reads: "Tram A", "Ligne 2".
 * @param {{ name: string, mode: string }} line - The line.
 * @param {string} language - The language.
 * @returns {string} The label.
 */
function lineLabel(line, language) {
  return t(line.mode === 'tram' ? 'tramLineLabel' : 'busLineLabel', language, {
    line: line.name,
  });
}

/**
 * @description The name of the device of a line: "CTS tram A", "CTS ligne 2".
 * @param {{ name: string, mode: string }} line - The line.
 * @param {string} language - The language.
 * @returns {string} The name.
 */
function lineDeviceName(line, language) {
  return t(line.mode === 'tram' ? 'tramDeviceName' : 'busDeviceName', language, {
    brand: BRAND,
    line: line.name,
  });
}

/**
 * @description The label of a state of a line.
 * @param {string} state - unknown, normal, info, disrupted, major.
 * @param {string} language - The language.
 * @returns {string} The label.
 */
const lineStateText = (state, language) => t(`state_${state}`, language);

/**
 * @description The label of a kind of message.
 * @param {string} channel - disruption, planned_disruption, works, information.
 * @param {string} language - The language.
 * @returns {string} The label.
 */
const kindText = (channel, language) => t(`kind_${channel}`, language);

export {
  LANGUAGES,
  TEXTS,
  isLanguage,
  t,
  all,
  passageWhen,
  passageShort,
  passageText,
  lineLabel,
  lineDeviceName,
  lineStateText,
  kindText,
};
