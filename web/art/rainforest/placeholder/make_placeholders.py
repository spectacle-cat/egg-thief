#!/usr/bin/env python3
"""Draws the rainforest's stand-in SVGs into this folder (the SVGs are the source: tools/art-rainforest.sh renders them).

    python3 -I art/rainforest/placeholder/make_placeholders.py

Cut-paper look: flat tones, two or three close ones per shape, ragged outlines, short strokes and flecks, no gradients.
Seeded, so a re-run draws the same pictures. Edit the SVGs by hand if you like; a real drawing dropped into
art/rainforest/<name>.png (or .svg) replaces its stand-in anyway.
"""
import math
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))

BC, PL, PLL = '#1A1030', '#3B2350', '#5A3A6E'
DT, JD, MT, MS = '#0C4A50', '#1E8C7B', '#86DDB9', '#D9F5E6'
LM, HP, DP = '#E4F56A', '#F23D7F', '#B01E5B'
# tones between neighbours
DTJ = '#146A66'    # deep teal / jade
JMT = '#53B59B'    # jade / mint
BCP = '#2A1840'    # blackcurrant / plum
PPL = '#4A2D5F'    # plum / plum light


def f(v):
    return ('%.1f' % v).rstrip('0').rstrip('.')


class Svg:
    def __init__(self, name, w, h, seed):
        self.name, self.w, self.h = name, w, h
        self.r = random.Random(seed)
        self.out = []
        self.nclip = 0

    # ---- geometry -------------------------------------------------------------------------------------
    def rag(self, pts, amp=2.0, step=9, closed=True):
        """Subdivide the edges and push the new points about, so the outline is ragged like torn paper."""
        res = []
        n = len(pts)
        for i in range(n if closed else n - 1):
            x0, y0 = pts[i]
            x1, y1 = pts[(i + 1) % n]
            d = math.hypot(x1 - x0, y1 - y0)
            k = max(1, int(d / step))
            nx, ny = (-(y1 - y0) / (d or 1), (x1 - x0) / (d or 1))
            for j in range(k):
                t = j / k
                a = self.r.uniform(-amp, amp) if (j or True) else 0
                res.append((x0 + (x1 - x0) * t + nx * a, y0 + (y1 - y0) * t + ny * a))
        if not closed:
            res.append(pts[-1])
        return res

    def smooth(self, pts, n=6):
        """Catmull-Rom through the points (open)."""
        res = []
        p = [pts[0]] + list(pts) + [pts[-1]]
        for i in range(1, len(p) - 2):
            for j in range(n):
                t = j / n
                res.append(tuple(
                    0.5 * ((2 * p[i][k]) + (-p[i - 1][k] + p[i + 1][k]) * t +
                           (2 * p[i - 1][k] - 5 * p[i][k] + 4 * p[i + 1][k] - p[i + 2][k]) * t * t +
                           (-p[i - 1][k] + 3 * p[i][k] - 3 * p[i + 1][k] + p[i + 2][k]) * t ** 3) for k in (0, 1)))
        res.append(pts[-1])
        return res

    def inside(self, poly, x, y):
        c = False
        n = len(poly)
        for i in range(n):
            x0, y0 = poly[i]
            x1, y1 = poly[(i + 1) % n]
            if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0:
                c = not c
        return c

    def blob(self, cx, cy, rx, ry, n=22, jit=0.12, rot=0):
        pts = []
        for i in range(n):
            a = 2 * math.pi * i / n
            k = 1 + self.r.uniform(-jit, jit)
            x, y = math.cos(a) * rx * k, math.sin(a) * ry * k
            c, s = math.cos(rot), math.sin(rot)
            pts.append((cx + x * c - y * s, cy + x * s + y * c))
        return pts

    # ---- drawing --------------------------------------------------------------------------------------
    def poly(self, pts, fill, op=None, stroke=None, sw=0):
        d = 'M' + ' L'.join('%s %s' % (f(x), f(y)) for x, y in pts) + 'Z'
        a = ' fill="%s"' % fill
        if op is not None:
            a += ' fill-opacity="%s"' % op
        if stroke:
            a += ' stroke="%s" stroke-width="%s" stroke-linejoin="round"' % (stroke, sw)
        self.out.append('<path d="%s"%s/>' % (d, a))

    def line(self, pts, col, w, op=None, cap='round'):
        d = 'M' + ' L'.join('%s %s' % (f(x), f(y)) for x, y in pts)
        o = ' stroke-opacity="%s"' % op if op is not None else ''
        self.out.append('<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="%s" stroke-linejoin="round"%s/>'
                        % (d, col, f(w), cap, o))

    def strokes(self, segs, col, w, op=None):
        """Many short strokes of one colour in one element."""
        if not segs:
            return
        d = ''.join('M%s %s L%s %s' % (f(a), f(b), f(c), f(e)) for (a, b), (c, e) in segs)
        o = ' stroke-opacity="%s"' % op if op is not None else ''
        self.out.append('<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round"%s/>' % (d, col, f(w * 1.3), o))

    def specks(self, pts, col, size, op=None):
        """Little ragged flecks (tiny quadrilaterals)."""
        d = ''
        for x, y in pts:
            s = size * self.r.uniform(0.5, 1.3)
            q = [(x + self.r.uniform(-s, s), y + self.r.uniform(-s, s)) for _ in range(4)]
            q = sorted(q, key=lambda p: math.atan2(p[1] - y, p[0] - x))
            d += 'M' + ' L'.join('%s %s' % (f(a), f(b)) for a, b in q) + 'Z'
        o = ' fill-opacity="%s"' % op if op is not None else ''
        self.out.append('<path d="%s" fill="%s"%s/>' % (d, col, o))

    def open_clip(self, pts):
        self.nclip += 1
        cid = 'c%d' % self.nclip
        d = 'M' + ' L'.join('%s %s' % (f(x), f(y)) for x, y in pts) + 'Z'
        self.out.append('<clipPath id="%s"><path d="%s"/></clipPath><g clip-path="url(#%s)">' % (cid, d, cid))

    def close_clip(self):
        self.out.append('</g>')

    # ---- texture inside a polygon --------------------------------------------------------------------------
    def scatter(self, poly, n):
        xs = [p[0] for p in poly]
        ys = [p[1] for p in poly]
        res = []
        tries = 0
        while len(res) < n and tries < n * 40:
            tries += 1
            x, y = self.r.uniform(min(xs), max(xs)), self.r.uniform(min(ys), max(ys))
            if self.inside(poly, x, y):
                res.append((x, y))
        return res

    def dashes(self, poly, n, col, length=(6, 18), ang=90, spread=18, w=2, op=None):
        segs = []
        for x, y in self.scatter(poly, n):
            a = math.radians(ang + self.r.uniform(-spread, spread))
            L = self.r.uniform(*length)
            segs.append(((x, y), (x + math.cos(a) * L, y + math.sin(a) * L)))
        self.strokes(segs, col, w, op)

    def flecks(self, poly, n, col, size=1.6, op=None):
        self.specks(self.scatter(poly, n), col, size, op)

    def patches(self, poly, n, col, rx=(8, 22), ry=(5, 14), rot=0, op=None):
        for x, y in self.scatter(poly, n):
            self.poly(self.rag(self.blob(x, y, self.r.uniform(*rx), self.r.uniform(*ry), 9, 0.25, rot + self.r.uniform(-.3, .3)), 1.2, 6), col, op)

    # ---- shapes ----------------------------------------------------------------------------------------
    def leaf(self, x, y, L, W, ang, fill, rib=None, shade=None, vein=None):
        """Pointed leaf from its base (x,y) outwards at angle ang (degrees), length L, width W."""
        a = math.radians(ang)
        ux, uy = math.cos(a), math.sin(a)
        nx, ny = -uy, ux
        left, right = [], []
        k = 9
        for i in range(k + 1):
            t = i / k
            hw = W * 0.5 * (math.sin(math.pi * min(1, t * 1.05 + 0.02)) ** 0.8) * (1 - 0.25 * t)
            bx, by = x + ux * L * t, y + uy * L * t
            left.append((bx + nx * hw, by + ny * hw))
            right.append((bx - nx * hw, by - ny * hw))
        outline = self.rag(left + right[::-1], 0.9, 7)
        self.poly(outline, fill)
        if shade:
            half = left[:] + [(x + ux * L * (i / k), y + uy * L * (i / k)) for i in range(k, -1, -1)]
            self.open_clip(outline)
            self.poly(half, shade)
            self.close_clip()
        if rib:
            self.line([(x + ux * L * 0.02, y + uy * L * 0.02), (x + ux * L * 0.93, y + uy * L * 0.93)], rib, max(1.2, W * 0.05))
        if vein:
            segs = []
            for i in range(2, 9):
                t = i / 10
                bx, by = x + ux * L * t, y + uy * L * t
                hw = W * 0.42 * math.sin(math.pi * t) ** 0.8
                for sgn in (1, -1):
                    segs.append(((bx, by), (bx + ux * L * 0.07 + sgn * nx * hw, by + uy * L * 0.07 + sgn * ny * hw)))
            self.strokes(segs, vein, max(1, W * 0.03))
        return outline

    def save(self):
        head = ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">\n'
                % (self.w, self.h, self.w, self.h))
        path = os.path.join(HERE, self.name + '.svg')
        with open(path, 'w') as fh:
            fh.write(head + '\n'.join(self.out) + '\n</svg>\n')
        print('wrote', path)


# =============================================================================================================
def up_trunk():
    s = Svg('up_trunk', 256, 512, 11)
    L = [(80, -6), (77, 90), (74, 200), (68, 290), (52, 360), (30, 425), (8, 478), (-4, 518)]
    R = [(260, 518), (246, 470), (226, 420), (205, 355), (190, 290), (184, 200), (181, 90), (178, -6)]
    body = s.rag(L + R, 2.2, 10)
    s.poly(body, DT)
    s.open_clip(body)
    # lit left side, shaded right side (close tones)
    s.poly(s.rag([(70, -6), (112, -6), (108, 200), (112, 300), (110, 520), (-10, 520), (30, 425), (68, 290)], 2.5, 10), DTJ)
    s.poly(s.rag([(70, -6), (96, -6), (92, 200), (96, 300), (86, 520), (-10, 520), (30, 425), (68, 290)], 2.5, 10), JD)
    s.poly(s.rag([(150, -6), (190, -6), (200, 300), (270, 520), (160, 520), (156, 300)], 2.5, 10), BC)
    s.poly(s.rag([(150, -6), (162, -6), (168, 300), (176, 520), (160, 520), (156, 300)], 2.5, 10), BCP)
    # root fins: crest lines running down from the column into the flare, and the dark gaps between them
    lfin = [(104, 300), (86, 380), (60, 450), (28, 520)]
    rfin = [(150, 300), (170, 385), (200, 455), (236, 520)]
    mfin = [(128, 380), (126, 450), (122, 520)]
    for crest, lit in ((lfin, MT), (rfin, JD), (mfin, JD)):
        s.line(s.rag(s.smooth(crest), 1.2, 8, False), lit, 3.2)
    s.poly(s.rag([(104, 300), (86, 380), (60, 450), (28, 520), (70, 520), (92, 450), (110, 380)], 1.5, 8), DT)
    s.poly(s.rag([(150, 300), (170, 385), (200, 455), (236, 520), (170, 520), (152, 450), (150, 380)], 1.5, 8), BC)
    s.poly(s.rag([(122, 400), (136, 410), (140, 520), (112, 520)], 1.5, 8), BC)
    s.poly(s.rag([(112, 470), (120, 440), (130, 470), (134, 520), (110, 520)], 1.2, 8), BCP)
    # bark: long vertical dashes, a few close-tone patches, flecks, a little moss
    s.dashes(body, 90, BC, (14, 46), 90, 6, 2.2)
    s.dashes(body, 70, JD, (10, 34), 90, 7, 1.8)
    s.dashes(body, 30, MT, (6, 18), 90, 8, 1.6)
    s.patches(body, 14, DTJ, (10, 22), (8, 26), math.pi / 2)
    s.patches(body, 8, BC, (6, 14), (8, 20), math.pi / 2)
    s.flecks(body, 150, MT, 1.3)
    s.flecks(body, 90, BC, 1.5)
    for y in (140, 215, 330):
        s.line(s.rag([(78 + s.r.uniform(-3, 3), y), (128, y + 7), (186, y - 2)], 2, 8, False), BC, 1.8, 0.7)
    s.patches(body, 6, MT, (6, 12), (3, 6), 0.1)
    s.close_clip()
    # the liana hanging down the column and curling at the foot
    lian = s.smooth([(150, -6), (140, 50), (160, 110), (132, 170), (150, 240), (122, 300), (138, 360), (116, 408)], 8)
    s.line(lian, BC, 9)
    s.line(lian, DT, 5.5)
    s.line([(x - 1.2, y) for x, y in lian], JD, 1.8)
    for i, (x, y) in enumerate(lian[::7]):
        d = 1 if i % 2 else -1
        s.leaf(x, y, 24 + s.r.uniform(0, 8), 12, 90 + d * 55 + s.r.uniform(-12, 12), JD, MT, DT)
    s.save()


def log_pieces(s, y0, y1, hollow):
    """A log lying east-west seen from above. Returns the body polygon."""
    top = [(x, y0 + 7 * math.sin(x / 70.0) + s.r.uniform(-1.5, 1.5)) for x in range(40, 565, 25)]
    bot = [(x, y1 + 6 * math.sin(x / 90.0 + 1) + s.r.uniform(-1.5, 1.5)) for x in range(565, 35, -25)]
    ends_r = [(590 + s.r.uniform(-4, 4), (y0 + y1) / 2 + d) for d in (-(y1 - y0) * .32, 0, (y1 - y0) * .32)]
    ends_l = [(10 + s.r.uniform(-4, 4), (y0 + y1) / 2 + d) for d in ((y1 - y0) * .32, 0, -(y1 - y0) * .32)]
    return s.rag(top + ends_r + bot + ends_l, 2.0, 9)


def log(name, y0, y1, hollow, seed):
    s = Svg(name, 600, 200, seed)
    body = log_pieces(s, y0, y1, hollow)
    mid = (y0 + y1) / 2
    s.poly(body, DT)
    s.open_clip(body)
    # shaded flank below, lit ridge along the top, close tone bands between
    s.poly(s.rag([(-10, mid + 22), (610, mid + 26), (610, 210), (-10, 210)], 4, 12), BC)
    s.poly(s.rag([(-10, mid + 6), (610, mid + 10), (610, mid + 28), (-10, mid + 24)], 3, 12), BCP)
    s.poly(s.rag([(-10, mid - 8), (610, mid - 6), (610, mid + 10), (-10, mid + 6)], 3, 12), DTJ)
    s.poly(s.rag([(-10, y0 - 4), (610, y0 - 4), (610, y0 + (y1 - y0) * .3), (-10, y0 + (y1 - y0) * .28)], 3, 12), JD)
    if hollow:
        s.patches(body, 10, PPL, (14, 36), (8, 18), 0, 0.9)    # old, rotten patches showing the plum wood
    s.dashes(body, 180, BC, (10, 40), 0, 6, 2.2)
    s.dashes(body, 120, JD, (8, 30), 0, 6, 1.8)
    s.dashes(body, 50, MT, (5, 16), 0, 8, 1.5)
    s.patches(body, 12, BC, (5, 12), (3, 7))
    s.flecks(body, 160, MT, 1.2)
    s.flecks(body, 100, BC, 1.4)
    # moss: clumps of jade and mint along the top, a few over the middle
    for _ in range(16 if hollow else 11):
        x = s.r.uniform(30, 570)
        y = y0 + s.r.uniform(2, (y1 - y0) * .5)
        s.patches([(x - 30, y - 12), (x + 30, y - 12), (x + 30, y + 12), (x - 30, y + 12)], 1, JD if s.r.random() < .6 else JMT, (10, 26), (5, 11))
    s.flecks(body, 70, MS, 1.1)
    # the cut ends: a paler ring of wood hinted at each end
    for ex, sgn in ((22, 1), (578, -1)):
        if hollow:
            hole = s.rag(s.blob(ex + sgn * 6, mid, 20, (y1 - y0) * .33, 14, .08), 1.8, 6)
            rim = s.rag(s.blob(ex + sgn * 2, mid, 30, (y1 - y0) * .42, 14, .08), 1.8, 6)
            s.poly(rim, PL)
            s.poly(hole, BC)
            s.poly(s.rag(s.blob(ex + sgn * 12, mid + 2, 9, (y1 - y0) * .2, 10, .12), 1.2, 5), '#100A20')
            s.dashes(rim, 14, PLL, (4, 9), 90, 30, 1.6)
        else:
            ring = s.rag(s.blob(ex, mid, 16, (y1 - y0) * .42, 12, .08), 1.6, 6)
            s.poly(ring, PLL)
            s.poly(s.rag(s.blob(ex + sgn * 2, mid, 10, (y1 - y0) * .28, 12, .1), 1.4, 6), PL)
            s.dashes(ring, 8, BC, (3, 8), 90, 30, 1.4)
    s.close_clip()
    s.save()


def log_mouth():
    s = Svg('log_mouth', 256, 256, 41)
    outer = s.rag(s.blob(128, 128, 118, 116, 30, .05), 3.0, 8)
    s.poly(outer, DT)
    s.open_clip(outer)
    # bark ring: lit upper left, shaded lower right, close tones
    s.poly(s.rag(s.blob(128, 128, 124, 122, 24, .0), 1, 8), BC)
    s.poly(s.rag(s.blob(120, 120, 116, 114, 28, .04), 3, 8), DT)
    s.poly(s.rag(s.blob(112, 108, 104, 100, 26, .04), 2.5, 8), DTJ)
    s.dashes(outer, 120, BC, (8, 26), 0, 180, 2.4)     # bark ridges, any direction round the ring
    s.dashes(outer, 70, JD, (6, 20), 0, 180, 2)
    s.flecks(outer, 110, MT, 1.3)
    s.patches(outer, 12, JD, (8, 18), (5, 11))
    # rotten wood rim just inside the bark
    rim = s.rag(s.blob(128, 130, 88, 86, 24, .05), 2.4, 8)
    s.poly(rim, PLL)
    s.poly(s.rag(s.blob(130, 134, 82, 80, 24, .05), 2.2, 8), PPL)
    s.dashes(rim, 60, PL, (5, 12), 0, 180, 1.8)
    s.flecks(rim, 50, MT, 1.1)
    # the dark mouth
    hole = s.rag(s.blob(132, 138, 66, 64, 22, .07), 2.4, 8)
    s.poly(hole, BCP)
    s.poly(s.rag(s.blob(136, 144, 52, 50, 20, .08), 2.2, 7), BC)
    s.poly(s.rag(s.blob(140, 148, 32, 30, 16, .1), 1.8, 7), '#0E0818')
    s.flecks(hole, 26, PL, 1.3)
    s.dashes(hole, 12, PLL, (4, 10), 0, 180, 1.5)
    # moss over the top of the rim
    for _ in range(9):
        a = s.r.uniform(math.pi * 1.0, math.pi * 1.9)
        x, y = 128 + math.cos(a) * 100, 128 + math.sin(a) * 100
        s.patches([(x - 22, y - 12), (x + 22, y - 12), (x + 22, y + 12), (x - 22, y + 12)], 2, JD if s.r.random() < .6 else JMT, (9, 20), (5, 10))
    s.flecks(outer, 30, MS, 1.0)
    s.close_clip()
    s.save()


def hairy_leg(s, pts, w):
    """A leg along a smoothed path: blackcurrant outline, plum body, hairs and pink flecks."""
    path = s.smooth(pts, 8)
    s.line(path, BC, w + 5)
    s.line(path, PL, w)
    s.line([(x + 1.5, y + 1.5) for x, y in path], BCP, w * .45)
    segs, pink, pale = [], [], []
    for i, (x, y) in enumerate(path[:-1]):
        x2, y2 = path[i + 1]
        a = math.atan2(y2 - y, x2 - x)
        for sgn in (1, -1):
            for _ in range(3):
                b = a + sgn * s.r.uniform(.9, 1.9)
                L = s.r.uniform(7, 16)
                bx, by = x + s.r.uniform(-1, 1) * w * .3, y + s.r.uniform(-1, 1) * w * .3
                segs.append(((bx, by), (bx + math.cos(b) * L, by + math.sin(b) * L)))
        if i % 4 == 2:
            pink.append((x + s.r.uniform(-2, 2), y + s.r.uniform(-2, 2)))
        if i % 3 == 0:
            pale.append((x + s.r.uniform(-w * .3, w * .3), y + s.r.uniform(-w * .3, w * .3)))
    s.strokes(segs, BC, 1.6)
    s.strokes(segs[::3], PLL, 1.2)
    s.specks(pale, PLL, 1.6)
    s.specks(pink, HP, 3)
    s.specks(pink[::2], DP, 3.4)


def spider_legs():
    s = Svg('spider_legs', 256, 256, 23)
    legs = [
        [(14, 262), (22, 170), (30, 96), (62, 54), (104, 66), (118, 112)],
        [(84, 262), (84, 186), (92, 118), (126, 62), (168, 72), (178, 122)],
        [(150, 262), (150, 190), (158, 128), (190, 84), (228, 92), (236, 132)],
        [(214, 262), (214, 214), (222, 160), (240, 138), (252, 150), (254, 178)],
    ]
    for lg in legs:
        hairy_leg(s, lg, 22)
    s.save()


def coati_tail():
    s = Svg('coati_tail', 128, 256, 5)
    ctr = s.smooth([(64, 264), (60, 190), (70, 120), (62, 50), (66, 14)], 10)
    n = len(ctr)
    left, right = [], []
    for i, (x, y) in enumerate(ctr):
        t = i / (n - 1)
        hw = 24 - 12 * t + s.r.uniform(-1.2, 1.2)
        if i == n - 1:
            hw = 6
        left.append((x - hw, y))
        right.append((x + hw, y))
    tip = [(ctr[-1][0] - 5, ctr[-1][1] - 5), (ctr[-1][0], ctr[-1][1] - 10), (ctr[-1][0] + 5, ctr[-1][1] - 5)]
    body = s.rag(left + tip + right[::-1], 1.8, 6)
    s.poly(body, BC)
    s.open_clip(body)
    # pale rings: slanted ragged bands
    for yy in (216, 176, 136, 98, 62, 32):
        t = 1 - (yy / 256)
        hw = 30 - 12 * t
        cx = min(ctr, key=lambda p: abs(p[1] - yy))[0]
        band = [(cx - hw - 3, yy + 3), (cx + hw + 3, yy - 3), (cx + hw + 3, yy + 9), (cx - hw - 3, yy + 14)]
        s.poly(s.rag(band, 1.6, 6), MS)
        s.poly(s.rag([(cx - hw - 3, yy + 8), (cx + hw + 3, yy + 2), (cx + hw + 3, yy + 9), (cx - hw - 3, yy + 14)], 1.2, 6), MT)
    s.dashes(body, 60, PL, (6, 16), 90, 14, 1.8)       # dark fur
    s.dashes(body, 30, PLL, (4, 9), 90, 20, 1.4)
    s.flecks(body, 40, BCP, 1.6)
    s.close_clip()
    # fur sticking out of the edges
    segs = []
    for i in range(0, n, 2):
        x, y = ctr[i]
        hw = 24 - 12 * (i / (n - 1))
        for sgn in (1, -1):
            segs.append(((x + sgn * (hw - 2), y), (x + sgn * (hw + s.r.uniform(2, 5)), y - s.r.uniform(0, 5))))
    s.strokes(segs, BC, 1.8)
    s.save()


def far(name, seed, spacing, lianas, wide):
    s = Svg(name, 1024, 400, seed)
    r = s.r
    # three ranks, back to front: paler and thinner at the back, deep teal in front
    ranks = [(MT, '#6FC8A6', 0.55, 26, 16, 40), (JMT, JD, 0.0, 34, 20, 0), (DTJ, DT, 0.0, 46, 28, -20)]
    for rank, (c1, c2, mist, w0, wv, top) in enumerate(ranks):
        x = r.uniform(-20, 40)
        while x < 1060:
            w = w0 + r.uniform(-wv * .4, wv) * (1.6 if wide and rank == 2 and r.random() < .25 else 1)
            t0 = top + r.uniform(-30, 20)
            lean = r.uniform(-5, 5)
            flare = w * r.uniform(.3, .6)
            pts = [(x - w / 2 + lean, t0), (x - w / 2 + lean * .5, 240), (x - w / 2 - flare * .4, 360), (x - w / 2 - flare, 401),
                   (x + w / 2 + flare, 401), (x + w / 2 + flare * .4, 360), (x + w / 2 + lean * .5, 240), (x + w / 2 + lean, t0)]
            body = s.rag(pts, 1.8, 10)
            s.poly(body, c1)
            s.open_clip(body)
            s.poly(s.rag([(x + w * .05, t0 - 5), (x + w / 2 + 40, t0 - 5), (x + w / 2 + 40, 410), (x + w * .1, 410)], 2, 10), c2)
            s.dashes(body, int(w * .7), BC if rank == 2 else DT, (10, 36), 90, 6, 1.8, 0.75 if rank < 2 else None)
            s.dashes(body, int(w * .5), MT if rank == 2 else MS, (6, 20), 90, 8, 1.5, 0.8 if rank < 2 else None)
            s.flecks(body, int(w * 1.2), MT if rank else MS, 1.2)
            s.patches(body, 3, JD if rank == 2 else DTJ, (5, 9), (8, 20), math.pi / 2)
            # mist: pale bands over the trunk foot (a tone between the trunk and mist)
            s.patches([(x - w, 250), (x + w, 250), (x + w, 400), (x - w, 400)], 5, MS, (14, 34), (4, 9), 0, 0.30 - rank * .06)
            s.poly(s.rag([(x - 60, 380), (x + 60, 376), (x + 60, 420), (x - 60, 420)], 4, 12), MS, 0.2 - rank * .05)
            s.close_clip()
            x += spacing * r.uniform(.6, 1.5) * (1 - rank * .12)
    # lianas hanging from the canopy
    for _ in range(lianas):
        x = r.uniform(40, 980)
        L = r.uniform(60, 200)
        pts = [(x + math.sin(i * 1.1) * 5, 40 + i * L / 6) for i in range(7)]
        pts = s.smooth(pts, 5)
        s.line(pts, BC, 3.6)
        s.line(pts, DT, 2)
        for i, (px, py) in enumerate(pts[::6]):
            s.leaf(px, py, 14, 7, 90 + (1 if i % 2 else -1) * 50, JD, MT)
    # canopy: hanging leaves along the top, several layers (deepest at the back)
    layer_cols = [(DT, JD, MT), (BC, DT, JD), (BC, DT, DTJ)]
    for li, (cdark, cmid, clit) in enumerate(layer_cols):
        x = -10
        while x < 1040:
            L = r.uniform(70, 140) * (1 - li * .15)
            if li == 0:
                L *= 1.2
            ang = 90 + r.uniform(-28, 28)
            y0 = r.uniform(-12, 14) + li * 4
            lw = r.uniform(38, 60)
            col = r.choice([cdark, cdark, cmid])
            s.leaf(x, y0, L, lw, ang, col, clit if col != cdark else cmid, shade=BC if col == cmid else None, vein=clit if col == cmid else None)
            x += r.uniform(18, 40)
    # a deep band along the very top so the leaves hang from something
    band = [(-10, -10), (1034, -10), (1034, 30)]
    xx = 1034
    while xx > -10:
        xx -= r.uniform(14, 30)
        band.append((xx, r.uniform(14, 44)))
    band.append((-10, 30))
    s.poly(band, BC)
    s.flecks(band, 120, DT, 1.5)
    s.dashes(band, 60, JD, (5, 12), 80, 30, 1.4)
    s.save()


def up_heliconia():
    s = Svg('up_heliconia', 256, 512, 67)
    # big paddle leaves at the foot
    for x, y, L, W, a in ((124, 512, 300, 62, -112), (132, 512, 280, 58, -66), (122, 512, 210, 54, -140), (136, 512, 220, 52, -42), (128, 512, 330, 50, -90)):
        s.leaf(x, y, L, W, a, DT if a % 2 else DTJ, JMT, BC if a % 2 else DT, MT)
    # the stalk arching up and over to the right, then hanging
    stalk = s.smooth([(128, 518), (126, 400), (126, 290), (134, 190), (160, 118), (200, 96), (222, 130), (214, 190)], 8)
    s.line(stalk, BC, 9)
    s.line(stalk, DT, 5.5)
    s.line([(x - 1.3, y) for x, y in stalk], JD, 1.5)
    # bracts: boat-shaped pink, alternate sides, hanging down the arch
    along = stalk[-40::3]
    for i, (x, y) in enumerate(along):
        d = 1 if i % 2 else -1
        ang = 100 + d * 52 + s.r.uniform(-10, 10)
        s.leaf(x, y, 78 - i * 1.6, 32, ang, HP, DP, DP)
        s.leaf(x + d * 2, y + 2, 30, 10, ang, MS, None, None)
    # darker small flower bits and a few leaf-like tips in jade
    s.flecks([(150, 100), (240, 100), (240, 240), (150, 240)], 40, MS, 1.2)
    s.save()


def heliconia():
    s = Svg('heliconia', 200, 200, 71)
    for a in range(0, 360, 60):
        s.leaf(100, 100, 92, 46, a + 12, DTJ if (a // 60) % 2 else DT, JMT, BC if (a // 60) % 2 else DT, MT)
    for a in range(0, 360, 45):
        s.leaf(100, 100, 46 + s.r.choice([0, 6, 10]), 18, a + 20, HP, DP, DP)
    s.poly(s.rag(s.blob(100, 100, 10, 10, 9, .2), 1, 4), BC)
    s.flecks(s.blob(100, 100, 20, 20, 10, .1), 8, MS, 1.2)
    s.save()


def bromeliad():
    s = Svg('bromeliad', 200, 200, 83)
    for a in range(0, 360, 30):
        k = a // 30
        s.leaf(100, 100, 84 + s.r.choice([0, 6, -8]), 22, a + s.r.uniform(-8, 8), DT if k % 3 == 0 else JD, MT, BC if k % 2 else DT, JMT)
    for a in range(0, 360, 40):
        s.leaf(100, 100, 40, 16, a + 15, DP, HP, BC)
    s.poly(s.rag(s.blob(100, 100, 12, 12, 9, .2), 1, 4), BC)
    s.specks([(98, 96), (104, 103), (95, 104)], MS, 1.6)
    s.save()


def up_bromeliad():
    s = Svg('up_bromeliad', 256, 200, 89)
    # straps in a rosette fanning up and out, the foot at the bottom centre
    for i, a in enumerate(range(-172, -8, 14)):
        L = 150 - abs(a + 90) * .45 + s.r.uniform(-12, 8)
        col = DT if i % 3 == 0 else (JD if i % 3 == 1 else DTJ)
        s.leaf(128, 204, L, 26, a + s.r.uniform(-5, 5), col, MT if i % 2 else JMT, BC if col == DT else DT, JMT)
    # the flower spike with pink bracts in the heart
    s.line(s.smooth([(128, 200), (126, 150), (130, 112)], 6), DT, 5)
    for i, a in enumerate((-100, -70, -125, -55, -90)):
        s.leaf(128 + (i - 2) * 3, 150 - i * 4, 42 - i * 3, 17, a, HP if i % 2 == 0 else DP, DP, BC)
    s.save()


def fungi():
    s = Svg('fungi', 200, 200, 97)
    caps = [(92, 98, 46), (146, 70, 30), (58, 150, 30), (146, 144, 36), (50, 66, 24), (110, 160, 20), (160, 108, 18)]
    # a faint glow round the whole cluster: stepped rings of lime, not a gradient
    for gx, gy, gr in caps:
        s.poly(s.rag(s.blob(gx + 4, gy + 5, gr + 2, gr + 1, 18, .1), 1.5, 6), BC)        # shadow
    for gx, gy, gr in caps:
        cap = s.rag(s.blob(gx, gy, gr, gr * .94, 20, .06), 1.6, 6)
        s.poly(cap, LM)
        s.open_clip(cap)
        s.poly(s.rag(s.blob(gx + gr * .35, gy + gr * .35, gr * .9, gr * .9, 18, .05), 1.4, 6), MT)      # shaded lower right edge
        s.poly(s.rag(s.blob(gx - gr * .08, gy - gr * .08, gr * .84, gr * .8, 18, .06), 1.4, 6), LM)
        s.poly(s.rag(s.blob(gx - gr * .22, gy - gr * .22, gr * .45, gr * .4, 12, .12), 1.2, 5), MS)  # lit highlight
        s.dashes(cap, int(gr * .8), JD, (3, 8), math.degrees(math.atan2(gy - 100, gx - 100)), 25, 1.3)   # gills hint
        s.flecks(cap, int(gr * .6), MS, 1.3)
        s.flecks(cap, int(gr * .3), JD, 1.3)
        s.close_clip()
        s.poly(s.rag(s.blob(gx, gy, gr * .1, gr * .1, 8, .2), .5, 4), JD)
    s.save()


def puddle():
    s = Svg('puddle', 256, 256, 101)
    body = s.rag(s.blob(128, 130, 112, 74, 28, .1, -.12), 3, 9)
    s.poly(body, DT)
    s.open_clip(body)
    s.poly(s.rag(s.blob(122, 124, 100, 62, 26, .08, -.12), 2.5, 9), JD)
    s.poly(s.rag(s.blob(112, 116, 66, 36, 20, .1, -.12), 2.2, 8), DTJ)
    s.dashes(body, 50, MT, (10, 32), 0, 8, 2.2)
    s.dashes(body, 26, MS, (6, 18), 0, 8, 1.8)
    s.dashes(body, 30, DT, (8, 24), 0, 10, 2)
    s.flecks(body, 60, MT, 1.2)
    for cx, cy, rx in ((88, 120, 22), (160, 142, 18), (140, 106, 12)):    # ripple rings
        ring = s.blob(cx, cy, rx, rx * .45, 14, .06)
        s.line(s.rag(ring, .8, 6) + [s.rag(ring, .8, 6)[0]], MS, 1.8, 0.9)
        ring = s.blob(cx, cy, rx * .5, rx * .22, 10, .06)
        s.line(s.rag(ring, .6, 5) + [s.rag(ring, .6, 5)[0]], MS, 1.5, 0.9)
    s.close_clip()
    s.save()


if __name__ == '__main__':
    up_trunk()
    log('log', 52, 148, False, 31)
    log('hollow_log', 24, 176, True, 37)
    log_mouth()
    spider_legs()
    coati_tail()
    far('up_far_1', 301, 230, 5, False)
    far('up_far_2', 302, 190, 8, True)
    far('up_far_3', 303, 280, 3, False)
    up_heliconia()
    heliconia()
    bromeliad()
    up_bromeliad()
    fungi()
    puddle()
