# Packshot Studio op je eigen computer

## Eenmalig installeren

1. Installeer **Docker Desktop** (gratis voor persoonlijk gebruik en kleine bedrijven):
   https://www.docker.com/products/docker-desktop/
   Start het na de installatie één keer, zodat het walvisje in de menubalk / taakbalk staat.
   Geef Docker Desktop bij *Settings → Resources* minstens **4 CPU's en 8 GB geheugen**.
2. Download de app: open https://github.com/pieterlambregs/pieterlambregs, kies de branch
   `claude/packshot-studio-8x67yx`, klik op **Code → Download ZIP** en pak de ZIP uit.
   (Of met git: `git clone -b claude/packshot-studio-8x67yx https://github.com/pieterlambregs/pieterlambregs.git`)
3. Open een terminal (Mac: *Terminal*, Windows: *PowerShell*) in de map `packshot-studio`.
4. Maak de instellingen aan: kopieer `.env.example` naar `.env`
   (Mac: `cp .env.example .env`, Windows: `copy .env.example .env`).

## Starten en stoppen

```
docker compose up -d --build     # starten (de eerste keer duurt het 5-10 minuten)
docker compose down              # stoppen
```

Open daarna **http://localhost:8080**. Je projecten en renders blijven bewaard als je stopt
of je computer herstart (ze staan in een Docker-volume, niet in de map).

## Delen met collega's op hetzelfde netwerk

Zet in `.env`:

```
PACKSHOT_BIND=0.0.0.0
PACKSHOT_USERS=pieter:een-sterk-wachtwoord,anna:ander-sterk-wachtwoord
```

(geen komma's of dubbele punten in een wachtwoord) en herstart met `docker compose up -d`. Collega's openen dan `http://<naam-of-IP-van-jouw-computer>:8080`
en loggen in met hun naam en wachtwoord. Het IP-adres vind je op de Mac bij
*Systeeminstellingen → Netwerk*, op Windows met `ipconfig`.

* Zonder `PACKSHOT_USERS` weigert de app te starten in deelmodus: vertrouwelijke artwork staat
  nooit zonder login open.
* Het werkt alleen zolang jouw computer aan staat en in hetzelfde netwerk zit.
* Binnen het netwerk is de verbinding **niet versleuteld** (http). Op een vertrouwd kantoornetwerk
  is dat meestal aanvaardbaar; voor gebruik via internet of thuiswerk is een server met HTTPS
  nodig.
* Mogelijk vraagt de firewall van je computer om poort 8080 toe te laten.

## Bijwerken naar een nieuwe versie

Download de nieuwe versie (of `git pull`) en voer opnieuw `docker compose up -d --build` uit.
Je projecten blijven bewaard.

## Rendertijd

Renderen gebeurt op de processor van jouw computer. Reken op ongeveer een minuut per aanzicht
op 1500-2000 px en 10-15 minuten op 4000 px. Tijdens het renderen kan je computer trager zijn.

## Bekijken op je iPhone (zonder server)

De app draait op je computer; je iPhone is alleen het scherm. Je computer moet aan staan.

**Op hetzelfde wifi-netwerk:** zet in `.env` `PACKSHOT_BIND=0.0.0.0` en een login in
`PACKSHOT_USERS`, herstart met `docker compose up -d`, en open op je iPhone in Safari
`http://<IP-van-je-computer>:8080`.

**Overal (ook onderweg): Tailscale** (gratis, privé, niet openbaar op internet)

1. Installeer Tailscale op je computer (https://tailscale.com/download) en op je iPhone
   (App Store) en log op beide in met hetzelfde account.
2. Zelfde `.env` als hierboven.
3. Open op je iPhone `http://<naam-van-je-computer>:8080` (de naam staat in de Tailscale-app).

Als icoon op je beginscherm: in Safari deelknop → **Zet op beginscherm**.
