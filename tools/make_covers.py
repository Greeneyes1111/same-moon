"""Draws the story covers as tiny SVG files (a few KB each).

Run: python3 tools/make_covers.py
Writes covers/<name>.svg and services/web/public/icons/icon.svg
"""
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "covers")

SKY = """<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121838"/><stop offset="1" stop-color="#33407e"/></linearGradient>
<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe6a1" stop-opacity=".5"/><stop offset="1" stop-color="#ffe6a1" stop-opacity="0"/></radialGradient>
{extra}
</defs>
<rect width="400" height="300" fill="url(#sky)"/>"""


def stars(seed, n=16, ymax=170):
    r = random.Random(seed)
    out = []
    for _ in range(n):
        x, y = r.randint(8, 392), r.randint(8, ymax)
        rad = r.choice([1.2, 1.5, 1.8, 2.2])
        op = r.choice([0.55, 0.7, 0.85, 1])
        out.append(f'<circle cx="{x}" cy="{y}" r="{rad}" fill="#fff6d5" opacity="{op}"/>')
    return "".join(out)


def moon(cx, cy, r, glow=True):
    g = f'<circle cx="{cx}" cy="{cy}" r="{r * 2}" fill="url(#glow)"/>' if glow else ""
    return (g + f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#ffe6a1"/>'
            f'<circle cx="{cx - r * .3}" cy="{cy - r * .2}" r="{r * .17}" fill="#f2d385"/>'
            f'<circle cx="{cx + r * .3}" cy="{cy + r * .25}" r="{r * .12}" fill="#f2d385"/>')


def svg(body, extra=""):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img">'
            + SKY.format(extra=extra) + body + "</svg>\n")


COVERS = {}

# 1. The Moon Came Too: one moon over an old home (left) and new buildings (right)
COVERS["moon"] = svg(
    stars(1) + moon(200, 92, 40)
    # hills
    + '<path d="M0 238 Q100 205 200 232 T400 226 V300 H0Z" fill="#1f275a"/>'
    # old home + lemon tree (left)
    + '<rect x="34" y="214" width="78" height="62" rx="4" fill="#2a3470"/>'
    + '<path d="M28 216 L73 186 L118 216Z" fill="#3a4690"/>'
    + '<rect x="62" y="232" width="22" height="22" rx="3" fill="#ffd27a"/>'
    + '<rect x="122" y="226" width="6" height="40" fill="#5b4a6b"/>'
    + '<circle cx="125" cy="214" r="22" fill="#2f6b5a"/>'
    + '<circle cx="115" cy="208" r="3.5" fill="#ffd94a"/><circle cx="131" cy="216" r="3.5" fill="#ffd94a"/><circle cx="122" cy="224" r="3.5" fill="#ffd94a"/>'
    # new buildings (right)
    + '<rect x="262" y="176" width="46" height="100" rx="3" fill="#2a3470"/>'
    + '<rect x="312" y="196" width="60" height="80" rx="3" fill="#25306a"/>'
    + "".join(f'<rect x="{x}" y="{y}" width="10" height="12" rx="2" fill="{c}"/>'
              for x, y, c in [(272, 190, "#ffd27a"), (290, 190, "#3d4a8f"), (272, 214, "#3d4a8f"), (290, 214, "#ffd27a"),
                              (272, 238, "#ffd27a"), (324, 210, "#ffd27a"), (344, 210, "#3d4a8f"), (324, 234, "#3d4a8f"), (344, 234, "#ffd27a")])
    + '<path d="M0 276 H400 V300 H0Z" fill="#171e48"/>'
)

# 2. What Fits in a Pocket: a small bag with a song, tea and a story rising out
COVERS["pocket"] = svg(
    stars(2, 14) + moon(330, 60, 22)
    + '<path d="M120 170 Q200 150 280 170 L270 268 Q200 280 130 268Z" fill="#b97a56"/>'
    + '<path d="M120 170 Q200 150 280 170 L272 205 Q200 222 128 205Z" fill="#a0664a"/>'
    + '<path d="M168 166 Q200 120 232 166" fill="none" stroke="#a0664a" stroke-width="9" stroke-linecap="round"/>'
    + '<circle cx="200" cy="208" r="6" fill="#ffd27a"/>'
    # music notes
    + '<g fill="#ffe6a1"><ellipse cx="150" cy="118" rx="9" ry="7"/><rect x="157" y="80" width="3.5" height="38"/><path d="M157 80 q14 4 16 16" stroke="#ffe6a1" stroke-width="3.5" fill="none"/></g>'
    # tea glass with steam
    + '<path d="M196 92 h22 l-3 30 h-16z" fill="#c9b6ff" opacity=".9"/><path d="M199 104 h16 l-2 16 h-12z" fill="#e0894f"/>'
    + '<path d="M203 86 q-6 -10 2 -18 q6 -8 0 -16 M213 86 q-6 -10 2 -18" stroke="#fff6d5" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".8"/>'
    # heart
    + '<path d="M262 112 c-12 -14 -30 0 -14 16 l14 12 l14 -12 c16 -16 -2 -30 -14 -16z" fill="#ff9e8a"/>'
    # sparkle path
    + '<path d="M200 160 q-40 -30 -48 -40 M200 160 q8 -20 7 -36 M200 160 q40 -20 60 -28" stroke="#fff6d5" stroke-width="1.6" stroke-dasharray="3 6" fill="none" opacity=".6"/>'
)

# 3. Nest Again: a small bird in a new nest with an old blue thread
COVERS["nest"] = svg(
    stars(3, 14) + moon(80, 70, 26)
    + '<path d="M400 150 Q300 170 170 214" stroke="#5b4a6b" stroke-width="12" fill="none" stroke-linecap="round"/>'
    + '<path d="M330 156 q20 -30 50 -26 M260 178 q-6 -26 14 -40" stroke="#5b4a6b" stroke-width="6" fill="none" stroke-linecap="round"/>'
    + "".join(f'<ellipse cx="{x}" cy="{y}" rx="13" ry="6" fill="#3f8a6f" transform="rotate({a} {x} {y})"/>'
              for x, y, a in [(372, 128, -20), (283, 134, -60), (350, 168, 25), (230, 196, 30)])
    # nest
    + '<path d="M160 214 Q215 262 270 214 Z" fill="#8a5a3c"/>'
    + '<path d="M160 214 Q215 250 270 214" fill="none" stroke="#b07a52" stroke-width="3"/>'
    + '<path d="M168 222 l90 -6 M172 230 l80 2 M182 238 l60 -4" stroke="#6e4630" stroke-width="2.5"/>'
    + '<path d="M196 230 q12 -10 22 0 q10 10 22 -2" stroke="#6fb4ff" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
    # bird
    + '<ellipse cx="214" cy="198" rx="26" ry="20" fill="#a77a58"/>'
    + '<circle cx="234" cy="184" r="13" fill="#a77a58"/>'
    + '<path d="M246 184 l12 3 l-12 4z" fill="#ffb347"/>'
    + '<circle cx="238" cy="181" r="2.6" fill="#1b1b2e"/>'
    + '<path d="M196 196 q14 -14 30 -2 q-14 10 -30 2z" fill="#8b6346"/>'
    + '<path d="M190 202 l-16 -6 l4 12z" fill="#8b6346"/>'
)

# 4. Two Words for Friend: two speech bubbles meeting
COVERS["words"] = svg(
    stars(4, 16) + moon(345, 55, 20)
    + '<path d="M60 90 h150 a20 20 0 0 1 20 20 v70 a20 20 0 0 1 -20 20 h-90 l-30 26 v-26 h-30 a20 20 0 0 1 -20 -20 v-70 a20 20 0 0 1 20 -20z" fill="#ffb38a"/>'
    + '<path d="M190 130 h150 a20 20 0 0 1 20 20 v70 a20 20 0 0 1 -20 20 h-30 v26 l-30 -26 h-90 a20 20 0 0 1 -20 -20 v-70 a20 20 0 0 1 20 -20z" fill="#8fdcc0" opacity=".95"/>'
    # sun in left bubble
    + '<circle cx="118" cy="140" r="18" fill="#ffe6a1"/>'
    + "".join(f'<line x1="118" y1="140" x2="{118 + 30 * dx}" y2="{140 + 30 * dy}" stroke="#ffe6a1" stroke-width="4" stroke-linecap="round" stroke-dasharray="0 22 8"/>'
              for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1), (.7, .7), (-.7, .7), (.7, -.7), (-.7, -.7)])
    # ball in right bubble
    + '<circle cx="300" cy="186" r="22" fill="#fff6d5"/><path d="M278 186 h44 M300 164 q-14 22 0 44 M300 164 q14 22 0 44" stroke="#5b6bd1" stroke-width="3" fill="none"/>'
    # heart where they overlap
    + '<path d="M210 168 c-8 -10 -22 0 -11 12 l11 9 l11 -9 c11 -12 -3 -22 -11 -12z" fill="#e2566b"/>'
)

# 5. Roots Take Time: a young olive tree with roots growing in the dark
COVERS["roots"] = svg(
    stars(5, 12, 120) + moon(330, 58, 22)
    + '<rect x="0" y="182" width="400" height="118" fill="#2a2246"/>'
    + '<path d="M0 182 Q200 172 400 182" stroke="#4a3d6e" stroke-width="4" fill="none"/>'
    # roots
    + '<g stroke="#b88b6a" stroke-width="3.5" fill="none" stroke-linecap="round">'
    + '<path d="M200 184 q-4 30 -30 46 q-24 14 -40 40"/><path d="M200 184 q6 34 34 50 q20 12 30 36"/>'
    + '<path d="M200 184 v70"/><path d="M186 224 q-26 -2 -44 10"/><path d="M220 230 q22 -8 46 0"/></g>'
    + '<g stroke="#b88b6a" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7">'
    + '<path d="M150 252 q-18 4 -28 18"/><path d="M250 244 q18 6 28 22"/><path d="M200 254 q-8 14 -4 30"/></g>'
    # trunk + leaves
    + '<path d="M200 184 q-4 -40 4 -70 M202 140 q-24 -14 -36 -30 M204 124 q22 -12 34 -30" stroke="#7a6457" stroke-width="7" fill="none" stroke-linecap="round"/>'
    + "".join(f'<ellipse cx="{x}" cy="{y}" rx="11" ry="4.5" fill="{c}" transform="rotate({a} {x} {y})"/>'
              for x, y, a, c in [(160, 104, -30, "#a9c7b8"), (176, 96, 20, "#8fb3a2"), (172, 116, 40, "#a9c7b8"),
                                 (236, 88, -20, "#8fb3a2"), (246, 102, 25, "#a9c7b8"), (226, 104, -50, "#a9c7b8"),
                                 (206, 108, 70, "#8fb3a2"), (194, 126, -40, "#8fb3a2")])
    + '<ellipse cx="252" cy="78" rx="9" ry="4" fill="#9ff0b0" transform="rotate(-35 252 78)"/>'
    + '<circle cx="252" cy="78" r="16" fill="#9ff0b0" opacity=".15"/>'
)

# 6. Blow the Bubble: one big gentle bubble, a flower, soft rain
COVERS["bubble"] = svg(
    stars(6, 10, 90)
    + '<path d="M40 70 q10 -30 50 -24 q14 -24 46 -10 q30 -6 34 22 q20 10 4 26 h-128 q-20 -6 -6 -14z" fill="#465398" opacity=".9"/>'
    + "".join(f'<line x1="{x}" y1="{y}" x2="{x - 4}" y2="{y + 14}" stroke="#8fb8ff" stroke-width="2" stroke-linecap="round" opacity=".55"/>'
              for x, y in [(70, 104), (98, 118), (122, 100), (150, 124), (60, 140), (134, 150)])
    + '<circle cx="250" cy="150" r="82" fill="url(#bub)" stroke="#bfe3ff" stroke-width="3" opacity=".95"/>'
    + '<path d="M196 112 a64 64 0 0 1 46 -36" stroke="#ffffff" stroke-width="7" fill="none" stroke-linecap="round" opacity=".8"/>'
    + '<circle cx="292" cy="196" r="7" fill="#ffffff" opacity=".6"/>'
    + '<circle cx="150" cy="250" r="9" fill="#ffd27a"/>'
    + "".join(f'<ellipse cx="{150 + dx}" cy="{250 + dy}" rx="9" ry="9" fill="#ff9eb8"/>' for dx, dy in [(0, -14), (13, -4), (8, 12), (-8, 12), (-13, -4)])
    + '<circle cx="150" cy="250" r="6" fill="#ffd27a"/>'
    + '<path d="M150 262 v34" stroke="#3f8a6f" stroke-width="4"/>'
    + '<path d="M150 284 q-18 -2 -22 -14 q14 0 22 14z" fill="#3f8a6f"/>'
    + '<circle cx="345" cy="62" r="5" fill="#bfe3ff" opacity=".6"/><circle cx="365" cy="88" r="3" fill="#bfe3ff" opacity=".5"/>',
    extra='<radialGradient id="bub" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#d7ecff" stop-opacity=".15"/><stop offset=".8" stop-color="#9ac9ff" stop-opacity=".18"/><stop offset="1" stop-color="#c9b6ff" stop-opacity=".45"/></radialGradient>'
)

# 7. Bread for the Neighbours: warm loaves at an open door
COVERS["bread"] = svg(
    stars(7, 10, 80) + moon(60, 52, 18, glow=False)
    + '<rect x="240" y="60" width="110" height="200" rx="6" fill="#ffd27a"/>'
    + '<rect x="250" y="70" width="90" height="190" rx="4" fill="#ffe4a3"/>'
    + '<path d="M240 60 h-20 v200 h20" fill="#2a3470"/>'
    + '<circle cx="232" cy="164" r="4" fill="#ffd27a"/>'
    + '<path d="M0 230 H260 V300 H0Z" fill="#26306c"/>'
    # cloth
    + '<path d="M40 232 h190 l-14 34 h-162z" fill="#e85d75"/>'
    + '<path d="M60 232 l-6 34 M90 232 l-4 34 M120 232 v34 M150 232 l4 34 M180 232 l6 34 M210 232 l8 34" stroke="#ffd0d8" stroke-width="3"/>'
    # loaves
    + '<ellipse cx="100" cy="222" rx="48" ry="20" fill="#d8955c"/><ellipse cx="100" cy="216" rx="44" ry="15" fill="#e7aa6e"/>'
    + '<ellipse cx="170" cy="222" rx="44" ry="18" fill="#d8955c"/><ellipse cx="170" cy="216" rx="40" ry="13" fill="#e7aa6e"/>'
    + '<path d="M78 214 q22 -6 44 0 M150 214 q20 -5 40 0" stroke="#b9743d" stroke-width="2.5" fill="none"/>'
    + '<path d="M96 192 q-8 -12 2 -22 q8 -10 0 -20 M170 194 q-8 -12 2 -22" stroke="#fff6d5" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/>'
    # cat in doorway
    + '<path d="M300 260 q-22 0 -20 -30 q2 -22 20 -24 q18 2 20 24 q2 30 -20 30z" fill="#2a2246"/>'
    + '<circle cx="300" cy="196" r="15" fill="#2a2246"/><path d="M288 188 l-2 -16 l10 10z M312 188 l2 -16 l-10 10z" fill="#2a2246"/>'
    + '<path d="M318 252 q22 -4 18 -26" stroke="#2a2246" stroke-width="6" fill="none" stroke-linecap="round"/>'
    + '<circle cx="294" cy="196" r="2" fill="#ffd27a"/><circle cx="306" cy="196" r="2" fill="#ffd27a"/>'
)

# 8. Omar and the Shadows: a lamp, a rabbit shadow, a camel crossing the ceiling
COVERS["shadows"] = svg(
    '<path d="M60 300 L150 40 H400 V300Z" fill="#ffe6a1" opacity=".16"/>'
    + '<path d="M90 300 L170 70 H400 V300Z" fill="#ffe6a1" opacity=".1"/>'
    # lamp
    + '<path d="M40 210 h60 l-12 -40 h-36z" fill="#ffb38a"/><rect x="66" y="210" width="8" height="60" fill="#5b4a6b"/><rect x="44" y="268" width="52" height="10" rx="4" fill="#5b4a6b"/>'
    + '<circle cx="70" cy="210" r="30" fill="url(#glow)"/>'
    # rabbit shadow on wall
    + '<g fill="#141a3d" opacity=".75" transform="translate(0 22)"><ellipse cx="250" cy="200" rx="46" ry="32"/><ellipse cx="226" cy="140" rx="11" ry="40" transform="rotate(-12 226 140)"/><ellipse cx="256" cy="138" rx="11" ry="40" transform="rotate(10 256 138)"/><circle cx="298" cy="210" r="12"/></g>'
    + '<circle cx="236" cy="218" r="4" fill="#fff6d5" opacity=".7"/>'
    # camel along ceiling (one hump, long neck)
    + '<g fill="#141a3d" opacity=".65">'
    + '<path d="M196 84 q-2 -16 16 -20 q14 -30 36 -6 q14 -2 26 4 q8 2 12 -6 l10 -22 q4 -8 12 -6 l12 3 q6 4 0 9 l-10 1 l-10 26 q-6 14 -22 18 h-62 q-18 0 -20 -1z"/>'
    + '<rect x="206" y="84" width="5" height="26" rx="2"/><rect x="222" y="84" width="5" height="26" rx="2"/><rect x="254" y="84" width="5" height="26" rx="2"/><rect x="270" y="84" width="5" height="26" rx="2"/>'
    + '<path d="M196 80 q-10 6 -8 18" stroke="#141a3d" stroke-width="3" fill="none"/></g>'
    + '<g fill="#141a3d" opacity=".6"><path d="M330 160 q20 -24 40 -6 q-16 2 -20 14 q16 6 26 -2 q-6 22 -40 14z"/></g>'
)

# 9. The Brave Box: an open box of glowing pebbles
COVERS["box"] = svg(
    stars(9, 16) + moon(70, 60, 20)
    + '<circle cx="200" cy="190" r="110" fill="url(#glow)"/>'
    + '<path d="M120 170 L200 150 L280 170 L200 190Z" fill="#8a5a3c"/>'
    + "".join(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{c}"/>'
              for x, y, rx, ry, c in [(170, 168, 13, 9, "#ffb38a"), (196, 160, 12, 8, "#8fdcc0"), (222, 168, 13, 9, "#c9b6ff"),
                                      (186, 176, 11, 7, "#ffe6a1"), (210, 178, 12, 8, "#8fb8ff"), (238, 174, 10, 7, "#ff9eb8"),
                                      (160, 178, 9, 6, "#c9b6ff"), (200, 170, 9, 6, "#ffd27a")])
    + '<path d="M120 170 L200 190 V262 L120 240Z" fill="#b97a56"/>'
    + '<path d="M280 170 L200 190 V262 L280 240Z" fill="#a0664a"/>'
    + '<path d="M120 170 L200 150 L176 104 L98 124Z" fill="#c98b62"/>'
    + '<path d="M98 124 L176 104" stroke="#e3a77a" stroke-width="3"/>'
    + "".join(f'<path d="M{x} {y} l3 -9 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3z" fill="#fff6d5" opacity=".9"/>'
              for x, y in [(250, 120), (300, 140), (150, 96)])
)

# 10. Darya's Map: a hand-drawn map of the places she knows
COVERS["map"] = svg(
    stars(10, 12, 60)
    + '<g transform="rotate(-4 200 160)">'
    + '<rect x="60" y="52" width="280" height="210" rx="6" fill="#fbf1dc"/>'
    + '<path d="M120 230 C140 190 170 210 190 170 S250 140 270 110 S300 90 310 80" stroke="#5b6bd1" stroke-width="3" stroke-dasharray="6 7" fill="none" stroke-linecap="round"/>'
    # home
    + '<rect x="98" y="218" width="34" height="28" fill="#e85d75"/><path d="M94 220 l21 -18 l21 18z" fill="#b8435a"/><rect x="110" y="232" width="9" height="14" fill="#fbf1dc"/>'
    # tree
    + '<rect x="186" y="170" width="5" height="18" fill="#7a6457"/><circle cx="188" cy="160" r="16" fill="#3f8a6f"/>'
    # bench
    + '<rect x="232" y="138" width="34" height="6" rx="2" fill="#3f8a6f"/><rect x="236" y="144" width="4" height="10" fill="#3f8a6f"/><rect x="258" y="144" width="4" height="10" fill="#3f8a6f"/>'
    # bakery loaf
    + '<ellipse cx="150" cy="182" rx="16" ry="9" fill="#e7aa6e"/><path d="M142 180 q8 -4 16 0" stroke="#b9743d" stroke-width="2" fill="none"/>'
    # pin
    + '<path d="M310 92 c-12 -14 -10 -32 0 -32 s12 18 0 32z" fill="#e2566b"/><circle cx="310" cy="72" r="4" fill="#fbf1dc"/>'
    # mountains
    + '<path d="M240 100 l18 -26 l14 18 l10 -12 l18 20z" fill="#b9c3e8"/>'
    + '<text x="92" y="88" font-family="sans-serif" font-size="15" fill="#33407e" opacity=".55">~ ~ ~</text>'
    + '</g>'
)

ICON = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a2150"/><stop offset="1" stop-color="#3b4a92"/></linearGradient></defs>
<rect width="512" height="512" rx="112" fill="url(#b)"/>
<circle cx="256" cy="246" r="132" fill="#ffe6a1"/>
<circle cx="312" cy="206" r="116" fill="url(#b)"/>
<circle cx="372" cy="356" r="10" fill="#fff6d5"/><circle cx="140" cy="132" r="8" fill="#fff6d5"/><circle cx="402" cy="128" r="6" fill="#fff6d5"/>
</svg>
"""

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, data in COVERS.items():
        with open(os.path.join(OUT, f"{name}.svg"), "w") as f:
            f.write(data)
    icons = os.path.join(ROOT, "services", "web", "public", "icons")
    os.makedirs(icons, exist_ok=True)
    with open(os.path.join(icons, "icon.svg"), "w") as f:
        f.write(ICON)
    for name in COVERS:
        size = os.path.getsize(os.path.join(OUT, f"{name}.svg"))
        print(f"{name}.svg {size} bytes")
