#!/usr/bin/env python3
# Erzeugt App-Icons und Startbilder aus werkzeuge/icon-quelle.png. Start: npm run icons (braucht Pillow).
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

WURZEL = Path(__file__).resolve().parent.parent
ZIEL = WURZEL / 'icons'
QUELLE = Image.open(Path(__file__).with_name('icon-quelle.png')).convert('RGB')
GRUND = (22, 24, 32)  # Hintergrund der Quelle
GROESSE = QUELLE.width
MITTE = GROESSE // 2


def speichern(bild, name):
    bild.save(ZIEL / name, optimize=True)


# Icon: enger als die Quelle, damit das Symbol auf dem Home-Bildschirm groß genug wirkt.
ICON_AUSSCHNITT = 1130
rand = (GROESSE - ICON_AUSSCHNITT) // 2
icon = QUELLE.crop((rand, rand, rand + ICON_AUSSCHNITT, rand + ICON_AUSSCHNITT))
for s in (180, 192, 512):
    speichern(icon.resize((s, s), Image.LANCZOS), f'icon-{s}.png')

# Maskable: Das Symbol muss im sicheren Kreis (80 % Durchmesser) liegen.
flaeche = Image.new('RGB', (1400, 1400), GRUND)
flaeche.paste(QUELLE, ((1400 - GROESSE) // 2, (1400 - GROESSE) // 2))
speichern(flaeche.resize((512, 512), Image.LANCZOS), 'icon-maskable-512.png')

# Startbilder: Symbol mittig auf dem Grund, Kanten des Ausschnitts weich ausgeblendet.
SYMBOL = QUELLE.crop((96, 198, 1158, 1056))
maske = Image.new('L', SYMBOL.size, 0)
ImageDraw.Draw(maske).rectangle((30, 30, SYMBOL.width - 31, SYMBOL.height - 31), fill=255)
maske = maske.filter(ImageFilter.GaussianBlur(14))
for w, h in ((750, 1334), (828, 1792), (1125, 2436), (1242, 2688), (1170, 2532), (1179, 2556),
             (1284, 2778), (1290, 2796), (1206, 2622), (1320, 2868)):
    start = Image.new('RGB', (w, h), GRUND)
    # Gleiche Größe und Lage wie im ersten Bild des Startvideos, damit der Übergang nicht springt.
    b = round(w * SYMBOL.width / GROESSE)
    f = b / SYMBOL.width
    t = SYMBOL.resize((b, round(SYMBOL.height * f)), Image.LANCZOS)
    m = maske.resize(t.size, Image.LANCZOS)
    start.paste(t, ((w - t.width) // 2, (h - t.height) // 2), m)
    speichern(start, f'splash-{w}x{h}.png')
