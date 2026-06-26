#!/usr/bin/env python3
# Generates the Pause Interior mindmap as SVG, PNG and PDF.
import cairosvg

W, H = 1720, 1200
CX, CY = 860, 600

LINEN="#F6F2EC"; OFF="#FBF9F5"; INK="#2B2A28"; CLAY="#B8A68F"; STONE="#52584E"; MUTED="#6b675f"

# branch: (title, [subitems], color, side)  side: 'r' or 'l'
branches = [
    ("Brand & Story", ["Her true founder story", "One idea: the pause", "Calm voice and look", "Photography comes first"], "#52584E", "r"),
    ("Product & Collection", ["Curate, not sprawl", "A few hero pieces", "Easy entry products", "Honest natural materials"], "#7d6f5a", "r"),
    ("Website & Shop", ["Calm, fast, mobile", "Effortless checkout", "Journal for SEO", "Visible trust signals"], "#6b7268", "r"),
    ("Marketing Engine", ["Email first (Klaviyo)", "Pinterest and Instagram", "Content that compounds", "Ads only when they pay"], "#8f7d5a", "r"),
    ("Customers & Community", ["Own the audience", "Reviews and real photos", "Slow letters, now and then", "A real human answers"], "#5f6b63", "l"),
    ("Operations & Care", ["Traceable materials", "Made to last", "A considered unboxing", "Smooth delivery"], "#9a8c72", "l"),
    ("Finance & Growth", ["Know your numbers", "Value above cost to acquire", "Protect the margin", "Five metrics each week"], "#737a6e", "l"),
    ("Next Level: Scale", ["Styling service", "Trade and B2B", "A Pause Circle membership", "New markets and stockists"], "#8a6f4f", "l"),
]

def esc(s): return s.replace("&","&amp;")

CARD_W, CARD_H, GAP = 520, 184, 44
def col_positions():
    rights=[b for b in branches if b[3]=="r"]; lefts=[b for b in branches if b[3]=="l"]
    def ys(n):
        total=n*CARD_H+(n-1)*GAP; top=CY-total/2
        return [top+i*(CARD_H+GAP)+CARD_H/2 for i in range(n)]
    return rights, lefts, ys(len(rights)), ys(len(lefts))

def card(x,y,title,items,color):
    s=f'<g><rect x="{x}" y="{y}" rx="16" ry="16" width="{CARD_W}" height="{CARD_H}" fill="{OFF}" stroke="{color}" stroke-width="2"/>'
    s+=f'<rect x="{x}" y="{y}" rx="16" ry="16" width="10" height="{CARD_H}" fill="{color}"/>'
    s+=f'<text x="{x+34}" y="{y+44}" font-family="Georgia, serif" font-size="27" font-weight="600" fill="{color}">{esc(title)}</text>'
    yy=y+82
    for it in items:
        s+=f'<circle cx="{x+40}" cy="{yy-5}" r="3.5" fill="{CLAY}"/>'
        s+=f'<text x="{x+54}" y="{yy}" font-family="Helvetica, Arial, sans-serif" font-size="17" fill="{INK}">{esc(it)}</text>'
        yy+=27
    s+="</g>"; return s

def connector(x0,y0,x1,y1,color):
    dx=90 if x1>x0 else -90
    return (f'<path d="M {x0} {y0} C {x0+dx} {y0}, {x1-dx} {y1}, {x1} {y1}" '
            f'fill="none" stroke="{color}" stroke-width="2.5" opacity="0.7"/>')

rights,lefts,ry,ly = col_positions()

svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">']
svg.append(f'<rect width="{W}" height="{H}" fill="{LINEN}"/>')
# header
svg.append(f'<text x="{W/2}" y="58" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="{INK}">Building Pause Interior, and lifting it to the next level</text>')
svg.append(f'<text x="{W/2}" y="86" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="15" letter-spacing="3" fill="{STONE}">A MINDMAP OF THE WHOLE PICTURE</text>')

# connectors first (behind cards)
R_X=CX+170; L_X=CX-170
for b,y in zip(rights,ry):
    svg.append(connector(R_X, CY, W-40-CARD_W, y, b[2]))
for b,y in zip(lefts,ly):
    svg.append(connector(L_X, CY, 40+CARD_W, y, b[2]))

# center node
svg.append(f'<rect x="{CX-170}" y="{CY-66}" rx="20" ry="20" width="340" height="132" fill="{STONE}"/>')
svg.append(f'<rect x="{CX-150}" y="{CY-30}" width="40" height="6" rx="3" fill="{OFF}"/>')
svg.append(f'<rect x="{CX-150}" y="{CY-30}" width="14" height="6" rx="3" fill="{OFF}"/>')
svg.append(f'<text x="{CX}" y="{CY-2}" text-anchor="middle" font-family="Georgia, serif" font-size="32" letter-spacing="3" fill="{OFF}">PAUSE INTERIOR</text>')
svg.append(f'<text x="{CX}" y="{CY+34}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="19" fill="#d8d2c6">to the next level</text>')

# cards
for b,y in zip(rights,ry):
    svg.append(card(W-40-CARD_W, y-CARD_H/2, b[0], b[1], b[2]))
for b,y in zip(lefts,ly):
    svg.append(card(40, y-CARD_H/2, b[0], b[1], b[2]))

# footer
svg.append(f'<text x="{W/2}" y="{H-26}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="{MUTED}">Pause Interior, fewer better things, made to last. Designed in Sweden.</text>')
svg.append("</svg>")
svg="\n".join(svg)

open("Pause-Interior-Mindmap.svg","w",encoding="utf-8").write(svg)
cairosvg.svg2png(bytestring=svg.encode(), write_to="Pause-Interior-Mindmap.png", scale=2)
cairosvg.svg2pdf(bytestring=svg.encode(), write_to="Pause-Interior-Mindmap.pdf")
print("mindmap written: svg, png, pdf")
