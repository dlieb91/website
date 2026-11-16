/* Winziger IndexedDB-Key-Value-Speicher.
   Merkt sich den Ordner-Handle, damit die App beim
   naechsten Start automatisch wieder darauf zugreifen kann.

   Eigener Datenbankname – jede App teilt sich nichts
   mit den anderen. */

const DB_NAME = 'nebenkostenkompass';
const STORE = 'kv';
const VERSION = 1;

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const kvGet = (key) => tx('readonly', (s) => s.get(key));
export const kvSet = (key, value) => tx('readwrite', (s) => s.put(value, key));
export const kvDel = (key) => tx('readwrite', (s) => s.delete(key));
