#!/usr/bin/env python3
"""Generate a CarrerasOS event site from templates/carrerasos-app + an event.json.

Usage:
    python3 tools/make_carrerasos_event.py path/to/event.json

Reads the event.json (schema: see templates/carrerasos-app/event.json, which
holds the Rancho Malpica reference data), copies the template app into
events/<slug>/ and injects the event data into the compiled bundle.

After generating, overwrite events/<slug>/images/imgNN.jpg with the event's
own photos (same filenames — see _image_map in event.json) if you have them.
"""
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "templates" / "carrerasos-app"


def js(obj):
    """Serialize to a JS-literal-compatible string (JSON is valid JS)."""
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    cfg = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    slug = cfg["slug"]
    dest = ROOT / "events" / slug
    if dest.exists():
        print(f"note: {dest} exists, refreshing files in place")
    shutil.copytree(TEMPLATE, dest, dirs_exist_ok=True)
    (dest / "event.json").write_text(
        json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    bundle = (dest / "bundle.js").read_text(encoding="utf-8")

    # 1. Event data span: var R={org:...} ... xe=[...];xe.forEach
    races = []
    for r in cfg["races"]:
        r = dict(r)
        r.pop("_comment", None)
        races.append(r)
    data_js = (
        "var R=" + js(cfg["event"])
        + ",Nm=" + js(cfg["field"])
        + ",Um=[],bm=[],qm=[],Hm=[],Wm=[]"
        + ",xe=" + js(races)
        + ";xe.forEach"
    )
    bundle, n1 = re.subn(r"var R=\{org:.*?\];xe\.forEach", data_js.replace("\\", "\\\\"), bundle, count=1, flags=re.S)

    # 2. Countdown target: var Qf=new Date(Y,M-1,D,H,M,0).getTime()
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})", cfg["countdown"])
    y, mo, d, h, mi = (int(x) for x in m.groups())
    cd_js = f"var Qf=new Date({y},{mo-1},{d},{h},{mi},0).getTime()"
    bundle, n2 = re.subn(r"var Qf=new Date\([0-9, ]+\)\.getTime\(\)", cd_js, bundle, count=1)

    # 3. Ads: Kf={...},F="#FF7A1A"
    ads = {str(k): v for k, v in cfg.get("ads", {}).items()}
    ads_js = "Kf=" + js(ads) + ',F="#FF7A1A"'
    bundle, n3 = re.subn(r'Kf=\{.*?\}\},F="#FF7A1A"', ads_js.replace("\\", "\\\\"), bundle, count=1, flags=re.S)

    assert (n1, n2, n3) == (1, 1, 1), f"injection failed: data={n1} countdown={n2} ads={n3}"
    (dest / "bundle.js").write_text(bundle, encoding="utf-8")

    # 4. Page titles + descriptions
    for page in ("index.html", "site.html"):
        p = dest / page
        h = p.read_text(encoding="utf-8")
        h = re.sub(r"<title>.*?</title>", f"<title>{cfg['page_title']}</title>", h, count=1, flags=re.S)
        h = re.sub(r'(<meta name="description" content=").*?(" />)',
                   lambda mm: mm.group(1) + cfg["page_description"] + mm.group(2), h, count=1, flags=re.S)
        p.write_text(h, encoding="utf-8")

    # 5. Manifest
    mf_path = dest / "manifest.json"
    mf = json.loads(mf_path.read_text(encoding="utf-8"))
    mf["name"] = cfg["page_title"]
    mf["description"] = cfg["page_description"]
    mf_path.write_text(json.dumps(mf, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"OK: events/{slug}/ generated")
    print(f"live URL after push: https://guttix1.github.io/Digital-flyer-/events/{slug}/")
    print("remember: swap events/%s/images/imgNN.jpg for the event's own photos (same filenames)" % slug)


if __name__ == "__main__":
    main()
