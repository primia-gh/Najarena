# Polices des images de partage

Utilisées uniquement par les images d'aperçu générées (`opengraph-image.tsx`,
voir `src/lib/image-partage.tsx`) : le générateur d'images n'accepte pas le
format woff2 servi aux navigateurs par `next/font`.

- Big Shoulders Display 800 et 900 (titres, chiffres)
- Chakra Petch 500 et 600 (textes, libellés)

Fichiers « latin » (accents français compris) tirés des paquets npm
`@fontsource/big-shoulders-display` et `@fontsource/chakra-petch` (v5.3.0).
Licence SIL Open Font License 1.1 : voir les fichiers LICENCE-*.txt.
