#!/usr/bin/env python3
"""Generate warm, soft, on-brand mood images as temporary placeholders
until the founder's real photography is added. Calm Scandinavian tone:
a wall, a soft light, a simple object silhouette, gentle shadow."""
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import os

def lerp(a,b,t): return tuple(int(a[i]+(b[i]-a[i])*t) for i in range(3))

def vgrad(w,h,top,bot):
    img=Image.new("RGB",(w,h)); px=img.load()
    for y in range(h):
        c=lerp(top,bot,(y/max(1,h-1))**1.1)
        for x in range(w): px[x,y]=c
    return img

def add_light(img,cx,cy,rad,strength=0.16):
    w,h=img.size
    l=Image.new("L",(w,h),0); d=ImageDraw.Draw(l)
    d.ellipse([cx-rad,cy-rad*1.2,cx+rad,cy+rad*1.2],fill=int(255*strength))
    l=l.filter(ImageFilter.GaussianBlur(rad*0.6))
    glow=Image.new("RGB",(w,h),(255,247,231))
    return Image.composite(glow,img,l)

def paste_soft(base,shape_rgba,blur):
    shape_rgba=shape_rgba.filter(ImageFilter.GaussianBlur(blur))
    base=base.convert("RGBA"); base.alpha_composite(shape_rgba)
    return base.convert("RGB")

def grain(img,sigma=6):
    w,h=img.size
    n=Image.effect_noise((w,h),sigma).convert("RGB")
    n=ImageChops.multiply(n,Image.new("RGB",(w,h),(35,35,35)))
    return ImageChops.add(img,n)

def vignette(img,strength=0.28):
    w,h=img.size
    mask=Image.new("L",(w,h),0); d=ImageDraw.Draw(mask)
    d.ellipse([-w*0.25,-h*0.25,w*1.25,h*1.25],fill=255)
    mask=mask.filter(ImageFilter.GaussianBlur(min(w,h)*0.22))
    dark=Image.new("RGB",(w,h),(28,26,23))
    return Image.composite(img,dark,mask.point(lambda v:int(255-(255-v)*strength)))

# palettes: (wall_top, wall_bottom, floor, object)
PAL={
 "hero":((222,211,190),(198,186,163),(150,138,116),(96,88,72)),
 "p1": ((228,218,199),(205,193,170),(158,146,123),(92,84,68)),
 "p2": ((216,208,190),(150,156,146),(120,124,114),(74,80,72)),
 "p3": ((231,222,204),(206,194,171),(150,138,115),(120,96,70)),
 "p4": ((235,228,214),(214,204,185),(176,164,140),(120,110,92)),
}

def compose(name,w,h,obj):
    top,bot,floor,ocol=PAL[name]
    hy=int(h*0.70)
    img=vgrad(w,hy,top,bot)                      # wall
    fl=vgrad(w,h-hy,lerp(floor,top,0.15),floor)  # floor
    canvas=Image.new("RGB",(w,h)); canvas.paste(img,(0,0)); canvas.paste(fl,(0,hy))
    canvas=add_light(canvas,int(w*0.66),int(h*0.24),int(w*0.42),0.18)
    # soft shadow on floor
    sh=Image.new("RGBA",(w,h),(0,0,0,0)); ds=ImageDraw.Draw(sh)
    ds.ellipse([w*0.30,hy-h*0.02,w*0.72,hy+h*0.10],fill=(30,26,20,90))
    canvas=paste_soft(canvas,sh,int(w*0.03))
    # object silhouette
    ov=Image.new("RGBA",(w,h),(0,0,0,0)); do=ImageDraw.Draw(ov)
    cxw=w*0.5
    if obj=="vase":
        do.rounded_rectangle([cxw-w*0.11,h*0.34,cxw+w*0.11,hy+h*0.005],
                             radius=int(w*0.10),fill=(*ocol,235))
        do.ellipse([cxw-w*0.12,h*0.32,cxw+w*0.12,h*0.40],fill=(*lerp(ocol,top,0.2),235))
    elif obj=="table":
        do.rounded_rectangle([cxw-w*0.20,h*0.50,cxw+w*0.20,h*0.545],radius=8,fill=(*ocol,235))
        do.rectangle([cxw-w*0.17,h*0.545,cxw-w*0.14,hy],fill=(*ocol,235))
        do.rectangle([cxw+w*0.14,h*0.545,cxw+w*0.17,hy],fill=(*ocol,235))
    else: # lamp
        do.ellipse([cxw-w*0.12,h*0.30,cxw+w*0.12,h*0.44],fill=(*ocol,235))
        do.rectangle([cxw-w*0.012,h*0.44,cxw+w*0.012,hy],fill=(*ocol,235))
    canvas=paste_soft(canvas,ov,int(w*0.012))
    canvas=canvas.filter(ImageFilter.GaussianBlur(1.4))
    canvas=grain(canvas); canvas=vignette(canvas)
    return canvas

here=os.path.dirname(__file__)
jobs={"hero":(1600,1000,"table"),"p1":(1100,1400,"vase"),"p2":(1100,1400,"lamp"),
      "p3":(1100,1400,"table"),"p4":(1100,1400,"vase")}
for name,(w,h,obj) in jobs.items():
    compose(name,w,h,obj).save(os.path.join(here,f"{name}.jpg"),quality=82,optimize=True)
    print("wrote",name)
print("done")
