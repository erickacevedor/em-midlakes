#!/bin/bash
# Compila public/ -> dist/ listo para subir por FTP.
#
# Ya no hay nada que transcodificar: las fotos viven en public/ como WebP y las
# rutas de los assets son relativas, asi que el sitio funciona igual en la raiz
# del dominio o en un subdirectorio. El build es una copia limpia mas el zip.
set -e
cd "$(dirname "$0")"

rm -rf dist
cp -r public dist

find dist -name ".DS_Store" -delete

rm -f mid-lakes-site.zip
if command -v zip >/dev/null 2>&1; then
  (cd dist && zip -rq ../mid-lakes-site.zip .)
  echo "OK -> dist/ ($(du -sh dist | cut -f1)) y mid-lakes-site.zip"
else
  echo "OK -> dist/ ($(du -sh dist | cut -f1))"
  echo "   (zip no esta instalado: comprimi dist/ a mano si necesitas el .zip)"
fi
