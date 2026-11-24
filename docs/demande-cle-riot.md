# Demande de clé production Riot — texte prêt à coller

Préparé le 24/11/2026. Le formulaire du portail (developer.riotgames.com → « Register Product ») est en anglais : les textes à coller sont en anglais, les notes pour le porteur du projet en français. Les champs exacts du formulaire ne sont pas publiés par Riot : adapter les blocs aux cases proposées.

**Avant de déposer**, vérifier que la mise en ligne du 24/11 (paliers renommés, arène en pause, mention légale) est en production.

---

## Product name

Najarena

## Product URL

https://najarena.vercel.app

> Note : la vérification du domaine se fait par un fichier `riot.txt` à la racine. Si un nom de domaine est acheté plus tard, il faudra sans doute refaire la vérification pour le nouveau domaine.

## Game

League of Legends

## Short description

Najarena is a French-language tournament platform for League of Legends amateurs. Players join daily 1v1 tournaments and team (5v5) tournaments; results are read from the official match history instead of being self-reported, and each player gets a public "esports CV" listing their verified tournament results.

## Detailed description / use case

Najarena organizes community tournaments for amateur League of Legends players in French-speaking regions (EUW first).

How it works:

1. A player creates an account and links their Riot ID. Ownership is checked by asking the player to set a specific profile icon, read through Summoner-V4. We will move to Riot Sign On (RSO) as soon as it is available to us.
2. The player registers for a tournament, checks in, and plays their bracket match as a custom game.
3. After the match, our server looks up the game in the players' match history (Match-V5) and records the winner. If the game cannot be found, the tournament organizer decides manually; such results are labeled "manual" on the site and never count as verified.
4. Each player has a public profile listing their verified tournament results.

Tournament ranking: players have a seasonal ranking computed only from matches played in Najarena tournaments (custom games). It is a standings table for our own tournaments, like any tournament organizer's season standings. It does not estimate, replace or reproduce the Riot ranked ladder or anyone's MMR, and its tiers have our own names (not Riot ranks). Matches played with an account below summoner level 30 never count toward it.

Fair play: results come from Riot data, not from players; disputes go to the organizer; anti-abuse rules limit repeated wins between the same players.

Monetization: tournament registration is always free. Optional paid plans (not yet active) add personal match analysis features; everything needed to play and to be ranked stays free. No betting, no gambling, no entry fees, no cryptocurrency. Cash prizes are disabled.

APIs we use (server side only; the key never reaches the browser):

- Account-V1 (by Riot ID) — link a player's Riot ID.
- Summoner-V4 (by PUUID) — profile icon check for ownership, summoner level.
- Match-V5 (match ids by PUUID, match, timeline) — find the tournament game and its result; optional personal match analysis.
- League-V4 (entries by PUUID) — show the player's own ranked tier on their profile.
- Spectator-V5 — tell a player their opponent is already in game.
- Clash-V1 — show upcoming Clash dates.
- LoL-Status-V4 — health check.

Later, once approved, we would like to request the Tournament API (tournament codes) for our larger tournaments, and RSO.

## Questions for the reviewer

> Note : poser ces questions dans la demande évite une seconde demande si la réponse est non.

1. Our 1v1 tournaments start at 8 players, and players can also challenge each other to a single 1v1 match. Does the 20-participant minimum in the tournament policies apply to tournaments that do not use the Tournament API? If it does, we will adapt our formats.
2. Is ownership verification through a requested profile icon acceptable until we have RSO?

## Legal and policies

- Terms of Service: https://najarena.vercel.app/cgu
- Privacy Policy: https://najarena.vercel.app/confidentialite
- Legal notice: https://najarena.vercel.app/mentions-legales
- Riot legal boilerplate: in the footer of every page.
- No Riot logos or champion art are used.

---

## Après le dépôt

1. Riot affiche une suite de caractères : la transmettre ici (ce n'est pas un secret). Je la publie dans `public/riot.txt`, je mets le site en ligne, puis tu valides le domaine dans le portail.
2. Réponse attendue en une à trois semaines, dans le portail. Ne pas relancer : chaque message renvoie la demande en bout de file.
3. Clé obtenue : la coller dans Vercel (réglage `RIOT_API_KEY`, production), jamais dans la conversation. Je vérifie ensuite qu'elle fonctionne.
