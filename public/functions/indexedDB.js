export const databases = {
  eventsDB: { name: 'eventsDB', version: 1, store: 'events' },
  MyDatabaseActionevent: { name: 'MyDatabaseActionevent', version: 1, store: 'files' }
};

export function openDatabase({ name, version, store }) {
  return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      request.onupgradeneeded = (event) => {
          const db = event.target.result;
          const objectStore = db.createObjectStore(store, { keyPath: 'id', autoIncrement: true });
          objectStore.createIndex('name', 'name', { unique: false });
          objectStore.createIndex('type', 'type', { unique: false });
          objectStore.createIndex('path', 'path', { unique: false });
      };
      request.onsuccess = (event) => {
          resolve(event.target.result);
      };
      request.onerror = (event) => {
          reject(event.target.error);
      };
  });
}

export function saveDataToIndexedDB(dbConfig, data) {
  openDatabase(dbConfig).then((db) => {
      const transaction = db.transaction([dbConfig.store], 'readwrite');
      const objectStore = transaction.objectStore(dbConfig.store);

      // Verificación y eliminación de ID inválida
      if (typeof data.id !== 'number' || data.id <= 0) {
          delete data.id;
      }

      const request = objectStore.add(data);
      request.onsuccess = (event) => {
          console.log('Data saved to IndexedDB', data);
          data.id = event.target.result;
          observer.notify('save', data);
      };
      request.onerror = (event) => {
          console.error('Error saving data to IndexedDB', event.target.error);
      };
  }).catch((error) => {
      console.error('Error opening IndexedDB', error);
  });
}

export function deleteDataFromIndexedDB(dbConfig, id) {
  openDatabase(dbConfig).then((db) => {
      const transaction = db.transaction([dbConfig.store], 'readwrite');
      const objectStore = transaction.objectStore(dbConfig.store);
      const request = objectStore.delete(id);
      request.onsuccess = () => {
          console.log(`Data with id ${id} deleted from IndexedDB`);
      };
      request.onerror = (event) => {
          console.error('Error deleting data from IndexedDB', event.target.error);
      };
  }).catch((error) => {
      console.error('Error opening IndexedDB', error);
  });
}

export function updateDataInIndexedDB(dbConfig, data) {
  data.id = Number(data.id);
  
  openDatabase(dbConfig).then((db) => {
      const transaction = db.transaction([dbConfig.store], 'readwrite');
      const objectStore = transaction.objectStore(dbConfig.store);
      const request = objectStore.put(data);

      request.onsuccess = () => {
          console.log(`Data with id ${data.id} updated in IndexedDB`, data);
          observer.notify('update', data);
      };

      request.onerror = (event) => {
          console.error('Error updating data in IndexedDB', event.target.error);
      };
  }).catch((error) => {
      console.error('Error opening IndexedDB', error);
  });
}

export function loadDataFromIndexedDB(dbConfig, callback) {
  openDatabase(dbConfig).then((db) => {
      const transaction = db.transaction([dbConfig.store], 'readonly');
      const objectStore = transaction.objectStore(dbConfig.store);
      const request = objectStore.getAll();
      request.onsuccess = (event) => {
          const allRecords = event.target.result;
          allRecords.forEach(record => {
              callback(dbConfig, record);
          });
      };
      request.onerror = (event) => {
          console.error('Error loading data from IndexedDB', event.target.error);
      };
  }).catch((error) => {
      console.error('Error opening IndexedDB', error);
  });
}

export async function getDataFromIndexedDB(dbConfig) {
  try {
      const db = await openDatabase(dbConfig);
      return new Promise((resolve, reject) => {
          const transaction = db.transaction([dbConfig.store], 'readonly');
          const objectStore = transaction.objectStore(dbConfig.store);
          const request = objectStore.getAll();

          request.onsuccess = (event) => {
              const allRecords = event.target.result;
              resolve(allRecords);
          };
          request.onerror = (event) => {
              console.error('Error loading data from IndexedDB', event.target.error);
              reject(event.target.error);
          };
      });
  } catch (error) {
      console.error('Error opening database', error);
      throw error;
  }
}

// DBObserver.js
class DBObserver {
  constructor() {
      this.listeners = [];
  }

  subscribe(callback) {
      this.listeners.push(callback);
  }

  unsubscribe(callback) {
      this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  notify(action, data) {
      this.listeners.forEach(listener => {
          listener(action, data);
      });
  }
}

export const observer = new DBObserver();

// New Functions for Exporting and Importing
export async function exportDatabase(dbConfig) {
  const data = await getDataFromIndexedDB(dbConfig);
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${dbConfig.name}_backup.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
 
export async function importDatabase(dbConfig, file) {
  const reader = new FileReader();
  reader.onload = async (event) => {
      const data = JSON.parse(event.target.result);
      const db = await openDatabase(dbConfig);
      const transaction = db.transaction([dbConfig.store], 'readwrite');
      const objectStore = transaction.objectStore(dbConfig.store);
      data.forEach(item => {
          objectStore.put(item);
      });
  };
  reader.readAsText(file);
}
