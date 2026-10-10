# Scotia Fieldsport Log

PWA for fox, deer and goat management in Scotland (DG9 area).

## Deploy to GitHub Pages

1. Create a new **public** repo on GitHub called `scotia-fieldsport-log` under the `rizla-green` account
2. In the repo **Settings → Pages**, set Source to **GitHub Actions** (or `main` branch / root)
3. From this directory, run:

```bash
git init
git add .
git commit -m "Initial build"
git branch -M main
git remote add origin https://github.com/rizla-green/scotia-fieldsport-log.git
git push -u origin main
```

The site will be live at: **https://rizla-green.github.io/scotia-fieldsport-log/**

## After deploying

### Add your logo icons
Put your Scotia Fieldsport Log badge image in `icons/` as:
- `logo-48.png`  (48 × 48 px)
- `logo-192.png` (192 × 192 px)  
- `logo-512.png` (512 × 512 px)

### Add your OpenWeatherMap API key
Sign up free at https://openweathermap.org/api  
Open `js/config.js` and replace `PASTE_YOUR_OPENWEATHERMAP_KEY_HERE` with your key.

### Firebase Firestore rules
In the Firebase console → Firestore → Rules, set:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

(The app uses its own password login — Firestore rules just keep it open to the app.)

### Dropbox
- Click the **⚙ Settings** cog inside the app
- Under "Dropbox auto-backup" → **Connect Dropbox**
- Authorise once per phone/browser. Backups go to `/Apps/ScotiaFieldsportLog/` in your Dropbox.
- Do this separately on each phone (Phil, Mike, Ben) — backups are independent per device.

## Credentials
| User | Username | Password |
|------|----------|----------|
| Phil | Phil     | PDunn    |
| Mike | Mike     | MDunn    |
| Ben  | Ben      | TigernutS82 |

## File structure
```
index.html        — App shell (login + all screens)
css/app.css       — All styles
js/config.js      — Firebase, Cloudinary, Dropbox, users config
js/auth.js        — Login/session (no Firebase Auth)
js/db.js          — Firestore + offline queue
js/weather.js     — OpenWeatherMap current + forecast
js/map.js         — Leaflet, boundaries, pins, gates
js/pins.js        — Drop-pin form, GPS, drag-to-reposition
js/lists.js       — Shot entry list cards
js/cloudinary.js  — Photo upload
js/dropbox.js     — Dropbox PKCE OAuth + backup
js/export.js      — CSV download
js/popup.js       — Modal/popup helper
js/app.js         — Main controller, tab routing
sw.js             — Service worker (offline cache)
manifest.json     — PWA manifest
icons/            — App icon images
```
