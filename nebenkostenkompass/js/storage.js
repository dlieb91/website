/* Speicherschicht: Ordnerzugriff, Autosave, Backups.

   Ablage im vom Nutzer gewaehlten Ordner:
     nebenkosten.json    alle Daten
     backups/         taegliche Sicherung, die letzten 20
*/

import { kvGet, kvSet, kvDel } from './db.js';
import { heuteISO, datumISO } from './util.js';

export const DATEI = 'nebenkosten.json';
const ORDNER = ['backups'];
const MAX_BACKUPS = 20;
const AUTOSAVE_MS = 1500;

export const speicher = {
  ordner: null,        // FileSystemDirectoryHandle
  ordnerName: '',
  status: 'idle',      // idle | dirty | saving | error
  onStatus: null,      // Callback fuer die Statusanzeige
};

export function istUnterstuetzt() {
  return typeof window.showDirectoryPicker === 'function';
}

function setStatus(s, detail) {
  speicher.status = s;
  if (speicher.onStatus) speicher.onStatus(s, detail);
}

/* ---------- Ordner waehlen & Rechte ---------- */

export async function ordnerWaehlen() {
  const handle = await window.showDirectoryPicker({
    id: 'nebenkostenkompass',
    mode: 'readwrite',
    startIn: 'documents',
  });
  return handle;
}

export async function rechtePruefen(handle, { anfragen = true } = {}) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if (!anfragen) return false;
  return (await handle.requestPermission(opts)) === 'granted';
}

export async function ordnerMerken(handle) {
  await kvSet('rootHandle', handle);
  await kvSet('rootName', handle.name);
}

export async function gemerkterOrdner() {
  const handle = await kvGet('rootHandle');
  return handle || null;
}

export async function ordnerVergessen() {
  await kvDel('rootHandle');
  await kvDel('rootName');
}

export async function ordnerUebernehmen(handle) {
  speicher.ordner = handle;
  speicher.ordnerName = handle.name;
  await unterordnerAnlegen(handle);
}

async function unterordnerAnlegen(root) {
  for (const pfad of ORDNER) {
    let dir = root;
    for (const teil of pfad.split('/')) dir = await dir.getDirectoryHandle(teil, { create: true });
  }
}

/* ---------- Pfad-Helfer ---------- */

async function verzeichnis(pfad, create = false) {
  let dir = speicher.ordner;
  for (const teil of pfad.split('/').filter(Boolean)) {
    dir = await dir.getDirectoryHandle(teil, { create });
  }
  return dir;
}

async function dateiHandle(relPfad, create = false) {
  const teile = relPfad.split('/');
  const name = teile.pop();
  const dir = teile.length ? await verzeichnis(teile.join('/'), create) : speicher.ordner;
  return dir.getFileHandle(name, { create });
}

/* ---------- Daten lesen / schreiben ---------- */

export async function datenLesen() {
  const text = await rohLesen();
  return text == null ? null : JSON.parse(text);
}

/** Roher Dateiinhalt, null wenn es die Datei noch nicht gibt. */
async function rohLesen() {
  try {
    const fh = await speicher.ordner.getFileHandle(DATEI);
    return await (await fh.getFile()).text();
  } catch (e) {
    if (e.name === 'NotFoundError') return null;
    throw e;
  }
}

async function schreiben(relPfad, inhalt) {
  const fh = await dateiHandle(relPfad, true);
  const w = await fh.createWritable();
  await w.write(inhalt);
  await w.close();
}

let timer = null;
let laufend = null;
let erneut = false;
let holeDaten = null;

/** Registriert die Funktion, die den aktuellen Stand liefert. */
export function datenquelle(fn) {
  holeDaten = fn;
}

export function planeSpeichern() {
  if (!speicher.ordner || !holeDaten) return;
  setStatus('dirty');
  clearTimeout(timer);
  timer = setTimeout(() => { sofortSpeichern().catch(() => { /* Status zeigt den Fehler */ }); }, AUTOSAVE_MS);
}

export async function sofortSpeichern() {
  if (!speicher.ordner || !holeDaten) return;
  clearTimeout(timer);

  /* Laeuft bereits ein Schreibvorgang, wird nach dessen Ende noch einmal
     geschrieben. Ohne das ginge jede Aenderung verloren, die waehrend des
     Schreibens entsteht – auf OneDrive oder Dropbox dauert ein Schreibvorgang
     leicht laenger als das Autosave-Intervall, und der Status meldet trotzdem
     „Gespeichert". */
  if (laufend) {
    erneut = true;
    return laufend;
  }

  laufend = (async () => {
    setStatus('saving');
    try {
      do {
        erneut = false;
        const daten = holeDaten();
        // Erst sichern, dann ueberschreiben – siehe backupWennFaellig.
        await backupWennFaellig(daten);
        await schreiben(DATEI, JSON.stringify(daten, null, 2));
      } while (erneut);
      setStatus('idle', new Date());
    } catch (e) {
      console.error('Speichern fehlgeschlagen:', e);
      setStatus('error', e);
      throw e;
    } finally {
      laufend = null;
      erneut = false;
    }
  })();
  return laufend;
}

/**
 * Taegliche Sicherung – gesichert wird der Stand, der **vor** dieser
 * Aenderung in der Datei stand.
 *
 * Muss deshalb vor dem Ueberschreiben laufen. Wuerde stattdessen der neue
 * Stand gesichert, enthielte die erste Sicherung des Tages die Aenderung
 * bereits – ausgerechnet die erste Aenderung des Tages, etwa ein geloeschter
 * Eintrag, waere dann nicht wiederherstellbar. Genau das sagen die
 * Loeschdialoge aber zu.
 */
async function backupWennFaellig(daten) {
  const heute = heuteISO();
  if (daten.meta?.letztesBackup === heute) return;

  const vorher = await rohLesen();
  if (vorher != null) {
    const n = new Date();
    const stempel = `${datumISO(n)}-${String(n.getHours()).padStart(2, '0')}-${String(n.getMinutes()).padStart(2, '0')}`;
    await schreiben(`backups/nebenkostenkompass-${stempel}.json`, vorher);
    await backupsAufraeumen();
  }
  // Vor dem Serialisieren vermerken, damit der Stempel mitgespeichert wird.
  if (daten.meta) daten.meta.letztesBackup = heute;
}

async function backupsAufraeumen() {
  try {
    const dir = await verzeichnis('backups');
    const namen = [];
    for await (const [name, h] of dir.entries()) {
      if (h.kind === 'file' && name.endsWith('.json')) namen.push(name);
    }
    namen.sort();
    for (const name of namen.slice(0, Math.max(0, namen.length - MAX_BACKUPS))) {
      await dir.removeEntry(name);
    }
  } catch (e) {
    console.warn('Backups aufraeumen fehlgeschlagen:', e);
  }
}

/** Inhalt einer Sicherung lesen – für die Wiederherstellung. */
export async function backupLesen(name) {
  const fh = await dateiHandle(`backups/${name}`);
  return JSON.parse(await (await fh.getFile()).text());
}

export async function backupsAuflisten() {
  const dir = await verzeichnis('backups');
  const liste = [];
  for await (const [name, h] of dir.entries()) {
    if (h.kind === 'file' && name.endsWith('.json')) {
      const f = await h.getFile();
      liste.push({ name, groesse: f.size, geaendert: f.lastModified });
    }
  }
  return liste.sort((a, b) => b.name.localeCompare(a.name));
}
