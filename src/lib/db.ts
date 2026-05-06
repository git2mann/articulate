/**
 * Articulate Client-Side Database (Section 12)
 * Robust IndexedDB storage for large neural libraries.
 * Replaces localStorage to avoid QuotaExceededError (5MB limit).
 */

const DB_NAME = 'articulate_vault';
const DB_VERSION = 1;
const STORE_NAME = 'library';

export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject("Failed to open IndexedDB");
    
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event: any) => resolve(event.target.result);
  });
}

export async function saveLibraryToDB(library: any[]) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  // Clear existing to ensure sync is clean
  store.clear();

  for (const item of library) {
    store.add(item);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject("Failed to save library");
  });
}

export async function getLibraryFromDB(): Promise<any[]> {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject("Failed to load library");
  });
}
