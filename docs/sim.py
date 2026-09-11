import math, random, statistics
import numpy as np
from scipy.stats import spearmanr
from glicko2 import Player, update_player

random.seed(7)
np.random.seed(7)


def p_win(sa, sb):
    return 1.0 / (1.0 + 10 ** ((sb - sa) / 400.0))


# ---------------------------------------------------------------- 1. cas d'ecole
def single_match(ra, rda, rb, rdb, a_wins=True, tau=0.5):
    A = Player(ra, rda)
    B = Player(rb, rdb)
    A0, B0 = Player(ra, rda), Player(rb, rdb)
    update_player(A, [B0], [1.0 if a_wins else 0.0], tau=tau)
    update_player(B, [A0], [0.0 if a_wins else 1.0], tau=tau)
    return A, B


print("=== 1. Cas d'ecole : nouveau (1500 +/-350) vs etabli (1700 +/-60) ===")
for a_wins in (True, False):
    A, B = single_match(1500, 350, 1700, 60, a_wins)
    tag = "le nouveau GAGNE" if a_wins else "le nouveau PERD"
    print(f"  {tag}")
    print(f"    nouveau : 1500+/-350 -> {A.rating:7.1f}+/-{A.rd:5.1f}   ({A.rating-1500:+.1f})")
    print(f"    etabli  : 1700+/- 60 -> {B.rating:7.1f}+/-{B.rd:5.1f}   ({B.rating-1700:+.1f})")

print("\n  Deux joueurs etablis de meme niveau (1600 +/-60) :")
A, B = single_match(1600, 60, 1600, 60, True)
print(f"    gagnant {A.rating-1600:+.1f} / perdant {B.rating-1600:+.1f}")


# ---------------------------------------------------------------- 2. simulation
def run_sim(n_players=300, days=90, bracket_size=16, tau=0.5, init_rd=350.0,
            season_len=30, soft_reset=0.30, upset_noise=True, verbose=False):
    pool = []
    for i in range(n_players):
        ts = np.random.normal(1500, 300)
        pool.append(Player(1500.0, init_rd, name=f"P{i}", true_skill=ts))

    # activite heterogene : quelques joueurs tres actifs, beaucoup d'occasionnels
    activity = np.random.pareto(1.6, n_players) + 0.3
    activity = activity / activity.sum()

    history = []
    for day in range(1, days + 1):
        # soft reset de debut de saison
        if season_len and day > 1 and (day - 1) % season_len == 0:
            for p in pool:
                p.rating = p.rating + soft_reset * (1500.0 - p.rating)
                p.rd = min(350.0, p.rd * 1.8)

        participants = list(np.random.choice(pool, size=bracket_size,
                                             replace=False, p=activity))
        # etat fige en debut de periode (regle Glicko-2)
        frozen = {p.name: Player(p.rating, p.rd, p.vol) for p in participants}
        results = {p.name: ([], []) for p in participants}

        alive = sorted(participants, key=lambda x: -x.rating)  # seeding
        while len(alive) > 1:
            pairs = [(alive[i], alive[len(alive) - 1 - i]) for i in range(len(alive) // 2)]
            nxt = []
            for a, b in pairs:
                pa = p_win(a.true_skill, b.true_skill)
                if upset_noise:  # forme du jour
                    pa = min(0.97, max(0.03, pa + np.random.normal(0, 0.05)))
                if random.random() < pa:
                    w, l = a, b
                else:
                    w, l = b, a
                results[w.name][0].append(frozen[l.name]); results[w.name][1].append(1.0)
                results[l.name][0].append(frozen[w.name]); results[l.name][1].append(0.0)
                nxt.append(w)
            alive = nxt

        for p in participants:
            opps, scs = results[p.name]
            update_player(p, opps, scs, tau=tau)

        # metriques sur les joueurs ayant au moins 5 matchs
        ranked = [p for p in pool if p.games >= 5]
        if len(ranked) > 10:
            rho = spearmanr([p.rating for p in ranked],
                            [p.true_skill for p in ranked]).statistic
            mae = statistics.mean(abs(p.rating - p.true_skill) for p in ranked)
            history.append((day, len(ranked), rho, mae,
                            statistics.mean(p.rd for p in ranked)))
    return pool, history


print("\n=== 2. Convergence sur 90 jours (1 tournoi de 16 par jour, 300 joueurs) ===")
pool, hist = run_sim()
print(f"  {'jour':>5} {'classes':>8} {'correl.':>8} {'err.moy':>8} {'RD moy':>7}")
for row in hist:
    if row[0] in (5, 10, 20, 30, 45, 60, 90):
        print(f"  {row[0]:>5} {row[1]:>8} {row[2]:>8.3f} {row[3]:>8.0f} {row[4]:>7.0f}")

# convergence en fonction du nombre de matchs joues
print("\n=== 3. Precision selon le nombre de matchs joues ===")
buckets = [(1, 4), (5, 9), (10, 19), (20, 39), (40, 999)]
for lo, hi in buckets:
    grp = [p for p in pool if lo <= p.games <= hi]
    if len(grp) < 5:
        continue
    mae = statistics.mean(abs(p.rating - p.true_skill) for p in grp)
    rd = statistics.mean(p.rd for p in grp)
    print(f"  {lo:>3}-{hi if hi<999 else '+':<4} matchs : n={len(grp):>3}  err.moy={mae:>4.0f}  RD moy={rd:>3.0f}")

# ---------------------------------------------------------------- 4. tau
print("\n=== 4. Effet de tau (volatilite) sur 60 jours ===")
for tau in (0.2, 0.3, 0.5, 0.8):
    random.seed(7); np.random.seed(7)
    _, h = run_sim(days=60, tau=tau)
    print(f"  tau={tau:<4} -> correlation {h[-1][2]:.3f} | erreur moyenne {h[-1][3]:.0f}")

# ---------------------------------------------------------------- 5. RD initial
print("\n=== 5. Effet du RD initial (vitesse de calibrage) ===")
for rd0 in (200, 250, 350):
    random.seed(7); np.random.seed(7)
    _, h = run_sim(days=60, init_rd=rd0)
    d10 = [r for r in h if r[0] == 10][0]
    print(f"  RD0={rd0} -> jour10 correl {d10[2]:.3f} err {d10[3]:.0f} | jour60 correl {h[-1][2]:.3f} err {h[-1][3]:.0f}")

# ---------------------------------------------------------------- 6. paliers
print("\n=== 6. Distribution des ratings (base des paliers) ===")
ranked = sorted([p for p in pool if p.games >= 5], key=lambda x: x.rating)
vals = [p.rating for p in ranked]
for q in (5, 20, 40, 60, 80, 95, 99):
    print(f"  p{q:<3} = {np.percentile(vals, q):.0f}")
print(f"  min {min(vals):.0f} / max {max(vals):.0f} / n={len(vals)}")

import json
json.dump({"hist": [(r[0], r[2], r[3], r[4]) for r in hist]}, open("hist.json", "w"))
