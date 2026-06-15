# IJhop publiceren als eigen repository + domein koppelen

Deze map (`ijhop/`) is een volledig zelfstandige app — eigen `package.json`,
eigen dependencies en eigen build, zonder enige koppeling met de Vastelasten-app.
Doel: eigen GitHub-repo `IJhop.app`, eigen deployment, op het domein
**ijhop.app**.

## 1. Lege GitHub-repo

Maak `RJdlt/IJhop.app` aan op <https://github.com/new> — **geen** README,
`.gitignore` of license aanvinken (de repo moet leeg zijn).

## 2. Push deze map als de root van die repo

Lokaal, vanuit de hoofdmap van `vastelasten-v2`:

```bash
cd ijhop
git init
git add .
git commit -m "Initial commit — IJhop (GVB IJ-veren app)"
git branch -M main
git remote add origin git@github.com:RJdlt/IJhop.app.git   # of de HTTPS-URL
git push -u origin main
```

Nu staat IJhop als eigen repository op GitHub, zonder Vastelasten-historie.

## 3. Deploy

**Vercel** (aanbevolen, statische build):

1. Importeer `RJdlt/IJhop.app` in Vercel.
2. Framework wordt automatisch herkend als **Vite** (zie `vercel.json`):
   build `npm run build`, output `dist`.
3. Deploy → je krijgt een `*.vercel.app`-URL.

**Netlify** werkt identiek: build `npm run build`, publish-map `dist`.

## 4. Domein ijhop.app koppelen

In Vercel: **Project → Settings → Domains → Add** → `ijhop.app` (en eventueel
`www.ijhop.app`). Vercel toont de DNS-records die je bij je domeinregistrar zet:

- **A** `@` → `76.76.21.21`, of
- **CNAME** `www` → `cname.vercel-dns.com`

`.app` is een HSTS-domein, dus HTTPS is verplicht — Vercel regelt het
TLS-certificaat automatisch zodra de DNS klopt.

## Geen terminal? Twee alternatieven

- **Deploy direct vanuit de submap:** importeer de bestaande repo
  `RJdlt/vastelasten-v2` in Vercel en zet **Root Directory** op `ijhop`. Dan
  bouwt Vercel alleen deze app — eigen project, eigen domein — zonder aparte repo.
- **Laat het automatisch doen:** maak de lege repo `IJhop.app` aan en start een
  nieuwe Claude Code-sessie met díé repo als scope; dan kunnen alle bestanden er
  automatisch in worden gezet.

## Opruimen (optioneel)

De kopie in de `vastelasten-v2`-branch kun je laten staan (feature-branch, niet
gemerged) of later verwijderen — de losse `IJhop.app`-repo is voortaan de bron.
