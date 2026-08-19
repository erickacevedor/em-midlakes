#!/bin/bash
# Compila public/ -> dist/ listo para subir por FTP.
#  - convierte los PNG a WebP (fotos con perdida, logos sin perdida)
#  - pasa las rutas absolutas a relativas para que funcione en cualquier subdirectorio
#  - descarta placeholders y assets sin uso
set -e
cd "$(dirname "$0")"

rm -rf dist && mkdir -p dist/images
cp public/index.html public/styles.css public/script.js dist/
cp public/apple-icon.png public/icon-light-32x32.png public/icon-dark-32x32.png dist/

python3 - <<'PY'
from PIL import Image
import os
SRC, DST = "public/images", "dist/images"
PHOTOS = ["ductwork.png","hero-hvac.png","technician.png","vents.png","wall-units.png"]
LOGOS  = ["mid-lakes-logo-dark.png","mid-lakes-logo-light.png"]

for f in PHOTOS:                                    # fotos: con perdida, q=82
    Image.open(f"{SRC}/{f}").convert("RGB").save(
        f"{DST}/{f[:-4]}.webp", "WEBP", quality=82, method=6)

for f in LOGOS:                                     # logos: sin perdida (marca)
    Image.open(f"{SRC}/{f}").convert("RGBA").save(
        f"{DST}/{f[:-4]}.webp", "WEBP", lossless=True, method=6)

im = Image.open(f"{SRC}/mid-lakes-logo-dark.png").convert("RGBA")   # favicon PNG
im.thumbnail((256, 256), Image.LANCZOS)
im.save(f"{DST}/mid-lakes-logo-dark.png", "PNG", optimize=True)
PY

# rutas absolutas -> relativas, y PNG -> WebP en las etiquetas <img>
sed -i '' \
  -e 's|src="/images/\([a-z0-9-]*\)\.png"|src="images/\1.webp"|g' \
  -e 's|href="/images/|href="images/|g' \
  -e 's|href="/styles\.css"|href="styles.css"|' \
  -e 's|src="/script\.js"|src="script.js"|' \
  dist/index.html

# nginx (Flywheel) solo reconoce index.php como indice de directorio.
# Copia identica: PHP entrega el HTML tal cual, sin codigo PHP dentro.
cp dist/index.html dist/index.php

find dist -name ".DS_Store" -delete
rm -f mid-lakes-site.zip && (cd dist && zip -rq ../mid-lakes-site.zip .)
echo "OK -> dist/ ($(du -sh dist | cut -f1)) y mid-lakes-site.zip"
