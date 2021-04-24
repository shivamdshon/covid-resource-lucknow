export const POPULAR_CITIES = [
  'lucknow',
  'hazratganj',
  'rajajipuram',
  'Gomti Nagar',
  'Faizabad Road',
  'Aliganj',
  'Kursi Road',
  'Sitapur Road',
  'Nishat Ganj',
  'Jankipuram',
  'Kanpur',
  'Alamnagar',
  'Mahanagar',
  'Vikas Nagar',
  'Hazratganj',
  'Aishbagh',
  'Indira Nagar',
  'Chinhat',
  'Ashiyana',
  'Nirala Nagar',
  'Rajajipuram',
  'Vasant Kunj',
  'Sector B Lucknow',
  'Gosainganj',
  'Balaganj',
  'Bakshi Ka Talab',
  'Daliganj',
  'Alambagh',
  'Aminabad',
  'Amausi',
  'Chowk',
  'Krishna Nagar',
  'Kakori',
  'Lalbagh',
];

export function capitalCase(string) {
  if (!string) {
    return string;
  }

  return string[0].toUpperCase() + string.slice(1);
}

export const STORAGE_KEY = {
  generated_links: 'generated_links',
};

export const LocalStorage = {
  /**
   *
   * @param key
   * @param value
   * @returns {*}
   */
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch(e) {}

    return value;
  },

  /**
   *
   * @param key
   * @param defaultValue
   * @returns {any}
   */
  getItem: (key, defaultValue) => {
    try {
      const value = localStorage.getItem(key);
      if (value === null || typeof value === "undefined") {
        return defaultValue;
      }
      return JSON.parse(value);
    } catch (e) {}

    return defaultValue;
  },

  /**
   *
   * @param key
   */
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }
}
