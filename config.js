// Scotia Fieldsport Log — configuration
// v1.0.0

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB-Q4IiJVZ7hCGDqZN-t8hHwfjUZ1BoqcY",
  authDomain: "scotia-fieldsport-log.firebaseapp.com",
  projectId: "scotia-fieldsport-log",
  storageBucket: "scotia-fieldsport-log.firebasestorage.app",
  messagingSenderId: "653763478309",
  appId: "1:653763478309:web:9e5d8551206aefb329d0cc"
};

const CLOUDINARY_CONFIG = {
  cloudName: "q7cde5pf",
  uploadPreset: "scotia_fieldsport"
};

const DROPBOX_CONFIG = {
  appKey: "pie3o0610s0or9o",
  folder: "/ScotiaFieldsportLog",
  backupIntervalDays: 7,
  maxBackups: 12
};

// OpenWeatherMap — set your own key here
const WEATHER_CONFIG = {
  apiKey: "a37dd4f86a45ae919d1f0624a6b88bff",
  defaultLat: 54.738,
  defaultLon: -4.418   // DG9 0PD
};

// Hardcoded users (no Firebase Auth)
const USERS = [
  { username: "Phil",  password: "PDunn",      initial: "P", displayName: "Phil" },
  { username: "Mike",  password: "MDunn",       initial: "M", displayName: "Mike" },
  { username: "Ben",   password: "TigernutS82", initial: "B", displayName: "Ben"  }
];

// Pin types — icon colour, which pin types accept photos
const PIN_TYPES = [
  { id: "seen",      label: "Seen",                   colour: "#FFD700", hasPhoto: false },
  { id: "shot",      label: "Shot / Culled",           colour: "#E63946", hasPhoto: false },
  { id: "vantage",   label: "Vantage Point / Shot From", colour: "#FF8C00", hasPhoto: true  },
  { id: "watch",     label: "Watch / Sit Spot",        colour: "#FF8C00", hasPhoto: true  },
  { id: "danger",    label: "Danger / Warning",        colour: "#FF0000", hasPhoto: false },
  { id: "photo",     label: "Photo Point",             colour: "#9B59B6", hasPhoto: true  },
  { id: "note",      label: "General Note",            colour: "#4A90D9", hasPhoto: false }
];

const SPECIES = [
  { id: "fox",       label: "Fox",        colour: "#E07B39" },
  { id: "red",       label: "Red Deer",   colour: "#8B1A1A" },
  { id: "roe",       label: "Roe Deer",   colour: "#A0522D" },
  { id: "fallow",    label: "Fallow Deer",colour: "#BDB76B" },
  { id: "sika",      label: "Sika Deer",  colour: "#556B2F" },
  { id: "goat",      label: "Goats",      colour: "#708090" }
];

// Map start — DG9 0PD (Whithorn area, Wigtownshire)
const MAP_START = { lat: 54.738, lon: -4.418, zoom: 13 };
