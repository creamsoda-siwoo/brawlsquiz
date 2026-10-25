#!/usr/bin/env python3
"""BrawlAPI(https://brawlapi.com)에서 브롤러·맵 데이터를 받아 js/data.js 를 생성합니다.

사용법: python3 scripts/update_data.py
새 브롤러가 나오면 이 스크립트를 다시 실행하면 됩니다.
"""
import concurrent.futures
import json
import pathlib
import urllib.request

API = "https://api.brawlapi.com/v1"
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


def fetch(path):
    req = urllib.request.Request(f"{API}/{path}", headers={"User-Agent": "brawlsquiz"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)["list"]


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


def accessory(items):
    return [{"name": i["name"], "img": i["imageUrl"]} for i in items if i.get("released", True)]


def main():
    brawlers = []
    for b in fetch("brawlers"):
        if not b.get("released"):
            continue
        brawlers.append({
            "id": b["id"],
            "name": b["name"],
            "img": b["imageUrl2"],        # 정사각형 초상화
            "icon": b["imageUrl"],        # 테두리 있는 아이콘
            "model": f"{CDN}/brawlers/model/{b['id']}.png",       # 배경 투명 3D 모델
            "art": f"{CDN}/brawlers/portraits/{b['id']}.png",     # 배경 투명 일러스트
            "rarity": b["rarity"]["name"],
            "rarityColor": b["rarity"]["color"],
            "class": b["class"]["name"],
            "gadgets": accessory(b["gadgets"]),
            "starPowers": accessory(b["starPowers"]),
        })
    brawlers.sort(key=lambda b: b["id"])

    maps = []
    for m in fetch("maps"):
        mode = MAP_MODES.get(m["gameMode"]["name"])
        if mode:
            maps.append({"name": m["name"], "img": m["imageUrl"], "mode": mode})

    modes = {}
    for g in fetch("gamemodes"):
        key = MAP_MODES.get(g["name"])
        if key and key not in modes:
            modes[key] = {"img": g["imageUrl"], "color": g["color"]}

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

    data = {"brawlers": brawlers, "maps": maps, "modes": modes}
    OUT.write_text(
        "// 자동 생성 파일 - scripts/update_data.py 로 갱신하세요.\n"
        "window.BRAWL_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"brawlers={len(brawlers)} maps={len(maps)} modes={len(modes)} -> {OUT}")


if __name__ == "__main__":
    main()
