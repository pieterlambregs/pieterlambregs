# Packshot Studio op one.com zetten

Je gewone one.com-webhosting (waar artlab-media.be op staat) kan alleen PHP en gewone
websites draaien. Packshot Studio heeft Python, Blender en een renderwachtrij nodig, dus het
draait op een **one.com VPS** (een eigen virtuele server). Je website blijft gewoon op de
webhosting staan.

Resultaat:

* de app op **https://packshot.artlab-media.be** (met HTTPS en login)
* **https://artlab-media.be/packshoot** stuurt automatisch door naar dat adres

## 1. VPS bestellen

In het one.com-controlepaneel: *VPS* bestellen.

* Besturingssysteem: **Ubuntu 24.04** (of 22.04)
* Minstens **4 vCPU, 8 GB RAM, 40 GB opslag**. Meer CPU-kernen = sneller renderen
  (renderen gebeurt op de processor). Met 4 kernen: ongeveer 1 minuut per aanzicht op
  1500-2000 px, 10-15 minuten op 4000 px.

Noteer het **IP-adres** en het **root-wachtwoord** (of SSH-sleutel) van de VPS.

## 2. Subdomein naar de VPS laten wijzen

In het one.com-controlepaneel bij het domein **artlab-media.be → DNS-instellingen**:

* nieuw **A-record**: naam `packshot`, waarde = IP-adres van de VPS
* (heeft de VPS ook een IPv6-adres: een **AAAA-record** `packshot` met dat adres)

Het kan tot een uur duren voor dit overal werkt. Testen: `ping packshot.artlab-media.be`
moet het IP-adres van de VPS tonen. **Wacht hiermee voor je stap 3 start**: het
HTTPS-certificaat wordt pas aangemaakt als het subdomein naar de VPS wijst.

## 3. Installeren (één commando)

Verbind met de VPS (Mac: *Terminal*, Windows: *PowerShell*):

```
ssh root@IP-ADRES-VAN-DE-VPS
```

en voer uit:

```
curl -fsSL https://raw.githubusercontent.com/pieterlambregs/pieterlambregs/claude/packshot-studio-8x67yx/packshot-studio/deploy/install-server.sh -o install.sh
bash install.sh
```

Het script installeert Docker, haalt de app op en vraagt:

* het domein: `packshot.artlab-media.be`
* een of meer **logins** (naam + wachtwoord van minstens 10 tekens, zonder komma's of
  dubbele punten). Druk op Enter bij een lege naam als je klaar bent.

De eerste keer duurt het bouwen 5-15 minuten. Daarna open je
**https://packshot.artlab-media.be** en log je in.

## 4. Doorverwijzing vanaf artlab-media.be/packshoot

Op je gewone webhosting (via het one.com-bestandsbeheer of FTP): maak in de hoofdmap van
artlab-media.be een map `packshoot` met daarin een bestand **`.htaccess`** met deze regel:

```
Redirect 302 /packshoot https://packshot.artlab-media.be/
```

(Staat er in de hoofdmap al een `.htaccess`, dan kun je de regel ook daar toevoegen.)

## Beheer

Alles gebeurt via `ssh root@IP-ADRES` en dan:

```
cd /opt/packshot/packshot-studio
C="docker compose -f docker-compose.yml -f deploy/docker-compose.server.yml"
```

| Wat | Commando |
|---|---|
| Nieuwe versie installeren | `bash ~/install.sh` (instellingen en projecten blijven) |
| Logins wijzigen | `nano .env` (regel `PACKSHOT_USERS=naam:wachtwoord,naam2:wachtwoord2`), dan `$C up -d` |
| Herstarten | `$C restart` |
| Stoppen | `$C down` (projecten blijven bewaard) |
| Meekijken in de logs | `$C logs -f` |

## Goed om te weten

* **Veiligheid**: alles loopt via HTTPS, de app is alleen bereikbaar na inloggen, en hij
  weigert te starten zonder logins. Gebruik sterke, unieke wachtwoorden: de artwork is
  vertrouwelijk.
* **Back-up**: projecten en renders staan op de VPS (Docker-volume `packshot-data`).
  Neem in het one.com-paneel snapshots/back-ups van de VPS als dat in je pakket zit.
* one.com geeft zelf geen ondersteuning op Docker-installaties.

## Op je iPhone

Open **https://packshot.artlab-media.be** in Safari en log in. Als icoon op je beginscherm:
tik op het deelknopje (vierkant met pijl) → **Zet op beginscherm**. De app opent dan
schermvullend, zonder Safari-balken.

* De menubalk bovenaan kun je horizontaal vegen.
* Bestanden uploaden: *Upload* → kies de PDF uit de app Bestanden (iCloud, Dropbox, e-mailbijlage
  eerst bewaren in Bestanden).
* Een render bewaren: tik op PNG of JPG → deelknop → **Bewaar afbeelding** (komt in Foto's) of
  **Bewaar in Bestanden**.
* Vouwlijnen verslepen werkt met je vinger, maar op een computerscherm is dat preciezer.
