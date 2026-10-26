#!/usr/bin/env python3
"""BrawlAPI(https://brawlapi.com)에서 브롤러·맵 데이터를 받아 js/data.js 를 생성합니다.

이름·설명은 게임 원본 한국어 번역 파일(localization/kr)에서 가져오므로
게임 안에서 쓰는 공식 한국어 표기 그대로 나옵니다.

사용법: python3 scripts/update_data.py
새 브롤러가 나오면 이 스크립트를 다시 실행하면 됩니다.
"""
import concurrent.futures
import json
import pathlib
import re
import urllib.request

API = "https://api.brawlapi.com"
CDN = "https://cdn.brawlify.com"
OUT = pathlib.Path(__file__).resolve().parent.parent / "js" / "data.js"

# 맵 퀴즈에 쓰는 대표 모드 (API 모드 이름 -> 퀴즈 모드 키)
MAP_MODES = {
    "Gem Grab": "gemGrab",
    "Brawl Ball": "brawlBall",
    "Heist": "heist",
    "Bounty": "bounty",
    "Hot Zone": "hotZone",
    "Knockout": "knockout",
    "Solo Showdown": "showdown",
    "Duo Showdown": "showdown",
    "Trio Showdown": "showdown",
    "Wipeout": "wipeout",
}


RARITY_TID = {
    "Common": "COMMON", "Rare": "RARE", "Super Rare": "SUPER_RARE", "Epic": "EPIC",
    "Mythic": "MYTHIC", "Legendary": "LEGENDARY", "Ultra Legendary": "ULTRA_LEGENDARY",
}
# 이름 뒤에 올 수 있는 조사·문장부호 (설명에서 브롤러 이름을 가릴 때 사용)
PARTICLE = r"(?=(?:은|는|이|가|을|를|의|와|과|에게|에|도|만|처럼|보다|랑|이랑|이라|라는|\s|[,.!?…'\"]|$))"


def get(path):
    req = urllib.request.Request(f"{API}/{path}", headers={"User-Agent": "brawlsquiz"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.load(res)


def fetch(path):
    return get(f"v1/{path}")["list"]


def by_id(path):
    return {row["id"]: row for row in get(f"game/{path}").values()}


def mask_name(text, name):
    """설명 퀴즈용: 설명 속 브롤러 이름을 ○○○ 로 가립니다."""
    parts = [name] + [p.strip() for p in re.split(r"[&]", name) if p.strip() and p.strip() != name]
    for part in sorted(parts, key=len, reverse=True):
        text = re.sub(r"(?<![가-힣])" + re.escape(part) + PARTICLE, "○○○", text)
    return text


def image_ok(url):
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "brawlsquiz"})
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status == 200
    except Exception:
        return False


def check_images(urls):
    """CDN에 실제로 존재하는 이미지 URL 집합을 돌려줍니다."""
    urls = sorted({u for u in urls if u})
    with concurrent.futures.ThreadPoolExecutor(32) as pool:
        return {u for u, ok in zip(urls, pool.map(image_ok, urls)) if ok}


def main():
    kr = {k: v["KR"] for k, v in get("game/localization/kr").items() if v.get("KR")}
    characters = by_id("csv_logic/characters")
    cards = by_id("csv_logic/cards")
    locations = by_id("csv_logic/locations")

    def ko(tid, fallback):
        return kr.get(tid, fallback) if tid else fallback

    def accessory(items):
        return [
            {"name": ko(cards.get(i["id"], {}).get("TID"), i["name"]), "img": i["imageUrl"]}
            for i in items if i.get("released", True)
        ]

    rarities = {}
    classes = {}
    brawlers = []
    for b in fetch("brawlers"):
        if not b.get("released"):
            continue
        tid = characters.get(b["id"], {}).get("TID")
        name = ko(tid, b["name"])
        desc = ko(tid and tid + "_DESC", "").replace("\\n", " ").replace("\n", " ")
        rarity = b["rarity"]["name"]
        rarities[rarity] = {
            "name": ko(f"TID_VAULT_BRAWLERS_{RARITY_TID.get(rarity, '')}", rarity),
            "color": b["rarity"]["color"],
            "order": b["rarity"]["id"],
        }
        cls = b["class"]["name"]
        classes[cls] = ko("TID_CLASS_ARCHETYPE_" + cls.upper().replace(" ", "_"), cls)
        brawlers.append({
            "id": b["id"],
            "name": name,
            "img": b["imageUrl2"],        # 정사각형 초상화
            "icon": b["imageUrl"],        # 테두리 있는 아이콘
            "model": f"{CDN}/brawlers/model/{b['id']}.png",       # 배경 투명 3D 모델
            "art": f"{CDN}/brawlers/portraits/{b['id']}.png",     # 배경 투명 일러스트
            "rarity": rarity,
            "class": cls,
            "desc": re.sub(r"\s+", " ", mask_name(desc, name)).strip(),
            "gadgets": accessory(b["gadgets"]),
            "starPowers": accessory(b["starPowers"]),
        })
    brawlers.sort(key=lambda b: b["id"])

    maps = []
    for m in fetch("maps"):
        mode = MAP_MODES.get(m["gameMode"]["name"])
        if mode:
            name = ko(locations.get(int(m["id"]), {}).get("TID"), m["name"])
            maps.append({"name": name, "img": m["imageUrl"], "mode": mode})

    modes = {}
    for g in fetch("gamemodes"):
        key = MAP_MODES.get(g["name"])
        if key and key not in modes:
            name = ko(g.get("TID"), g["name"]).replace("솔로 ", "")
            modes[key] = {"name": name, "img": g["imageUrl"], "color": g["color"]}

    # 이미지가 없는(404) 항목은 퀴즈에서 제외
    urls = [m["img"] for m in maps] + [m["img"] for m in modes.values()]
    for b in brawlers:
        urls += [b["img"], b["icon"], b["model"], b["art"]] + [i["img"] for i in b["gadgets"] + b["starPowers"]]
    ok = check_images(urls)
    for b in brawlers:
        if b["icon"] not in ok:
            b["icon"] = b["img"]
        for key in ("model", "art"):
            if b[key] not in ok:
                b[key] = None
        b["gadgets"] = [i for i in b["gadgets"] if i["img"] in ok]
        b["starPowers"] = [i for i in b["starPowers"] if i["img"] in ok]
    brawlers = [b for b in brawlers if b["img"] in ok]
    maps = [m for m in maps if m["img"] in ok]

    rarities = dict(sorted(rarities.items(), key=lambda r: r[1]["order"]))
    for r in rarities.values():
        del r["order"]
    data = {"brawlers": brawlers, "maps": maps, "modes": modes, "rarities": rarities, "classes": classes}
    OUT.write_text(
        "// 자동 생성 파일 - scripts/update_data.py 로 갱신하세요.\n"
        "window.BRAWL_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"brawlers={len(brawlers)} maps={len(maps)} modes={len(modes)} -> {OUT}")


if __name__ == "__main__":
    main()
