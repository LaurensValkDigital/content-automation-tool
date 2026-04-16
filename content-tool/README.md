# Content Automation Tool — Valk Digital V4

Bloomreach email personalisatie tool voor Van der Valk hotels. Beheert content voor twee lagen:

- **Laag 1 — Tone of Voice** (`segment_profiel`): subject, titels, teksten, buttons per persona
- **Laag 2 — Afbeeldingen** (`segment_hotel`): 12 afbeeldingen per omgevingslabel

Exporteert een 251-kolom CSV die direct als Bloomreach Catalog geüpload kan worden.

---

## Lokaal draaien

```bash
npm install
npm run dev
```

Open `http://localhost:5173`

---

## Bouwen voor productie

```bash
npm run build
```

Output staat in de `dist/` map.

---

## Deployen op GitHub Pages

### Eenmalige setup

1. Maak een repository aan op GitHub (bijv. `content-automation-tool`)
2. Push deze code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/JOUW_USERNAME/content-automation-tool.git
   git push -u origin main
   ```

3. Voeg de `gh-pages` package toe:
   ```bash
   npm install --save-dev gh-pages
   ```

4. Voeg dit toe aan `package.json` onder `"scripts"`:
   ```json
   "deploy": "gh-pages -d dist"
   ```

5. Zet de homepage in `package.json`:
   ```json
   "homepage": "https://JOUW_USERNAME.github.io/content-automation-tool"
   ```

### Deployen

```bash
npm run build
npm run deploy
```

De tool is nu live op: `https://JOUW_USERNAME.github.io/content-automation-tool`

---

## Gebruik

### Excel importeren
Klik op **↑ Excel importeren** en selecteer `Content_Automation_Hotel_v4.xlsx`.  
De tool leest `InputSheet_Laag1` en `InputSheet_Laag2` automatisch in.

### Content invullen
- Gebruik de tabs **Laag 1** en **Laag 2** om te wisselen tussen lagen
- Per module: klik op een segment (Default / Gezinsreiziger / etc.) om segment-specifieke overrides in te vullen
- Lege segmentvelden vallen automatisch terug op Default (zichtbaar als fallback-hint)
- Oranje stip = segment heeft overrides ingevuld

### Export
Klik op **↓ Export CSV** — download `catalog_export_bloomreach.csv`.  
Upload dit bestand als Bloomreach Catalog (251 kolommen, binnen de limiet van 256).

---

## Segmenten

| Laag | Segment | Bloomreach attribuut | Prefix |
|------|---------|----------------------|--------|
| 1 | Gezinsreiziger | `segment_profiel` | `TOV_GEZ_` |
| 1 | Luxe & Wellness | `segment_profiel` | `TOV_LUX_` |
| 1 | Stedentripper | `segment_profiel` | `TOV_STE_` |
| 1 | Comfortzoeker | `segment_profiel` | `TOV_COM_` |
| 1 | Kortingzoeker | `segment_profiel` | `TOV_KOR_` |
| 1 | Groen Genieter | `segment_profiel` | `TOV_GRO_` |
| 2 | Stedelijk | `segment_hotel` | `IMG_STE_` |
| 2 | Natuur & Rust | `segment_hotel` | `IMG_NAT_` |
| 2 | Gemengd | `segment_hotel` | `IMG_GEM_` |
