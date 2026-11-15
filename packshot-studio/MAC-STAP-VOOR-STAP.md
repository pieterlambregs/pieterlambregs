# Packshot Studio op je Mac – stap voor stap

Deze gids gaat ervan uit dat **Docker Desktop al geïnstalleerd is en open staat** (het
venster met "docker desktop" linksboven en het walvisje in de menubalk).
De nummers ① tot ⑤ verwijzen naar de gemarkeerde plekken in het voorbeeldscherm
`docker-desktop-uitleg.png`.

Reken voor de eerste keer op ongeveer 45 minuten, waarvan het meeste wachten is.

---

## Stap 1 – Welke chip zit er in je Mac?

1. Klik linksboven op het **Apple-logo ** → **Over deze Mac**.
2. Kijk naar de regel **Chip** of **Processor**:
   * **Apple M1, M2, M3 of M4** → je hebt een *Apple-chip*. Doe stap 2 helemaal.
   * **Intel** → sla in stap 2 het onderdeel "Rosetta" over.

Waarom: het renderprogramma (Blender) bestaat in Docker alleen in een Intel-versie. Op een
Apple-chip vertaalt Docker dat automatisch met Rosetta. Dat werkt, maar renderen is daardoor
trager dan op een Intel-processor van dezelfde snelheid.

---

## Stap 2 – Docker Desktop instellen ①

1. Klik in Docker Desktop rechtsboven op het **tandwiel ①** (Settings).
2. **Alleen bij een Apple-chip:** kies links **General** en zet
   **"Use Rosetta for x86_64/amd64 emulation on Apple Silicon"** aan (vinkje).
   (Zie je die optie niet, kijk dan onder *General → Virtual Machine Options*; kies daar
   *Apple Virtualization framework* en vink Rosetta aan.)
3. Nog steeds in **General**: zet **"Start Docker Desktop when you sign in to your computer"**
   aan. Dan start de app later vanzelf mee als je je Mac opstart.
4. Kies links **Resources** (eventueel daarna **Advanced**) en zet:
   * **CPU limit**: zo hoog mogelijk (alle kernen, of alle min één). Meer kernen = sneller renderen.
   * **Memory limit**: minstens **8 GB** (heeft je Mac 16 GB of meer: zet 8–10 GB).
   * **Disk usage limit**: minstens **40 GB** (staat bij jou al op 910 GB, dat is ruim genoeg).
5. Klik rechtsonder op **Apply & restart** en wacht tot Docker herstart is.

---

## Stap 3 – Controleer dat de Docker-motor draait ④

Kijk helemaal **linksonder** in Docker Desktop ④.

* Staat er **RAM --.-- GB CPU --.-- %** (zoals op jouw screenshot), dan staat de motor stil
  of in spaarstand. Klik op het **afspeelknopje ▷** linksonder om hem te starten.
* Als er echte getallen staan (bijvoorbeeld *RAM 1.2 GB CPU 3 %*) en een **groen** bolletje
  of vinkje, draait hij.

Het image `docker/welcome-to-docker` uit je screenshot is alleen een voorbeeld van Docker;
dat mag je laten staan of verwijderen met het rode prullenbakje. Het heeft niets met
Packshot Studio te maken.

---

## Stap 4 – De Terminal openen ⑤

Je typt een paar commando's. Daarvoor gebruik je de app **Terminal** van je Mac:

* Druk **⌘ + spatie**, typ **Terminal** en druk **Enter**,
  of ga in de Finder naar **Programma's → Hulpprogramma's → Terminal**.

(De knop **Terminal ⑤** rechtsonder in Docker Desktop werkt ook, maar de Mac-app Terminal is
eenvoudiger om in te kopiëren en plakken.)

**Hoe typ je een commando:** kopieer de regel uit deze gids, plak hem in Terminal met **⌘V**
en druk op **Enter**. Wacht tot de cursor weer op een nieuwe regel staat (eindigend op
`%` of `$`) voor je het volgende commando plakt.

---

## Stap 5 – De app downloaden

Om de app te downloaden gebruik je het programma **git**. Op een Mac staat git er niet standaard
op: macOS installeert het de eerste keer zelf, samen met een pakket dat de
**opdrachtregel-ontwikkelaarstools** heet (ook wel *Command Line Tools*). Dat is een gratis,
officieel pakket van Apple van ongeveer 1 GB. Je hoeft dit maar één keer te doen.

### 5.1 Het commando geven

Plak in Terminal deze twee regels (de eerste brengt je naar je thuismap):

```
cd ~
git clone -b claude/packshot-studio-8x67yx https://github.com/pieterlambregs/pieterlambregs.git packshot
```

Nu zijn er twee mogelijkheden:

* **A. Er verschijnen regels als `Cloning into 'packshot'...` en `done.`**
  Git stond er al op en de download is gelukt. Ga door naar **5.4**.
* **B. Er verschijnt een venster** (zie 5.2), en in Terminal staat iets als
  `xcode-select: note: No developer tools were found, requesting install.`
  Er is nog **niets** gedownload; dat komt in 5.3.

### 5.2 Het venster: de tools installeren

Er verschijnt midden op je scherm een venster met ongeveer deze tekst:

> **Voor de opdracht "git" zijn de opdrachtregelontwikkelaarstools vereist.
> Wil je de tools nu installeren?**
>
> [ Verkrijg Xcode ]   [ Niet nu ]   [ **Installeer** ]

1. Klik op **Installeer** (de rechterknop).
   **Niet** op *Verkrijg Xcode*: dat is een veel groter programma (± 15 GB) dat je niet nodig hebt.
2. Er komt een licentieovereenkomst. Klik op **Akkoord**.
3. Er verschijnt een voortgangsbalk *"De software wordt gedownload"*. Dit duurt **5 tot 20
   minuten**, afhankelijk van je internet. Laat je Mac aan staan.
4. Je ziet **"De software is geïnstalleerd"**. Klik op **Gereed**.

### 5.3 Het commando opnieuw geven

Ga terug naar het **Terminal**-venster. Je hoeft de lange regel niet opnieuw te kopiëren:

1. Klik in het Terminal-venster.
2. Druk op de **pijltjestoets omhoog ↑**: de laatst getypte regel (`git clone ...`) verschijnt
   weer. Zie je `cd ~`, druk dan nog een keer op **↑**.
3. Druk op **Enter**.

Nu zie je:

```
Cloning into 'packshot'...
remote: Enumerating objects: ...
Receiving objects: 100% ...
Resolving deltas: 100% ...
```

Gelukt als de cursor weer op een nieuwe regel staat zonder het woord *error* of *fatal*.

### 5.4 Controleren

Plak:

```
ls ~/packshot/packshot-studio
```

Je ziet onder andere `backend`, `frontend`, `docker-compose.yml` en `MAC-STAP-VOOR-STAP.md`.
In de Finder vind je de map ook terug: menu **Ga → Thuismap** → map **packshot**.

Ga nu de map van de app in (dit doe je voortaan elke keer voor je een commando geeft):

```
cd ~/packshot/packshot-studio
```

### Lukt het niet? De twee meest voorkomende situaties

**Er verschijnt geen venster, en Terminal zegt `xcrun: error: invalid active developer path`**
Dit gebeurt vaak na een macOS-update. Plak:

```
xcode-select --install
```

Het venster van 5.2 verschijnt alsnog. Volg 5.2 en 5.3.

**Het venster zegt: "Kan de software niet installeren omdat deze momenteel niet beschikbaar is
via de software-updateserver"**
Gebruik dan de downloadmethode zonder git hieronder.

### Alternatief zonder git: de ZIP downloaden

Werkt git echt niet, dan kan het ook met een gewone download:

1. Open in Safari deze link:
   https://github.com/pieterlambregs/pieterlambregs/archive/refs/heads/claude/packshot-studio-8x67yx.zip
   Het bestand **pieterlambregs-claude-packshot-studio-8x67yx.zip** komt in je map
   **Downloads**. (Safari pakt het vaak meteen uit; anders dubbelklik je erop.)
2. Je krijgt een map **pieterlambregs-claude-packshot-studio-8x67yx**.
   Hernoem die map naar **packshot** (klik erop, druk **Enter**, typ `packshot`, **Enter**).
3. Sleep de map **packshot** naar je thuismap (in de Finder-zijbalk het huisje met je naam, of
   menu **Ga → Thuismap**).
4. Ga verder met **5.4**.

Nadeel van deze manier: bijwerken naar een nieuwe versie doe je later ook weer door de ZIP
opnieuw te downloaden (in plaats van `git pull`). Je bestand `.env` uit stap 6 zet je dan over
naar de nieuwe map.

---

## Stap 6 – Instellingen maken (wie mag erin)

Maak het instellingenbestand aan en open het in Teksteditor:

```
cp .env.example .env
open -e .env
```

Er opent een venster in **Teksteditor**. Vervang de hele inhoud door:

```
PACKSHOT_BIND=0.0.0.0
PACKSHOT_USERS=pieter:KiesHierEenSterkWachtwoord
```

* Vervang `KiesHierEenSterkWachtwoord` door je eigen wachtwoord (minstens 10 tekens, **geen
  komma's en geen dubbele punten**).
* Collega's toevoegen: met een komma ertussen, bijvoorbeeld
  `PACKSHOT_USERS=pieter:Wachtwoord1,anna:Wachtwoord2`.
* `PACKSHOT_BIND=0.0.0.0` betekent: ook bereikbaar vanaf je iPhone en andere toestellen op je
  wifi. Wil je de app alleen op je Mac zelf gebruiken, zet dan `PACKSHOT_BIND=127.0.0.1`.

Bewaar met **⌘S** en sluit Teksteditor. (Krijg je de vraag of je ".txt" wilt toevoegen: kies
**Gebruik ".env"** / niet toevoegen.)

---

## Stap 7 – De app bouwen en starten

Plak in Terminal (je staat nog in de map `packshot-studio`):

```
docker compose up -d --build
```

Wat er gebeurt:

* Docker downloadt de onderdelen en bouwt de app. Je ziet veel regels voorbij komen, met
  stappen als `[+] Building ...` en `RUN pip install ...`.
* **De eerste keer duurt dit 10 tot 30 minuten** (Blender is groot). Laat Terminal open en
  laat je Mac niet slapen.
* Klaar als je onderaan regels ziet zoals:

  ```
   ✔ Container packshot-studio-redis-1   Started
   ✔ Container packshot-studio-api-1     Started
   ✔ Container packshot-studio-worker-1  Started
   ✔ Container packshot-studio-web-1     Started
  ```

---

## Stap 8 – Controleren in Docker Desktop ② ③

1. Klik links op **Containers ②** (het kubusje, tweede icoon van boven).
   Je ziet een groep **packshot-studio**. Klik op het pijltje ervoor: er staan vier regels
   onder, **api**, **worker**, **redis** en **web**, allemaal met een **groen bolletje**
   (Running).
   * Bij **web** staat in de kolom *Port(s)* **8080:80**. Daarop klikken opent de app.
2. Klik links op **Images ③** (het icoon onder Containers). Je ziet nu ook
   **packshot-studio-api** en **packshot-studio-worker** (± 3 GB elk), **packshot-studio-web**
   en **redis**.

Is een bolletje **grijs of oranje**? Klik op de naam van die container: je ziet de *Logs*. Stuur
me een screenshot daarvan.

---

## Stap 9 – De app openen op je Mac

1. Open Safari of Chrome en ga naar **http://localhost:8080**
2. Er verschijnt een inlogvenster: vul je **naam** (bijvoorbeeld `pieter`) en je **wachtwoord**
   uit stap 6 in.
3. Je ziet de **Library**. Klik op **+ Upload print files** en kies een PDF.

---

## Stap 10 – Bekijken op je iPhone

Je iPhone moet op **hetzelfde wifi-netwerk** zitten als je Mac.

1. Zoek het adres van je Mac. Plak in Terminal:
   ```
   ipconfig getifaddr en0
   ```
   Je krijgt iets als **192.168.1.23**. (Of: **Systeeminstellingen → Wifi → Details…** naast je
   netwerk → *IP-adres*.)
2. Vraagt je Mac **"Wil je dat de app Docker inkomende netwerkverbindingen accepteert?"** →
   klik **Sta toe**.
3. Open op je iPhone **Safari** en typ: **http://192.168.1.23:8080** (met jouw getallen).
4. Log in met dezelfde naam en hetzelfde wachtwoord.
5. Als app-icoon op je beginscherm: tik op de **deelknop** (vierkant met pijl omhoog) →
   **Zet op beginscherm** → **Voeg toe**.

Let op: het adres van je Mac kan na een herstart van je router veranderen; kijk het dan opnieuw
op met stap 10.1.

Onderweg (niet op hetzelfde wifi) werkt dit niet. Daarvoor kun je Tailscale gebruiken: zie
`HANDLEIDING.md`.

---

## Dagelijks gebruik

* **Je Mac aanzetten:** Docker Desktop start vanzelf (stap 2.3) en de app daarmee ook. Even
  wachten tot het walvisje in de menubalk stil staat, dan **http://localhost:8080**.
* **Stoppen:** in Docker Desktop → **Containers ②** → bij **packshot-studio** op het
  **vierkantje ■** (Stop). **Starten:** op het **driehoekje ▶**.
  Of in Terminal, in de map `~/packshot/packshot-studio`: `docker compose down` en
  `docker compose up -d`.
* Je projecten en renders blijven bewaard, ook na stoppen en herstarten.

## Bijwerken naar een nieuwe versie

```
cd ~/packshot/packshot-studio
git pull
docker compose up -d --build
```

## Problemen

| Wat je ziet | Wat te doen |
|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop is niet open of de motor staat stil: open Docker Desktop en klik ▷ linksonder ④. |
| `no matching distribution found for bpy` of `exec format error` | Rosetta staat niet aan (stap 2.2). Zet het aan, *Apply & restart*, en herhaal stap 7. |
| `port is already allocated` | Iets anders gebruikt poort 8080. Zet in `.env` een regel `PACKSHOT_PORT=8090` en gebruik dan http://localhost:8090. |
| De container **web** start steeds opnieuw | De logins in `.env` kloppen niet (komma of dubbele punt in een wachtwoord, of `PACKSHOT_USERS` leeg terwijl `PACKSHOT_BIND=0.0.0.0`). Kijk bij Containers ② → web → *Logs*. |
| Inlogvenster blijft terugkomen | Naam of wachtwoord fout; let op hoofdletters. |
| iPhone kan de pagina niet openen | Zelfde wifi? `PACKSHOT_BIND=0.0.0.0`? Firewall-vraag toegestaan? Probeer eerst http://localhost:8080 op de Mac zelf. |
| Renderen duurt lang | Normaal op een Apple-chip via Rosetta; geef Docker meer CPU (stap 2.4) en kies 1000–2000 px tot je tevreden bent. |
