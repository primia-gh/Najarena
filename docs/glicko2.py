"""Glicko-2 — implementation de reference (Glickman 2013) + moteur de simulation."""
import math

SCALE = 173.7178
BASE = 1500.0


class Player:
    def __init__(self, rating=1500.0, rd=350.0, vol=0.06, name=None, true_skill=None):
        self.rating = rating
        self.rd = rd
        self.vol = vol
        self.name = name
        self.true_skill = true_skill
        self.games = 0

    # --- conversions echelle Glicko-2 ---
    @property
    def mu(self):
        return (self.rating - BASE) / SCALE

    @property
    def phi(self):
        return self.rd / SCALE

    def set_from_glicko2(self, mu, phi):
        self.rating = mu * SCALE + BASE
        self.rd = phi * SCALE

    def copy_state(self):
        return (self.rating, self.rd, self.vol)


def _g(phi):
    return 1.0 / math.sqrt(1.0 + 3.0 * phi * phi / (math.pi ** 2))


def _E(mu, mu_j, phi_j):
    return 1.0 / (1.0 + math.exp(-_g(phi_j) * (mu - mu_j)))


def update_player(player, opponents, scores, tau=0.5, eps=1e-6):
    """opponents: liste de Player (etat en DEBUT de periode). scores: 1.0 / 0.0 / 0.5"""
    mu, phi, sigma = player.mu, player.phi, player.vol

    if not opponents:
        # aucun match : le RD augmente (l'incertitude revient)
        phi_star = math.sqrt(phi * phi + sigma * sigma)
        player.set_from_glicko2(mu, min(phi_star, 350.0 / SCALE))
        return

    # v = variance estimee
    v_inv = 0.0
    delta_sum = 0.0
    for opp, s in zip(opponents, scores):
        gj = _g(opp.phi)
        Ej = _E(mu, opp.mu, opp.phi)
        v_inv += gj * gj * Ej * (1 - Ej)
        delta_sum += gj * (s - Ej)
    v = 1.0 / v_inv
    delta = v * delta_sum

    # --- iteration sur la volatilite (Illinois) ---
    a = math.log(sigma ** 2)

    def f(x):
        ex = math.exp(x)
        num = ex * (delta ** 2 - phi ** 2 - v - ex)
        den = 2.0 * ((phi ** 2 + v + ex) ** 2)
        return num / den - (x - a) / (tau ** 2)

    A = a
    if delta ** 2 > phi ** 2 + v:
        B = math.log(delta ** 2 - phi ** 2 - v)
    else:
        k = 1
        while f(a - k * tau) < 0:
            k += 1
        B = a - k * tau

    fA, fB = f(A), f(B)
    while abs(B - A) > eps:
        C = A + (A - B) * fA / (fB - fA)
        fC = f(C)
        if fC * fB <= 0:
            A, fA = B, fB
        else:
            fA = fA / 2.0
        B, fB = C, fC

    sigma_new = math.exp(A / 2.0)

    phi_star = math.sqrt(phi ** 2 + sigma_new ** 2)
    phi_new = 1.0 / math.sqrt(1.0 / (phi_star ** 2) + 1.0 / v)
    mu_new = mu + (phi_new ** 2) * delta_sum

    player.vol = sigma_new
    player.set_from_glicko2(mu_new, phi_new)
    player.games += len(opponents)
