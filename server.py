import os
import ssl
import sys
import json
import base64
import hashlib
import re
import urllib.request
import urllib.parse
from urllib.parse import urljoin
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import padding
import requests
import hmac
import secrets
import collections
from datetime import datetime

class LogCapture:
    def __init__(self, original_stream):
        self.original_stream = original_stream
        self.buffer = collections.deque(maxlen=300)

    def write(self, message):
        self.original_stream.write(message)
        if message.strip():
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            self.buffer.append(f"[{timestamp}] {message.strip()}")

    def flush(self):
        self.original_stream.flush()

    def isatty(self):
        return self.original_stream.isatty() if hasattr(self.original_stream, 'isatty') else False

    def __getattr__(self, name):
        return getattr(self.original_stream, name)

# Redirect stdout and stderr to capture logs
sys.stdout = LogCapture(sys.stdout)
sys.stderr = LogCapture(sys.stderr)

import time
START_TIME = time.time()
ACTIVE_SESSIONS = {}

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def load_unique_visitors():
    path = os.path.join(_BASE_DIR, "unique_visitors.json")
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            pass
    return set()

def save_unique_visitor(ip):
    if ip not in UNIQUE_VISITORS:
        UNIQUE_VISITORS.add(ip)
        path = os.path.join(_BASE_DIR, "unique_visitors.json")
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(list(UNIQUE_VISITORS), f)
        except Exception:
            pass

def load_banned_ips():
    path = os.path.join(_BASE_DIR, "banned_ips.json")
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            pass
    return set()

def save_banned_ips():
    path = os.path.join(_BASE_DIR, "banned_ips.json")
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(list(BANNED_IPS), f)
    except Exception:
        pass

BANNED_IPS = load_banned_ips()
UNIQUE_VISITORS = load_unique_visitors()


def load_or_generate_session_secret():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    secret_path = os.path.join(base_dir, ".session_secret")
    if os.path.exists(secret_path):
        try:
            with open(secret_path, "rb") as f:
                secret = f.read()
                if len(secret) == 32:
                    return secret
        except Exception:
            pass
    secret = secrets.token_bytes(32)
    try:
        with open(secret_path, "wb") as f:
            f.write(secret)
    except Exception:
        pass
    return secret

SESSION_SECRET = load_or_generate_session_secret()

def generate_signed_session():
    session_id = secrets.token_hex(16)
    sig = hmac.new(SESSION_SECRET, session_id.encode(), hashlib.sha256).hexdigest()
    return f"{session_id}.{sig}"

def verify_signed_session(cookie_value):
    try:
        session_id, sig = cookie_value.split(".", 1)
        expected_sig = hmac.new(SESSION_SECRET, session_id.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(sig, expected_sig)
    except Exception:
        return False

def generate_signed_admin_session():
    session_id = "admin_" + secrets.token_hex(16)
    sig = hmac.new(SESSION_SECRET, session_id.encode(), hashlib.sha256).hexdigest()
    return f"{session_id}.{sig}"

def verify_signed_admin_session(cookie_value):
    try:
        session_id, sig = cookie_value.split(".", 1)
        if not session_id.startswith("admin_"):
            return False
        expected_sig = hmac.new(SESSION_SECRET, session_id.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(sig, expected_sig)
    except Exception:
        return False


_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
})

PORT = int(os.environ.get("PORT", 8000))
AES_GCM_SECRET = "c4a8f1d7e2b9a6c3d0f5e8a1b7c4d9e2"
API_KEY_URL = "https://core.vidzee.wtf/api-key"

TMDB_ID_MAP = {
}

# Virtual season splitting for shows that consolidate multiple seasons into one flat season on TMDB
TV_SEASON_SPLIT_MAP = {
    "65942": {  # Re:ZERO -Starting Life in Another World-
        "seasons": [
            {"season_number": 1, "start_absolute": 1, "episode_count": 25, "name": "Season 1"},
            {"season_number": 2, "start_absolute": 26, "episode_count": 25, "name": "Season 2"},
            {"season_number": 3, "start_absolute": 51, "episode_count": 35, "name": "Season 3"}
        ]
    }
}



# ── Config Management ─────────────────────────────────────────────────────────
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(_BASE_DIR, "config.json")
DEFAULT_CONFIG = {
    "source_domain":   "https://multimovies.makeup",
    "animedekho_domain": "https://animedekho.app",
    "omdb_api_key":    "",
    "app_name":        "NEUROTIX",
    "app_tagline":     "Stream Everything. Fear Nothing.",
    "default_server":  "",
    "featured_count":  8,
    "cards_per_row":   20,
    "cache_ttl_seconds": 300,
    "sections": [
        {"id": "dt-movies",   "title": "🎬 Latest Movies",    "icon": "🎬"},
        {"id": "dt-tvshows",  "title": "📺 Web Series",       "icon": "📺"},
        {"id": "dt-seasons",  "title": "🗂️ Recent Seasons",   "icon": "🗂️"},
        {"id": "dt-episodes", "title": "▶️ New Episodes",      "icon": "▶️"},
        {"id": "popular",     "title": "🔥 Most Popular",     "icon": "🔥"}
    ]
}

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            for k, v in DEFAULT_CONFIG.items():
                cfg.setdefault(k, v)
            return cfg
        except Exception:
            pass
    return dict(DEFAULT_CONFIG)

def save_config(cfg):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)

CONFIG = load_config()
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", CONFIG.get("admin_username", "admin"))
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", CONFIG.get("admin_password", "admin"))

# ── Homepage Cache ─────────────────────────────────────────────────────────────
import time
_homepage_cache = {"data": None, "ts": 0}



# Bypass SSL certificate verification issues locally
ssl_ctx = ssl._create_unverified_context()

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

_HDRS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9"
}

def _get_tmdb_json(url, timeout=5):
    for attempt in range(3):
        try:
            r = _session.get(url, timeout=timeout, verify=False)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            print(f"[-] TMDB API request attempt {attempt+1} failed for {url}: {e}")
            if attempt < 2:
                time.sleep(0.3)
    return None


def _fetch(url, extra_headers=None, timeout=15):
    h = dict(_HDRS)
    if extra_headers:
        h.update(extra_headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, context=ssl_ctx, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="ignore")


# ── Homepage Scraper ───────────────────────────────────────────────────────────
def _extract_cards_from_block(block_html, domain):
    """Parse article cards from a section block."""
    cards = []
    articles = re.findall(r'<article[^>]*class="([^"]*)"[^>]*>(.*?)</article>', block_html, re.DOTALL)
    
    for art_class, art_body in articles:
        href_m  = re.search(r'href="([^"]+)"', art_body)
        img_m   = re.search(r'<img[^>]+(?:data-src|src)="([^"]+)"', art_body)
        title_m = re.search(r'class="title"[^>]*>(.*?)</\w+>', art_body, re.DOTALL)
        if not title_m:
            title_m = re.search(r'<h3[^>]*>(.*?)</h3>', art_body, re.DOTALL)
        rating_m  = re.search(r'<div class="rating">([^<]+)</div>', art_body)
        year_m    = re.search(r'<span>(\d{4})</span>', art_body)
        itype_m   = re.search(r'<span class="item_type">([^<]+)</span>', art_body)
        quality_m = re.search(r'class="[^"]*quality[^"]*"[^>]*>([^<]+)', art_body)

        if not href_m or not img_m:
            continue

        url    = href_m.group(1)
        poster = img_m.group(1)
        title  = re.sub(r'<[^>]+>', '', title_m.group(1)).strip() if title_m else ""
        rating = rating_m.group(1).strip() if rating_m else ""
        year   = year_m.group(1).strip() if year_m else ""
        quality = quality_m.group(1).strip() if quality_m else "HD"

        # Derive type from article class or URL
        ctype = "movie"
        art_low = art_class.lower()
        if "tvshows" in art_low or "/tvshows/" in url:
            ctype = "tv"
        elif "episode" in art_low or "/episodes/" in url:
            ctype = "episode"
        elif "season" in art_low or "/seasons/" in url:
            ctype = "season"
        elif "anime" in art_low or "/anime/" in url:
            ctype = "anime"

        item_type = itype_m.group(1).strip() if itype_m else ctype.capitalize()

        if title and url:
            cards.append({
                "title":     title,
                "url":       url,
                "poster":    poster,
                "rating":    rating,
                "year":      year,
                "quality":   quality,
                "type":      ctype,
                "item_type": item_type
            })
    return cards

def fetch_url(key, url):
    import time
    for attempt in range(3):
        try:
            r = _session.get(url, timeout=5)
            r.raise_for_status()
            return key, r.json()
        except Exception as e:
            print(f"[-] TMDB homepage fetch attempt {attempt+1} failed for {key}: {e}")
            if attempt < 2:
                time.sleep(0.2)
                continue
    return key, None

def _fetch_multi_pages_tmdb(base_url, pages_count=10, start_page=1):
    """Fetch multiple pages of TMDB content concurrently and merge their 'results'."""
    from concurrent.futures import ThreadPoolExecutor
    import urllib.parse
    import re
    
    results = []
    total_pages = 1
    
    page_numbers = list(range(start_page, start_page + pages_count))
    
    def fetch_single_page(p):
        if "page=" in base_url:
            url = re.sub(r'page=\d+', f'page={p}', base_url)
        else:
            sep = "&" if "?" in base_url else "?"
            url = f"{base_url}{sep}page={p}"
        
        cache_key = f"raw-page-{p}-{urllib.parse.quote(base_url, safe='')}"
        _, data = fetch_url(cache_key, url)
        return data

    with ThreadPoolExecutor(max_workers=min(10, pages_count)) as executor:
        pages_data = list(executor.map(fetch_single_page, page_numbers))
        
    for data in pages_data:
        if data:
            results.extend(data.get("results", []))
            if "total_pages" in data:
                total_pages = data["total_pages"]
                
    return results, total_pages

# Helper to map standard TMDB result listings to card models
def map_tmdb_items(items, default_type="movie"):
    cards = []
    for item in items:
        is_tv = default_type in ("tv", "anime")
        title = item.get("name") if is_tv else item.get("title")
        if not title:
            title = item.get("original_name") if is_tv else item.get("original_title")
        
        poster_path = item.get("poster_path")
        poster = f"https://image.tmdb.org/t/p/w342{poster_path}" if poster_path else ""

        backdrop_path = item.get("backdrop_path")
        backdrop = f"https://image.tmdb.org/t/p/w1280{backdrop_path}" if backdrop_path else poster

        year = (item.get("first_air_date") or "")[:4] if is_tv else (item.get("release_date") or "")[:4]

        tid = str(item.get("id"))
        if tid in TMDB_ID_MAP:
            tid = TMDB_ID_MAP[tid]

        cards.append({
            "title": title or "Untitled",
            "url": "",
            "tmdb_id": tid,
            "poster": poster,
            "backdrop": backdrop,
            "description": item.get("overview", ""),
            "rating": str(item.get("vote_average", ""))[:3] if item.get("vote_average") else "",
            "year": year,
            "quality": "HD",
            "type": default_type,
            "item_type": "Series" if is_tv else "Movie"
        })
    return cards

def scrape_homepage():
    """Fetch homepage categories directly from TMDB API, ensuring complete independence from scraping."""
    global _homepage_cache
    cfg = load_config()
    
    # Read cache if fresh
    now = time.time()
    ttl = cfg.get("cache_ttl_seconds", 300)
    if _homepage_cache.get("data") and (now - _homepage_cache.get("ts", 0) < ttl):
        print("[+] Homepage loaded from cache")
        return _homepage_cache["data"]

    api_key = cfg.get("tmdb_api_key", "").strip()
    if not api_key:
        api_key = "8265bd1679663a7ea12ac168da84d2e8"  # public read-only key

    result = {
        "featured": [],
        "sections": [],
        "app": {
            "name": cfg.get("app_name", "NEUROTIX"),
            "tagline": cfg.get("app_tagline", "Stream Everything. Fear Nothing.")
        }
    }

    # Fetch TMDB endpoints in parallel for maximum speed
    import datetime
    today_str = datetime.date.today().strftime("%Y-%m-%d")

    # Fetch Featured Slider (only needs 1 page)
    _, feat_val = fetch_url("featured", f"https://api.themoviedb.org/3/trending/all/day?api_key={api_key}")
    
    success = False
    feat_data = feat_val.get("results", []) if feat_val else []
    if feat_data:
        success = True
        for item in feat_data[:cfg.get("featured_count", 8)]:
            media_type = item.get("media_type", "movie")
            is_tv = media_type == "tv"
            
            backdrop = item.get("backdrop_path")
            poster_path = item.get("poster_path")
            image_url = ""
            if backdrop:
                image_url = f"https://image.tmdb.org/t/p/w1280{backdrop}"
            elif poster_path:
                image_url = f"https://image.tmdb.org/t/p/w1280{poster_path}"

            title = item.get("name") if is_tv else item.get("title")
            if not title:
                title = item.get("original_name") if is_tv else item.get("original_title")

            year = (item.get("first_air_date") or "")[:4] if is_tv else (item.get("release_date") or "")[:4]

            tid = str(item.get("id"))
            if tid in TMDB_ID_MAP:
                tid = TMDB_ID_MAP[tid]

            result["featured"].append({
                "title": title or "Untitled",
                "url": "",
                "tmdb_id": tid,
                "poster": image_url,
                "rating": str(item.get("vote_average", ""))[:3] if item.get("vote_average") else "",
                "description": item.get("overview", ""),
                "year": year,
                "type": media_type
            })

    # Fetch items for other sections concurrently (using page count 2 for speed & rate limits)
    sections_def = [
        ("dt-movies", f"https://api.themoviedb.org/3/discover/movie?api_key={api_key}&primary_release_date.lte={today_str}&sort_by=primary_release_date.desc&vote_count.gte=15", "🎬 Latest Movies", "movie"),
        ("dt-tvshows", f"https://api.themoviedb.org/3/tv/popular?api_key={api_key}", "📺 Web Series", "tv"),
        ("dt-anime", f"https://api.themoviedb.org/3/discover/tv?api_key={api_key}&with_genres=16&with_original_language=ja&sort_by=popularity.desc", "🌸 Popular Anime", "anime"),
        ("dt-seasons", f"https://api.themoviedb.org/3/tv/on_the_air?api_key={api_key}", "🗂️ Recent Seasons", "tv"),
        ("dt-episodes", f"https://api.themoviedb.org/3/tv/airing_today?api_key={api_key}", "▶️ New Episodes", "tv"),
        ("dt-popular", f"https://api.themoviedb.org/3/movie/popular?api_key={api_key}", "🔥 Popular Movies", "movie")
    ]

    from concurrent.futures import ThreadPoolExecutor
    def fetch_sec(item):
        sec_id, url, title, mtype = item
        items, _ = _fetch_multi_pages_tmdb(url, pages_count=2, start_page=1)
        return sec_id, title, mtype, items

    with ThreadPoolExecutor(max_workers=6) as executor:
        sections_results = list(executor.map(fetch_sec, sections_def))

    for sec_id, title, mtype, items in sections_results:
        if items:
            cards = map_tmdb_items(items, mtype)
            result["sections"].append({
                "id": sec_id,
                "title": title,
                "items": cards
            })

    # If TMDB completely failed, load fallback evergreen movies list so player stays functional
    if not success or not result.get("sections"):
        evergreen_movies = [
            {
                "title": "Interstellar",
                "url": "",
                "poster": "https://image.tmdb.org/t/p/w500/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg",
                "rating": "8.7",
                "year": "2014",
                "quality": "4K",
                "type": "movie",
                "item_type": "Movie",
                "imdb_id": "tt1857642"
            },
            {
                "title": "Inception",
                "url": "",
                "poster": "https://image.tmdb.org/t/p/w500/sPX89Td70IDDjVr85jdSBb4rWGr.jpg",
                "rating": "8.8",
                "year": "2010",
                "quality": "HD",
                "type": "movie",
                "item_type": "Movie",
                "imdb_id": "tt1375666"
            },
            {
                "title": "The Dark Knight",
                "url": "",
                "poster": "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
                "rating": "9.0",
                "year": "2008",
                "quality": "HD",
                "type": "movie",
                "item_type": "Movie",
                "imdb_id": "tt0468569"
            }
        ]
        
        result["featured"] = []
        for item in evergreen_movies:
            result["featured"].append({
                "title": item["title"],
                "url": "",
                "poster": item["poster"],
                "rating": item["rating"],
                "description": f"Stream {item['title']} in ultra high quality.",
                "year": item["year"],
                "type": "movie",
                "imdb_id": item["imdb_id"]
            })
            
        result["sections"].append({
            "id": "dt-movies",
            "title": "🎬 Latest Movies (Fallback)",
            "items": evergreen_movies
        })
    else:
        # Cache successfully loaded homepage results
        _homepage_cache = {
            "data": result,
            "ts": now
        }

    print(f"[+] Homepage fetched: {len(result['featured'])} featured, {len(result['sections'])} sections")
    return result

def scrape_movies_sections():
    cfg = load_config()
    api_key = cfg.get("tmdb_api_key", "").strip() or "8265bd1679663a7ea12ac168da84d2e8"
    
    sections = []
    sections_def = [
        ("movie-top-rated", f"https://api.themoviedb.org/3/movie/top_rated?api_key={api_key}", "⭐ Top Rated Movies", "movie"),
        ("movie-upcoming", f"https://api.themoviedb.org/3/movie/upcoming?api_key={api_key}", "📅 Upcoming Movies", "movie")
    ]
    
    for sec_id, url, sec_title, media_type in sections_def:
        items_data, _ = _fetch_multi_pages_tmdb(url, pages_count=10, start_page=1)
        if items_data:
            cards = map_tmdb_items(items_data, media_type)
            sections.append({
                "id": sec_id,
                "title": sec_title,
                "items": cards
            })
    return {"sections": sections}

def scrape_series_sections():
    cfg = load_config()
    api_key = cfg.get("tmdb_api_key", "").strip() or "8265bd1679663a7ea12ac168da84d2e8"
    
    sections = []
    sections_def = [
        ("tv-top-rated", f"https://api.themoviedb.org/3/tv/top_rated?api_key={api_key}", "⭐ Top Rated Series", "tv")
    ]
    
    for sec_id, url, sec_title, media_type in sections_def:
        items_data, _ = _fetch_multi_pages_tmdb(url, pages_count=10, start_page=1)
        if items_data:
            cards = map_tmdb_items(items_data, media_type)
            sections.append({
                "id": sec_id,
                "title": sec_title,
                "items": cards
            })
    return {"sections": sections}

def scrape_anime_sections():
    cfg = load_config()
    api_key = cfg.get("tmdb_api_key", "").strip() or "8265bd1679663a7ea12ac168da84d2e8"
    
    sections = []
    sections_def = [
        ("anime-top-rated", f"https://api.themoviedb.org/3/discover/tv?api_key={api_key}&with_genres=16&with_original_language=ja&sort_by=vote_average.desc&vote_count.gte=50", "🏆 Top Rated Anime", "anime")
    ]
    
    for sec_id, url, sec_title, media_type in sections_def:
        items_data, _ = _fetch_multi_pages_tmdb(url, pages_count=10, start_page=1)
        if items_data:
            cards = map_tmdb_items(items_data, media_type)
            sections.append({
                "id": sec_id,
                "title": sec_title,
                "items": cards
            })
    return {"sections": sections}


# ── Genres ────────────────────────────────────────────────────────────────────
MOVIE_GENRES = [
    {"id": 28,    "name": "Action",      "emoji": "💥"},
    {"id": 12,    "name": "Adventure",   "emoji": "🗺️"},
    {"id": 16,    "name": "Animation",   "emoji": "🎨"},
    {"id": 35,    "name": "Comedy",      "emoji": "😂"},
    {"id": 80,    "name": "Crime",       "emoji": "🔫"},
    {"id": 99,    "name": "Documentary", "emoji": "📽️"},
    {"id": 18,    "name": "Drama",       "emoji": "🎭"},
    {"id": 10751, "name": "Family",      "emoji": "👨‍👩‍👧"},
    {"id": 14,    "name": "Fantasy",     "emoji": "🧙"},
    {"id": 36,    "name": "History",     "emoji": "📜"},
    {"id": 27,    "name": "Horror",      "emoji": "👻"},
    {"id": 10402, "name": "Music",       "emoji": "🎵"},
    {"id": 9648,  "name": "Mystery",     "emoji": "🔍"},
    {"id": 10749, "name": "Romance",     "emoji": "❤️"},
    {"id": 878,   "name": "Sci-Fi",      "emoji": "🚀"},
    {"id": 53,    "name": "Thriller",    "emoji": "😱"},
    {"id": 10752, "name": "War",         "emoji": "⚔️"},
    {"id": 37,    "name": "Western",     "emoji": "🤠"},
]

TV_GENRES = [
    {"id": 10759, "name": "Action & Adventure", "emoji": "💥"},
    {"id": 16,    "name": "Animation",           "emoji": "🎨"},
    {"id": 35,    "name": "Comedy",              "emoji": "😂"},
    {"id": 80,    "name": "Crime",               "emoji": "🔫"},
    {"id": 99,    "name": "Documentary",         "emoji": "📽️"},
    {"id": 18,    "name": "Drama",               "emoji": "🎭"},
    {"id": 10751, "name": "Family",              "emoji": "👨‍👩‍👧"},
    {"id": 10762, "name": "Kids",                "emoji": "🧒"},
    {"id": 9648,  "name": "Mystery",             "emoji": "🔍"},
    {"id": 10763, "name": "News",                "emoji": "📰"},
    {"id": 10764, "name": "Reality",             "emoji": "📺"},
    {"id": 10765, "name": "Sci-Fi & Fantasy",    "emoji": "🚀"},
    {"id": 10766, "name": "Soap",                "emoji": "🎞️"},
    {"id": 10767, "name": "Talk",                "emoji": "🗣️"},
    {"id": 10768, "name": "War & Politics",      "emoji": "⚔️"},
    {"id": 37,    "name": "Western",             "emoji": "🤠"},
]

ANIME_GENRES = [
    {"id": "action",      "name": "Action",       "emoji": "💥",  "movie_id": 28,    "tv_id": 10759},
    {"id": "adventure",   "name": "Adventure",    "emoji": "🗺️",  "movie_id": 12,    "tv_id": 10759},
    {"id": "comedy",      "name": "Comedy",       "emoji": "😂",  "movie_id": 35,    "tv_id": 35},
    {"id": "crime",       "name": "Crime",        "emoji": "🔫",  "movie_id": 80,    "tv_id": 80},
    {"id": "documentary", "name": "Documentary",  "emoji": "📽️",  "movie_id": 99,    "tv_id": 99},
    {"id": "drama",       "name": "Drama",        "emoji": "🎭",  "movie_id": 18,    "tv_id": 18},
    {"id": "family",      "name": "Family",       "emoji": "👨‍👩‍👧", "movie_id": 10751, "tv_id": 10751},
    {"id": "fantasy",     "name": "Fantasy",      "emoji": "🧙",  "movie_id": 14,    "tv_id": 10765},
    {"id": "horror",      "name": "Horror",       "emoji": "👻",  "movie_id": 27,    "tv_id": 9648},
    {"id": "music",       "name": "Music",        "emoji": "🎵",  "movie_id": 10402, "tv_id": None},
    {"id": "mystery",     "name": "Mystery",      "emoji": "🔍",  "movie_id": 9648,  "tv_id": 9648},
    {"id": "romance",     "name": "Romance",      "emoji": "❤️",  "movie_id": 10749, "tv_id": 18},
    {"id": "sci-fi",      "name": "Sci-Fi",       "emoji": "🚀",  "movie_id": 878,   "tv_id": 10765},
    {"id": "thriller",    "name": "Thriller",     "emoji": "😱",  "movie_id": 53,    "tv_id": 9648},
    {"id": "war",         "name": "War",          "emoji": "⚔️",  "movie_id": 10752, "tv_id": 10768},
    {"id": "western",     "name": "Western",      "emoji": "🤠",  "movie_id": 37,    "tv_id": 37},
]

def fetch_genre_content(genre_id, media_type="movie", sort_by="popularity.desc", page=1):
    """Fetch TMDB content for a specific genre ID."""
    cfg = load_config()
    api_key = cfg.get("tmdb_api_key", "").strip() or "8265bd1679663a7ea12ac168da84d2e8"
    
    # TMDB TV discover uses different sort_by params vs movie discover
    # Map movie-specific sorts to their TV equivalents
    TV_SORT_MAP = {
        "primary_release_date.desc": "first_air_date.desc",
        "primary_release_date.asc":  "first_air_date.asc",
        "revenue.desc":              "popularity.desc",  # revenue not supported for TV
        "revenue.asc":               "popularity.desc",
    }
    
    if media_type == "movie":
        url = (f"https://api.themoviedb.org/3/discover/movie"
               f"?api_key={api_key}&with_genres={genre_id}"
               f"&sort_by={sort_by}&vote_count.gte=20")
    elif media_type == "anime_movie":
        url = (f"https://api.themoviedb.org/3/discover/movie"
               f"?api_key={api_key}&with_genres=16,{genre_id}"
               f"&with_original_language=ja"
               f"&sort_by={sort_by}&vote_count.gte=5")
    elif media_type in ("anime", "anime_tv"):
        tv_sort = TV_SORT_MAP.get(sort_by, sort_by)
        url = (f"https://api.themoviedb.org/3/discover/tv"
               f"?api_key={api_key}&with_genres=16,{genre_id}"
               f"&with_original_language=ja"
               f"&sort_by={tv_sort}&vote_count.gte=5")
    else:
        tv_sort = TV_SORT_MAP.get(sort_by, sort_by)  # remap if needed
        url = (f"https://api.themoviedb.org/3/discover/tv"
               f"?api_key={api_key}&with_genres={genre_id}"
               f"&sort_by={tv_sort}&vote_count.gte=10")
    
    start_tmdb_page = (page - 1) * 10 + 1
    items, total_pages = _fetch_multi_pages_tmdb(url, pages_count=10, start_page=start_tmdb_page)
    total_pages_scaled = max(1, total_pages // 10)
    
    mapping_type = "movie" if media_type == "anime_movie" else ("tv" if media_type == "anime_tv" else media_type)
    return map_tmdb_items(items, mapping_type), total_pages_scaled


def get_genres_page(media_type="all", genre_id=None, sort_by="popularity.desc", page=1):
    """Return genres list and optionally content for a specific genre."""
    result = {
        "movie_genres": MOVIE_GENRES,
        "tv_genres": TV_GENRES,
        "anime_genres": ANIME_GENRES,
        "sections": []
    }
    
    if genre_id:
        genre_id = str(genre_id)
        # Find genre name
        genre_name = genre_id
        genre_emoji = "🎬"
        
        # Check if the genre_id is in ANIME_GENRES
        anime_genre_cfg = None
        for g in ANIME_GENRES:
            if g["id"] == genre_id:
                anime_genre_cfg = g
                genre_name = g["name"]
                genre_emoji = g["emoji"]
                break
        
        # If not found in anime genres, check in standard movie/tv genres
        if not anime_genre_cfg:
            all_genres = MOVIE_GENRES + TV_GENRES
            for g in all_genres:
                if str(g["id"]) == genre_id:
                    genre_name = g["name"]
                    genre_emoji = g["emoji"]
                    break
        
        if media_type in ("movie", "all"):
            is_valid_movie_genre = any(str(g["id"]) == genre_id for g in MOVIE_GENRES)
            if is_valid_movie_genre:
                items, total_pages = fetch_genre_content(genre_id, "movie", sort_by, page)
                if items:
                    result["sections"].append({
                        "id": f"genre-{genre_id}-movie",
                        "title": f"{genre_emoji} {genre_name} — Movies",
                        "items": items,
                        "genre_id": genre_id,
                        "media_type": "movie",
                        "page": page,
                        "total_pages": total_pages,
                        "has_more": page < total_pages
                    })
        
        if media_type in ("tv", "all"):
            is_valid_tv_genre = any(str(g["id"]) == genre_id for g in TV_GENRES)
            if is_valid_tv_genre:
                items, total_pages = fetch_genre_content(genre_id, "tv", sort_by, page)
                if items:
                    result["sections"].append({
                        "id": f"genre-{genre_id}-tv",
                        "title": f"{genre_emoji} {genre_name} — Series",
                        "items": items,
                        "genre_id": genre_id,
                        "media_type": "tv",
                        "page": page,
                        "total_pages": total_pages,
                        "has_more": page < total_pages
                    })

        if media_type in ("anime", "anime_movie", "anime_tv", "all"):
            if anime_genre_cfg:
                # Browsing Anime tab specifically (string ID like "action")
                movie_id = anime_genre_cfg.get("movie_id")
                tv_id = anime_genre_cfg.get("tv_id")
                
                if movie_id and media_type in ("anime", "anime_movie", "all"):
                    items, total_pages = fetch_genre_content(str(movie_id), "anime_movie", sort_by, page)
                    if items:
                        result["sections"].append({
                            "id": f"genre-{genre_id}-anime-movie",
                            "title": f"{genre_emoji} {genre_name} — Anime Movies",
                            "items": items,
                            "genre_id": genre_id,
                            "media_type": "anime_movie",
                            "page": page,
                            "total_pages": total_pages,
                            "has_more": page < total_pages
                        })
                if tv_id and media_type in ("anime", "anime_tv", "all"):
                    items, total_pages = fetch_genre_content(str(tv_id), "anime_tv", sort_by, page)
                    if items:
                        result["sections"].append({
                            "id": f"genre-{genre_id}-anime-tv",
                            "title": f"{genre_emoji} {genre_name} — Anime Series",
                            "items": items,
                            "genre_id": genre_id,
                            "media_type": "anime_tv",
                            "page": page,
                            "total_pages": total_pages,
                            "has_more": page < total_pages
                        })
            else:
                # Browsing "All" tab (numeric ID like 28 or 10759)
                if media_type in ("anime", "anime_movie", "all"):
                    is_valid_movie_genre = any(str(g["id"]) == genre_id for g in MOVIE_GENRES)
                    if is_valid_movie_genre:
                        items, total_pages = fetch_genre_content(genre_id, "anime_movie", sort_by, page)
                        if items:
                            result["sections"].append({
                                "id": f"genre-{genre_id}-anime-movie",
                                "title": f"{genre_emoji} {genre_name} — Anime Movies",
                                "items": items,
                                "genre_id": genre_id,
                                "media_type": "anime_movie",
                                "page": page,
                                "total_pages": total_pages,
                                "has_more": page < total_pages
                            })
                
                if media_type in ("anime", "anime_tv", "all"):
                    is_valid_tv_genre = any(str(g["id"]) == genre_id for g in TV_GENRES)
                    if is_valid_tv_genre:
                        items, total_pages = fetch_genre_content(genre_id, "anime_tv", sort_by, page)
                        if items:
                            result["sections"].append({
                                "id": f"genre-{genre_id}-anime-tv",
                                "title": f"{genre_emoji} {genre_name} — Anime Series",
                                "items": items,
                                "genre_id": genre_id,
                                "media_type": "anime_tv",
                                "page": page,
                                "total_pages": total_pages,
                                "has_more": page < total_pages
                            })
    
    return result


def fetch_provider_content(provider_id, sort_by="popularity.desc", page=1):
    """Fetch TMDB movies & series for a specific watch provider ID, sorted by popularity.
    Supports pagination — each page returns ~40 items (20 movies + 20 TV interlaced)."""
    cfg = load_config()
    api_key = cfg.get("tmdb_api_key", "").strip() or "8265bd1679663a7ea12ac168da84d2e8"

    TV_SORT_MAP = {
        "primary_release_date.desc": "first_air_date.desc",
        "primary_release_date.asc":  "first_air_date.asc",
        "revenue.desc":              "popularity.desc",
        "revenue.asc":               "popularity.desc",
    }

    tv_sort = TV_SORT_MAP.get(sort_by, sort_by)

    movie_url = (f"https://api.themoviedb.org/3/discover/movie"
                 f"?api_key={api_key}&with_watch_providers={provider_id}"
                 f"&watch_region=US&sort_by={sort_by}&vote_count.gte=10")

    tv_url = (f"https://api.themoviedb.org/3/discover/tv"
              f"?api_key={api_key}&with_watch_providers={provider_id}"
              f"&watch_region=US&sort_by={tv_sort}&vote_count.gte=5")

    start_tmdb_page = (page - 1) * 5 + 1
    movies_raw, movie_total = _fetch_multi_pages_tmdb(movie_url, pages_count=5, start_page=start_tmdb_page)
    tvs_raw, tv_total = _fetch_multi_pages_tmdb(tv_url, pages_count=5, start_page=start_tmdb_page)

    movies = map_tmdb_items(movies_raw, "movie")
    tvs = map_tmdb_items(tvs_raw, "tv")

    max_pages_scaled = max(1, max(movie_total, tv_total) // 5)

    combined = []
    m_idx = 0
    t_idx = 0
    while m_idx < len(movies) or t_idx < len(tvs):
        if m_idx < len(movies):
            combined.append(movies[m_idx])
            m_idx += 1
        if t_idx < len(tvs):
            combined.append(tvs[t_idx])
            t_idx += 1

    return combined, max_pages_scaled


# ── Watch Provider Logos ──────────────────────────────────────────────────────
# Provider slugs → TMDB watch-provider IDs. Embedded SVG fallbacks in app.js use these slugs.
_PROVIDER_SLUGS = {
    8: "netflix", 9: "primevideo", 337: "disney", 15: "hulu",
    2: "appletv", 1899: "max", 531: "paramount", 386: "peacock",
    283: "crunchyroll", 34: "mgm", 257: "fubo",
    3: "googleplay", 192: "youtube", 188: "youtubepremium",
    526: "amc", 43: "starz", 258: "criterion", 207: "roku",
    83: "cw", 191: "kanopy", 212: "hoopla", 7: "fandango",
    209: "pbs", 123: "fxnow", 332: "fandangofree", 11: "mubi",
    44: " AMC+ ".strip(), 1884: "showtime",
}
# Terms that indicate a sub-channel/aggregator variant we want to filter out
# (they duplicate a parent brand and clutter the grid, e.g. "HBO Max Amazon Channel")
_PROVIDER_NOISE = (
    "amazon channel", "apple tv channel", "roku premium channel",
    "roku channel", "amazon channel", "via", "google play",
    "premium", "essential", "free",
)
# Canonical key for deduping brand variants (e.g. "AMC+" / "AMC" / "Apple TV" / "Apple TV Store")
_BRAND_CANON = {
    "amc": "amc", "amcplus": "amc", "appletv": "appletv", "appletvstore": "appletv",
    "peacock": "peacock", "peacockpremium": "peacock",
    "paramount": "paramount", "paramountplus": "paramount",
    "amazonprimevideo": "primevideo", "amazonvideo": "amazonvideo",
    "fandangoathome": "fandango", "fandangoathomefree": "fandango",
}
_providers_cache = None  # cached list


def _slugify(name):
    """Make a stable slug from a provider name for SVG fallback lookup."""
    s = name.lower()
    for ch in " .-+/'":
        s = s.replace(ch, "")
    return s


def fetch_provider_logos(limit=30):
    """Fetch the most popular providers dynamically from TMDB, with real full-color logos.
    Returns an ordered list of {id, name, slug, logo}. Cached after first call."""
    global _providers_cache
    if _providers_cache is not None:
        return _providers_cache

    cfg = load_config()
    api_key = cfg.get("tmdb_api_key", "").strip() or "8265bd1679663a7ea12ac168da84d2e8"
    url = (f"https://api.themoviedb.org/3/watch/providers/movie"
           f"?api_key={api_key}&watch_region=US")
    data = _get_tmdb_json(url, timeout=8)
    if not data or "results" not in data:
        _providers_cache = []
        return _providers_cache

    results = data.get("results", [])
    # Sort by TMDB popularity (most-watched providers first)
    results.sort(key=lambda p: -p.get("popularity", 0))

    providers = []
    seen_brands = set()
    for prov in results:
        if len(providers) >= limit:
            break
        name = prov.get("provider_name", "").strip()
        logo_path = prov.get("logo_path")
        if not name or not logo_path:
            continue
        name_low = name.lower()
        # Skip aggregator/duplicate sub-channels
        if any(noise in name_low for noise in _PROVIDER_NOISE):
            continue
        # Dedup by canonical brand key (e.g. "AMC" / "AMC+" / "Apple TV Store" map to same brand)
        raw_slug = _slugify(name)
        canon = _BRAND_CANON.get(raw_slug, raw_slug)
        if canon in seen_brands:
            continue
        seen_brands.add(canon)

        pid = prov.get("provider_id")
        # Prefer a known slug so embedded SVG fallbacks can match, else slugify the name
        slug = _PROVIDER_SLUGS.get(pid) or raw_slug
        providers.append({
            "id": str(pid),
            "name": name,
            "slug": slug,
            "logo": f"https://image.tmdb.org/t/p/w154{logo_path}",
        })

    _providers_cache = providers
    return _providers_cache


# ── IMDB / OMDB Data ──────────────────────────────────────────────────────────
_imdb_cache = {}

def fetch_imdb_data(imdb_id):
    """Get IMDB data: OMDB API first, direct IMDB scrape as fallback."""
    if imdb_id in _imdb_cache:
        return _imdb_cache[imdb_id]

    cfg = load_config()
    api_key = cfg.get("omdb_api_key", "").strip()
    data = None

    # Try OMDB API
    if api_key:
        try:
            omdb_url = f"https://www.omdbapi.com/?i={imdb_id}&apikey={api_key}&plot=full"
            raw = _fetch(omdb_url)
            d = json.loads(raw)
            if d.get("Response") == "True":
                poster = d.get("Poster", "")
                if poster and poster != "N/A":
                    pass
                else:
                    poster = ""
                data = {
                    "title":       d.get("Title", ""),
                    "year":        d.get("Year", ""),
                    "release_date": d.get("Released", ""),
                    "rating":      d.get("imdbRating", ""),
                    "votes":       d.get("imdbVotes", ""),
                    "plot":        d.get("Plot", ""),
                    "genre":       d.get("Genre", ""),
                    "runtime":     d.get("Runtime", ""),
                    "poster":      poster,
                    "director":    d.get("Director", ""),
                    "actors":      d.get("Actors", ""),
                    "type":        d.get("Type", "movie"),
                    "country":     d.get("Country", ""),
                    "language":    d.get("Language", ""),
                    "awards":      d.get("Awards", ""),
                    "rated":       d.get("Rated", ""),
                    "boxoffice":   d.get("BoxOffice", ""),
                }
        except Exception as e:
            print(f"[-] OMDB error for {imdb_id}: {e}")

    # Direct IMDB scrape fallback
    if not data:
        try:
            imdb_url = f"https://www.imdb.com/title/{imdb_id}/"
            raw = _fetch(imdb_url, {"Accept": "text/html"})

            is_waf = "challenge.js" in raw or len(raw) < 5000
            if is_waf:
                raise Exception("AWS WAF challenge page detected")

            # Extract JSON-LD
            ld_m = re.search(r'<script type="application/ld\+json">(.*?)</script>', raw, re.DOTALL)
            if ld_m:
                ld = json.loads(ld_m.group(1))
                rating_val = ld.get("aggregateRating", {}).get("ratingValue", "")
                directors  = [d.get("name", "") for d in ld.get("director", []) if isinstance(d, dict)]
                actors     = [a.get("name", "") for a in ld.get("actor", []) if isinstance(a, dict)]
                genres     = ld.get("genre", [])
                data = {
                    "title":    ld.get("name", ""),
                    "year":     (ld.get("datePublished") or "")[:4],
                    "rating":   str(rating_val),
                    "votes":    str(ld.get("aggregateRating", {}).get("ratingCount", "")),
                    "plot":     ld.get("description", ""),
                    "genre":    ", ".join(genres) if isinstance(genres, list) else str(genres),
                    "runtime":  ld.get("duration", "").replace("PT", "").lower(),
                    "poster":   ld.get("image", ""),
                    "director": ", ".join(directors),
                    "actors":   ", ".join(actors[:4]),
                    "type":     "series" if ld.get("@type") in ("TVSeries", "TVEpisode") else "movie",
                    "country":  "",
                    "language": "",
                    "awards":   "",
                    "rated":    ld.get("contentRating", ""),
                    "boxoffice": "",
                }
        except Exception as e:
            print(f"[-] IMDb scrape failed: {e}. Falling back to IMDb Suggestion API.")
            try:
                first_letter = imdb_id[0] if imdb_id else 't'
                suggest_url = f"https://sg.media-imdb.com/suggests/{first_letter}/{imdb_id}.json"
                req_s = urllib.request.Request(suggest_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req_s, context=ssl_ctx, timeout=5) as r_s:
                    content = r_s.read().decode("utf-8")
                
                json_match = re.search(r'imdb\$[^(]+\((.*)\)', content)
                if json_match:
                    suggest_data = json.loads(json_match.group(1))
                    entries = suggest_data.get("d", [])
                    if entries:
                        entry = entries[0]
                        title = entry.get("l", "")
                        year = str(entry.get("y", ""))
                        q = entry.get("q", "")
                        
                        # TVmaze genres enrichment for TV series
                        genres = ""
                        if q in ("TV series", "TV mini-series", "tvSeries", "tvMiniSeries"):
                            try:
                                tvmaze_url = f"https://api.tvmaze.com/singlesearch/shows?q={urllib.parse.quote(title)}"
                                req_tv = urllib.request.Request(tvmaze_url, headers={"User-Agent": "Mozilla/5.0"})
                                with urllib.request.urlopen(req_tv, context=ssl_ctx, timeout=4) as r_tv:
                                    tv_data = json.loads(r_tv.read().decode("utf-8"))
                                genres = ", ".join(tv_data.get("genres", []))
                                if tv_data.get("type") == "Animation":
                                    genres += ", Animation"
                            except Exception:
                                pass
                        
                        # Fallback keywords for genres
                        if not genres:
                            if any(w in title.lower() for w in ("anime", "animation", "manga", "naruto", "dragon ball", "one piece", "jujutsu kaisen")):
                                genres = "Animation, Anime"
                        
                        data = {
                            "title":    title,
                            "year":     year,
                            "rating":   "",
                            "votes":    "",
                            "plot":     "",
                            "genre":    genres,
                            "runtime":  "",
                            "poster":   entry.get("i", [""])[0] if entry.get("i") else "",
                            "director": "",
                            "actors":   entry.get("s", ""),
                            "type":     "series" if q in ("TV series", "TV mini-series", "tvSeries", "tvMiniSeries") else "movie",
                            "country":  "",
                            "language": "",
                            "awards":   "",
                            "rated":    "",
                            "boxoffice": "",
                        }
            except Exception as e2:
                print(f"[-] IMDb Suggestion API fallback failed: {e2}")

    _imdb_cache[imdb_id] = data
    return data


_cached_api_key = None
_cached_api_key_time = 0

def decrypt_api_key():
    global _cached_api_key, _cached_api_key_time
    import time as _time_mod
    now = _time_mod.time()
    if _cached_api_key and (now - _cached_api_key_time < 1800):
        return _cached_api_key

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    try:
        req = urllib.request.Request(API_KEY_URL, headers=headers)
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=5) as response:
            encrypted_b64 = response.read().decode("utf-8")
        
        encrypted_b64 = "".join(encrypted_b64.split())
        data = base64.b64decode(encrypted_b64)
        
        if len(data) <= 28:
            return None
            
        iv = data[0:12]
        tag = data[12:28]
        ciphertext = data[28:]
        payload = ciphertext + tag
        
        key_bytes = hashlib.sha256(AES_GCM_SECRET.encode("utf-8")).digest()
        
        aesgcm = AESGCM(key_bytes)
        decrypted = aesgcm.decrypt(iv, payload, None)
        res = decrypted.decode("utf-8")
        _cached_api_key = res
        _cached_api_key_time = now
        return res
    except Exception as e:
        print(f"[-] Error decrypting API key: {e}")
        if _cached_api_key:
            return _cached_api_key
        return None

def decrypt_stream_link(encrypted_b64, aes_key_str):
    try:
        decoded_bytes = base64.b64decode(encrypted_b64)
        idx = decoded_bytes.find(b':')
        if idx == -1:
            return None
            
        iv_b64 = decoded_bytes[:idx]
        ciphertext_b64 = decoded_bytes[idx+1:]
        
        iv = base64.b64decode(iv_b64)
        ciphertext = base64.b64decode(ciphertext_b64)
        
        key = aes_key_str.ljust(32, '\0').encode('utf-8')[:32]
        
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
        decryptor = cipher.decryptor()
        decrypted_padded = decryptor.update(ciphertext) + decryptor.finalize()
        
        unpadder = padding.PKCS7(128).unpadder()
        decrypted = unpadder.update(decrypted_padded) + unpadder.finalize()
        return decrypted.decode('utf-8')
    except Exception:
        return None

_tmdb_cache = {}   # imdb_id -> tmdb_id
_imdb_title_cache = {}  # title_key -> imdb_id
_tmdb_details_cache = {} # cache_key -> details dict

def search_imdb_by_title(title, content_type="movie", year=None):
    """Search IMDB suggestion API to get IMDB ID from a title string."""
    if not title:
        return None
    cache_key = f"{title.lower().strip()}|{content_type}"
    if cache_key in _imdb_title_cache:
        return _imdb_title_cache[cache_key]
    try:
        encoded = urllib.parse.quote(title.lower().strip())
        suggest_url = f"https://v3.sg.media-imdb.com/suggestion/x/{encoded}.json"
        req = urllib.request.Request(suggest_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=5) as r:
            data = json.loads(r.read().decode("utf-8"))
        entries = data.get("d", [])

        TV_TYPES = ("TV series", "TV mini-series", "tvSeries", "tvMiniSeries")
        for entry in entries[:8]:
            eid = entry.get("id", "")
            if not eid.startswith("tt"):
                continue
            etype = entry.get("q", "")
            eyear = str(entry.get("y", ""))

            if content_type == "tv" and etype not in TV_TYPES:
                continue
            if content_type == "movie" and etype in TV_TYPES:
                continue
            if year and eyear and abs(int(year) - int(eyear)) > 3:
                continue

            _imdb_title_cache[cache_key] = eid
            return eid

        # Relaxed fallback — any tt ID
        for entry in entries[:4]:
            eid = entry.get("id", "")
            if eid.startswith("tt"):
                _imdb_title_cache[cache_key] = eid
                return eid
    except Exception as ex:
        print(f"[-] search_imdb_by_title error: {ex}")
    return None


def imdb_to_tmdb(imdb_id, content_type="movie"):
    """Convert IMDB ID to TMDB ID using the free TMDB find endpoint."""
    if not imdb_id:
        return None
    if imdb_id in _tmdb_cache:
        return _tmdb_cache[imdb_id]
    try:
        cfg = load_config()
        api_key = cfg.get("tmdb_api_key", "")
        if not api_key:
            # Try without API key using the public endpoint
            api_key = "8265bd1679663a7ea12ac168da84d2e8"  # public read-only key
        url = f"https://api.themoviedb.org/3/find/{imdb_id}?api_key={api_key}&external_source=imdb_id"
        data = _get_tmdb_json(url, timeout=4)
        if not data:
            return None
        # For movies
        if content_type != "tv":
            results = data.get("movie_results", [])
        else:
            results = data.get("tv_results", [])
        if results:
            tmdb_id = str(results[0]["id"])
            if tmdb_id in TMDB_ID_MAP:
                tmdb_id = TMDB_ID_MAP[tmdb_id]
            _tmdb_cache[imdb_id] = tmdb_id
            return tmdb_id
    except Exception as e:
        print(f"[-] imdb_to_tmdb error: {e}")
    return None


def fetch_anilist_cast(title):
    if not title:
        return None
    url = "https://graphql.anilist.co"
    query = """
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        characters (sort: [ROLE, RELEVANCE, ID], perPage: 12) {
          edges {
            role
            node {
              name {
                full
              }
              image {
                large
              }
            }
            voiceActors (language: JAPANESE) {
              name {
                full
              }
              image {
                large
              }
            }
          }
        }
      }
    }
    """
    variables = {"search": title}
    try:
        req_data = json.dumps({"query": query, "variables": variables}).encode("utf-8")
        req = urllib.request.Request(
            url, 
            data=req_data, 
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0"
            }
        )
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=4) as response:
            res = json.loads(response.read().decode("utf-8"))
            media = res.get("data", {}).get("Media")
            if not media:
                return None
            
            edges = media.get("characters", {}).get("edges", [])
            cast_list = []
            for edge in edges:
                node = edge.get("node", {})
                char_name = node.get("name", {}).get("full")
                char_img = node.get("image", {}).get("large")
                
                va_list = edge.get("voiceActors", [])
                va_name = ""
                va_img = ""
                if va_list:
                    va_name = va_list[0].get("name", {}).get("full") or ""
                    va_img = va_list[0].get("image", {}).get("large") or ""
                
                if char_name:
                    cast_list.append({
                        "name": va_name or "Voice Actor",
                        "character": char_name,
                        "profile_path": char_img or "",
                        "actor_image": va_img or ""
                    })
            return cast_list
    except Exception as e:
        print(f"[-] AniList credits fetch failed for {title}: {e}")
    return None


def fetch_tmdb_data(imdb_id, content_type="movie"):
    """Get rich details from TMDB by IMDb ID, using retry to handle transient connection resets."""
    if not imdb_id:
        return None
    cache_key = f"{imdb_id}|{content_type}"
    if cache_key in _tmdb_details_cache:
        return _tmdb_details_cache[cache_key]
    try:
        cfg = load_config()
        api_key = cfg.get("tmdb_api_key", "").strip()
        if not api_key:
            api_key = "8265bd1679663a7ea12ac168da84d2e8"  # public read-only key

        # Helper to request URL with retries
        _get_json = _get_tmdb_json

        # Step 1: Find TMDB ID from IMDb ID
        find_url = f"https://api.themoviedb.org/3/find/{imdb_id}?api_key={api_key}&external_source=imdb_id"
        find_res = _get_json(find_url)
        if not find_res:
            return None

        movie_results = find_res.get("movie_results", [])
        tv_results = find_res.get("tv_results", [])

        # Smart selection if both exist to avoid returning stubs (e.g. Baki-Dou movie stub instead of TV)
        if movie_results and tv_results:
            movie_item = movie_results[0]
            tv_item = tv_results[0]

            movie_pop = movie_item.get("popularity", 0) or 0
            tv_pop = tv_item.get("popularity", 0) or 0

            movie_has_date = bool(movie_item.get("release_date"))
            tv_has_date = bool(tv_item.get("first_air_date"))

            # If TV is much more popular or TV has a date and Movie does not
            if tv_pop > movie_pop * 5 and tv_pop > 2.0:
                item = tv_item
                media_type = "tv"
            elif tv_has_date and not movie_has_date:
                item = tv_item
                media_type = "tv"
            elif movie_has_date and not tv_has_date:
                item = movie_item
                media_type = "movie"
            else:
                if content_type == "tv":
                    item = tv_item
                    media_type = "tv"
                else:
                    item = movie_item
                    media_type = "movie"
        else:
            results = tv_results if content_type == "tv" else movie_results
            if not results:
                results = movie_results or tv_results
            if not results:
                return None
            item = results[0]
            media_type = "tv" if item in tv_results else "movie"

        tmdb_id = item.get("id")
        if str(tmdb_id) in TMDB_ID_MAP:
            tmdb_id = int(TMDB_ID_MAP[str(tmdb_id)])

        # Step 2: Fetch detailed info from TMDB details endpoint with credits
        credits_append = "aggregate_credits" if media_type == "tv" else "credits"
        details_url = f"https://api.themoviedb.org/3/{media_type}/{tmdb_id}?api_key={api_key}&append_to_response={credits_append}"
        details = _get_json(details_url)

        if not details:
            # Fallback to find results
            fallback_data = {
                "title": item.get("title") or item.get("name"),
                "year": (item.get("release_date") or item.get("first_air_date") or "")[:4],
                "rating": str(item.get("vote_average", "")),
                "plot": item.get("overview", ""),
                "poster": f"https://image.tmdb.org/t/p/w500{item.get('poster_path')}" if item.get('poster_path') else "",
                "backdrop": f"https://image.tmdb.org/t/p/w1280{item.get('backdrop_path')}" if item.get('backdrop_path') else "",
                "type": "series" if media_type == "tv" else "movie",
                "genre": "",
                "runtime": "",
                "cast": []
            }
            _tmdb_details_cache[cache_key] = fallback_data
            return fallback_data

        genres = ", ".join([g["name"] for g in details.get("genres", [])])

        if media_type == "tv":
            runtimes = details.get("episode_run_time", [])
            runtime = f"{runtimes[0]} min" if runtimes else ""
            year = (details.get("first_air_date") or "")[:4]
            title = details.get("name")
            seasons_count = details.get("number_of_seasons")
        else:
            rt = details.get("runtime")
            runtime = f"{rt} min" if rt else ""
            year = (details.get("release_date") or "")[:4]
            title = details.get("title")
            seasons_count = None

        cast_list = []
        raw_cast = details.get("aggregate_credits", {}).get("cast", []) if media_type == "tv" else details.get("credits", {}).get("cast", [])
        for c in raw_cast[:12]:
            character = ""
            if media_type == "tv":
                roles = c.get("roles", [])
                if roles:
                    character = roles[0].get("character") or ""
            else:
                character = c.get("character") or ""

            cast_list.append({
                "name": c.get("name") or "",
                "character": character,
                "profile_path": f"https://image.tmdb.org/t/p/w185{c.get('profile_path')}" if c.get('profile_path') else ""
            })

        # Check if animation/anime to load character images from AniList
        if "Animation" in genres:
            anilist_cast = fetch_anilist_cast(title)
            if anilist_cast:
                cast_list = anilist_cast

        result_data = {
            "title": title,
            "year": year,
            "release_date": details.get("first_air_date") if media_type == "tv" else details.get("release_date"),
            "rating": str(details.get("vote_average", ""))[:3] if details.get("vote_average") else "",
            "plot": details.get("overview", ""),
            "genre": genres,
            "runtime": runtime,
            "poster": f"https://image.tmdb.org/t/p/w500{details.get('poster_path')}" if details.get('poster_path') else "",
            "backdrop": f"https://image.tmdb.org/t/p/w1280{details.get('backdrop_path')}" if details.get('backdrop_path') else "",
            "type": "series" if media_type == "tv" else "movie",
            "seasons_count": seasons_count,
            "votes": str(details.get("vote_count", "")),
            "cast": cast_list
        }
        _tmdb_details_cache[cache_key] = result_data
        return result_data
    except Exception as e:
        print(f"[-] fetch_tmdb_data error: {e}")
    return None



def generate_direct_embeds(imdb_id, content_type="movie", season=None, episode=None, tmdb_id=None):
    """Generate direct self-iframe embed options based on IMDb ID, season, and episode."""
    s = str(season or "1")
    e = str(episode or "1")
    embeds = []

    # Resolve TMDB ID once at the start — many providers use it
    if not tmdb_id and imdb_id:
        tmdb_id = imdb_to_tmdb(imdb_id, content_type)
    # Primary ID selector: TMDB when available, IMDB otherwise
    pid = tmdb_id if tmdb_id else imdb_id  # "primary ID"

    # Map virtual season/episode to TMDB flat season/episode if the show has virtual season mapping
    tmdb_s = s
    tmdb_e = e
    if tmdb_id in TV_SEASON_SPLIT_MAP and content_type == "tv":
        split_cfg = TV_SEASON_SPLIT_MAP[tmdb_id]
        try:
            v_s = int(s)
            v_e = int(e)
            for s_info in split_cfg["seasons"]:
                if s_info["season_number"] == v_s:
                    abs_ep = s_info["start_absolute"] + v_e - 1
                    tmdb_s = "1"
                    tmdb_e = str(abs_ep)
                    break
        except Exception:
            pass

    # ── Providers that work best with TMDB IDs (same as tmovie.in) ────────────

    # 1. Peachify (tmovie.in uses TMDB for this)
    if pid:
        if content_type == "tv":
            peach_url = f"https://peachify.top/embed/tv/{pid}/{tmdb_s}/{tmdb_e}?dub=Hindi&sub=English&accent=ec133e"
        else:
            peach_url = f"https://peachify.top/embed/movie/{pid}?dub=Hindi&sub=English&accent=ec133e"
        embeds.append({"name": "Peachify", "url": peach_url, "nume": "peachify"})

    # 2. NHD Server (TMDB-based — tmovie.in)
    if tmdb_id:
        if content_type == "tv":
            nhd_url = (f"https://nhdapi.com/embed/tv/{tmdb_id}/{tmdb_s}/{tmdb_e}"
                       f"?autonext=true&audio=true&title=true"
                       f"&lang=Hindi&primarycolor=ec133e&secondarycolor=e13789")
        else:
            nhd_url = f"https://nhdapi.com/embed/movie/{tmdb_id}?lang=Hindi"
        embeds.append({"name": "NHD Server", "url": nhd_url, "nume": "nhd"})
    elif imdb_id:
        if content_type == "tv":
            nhd_url = f"https://nhdapi.com/embed/tv?id={imdb_id}&s={s}&e={e}"
        else:
            nhd_url = f"https://nhdapi.com/embed/movie/{imdb_id}"
        embeds.append({"name": "NHD Server", "url": nhd_url, "nume": "nhd"})

    # 3. VidCore (TMDB-based / No Ads)
    if tmdb_id:
        if content_type == "tv":
            vidcore_url = f"https://vidcore.net/tv/{tmdb_id}/{tmdb_s}/{tmdb_e}"
        else:
            vidcore_url = f"https://vidcore.net/movie/{tmdb_id}"
        embeds.append({"name": "VidCore", "url": vidcore_url, "nume": "vidcore"})
    elif imdb_id:
        if content_type == "tv":
            vidcore_url = f"https://vidcore.net/embed/imdb/tv?id={imdb_id}&s={s}&e={e}"
        else:
            vidcore_url = f"https://vidcore.net/embed/imdb/movie?id={imdb_id}"
        embeds.append({"name": "VidCore", "url": vidcore_url, "nume": "vidcore"})

    # 3a. EmbedMaster (TMDB-based)
    if tmdb_id:
        if content_type == "tv":
            embedmaster_url = f"https://embedmaster.link/tv/{tmdb_id}/{tmdb_s}/{tmdb_e}"
        else:
            embedmaster_url = f"https://embedmaster.link/movie/{tmdb_id}"
        embeds.append({"name": "EmbedMaster", "url": embedmaster_url, "nume": "embedmaster"})

    # 3b. VidNest (TMDB-based)
    if tmdb_id:
        if content_type == "tv":
            vidnest_url = f"https://vidnest.fun/tv/{tmdb_id}/{tmdb_s}/{tmdb_e}"
        else:
            vidnest_url = f"https://vidnest.fun/movie/{tmdb_id}"
        embeds.append({"name": "VidNest", "url": vidnest_url, "nume": "vidnest"})

    # 3c. VidFast (TMDB-based)
    if tmdb_id:
        if content_type == "tv":
            vidfast_url = f"https://vidfast.pro/tv/{tmdb_id}/{tmdb_s}/{tmdb_e}"
        else:
            vidfast_url = f"https://vidfast.pro/movie/{tmdb_id}"
        embeds.append({"name": "VidFast", "url": vidfast_url, "nume": "vidfast"})

    # 3d. VidSrc (RU) (TMDB-based)
    if tmdb_id:
        if content_type == "tv":
            vidsrcru_url = f"https://vidsrc-embed.ru/embed/tv/{tmdb_id}/{tmdb_s}/{tmdb_e}"
        else:
            vidsrcru_url = f"https://vidsrc-embed.ru/embed/movie/{tmdb_id}"
        embeds.append({"name": "VidSrc (RU)", "url": vidsrcru_url, "nume": "vidsrcru"})

    # 3e. Vidify (TMDB-based)
    if tmdb_id:
        if content_type == "tv":
            vidify_url = f"https://pro.vidify.top/embed/tv/{tmdb_id}/{tmdb_s}/{tmdb_e}"
        else:
            vidify_url = f"https://pro.vidify.top/embed/movie/{tmdb_id}"
        embeds.append({"name": "Vidify", "url": vidify_url, "nume": "vidify"})

    # 4. Videasy (TMDB preferred — tmovie.in / Hindi Dubbed)
    if pid:
        if content_type == "tv":
            videasy_url = f"https://player.videasy.to/tv/{pid}/{tmdb_s}/{tmdb_e}"
        else:
            videasy_url = f"https://player.videasy.to/movie/{pid}"
        embeds.append({"name": "Videasy", "url": videasy_url, "nume": "videasy"})

    # 5. Vidzen (TMDB preferred — tmovie.in)
    if pid:
        if content_type == "tv":
            vidzen_url = f"https://vidzen.stream/tv/{pid}/{tmdb_s}/{tmdb_e}"
        else:
            vidzen_url = f"https://vidzen.stream/movie/{pid}"
        embeds.append({"name": "Vidzen", "url": vidzen_url, "nume": "vidzen"})

    # 6. NexVid (TMDB preferred — tmovie.in)
    if pid:
        if content_type == "tv":
            nexvid_url = f"https://nexvid.xyz/embed/tv/{pid}/{tmdb_s}/{tmdb_e}"
        else:
            nexvid_url = f"https://nexvid.xyz/embed/movie/{pid}"
        embeds.append({"name": "NexVid", "url": nexvid_url, "nume": "nexvid"})

    # 7. 1Embed (tmovie.in / No Ads) — accepts both IMDB and TMDB
    if pid:
        if content_type == "tv":
            embed1_url = f"https://www.1embed.cc/embed/series?tmdb={pid}&sea={tmdb_s}&epi={tmdb_e}" if tmdb_id else \
                         f"https://www.1embed.cc/embed/series?imdb={imdb_id}&sea={s}&epi={e}"
        else:
            embed1_url = f"https://www.1embed.cc/embed/movie?tmdb={pid}" if tmdb_id else \
                         f"https://www.1embed.cc/embed/movie?imdb={imdb_id}"
        embeds.append({"name": "1Embed", "url": embed1_url, "nume": "1embed"})

    # 8. SuperEmbed — uses TMDB ID with tmdb=1 flag
    if pid:
        if content_type == "tv":
            superembed_url = f"https://multiembed.mov/directstream.php?video_id={pid}&tmdb=1&s={tmdb_s}&e={tmdb_e}"
        else:
            superembed_url = f"https://multiembed.mov/directstream.php?video_id={pid}&tmdb=1"
        embeds.append({"name": "SuperEmbed", "url": superembed_url, "nume": "superembed"})

    # VidPlay — TMDB-based provider
    if tmdb_id:
        if content_type == "tv":
            vidplay_url = f"https://vidplay.to/tv/{tmdb_id}/{tmdb_s}/{tmdb_e}/player"
        else:
            vidplay_url = f"https://vidplay.to/movie/{tmdb_id}/player"
        embeds.append({"name": "VidPlay", "url": vidplay_url, "nume": "vidplay"})

    # Additional TMDB-based providers shown in the website screenshot
    if tmdb_id:
        additional_tmdb_providers = [
            ("VidKing", "https://vidking.net", "vidking"),
            ("VidLink", "https://vidlink.pro", "vidlink"),
            ("VidUp", "https://vidup.to", "vidup"),
            ("Vidmov", "https://vidsrc.mov", "vidmov"),
            ("Vidfyi", "https://vidsrc.fyi", "vidfyi"),
            ("Vidrock", "https://vidrock.ru", "vidrock"),
            ("Movies111", "https://movies111.co", "movies111"),
            ("Hyperlink", "https://hyperlink.link", "hyperlink"),
            ("Ultrabox", "https://ultrabox.to", "ultrabox"),
            ("Cloudbox", "https://cloudbox.net", "cloudbox"),
            ("Upcloud", "https://upcloud.one", "upcloud"),
            ("StreamVault", "https://streamvault.to", "streamvault"),
            ("Mediahub", "https://mediahub.net", "mediahub"),
            ("Cloudplay", "https://cloudplay.co", "cloudplay"),
            ("StreamBoxHD", "https://autoembed.to", "streamboxhd"),
            ("MovieVault", "https://movievault.net", "movievault"),
        ]
        for p_name, p_base, p_nume in additional_tmdb_providers:
            if content_type == "tv":
                if p_nume in ["vidking", "vidmov", "vidfyi", "streamboxhd"]:
                    p_url = f"{p_base}/embed/tv/{tmdb_id}/{tmdb_s}/{tmdb_e}"
                else:
                    p_url = f"{p_base}/tv/{tmdb_id}/{tmdb_s}/{tmdb_e}"
            else:
                if p_nume in ["vidking", "vidmov", "vidfyi", "streamboxhd"]:
                    p_url = f"{p_base}/embed/movie/{tmdb_id}"
                else:
                    p_url = f"{p_base}/movie/{tmdb_id}"
            embeds.append({"name": p_name, "url": p_url, "nume": p_nume})

    # ── Providers that use IMDB IDs ────────────────────────────────────────────

    if imdb_id:
        # 9. Screenscape
        if content_type == "tv":
            screen_url = f"https://screenscape.me/embed?imdb={imdb_id}&type=tv&season={s}&episode={e}&lan=hindi"
        else:
            screen_url = f"https://screenscape.me/embed?imdb={imdb_id}&type=movie&lan=hindi"
        embeds.append({"name": "Screenscape", "url": screen_url, "nume": "screenscape"})

        # 10. Cineverse (Modiplay)
        if content_type == "tv":
            cine_url = f"https://cineverse.modiplay.xyz/embed/imdb/tv?id={imdb_id}&s={s}&e={e}"
        else:
            cine_url = f"https://cineverse.modiplay.xyz/embed/imdb/movie?id={imdb_id}"
        embeds.append({"name": "Vibuxer", "url": cine_url, "nume": "cineverse"})

        # 11. Nxsha Player
        if content_type == "tv":
            nxsha_url = f"https://web.nxsha.app/embed/tv/{imdb_id}/{s}/{e}"
        else:
            nxsha_url = f"https://web.nxsha.app/embed/movie/{imdb_id}"
        embeds.append({"name": "Nxsha Player", "url": nxsha_url, "nume": "nxsha"})

        # 12. Vidzee Embed
        if content_type == "tv":
            vidzee_url = f"https://player.vidzee.wtf/embed/tv/{imdb_id}/{s}/{e}"
        else:
            vidzee_url = f"https://player.vidzee.wtf/embed/movie/{imdb_id}"
        embeds.append({"name": "Vidzee Embed", "url": vidzee_url, "nume": "vidzee"})

        # 13. CinemaOS — use the working /movie/watch/ and /tv/watch/ routes
        # /player/ route returns HTTP 500, the watch routes return HTTP 200
        cinema_pid = tmdb_id if tmdb_id else imdb_id
        if cinema_pid:
            if content_type == "tv":
                cinema_url = f"https://cinemaos.tech/tv/watch/{cinema_pid}?season={s}&episode={e}"
            else:
                cinema_url = f"https://cinemaos.tech/movie/watch/{cinema_pid}"
            embeds.append({"name": "CinemaOS", "url": cinema_url, "nume": "cinemaos"})

        # 14. VidSrc.xyz
        if content_type == "tv":
            vidsrc_url = f"https://vidsrc.xyz/embed/tv?imdb={imdb_id}&season={s}&episode={e}"
        else:
            vidsrc_url = f"https://vidsrc.xyz/embed/movie?imdb={imdb_id}"
        embeds.append({"name": "VidSrc.xyz", "url": vidsrc_url, "nume": "vidsrc"})

        # 15. VidSrc.to
        if content_type == "tv":
            vidsrcto_url = f"https://vidsrc.to/embed/tv/{imdb_id}/{s}/{e}"
        else:
            vidsrcto_url = f"https://vidsrc.to/embed/movie/{imdb_id}"
        embeds.append({"name": "VidSrc.to", "url": vidsrcto_url, "nume": "vidsrcto"})

        # 16. Embed.su
        if content_type == "tv":
            embedsu_url = f"https://embed.su/embed/tv/{imdb_id}/{s}/{e}"
        else:
            embedsu_url = f"https://embed.su/embed/movie/{imdb_id}"
        embeds.append({"name": "Embed.su", "url": embedsu_url, "nume": "embedsu"})

        # Smashy
        if content_type == "tv":
            smashy_url = f"https://player.smashy.stream/tv/{imdb_id}?s={s}&e={e}"
        else:
            smashy_url = f"https://player.smashy.stream/movie/{imdb_id}"
        embeds.append({"name": "Smashy", "url": smashy_url, "nume": "smashy"})

        # NontonGo
        if content_type == "tv":
            nontongo_url = f"https://www.nontongo.win/embed/tv/{imdb_id}/{s}/{e}"
        else:
            nontongo_url = f"https://www.nontongo.win/embed/movie/{imdb_id}"
        embeds.append({"name": "NontonGo", "url": nontongo_url, "nume": "nontongo"})

    return embeds


def get_anime_details_from_tmdb(imdb_id):
    """
    Checks if an IMDb ID corresponds to an animation/anime on TMDB.
    Returns (is_anime, title)
    """
    if not imdb_id:
        return False, None
    try:
        cfg = load_config()
        api_key = cfg.get("tmdb_api_key", "").strip() or "8265bd1679663a7ea12ac168da84d2e8"
        url = f"https://api.themoviedb.org/3/find/{imdb_id}?api_key={api_key}&external_source=imdb_id"
        res = _get_tmdb_json(url, timeout=5)
        if not res:
            return False, None
        
        # Check movie_results
        for item in res.get("movie_results", []):
            if 16 in item.get("genre_ids", []):
                return True, item.get("title") or item.get("original_title")
        # Check tv_results
        for item in res.get("tv_results", []):
            if 16 in item.get("genre_ids", []):
                return True, item.get("name") or item.get("original_name")
    except Exception as e:
        print(f"[-] get_anime_details_from_tmdb check failed for {imdb_id}: {e}")
    return False, None


def extract_animedekho_embeds(imdb_id, season=None, episode=None, fallback_title=None):
    """
    Scrapes AnimeDekho and HentaiDekho to extract direct player embed URLs.
    Handles bypass for verification gates.
    """
    import http.cookiejar
    import base64
    from concurrent.futures import ThreadPoolExecutor
    
    cfg = load_config()
    
    try:
        s = str(int(season)) if season else "1"
    except ValueError:
        s = str(season or "1")
    try:
        e = str(int(episode)) if episode else "1"
    except ValueError:
        e = str(episode or "1")
        
    title = ""
    is_anime = False
    title_slug = ""
    content_type = "movie"
    try:
        imdb_data = fetch_imdb_data(imdb_id) if imdb_id else None
        if imdb_data:
            genres = str(imdb_data.get("genre", "")).lower()
            if "animation" in genres or "anime" in genres or "hentai" in genres:
                is_anime = True
            title = imdb_data.get("title", "")
            
        if not title and fallback_title:
            title = fallback_title
            is_anime = True
            
        if title:
            s_title = title.lower()
            s_title = re.sub(r'[^a-z0-9\s-]', '', s_title)
            s_title = re.sub(r'[\s-]+', '-', s_title)
            title_slug = s_title.strip('-')
            
        if season or episode or (imdb_data and imdb_data.get("type") in ("series", "tv", "show")):
            content_type = "tv"
    except Exception as err:
        print(f"[-] extract_animedekho_embeds metadata error: {err}")
        return []

    # If we resolved a slug, always allow checking (very useful for adult anime titles not fully categorised)
    if title_slug:
        is_anime = True

    if not is_anime or not title_slug:
        return []

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    def scrape_domain(ad_domain, provider_prefix):
        ad_domain = ad_domain.rstrip("/")
        # Build direct candidate URL
        if content_type == "tv":
            url = f"{ad_domain}/epi/{title_slug}-{s}x{e}/"
        else:
            url = f"{ad_domain}/movie-hindi/{title_slug}/"

        cj = http.cookiejar.CookieJar()
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
        
        def fetch_with_bypass(target_url):
            req = urllib.request.Request(target_url, headers=headers)
            try:
                with opener.open(req, timeout=8) as r:
                    html = r.read().decode("utf-8", errors="ignore")
                
                # Check if we landed on an ad-skip page (new format with vshort.php form)
                if "data-src" not in html and "data-option" not in html:
                    
                    # New bypass: form that POSTs to vshort.php with a shortlink
                    vshort_match = re.search(r'action=["\']([^"\']*vshort\.php)["\']', html)
                    shortlink_match = re.search(r'name=["\']shortlink["\'][^>]*value=["\']([^"\']+)["\']|value=["\']([^"\']+)["\'][^>]*name=["\']shortlink["\']', html)
                    postlink_match = re.search(r'name=["\']postlink["\'][^>]*value=["\']([^"\']+)["\']|value=["\']([^"\']+)["\'][^>]*name=["\']postlink["\']', html)
                    
                    if vshort_match and shortlink_match:
                        vshort_url = vshort_match.group(1)
                        shortlink = shortlink_match.group(1) or shortlink_match.group(2)
                        postlink = (postlink_match.group(1) or postlink_match.group(2)) if postlink_match else target_url
                        
                        if not vshort_url.startswith("http"):
                            vshort_url = ad_domain.rstrip("/") + "/" + vshort_url.lstrip("/")
                        
                        print(f"[{provider_prefix}] Ad-skip bypass: POSTing to {vshort_url}")
                        # POST to vshort.php
                        form_data = urllib.parse.urlencode({
                            "postlink": postlink,
                            "shortlink": shortlink,
                        }).encode("utf-8")
                        try:
                            post_req = urllib.request.Request(
                                vshort_url, 
                                data=form_data,
                                headers={**headers, "Content-Type": "application/x-www-form-urlencoded", "Referer": target_url}
                            )
                            with opener.open(post_req, timeout=8) as r2:
                                bypass_html = r2.read().decode("utf-8", errors="ignore")
                                bypass_final_url = r2.geturl()
                        except Exception as e:
                            print(f"[{provider_prefix}] vshort POST failed: {e}")
                            bypass_html = ""
                            bypass_final_url = ""
                        
                        # Visit the shortlink (verify.php)
                        try:
                            verify_req = urllib.request.Request(shortlink, headers={**headers, "Referer": target_url})
                            with opener.open(verify_req, timeout=8) as r3:
                                pass
                        except Exception:
                            pass
                        
                        # Re-fetch the target page now that cookies are set
                        with opener.open(urllib.request.Request(target_url, headers={**headers, "Referer": shortlink}), timeout=8) as r4:
                            html = r4.read().decode("utf-8", errors="ignore")
                    
                    elif "verify.php" in html:
                        # Old bypass format: verify.php link in a value attribute
                        match = re.search(r'value=["\'](' + re.escape(ad_domain) + r'/24hr/verify\.php\?[^"\']+)["\']', html)
                        if match:
                            shortlink = match.group(1)
                            opener.open(urllib.request.Request(shortlink, headers=headers), timeout=8)
                            with opener.open(urllib.request.Request(target_url, headers=headers), timeout=8) as r2:
                                html = r2.read().decode("utf-8", errors="ignore")

                return html
            except Exception as err:
                print(f"[-] fetch_with_bypass error for {target_url} on {provider_prefix}: {err}")
                return ""


        print(f"[{provider_prefix}] Trying direct URL: {url}")
        target_html = fetch_with_bypass(url)
        
        # If direct URL did not load the player options, try searching
        has_player = "data-src" in target_html or "data-option" in target_html or "bx-lst" in target_html or "serversel" in target_html
        if not has_player:
            print(f"[{provider_prefix}] Direct URL failed. Searching for: {title}")
            clean_q = urllib.parse.quote(title.strip())
            search_url = f"{ad_domain}/?s={clean_q}"
            search_html = fetch_with_bypass(search_url)
            
            # Extract series/movie pages (supporting standard Dooplay slugs: series-hindi, movie-hindi, series, movie, tvshows, anime)
            links = re.findall(r'href=["\'](' + re.escape(ad_domain) + r'/(?:series-hindi|movie-hindi|series|movie|tvshows|anime)/[^"\']+)["\']', search_html)
            links = list(set(links))

            
            # Look for the best link that contains the title slug
            best_link = None
            for link in links:
                if title_slug in link.lower():
                    best_link = link
                    break
            if not best_link and links:
                best_link = links[0]
                
            if best_link:
                print(f"[{provider_prefix}] Resolved series/movie link: {best_link}")
                if content_type == "tv":
                    # Need to fetch the series page to get episode page
                    series_html = fetch_with_bypass(best_link)
                    ep_pattern = f"-{s}x{e}/"
                    episodes = re.findall(r'href=["\'](' + re.escape(ad_domain) + r'/(?:epi|episodes)/[^"\']+)["\']', series_html)
                    episodes = list(set(episodes))
                    
                    resolved_url = None
                    for ep in episodes:
                        if ep_pattern in ep:
                            resolved_url = ep
                            break
                    if not resolved_url:
                        for ep in episodes:
                            if f"x{e}" in ep or f"-episode-{e}" in ep:
                                resolved_url = ep
                                break
                    if not resolved_url and episodes:
                        resolved_url = episodes[0]
                        
                    if resolved_url:
                        print(f"[{provider_prefix}] Resolved episode page: {resolved_url}")
                        target_html = fetch_with_bypass(resolved_url)
                else:
                    # Movie
                    target_html = fetch_with_bypass(best_link)

        # Now extract players from target_html
        # New format: <a data-option data-src="base64url"> or similar data-option elements
        links = re.findall(r'data-src=["\']([^"\']+)["\']', target_html)
        # Also try data-link attribute (used by some Dooplay variants)
        if not links:
            links = re.findall(r'data-link=["\']([^"\']+)["\']', target_html)
        server_names = re.findall(r'class=["\']num["\']>([^<]+)<', target_html)
        # Alternative: get server names from the option buttons text content
        if not server_names:
            server_names = re.findall(r'data-option[^>]*>\s*([^<]{1,50})\s*<', target_html)
        
        print(f"[{provider_prefix}] Found {len(links)} player link(s)")
        if not links:
            print(f"[{provider_prefix}] No player server links found.")
            return []

            
        domain_embeds = []
        
        def resolve_server_iframe(idx, link):
            try:
                decoded = base64.b64decode(link).decode('utf-8', errors='ignore')
                name = server_names[idx] if idx < len(server_names) else f"Server {idx + 1}"
                
                # Fetch srv url to follow redirect and extract iframe
                req_srv = urllib.request.Request(decoded, headers=headers)
                with opener.open(req_srv, timeout=6) as r_srv:
                    final_url = r_srv.geturl()
                    srv_html = r_srv.read().decode("utf-8", errors="ignore")
                    
                ifr_match = re.search(r'<iframe[^>]*src=["\']([^"\']+)["\']', srv_html, re.IGNORECASE)
                if ifr_match:
                    iframe_url = ifr_match.group(1)
                else:
                    iframe_url = final_url
                    
                # Clean iframe url if needed (e.g. check scheme)
                if iframe_url.startswith("//"):
                    iframe_url = "https:" + iframe_url
                    
                return {"name": name, "url": iframe_url, "source": provider_prefix}
            except Exception as err:
                print(f"[-] Error resolving {provider_prefix} server {idx}: {err}")
                return None

        # Resolve in parallel using thread pool
        with ThreadPoolExecutor(max_workers=8) as ex:
            futures = [ex.submit(resolve_server_iframe, idx, link) for idx, link in enumerate(links)]
            for fut in futures:
                res = fut.result()
                if res:
                    domain_embeds.append(res)
                    
        return domain_embeds

    # Scrape both domains concurrently in parallel
    results = []
    ad_url = cfg.get("animedekho_domain", "https://animedekho.app")
    
    with ThreadPoolExecutor(max_workers=2) as main_ex:
        scrape_futures = [
            main_ex.submit(scrape_domain, ad_url, "AnimeDekho"),
            main_ex.submit(scrape_domain, "https://hentaidekho.com", "HentaiDekho")
        ]
        for fut in scrape_futures:
            try:
                res = fut.result()
                if res:
                    results.extend(res)
            except Exception as err:
                print(f"[-] Scrape domain task failed: {err}")
                
    return results

def format_embed_name(url):
    domain_match = re.search(r'https?://([^/]+)', url)
    if not domain_match:
        return "External Server"
    domain = domain_match.group(1).lower()
    if domain.startswith("www."):
        domain = domain[4:]
    if "gdmirrorbot" in domain:
        return "GD Mirror"
    if "vibuxer" in domain or "modiplay" in domain:
        return "Vibuxer"
    if "vidcore" in domain:
        return "VidCore"
    if "embedmaster" in domain:
        return "EmbedMaster"
    if "vidnest" in domain:
        return "VidNest"
    if "vidfast" in domain:
        return "VidFast"
    if "vidsrc-embed" in domain:
        return "VidSrc (RU)"
    if "vidify" in domain:
        return "Vidify"
    if "peachify" in domain:
        return "Peachify"
    if "screenscape" in domain:
        return "Screenscape"
    if "nxsha" in domain:
        return "Nxsha Player"
    if "nhdapi" in domain:
        return "NHD Player"
    if "cinemaos" in domain:
        return "CinemaOS"
    if "vidzee" in domain:
        return "Vidzee Embed"
    if "animedekho" in domain:
        return "AnimeDekho"
    if "vidking" in domain:
        return "VidKing"
    if "vidplay" in domain:
        return "VidPlay"
    if "smashy" in domain:
        return "Smashy"
    if "vidup" in domain:
        return "VidUp"
    if "vidlink" in domain:
        return "VidLink"
    if "vidmov" in domain:
        return "Vidmov"
    if "vidfyi" in domain:
        return "Vidfyi"
    if "vidrock" in domain:
        return "Vidrock"
    if "movies111" in domain:
        return "Movies111"
    if "nontongo" in domain:
        return "NontonGo"
    if "hyperlink" in domain:
        return "Hyperlink"
    if "ultrabox" in domain:
        return "Ultrabox"
    if "cloudbox" in domain:
        return "Cloudbox"
    if "upcloud" in domain:
        return "Upcloud"
    if "streamvault" in domain:
        return "StreamVault"
    if "mediahub" in domain:
        return "Mediahub"
    if "cloudplay" in domain:
        return "Cloudplay"
    if "streamboxhd" in domain or "autoembed" in domain:
        return "StreamBoxHD"
    if "movievault" in domain:
        return "MovieVault"
    return domain.split('.')[0].capitalize()

def clean_segment(data):
    if not data or len(data) < 4:
        return data
    # Standard MPEG-TS starts with 0x47 sync byte
    if data[0] == 0x47:
        return data
    # Look for the sync byte 0x47
    for offset in range(min(1024, len(data))):
        if data[offset] == 0x47:
            # Validate interval (188 bytes) to ensure it's not a random byte
            is_valid = True
            for i in range(1, 4):
                cp = offset + 188 * i
                if cp < len(data) and data[cp] != 0x47:
                    is_valid = False
                    break
            if is_valid:
                return data[offset:]
    return data


def ping_server(srv):
    """Returns (ping_ms, srv). Lower is faster. Returns (-1, srv) if offline."""
    import socket
    import time as _time
    import urllib.parse
    import urllib.request

    if srv.get("is_iframe"):
        test_url = srv.get("embed_url", "")
    else:
        streams = srv.get("streams", [])
        test_url = streams[0].get("url", "") if streams else ""

    if not test_url:
        return (-1, srv)

    try:
        parsed = urllib.parse.urlparse(test_url)
        hostname = parsed.hostname
        if not hostname:
            return (-1, srv)
        
        try:
            ip = socket.gethostbyname(hostname)
        except socket.gaierror:
            return (-1, srv)
        
        port = 443 if parsed.scheme == "https" else 80
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1.5)
        try:
            s.connect((ip, port))
            s.close()
        except Exception:
            return (-1, srv)
    except Exception:
        return (-1, srv)

    iframe_penalty = 500 if srv.get("is_iframe") else 0

    try:
        t0 = _time.monotonic()
        req = urllib.request.Request(
            test_url,
            headers={"User-Agent": "Mozilla/5.0", "Range": "bytes=0-0"},
            method="HEAD"
        )
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=2.0):
            pass
        ms = int((_time.monotonic() - t0) * 1000) + iframe_penalty
        return (ms, srv)
    except Exception:
        try:
            t0 = _time.monotonic()
            req2 = urllib.request.Request(test_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req2, context=ssl_ctx, timeout=1.2) as r:
                r.read(64)
            ms = int((_time.monotonic() - t0) * 1000) + iframe_penalty
            return (ms, srv)
        except Exception:
            return (9000 + iframe_penalty, srv)


def get_multimovies_embeds(post_id, season="1", episode="1", content_type="movie"):
    """
    Fetches embed players from Dooplay's admin-ajax.php for Multimovies.
    """
    import json
    import re
    import urllib.parse
    import urllib.request
    from concurrent.futures import ThreadPoolExecutor
    cfg = load_config()
    source_domain = cfg.get("source_domain", "https://multimovies.makeup").rstrip("/")
    ajax_url = f"{source_domain}/wp-admin/admin-ajax.php"
    
    embeds = []
    
    def fetch_nume(nume):
        data_dict = {
            "action": "doo_player_ajax",
            "post": str(post_id),
            "nume": str(nume),
            "type": content_type
        }
        data_encoded = urllib.parse.urlencode(data_dict).encode("utf-8")
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        req = urllib.request.Request(ajax_url, data=data_encoded, headers=headers)
        try:
            with urllib.request.urlopen(req, context=ssl_ctx, timeout=3.5) as r:
                res = json.loads(r.read().decode("utf-8"))
            if "embed_url" in res:
                embed_raw = res["embed_url"]
                if "<iframe" in embed_raw.lower():
                    src_match = re.search(r'src=["\']([^"\']+)["\']', embed_raw, re.IGNORECASE)
                    embed_url = src_match.group(1) if src_match else embed_raw
                else:
                    embed_url = embed_raw
                
                embed_url = embed_url.strip()
                if embed_url:
                    name = format_embed_name(embed_url)
                    return {
                        "server": f"iframe-multimovies-{nume}",
                        "name": f"Multimovies - {name}",
                        "is_iframe": True,
                        "embed_url": embed_url,
                        "streams": [{
                            "quality": "Embed Player",
                            "language": "Multi",
                            "url": embed_url
                        }]
                    }
        except Exception:
            pass
        return None

    with ThreadPoolExecutor(max_workers=10) as ex:
        futures = [ex.submit(fetch_nume, nume) for nume in range(1, 11)]
        for fut in futures:
            res = fut.result()
            if res:
                embeds.append(res)
                
    return embeds


import asyncio
from fastapi import FastAPI, Request, Response, HTTPException, Cookie, Query, Depends, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
import httpx
import urllib.parse
from urllib.parse import urljoin

app = FastAPI(docs_url=None, redoc_url=None)

# IP Blacklist / Ban Middleware
@app.middleware("http")
async def ban_check_middleware(request: Request, call_next):
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "127.0.0.1"

    if ip == "127.0.0.1":
        return await call_next(request)

    if ip in BANNED_IPS:
        admin_session = request.cookies.get("admin_session_token")
        if admin_session and verify_signed_admin_session(admin_session):
            return await call_next(request)

        return Response(
            "Access Denied: Your IP has been blacklisted by administrator security protocol.",
            status_code=403,
            media_type="text/plain"
        )

    return await call_next(request)

# Global httpx AsyncClient for reused connections
async_client = httpx.AsyncClient(verify=False, timeout=30.0)

@app.on_event("shutdown")
async def shutdown_event():
    await async_client.aclose()

# CORS & Cache-Control Middleware (ASGI class to avoid BaseHTTPMiddleware bugs on StreamingResponse)
class CORSCacheMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "GET")
        headers_dict = {k.lower(): v for k, v in scope.get("headers", [])}
        origin_bytes = headers_dict.get(b"origin")

        if method == "OPTIONS":
            origin = origin_bytes.decode("latin-1") if origin_bytes else None
            headers = []
            if origin and (origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:")):
                headers.append((b"access-control-allow-origin", origin.encode("latin-1")))
                headers.append((b"access-control-allow-credentials", b"true"))
            else:
                headers.append((b"access-control-allow-origin", b"http://localhost:8000"))
                
            headers.append((b"access-control-allow-methods", b"GET, POST, OPTIONS"))
            headers.append((b"access-control-allow-headers", b"*"))
            headers.append((b"cache-control", b"no-cache, no-store, must-revalidate"))
            headers.append((b"pragma", b"no-cache"))
            headers.append((b"expires", b"0"))
            
            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": headers
            })
            await send({
                "type": "http.response.body",
                "body": b"",
                "more_body": False
            })
            return

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                
                has_origin = any(h[0].lower() == b"access-control-allow-origin" for h in headers)
                has_cache = any(h[0].lower() == b"cache-control" for h in headers)
                
                if not has_origin:
                    origin = origin_bytes.decode("latin-1") if origin_bytes else None
                    if origin and (origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:")):
                        headers.append((b"access-control-allow-origin", origin.encode("latin-1")))
                        headers.append((b"access-control-allow-credentials", b"true"))
                    else:
                        headers.append((b"access-control-allow-origin", b"http://localhost:8000"))
                        
                    headers.append((b"access-control-allow-methods", b"GET, POST, OPTIONS"))
                    headers.append((b"access-control-allow-headers", b"*"))

                if not has_cache:
                    headers.append((b"cache-control", b"no-cache, no-store, must-revalidate"))
                    headers.append((b"pragma", b"no-cache"))
                    headers.append((b"expires", b"0"))
                
                message["headers"] = headers
                
            await send(message)

        await self.app(scope, receive, send_wrapper)

app.add_middleware(CORSCacheMiddleware)

# Security/Session Verification Dependency
def verify_api_session(request: Request, session_token: str = Cookie(None)):
    print(f"[*] verify_api_session: origin={request.headers.get('origin')}, referer={request.headers.get('referer')}, session_token={session_token}, cookies={request.cookies}")
    request_host = request.url.netloc

    # 1. Verify Origin header if present
    origin = request.headers.get("origin")
    if origin:
        origin_clean = origin.replace("https://", "").replace("http://", "")
        if not (origin_clean.startswith("localhost:") or origin_clean.startswith("127.0.0.1:") or origin_clean.startswith(request_host)):
            print("[-] verify_api_session failed: origin check")
            raise HTTPException(status_code=403, detail="Forbidden Origin")

    # 2. Verify Referer header if present
    referer = request.headers.get("referer")
    if referer:
        ref_clean = referer.replace("https://", "").replace("http://", "")
        if not (ref_clean.startswith("localhost:") or ref_clean.startswith("127.0.0.1:") or ref_clean.startswith(request_host)):
            print("[-] verify_api_session failed: referer check")
            raise HTTPException(status_code=403, detail="Forbidden Referer")

    # 3. Verify Session Cookie
    if not session_token or not verify_signed_session(session_token):
        print(f"[-] verify_api_session failed: session token check (valid={verify_signed_session(session_token) if session_token else False})")
        raise HTTPException(status_code=403, detail="Forbidden Session")

def verify_admin_session(request: Request, admin_session_token: str = Cookie(None)):
    request_host = request.url.netloc

    # 1. Verify Origin header if present
    origin = request.headers.get("origin")
    if origin:
        origin_clean = origin.replace("https://", "").replace("http://", "")
        if not (origin_clean.startswith("localhost:") or origin_clean.startswith("127.0.0.1:") or origin_clean.startswith(request_host)):
            print("[-] verify_admin_session failed: origin check")
            raise HTTPException(status_code=403, detail="Forbidden Origin")

    # 2. Verify Referer header if present
    referer = request.headers.get("referer")
    if referer:
        ref_clean = referer.replace("https://", "").replace("http://", "")
        if not (ref_clean.startswith("localhost:") or ref_clean.startswith("127.0.0.1:") or ref_clean.startswith(request_host)):
            print("[-] verify_admin_session failed: referer check")
            raise HTTPException(status_code=403, detail="Forbidden Referer")

    # 3. Verify Session Cookie
    if not admin_session_token or not verify_signed_admin_session(admin_session_token):
        print("[-] verify_admin_session failed: admin session token check")
        raise HTTPException(status_code=401, detail="Forbidden Admin Session")

# Admin Login API
@app.post("/api/admin/login")
async def api_admin_login(request: Request, response: Response):
    try:
        body = await request.json()
        username = body.get("username")
        password = body.get("password")
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            token = generate_signed_admin_session()
            response.set_cookie(
                key="admin_session_token",
                value=token,
                path="/",
                httponly=True,
                samesite="strict"
            )
            return {"ok": True}
        else:
            raise HTTPException(status_code=401, detail="Invalid admin credentials")
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Login request failed: {e}")

# Admin Logout API
@app.post("/api/admin/logout")
def api_admin_logout(response: Response):
    response.delete_cookie(key="admin_session_token", path="/")
    return {"ok": True}

# Admin Status API
@app.get("/api/admin/status")
def api_admin_status(admin_session_token: str = Cookie(None)):
    if admin_session_token and verify_signed_admin_session(admin_session_token):
        return {
            "authenticated": True,
            "username": ADMIN_USERNAME,
            "is_default": (ADMIN_USERNAME == "admin" and ADMIN_PASSWORD == "admin")
        }
    return {"authenticated": False}

# Report user playback activity / heartbeat
@app.post("/api/analytics/activity", dependencies=[Depends(verify_api_session)])
async def api_report_activity(request: Request):
    try:
        body = await request.body()
        data = json.loads(body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request body")
        
    session_token = request.cookies.get("session_token", "unknown")
    
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "127.0.0.1"

    user_agent = request.headers.get("user-agent", "Unknown")
    
    ACTIVE_SESSIONS[session_token] = {
        "ip": ip,
        "user_agent": user_agent,
        "title": data.get("title", "Unknown"),
        "type": data.get("type", "movie"),
        "season": data.get("season"),
        "episode": data.get("episode"),
        "server_name": data.get("server_name"),
        "server_type": data.get("server_type"),
        "adblocker": bool(data.get("adblocker", False)),
        "last_seen": time.time()
    }
    return {"ok": True}

# Get list of live active stream sessions (Admin only)
@app.get("/api/admin/active_sessions", dependencies=[Depends(verify_admin_session)])
def api_get_active_sessions():
    now = time.time()
    stale_keys = [k for k, v in ACTIVE_SESSIONS.items() if now - v["last_seen"] > 25]
    for k in stale_keys:
        ACTIVE_SESSIONS.pop(k, None)
        
    sessions_list = []
    for k, v in ACTIVE_SESSIONS.items():
        sessions_list.append({
            "ip": v["ip"],
            "user_agent": v["user_agent"],
            "title": v["title"],
            "type": v["type"],
            "season": v["season"],
            "episode": v["episode"],
            "server_name": v["server_name"],
            "server_type": v["server_type"],
            "adblocker": v["adblocker"],
            "active_seconds_ago": int(now - v["last_seen"])
        })
    sessions_list.sort(key=lambda s: s["active_seconds_ago"])
    return sessions_list

# Admin Stats API
@app.get("/api/admin/stats", dependencies=[Depends(verify_admin_session)])
def api_admin_stats():
    import os
    import sys
    import platform
    
    # Calculate Uptime
    uptime_sec = int(time.time() - START_TIME)
    days = uptime_sec // 86400
    hours = (uptime_sec % 86400) // 3600
    minutes = (uptime_sec % 3600) // 60
    seconds = uptime_sec % 60
    uptime_str = f"{days}d {hours}h {minutes}m {seconds}s"
    
    # Memory Info (psutil)
    memory_info = {}
    try:
        import psutil
        mem = psutil.virtual_memory()
        memory_info["total"] = f"{mem.total / (1024**3):.2f} GB"
        memory_info["available"] = f"{mem.available / (1024**3):.2f} GB"
        memory_info["percent"] = f"{mem.percent}%"
        # Process Memory
        process = psutil.Process(os.getpid())
        memory_info["process"] = f"{process.memory_info().rss / (1024**2):.2f} MB"
    except Exception:
        memory_info["total"] = "N/A (psutil not installed)"
        memory_info["available"] = "N/A"
        memory_info["percent"] = "N/A"
        memory_info["process"] = "N/A"

    # Mask sensitive environment variables
    masked_env = {}
    for k, v in os.environ.items():
        if any(x in k.upper() for x in ("KEY", "SECRET", "PASSWORD", "TOKEN", "AUTH", "PASS")):
            masked_env[k] = "********"
        else:
            masked_env[k] = v

    return {
        "platform": platform.platform(),
        "python_version": sys.version.split()[0],
        "cpu_count": os.cpu_count(),
        "pid": os.getpid(),
        "uptime": uptime_str,
        "memory": memory_info,
        "env_vars": masked_env,
        "is_default_admin": (ADMIN_USERNAME == "admin" and ADMIN_PASSWORD == "admin"),
        "total_visitors": len(UNIQUE_VISITORS)
    }

# Admin Logs API
@app.get("/api/admin/logs", dependencies=[Depends(verify_admin_session)])
def api_admin_logs():
    import sys
    if hasattr(sys.stdout, "buffer"):
        return list(sys.stdout.buffer)
    return ["[-] Log capture not active or buffer missing"]

# Admin Rebuild JS API
@app.post("/api/admin/rebuild_js", dependencies=[Depends(verify_admin_session)])
def api_admin_rebuild_js():
    import subprocess
    import os
    import sys
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    obf_path = os.path.join(base_dir, "obfuscator.py")
    if not os.path.exists(obf_path):
        raise HTTPException(status_code=404, detail="obfuscator.py not found in project root")
        
    try:
        res = subprocess.run([sys.executable, obf_path], capture_output=True, text=True, check=True)
        return {
            "ok": True,
            "stdout": res.stdout,
            "stderr": res.stderr
        }
    except Exception as e:
        err_msg = str(e)
        if hasattr(e, "stderr") and e.stderr:
            err_msg += "\n" + e.stderr
        raise HTTPException(status_code=500, detail=f"Obfuscation failed: {err_msg}")

# 0a. Homepage data
@app.get("/api/homepage", dependencies=[Depends(verify_api_session)])
def api_homepage():
    try:
        data = scrape_homepage()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Homepage scrape failed: {e}")

# Upcoming titles
@app.get("/api/upcoming", dependencies=[Depends(verify_api_session)])
def api_upcoming():
    try:
        cfg = load_config()
        api_key = cfg.get("tmdb_api_key", "").strip() or "8265bd1679663a7ea12ac168da84d2e8"
        import datetime
        today = datetime.date.today()
        today_str = today.strftime("%Y-%m-%d")
        
        endpoints = {
            "movie-upcoming": f"https://api.themoviedb.org/3/movie/upcoming?api_key={api_key}&page=1",
            "tv-upcoming": f"https://api.themoviedb.org/3/discover/tv?api_key={api_key}&first_air_date.gte={today_str}&sort_by=first_air_date.asc&page=1",
            "anime-upcoming": f"https://api.themoviedb.org/3/discover/tv?api_key={api_key}&with_genres=16&with_original_language=ja&first_air_date.gte={today_str}&sort_by=first_air_date.asc&page=1"
        }
        
        responses = {}
        for key, url in endpoints.items():
            key, val = fetch_url(key, url)
            if val is not None:
                responses[key] = val
        
        def map_upcoming(items, default_type):
            cards = []
            for item in items:
                is_tv = default_type in ("tv", "anime")
                title = item.get("name") if is_tv else item.get("title")
                if not title:
                    title = item.get("original_name") if is_tv else item.get("original_title")
                
                poster_path = item.get("poster_path")
                poster = f"https://image.tmdb.org/t/p/w342{poster_path}" if poster_path else ""
                
                backdrop_path = item.get("backdrop_path")
                backdrop = f"https://image.tmdb.org/t/p/w1280{backdrop_path}" if backdrop_path else poster
                
                rel_date = item.get("first_air_date") if is_tv else item.get("release_date")
                year = (rel_date or "")[:4]
                
                if not rel_date:
                    continue
                    
                try:
                    item_date = datetime.datetime.strptime(rel_date, "%Y-%m-%d").date()
                    if item_date < today:
                        continue
                except Exception:
                    continue
                    
                cards.append({
                    "title": title or "Untitled",
                    "url": "",
                    "tmdb_id": str(item.get("id")),
                    "poster": poster,
                    "backdrop": backdrop,
                    "description": item.get("overview", ""),
                    "rating": str(item.get("vote_average", ""))[:3] if item.get("vote_average") else "",
                    "year": year,
                    "release_date": rel_date,
                    "quality": "HD",
                    "type": default_type,
                    "item_type": "Anime" if default_type == "anime" else ("Series" if is_tv else "Movie"),
                    "is_upcoming": True
                })
            return cards
        
        movie_list = map_upcoming(responses.get("movie-upcoming", {}).get("results", []), "movie")
        tv_list = map_upcoming(responses.get("tv-upcoming", {}).get("results", []), "tv")
        anime_list = map_upcoming(responses.get("anime-upcoming", {}).get("results", []), "anime")
        
        if not movie_list:
            movie_list = [
                {
                    "title": "Avatar: Fire and Ash",
                    "url": "",
                    "tmdb_id": "83533",
                    "poster": "https://image.tmdb.org/t/p/w342/j8S2p8Eub28i1FepwE3l0vjT37G.jpg",
                    "backdrop": "https://image.tmdb.org/t/p/w1280/8Z8QzM0jW5T2F9s6x1yQ37G.jpg",
                    "description": "The third installment of James Cameron's Avatar franchise, exploring the ash people of Pandora.",
                    "rating": "8.5",
                    "year": "2026",
                    "release_date": "2026-12-18",
                    "quality": "HD",
                    "type": "movie",
                    "item_type": "Movie",
                    "is_upcoming": True
                },
                {
                    "title": "The Batman Part II",
                    "url": "",
                    "tmdb_id": "1132612",
                    "poster": "https://image.tmdb.org/t/p/w342/v4yVT755k5J4F16V3oX3O8K0.jpg",
                    "backdrop": "https://image.tmdb.org/t/p/w1280/p4yVT755k5J4F16V3oX3O8K0.jpg",
                    "description": "Robert Pattinson returns as the Dark Knight in Matt Reeves' gritty superhero sequel.",
                    "rating": "9.0",
                    "year": "2026",
                    "release_date": "2026-10-02",
                    "quality": "HD",
                    "type": "movie",
                    "item_type": "Movie",
                    "is_upcoming": True
                }
            ]
        if not tv_list:
            tv_list = [
                {
                    "title": "Stranger Things (Season 5)",
                    "url": "",
                    "tmdb_id": "66732",
                    "poster": "https://image.tmdb.org/t/p/w342/txv72vY4sV1mJ2fIqV6qK6Xq2f9.jpg",
                    "backdrop": "https://image.tmdb.org/t/p/w1280/56v2Kj2qLz3278vXEZgnrgo455V.jpg",
                    "description": "The final season of the Netflix hit series, bringing the battle with Vecna to its epic conclusion.",
                    "rating": "8.9",
                    "year": "2026",
                    "release_date": "2026-11-15",
                    "quality": "HD",
                    "type": "tv",
                    "item_type": "Series",
                    "is_upcoming": True
                }
            ]
        if not anime_list:
            anime_list = [
                {
                    "title": "Solo Leveling (Season 2)",
                    "url": "",
                    "tmdb_id": "119864",
                    "poster": "https://image.tmdb.org/t/p/w342/o5n8bH4nS9e1xTirfDGlqC3XG96.jpg",
                    "backdrop": "https://image.tmdb.org/t/p/w1280/o5n8bH4nS9e1xTirfDGlqC3XG96.jpg",
                    "description": "Sung Jinwoo returns to face even greater dungeons and shadows in the second season.",
                    "rating": "8.8",
                    "year": "2026",
                    "release_date": "2026-10-08",
                    "quality": "HD",
                    "type": "anime",
                    "item_type": "Anime",
                    "is_upcoming": True
                }
            ]
        
        return {
            "movies": movie_list,
            "tv": tv_list,
            "anime": anime_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upcoming fetch failed: {e}")

# Movie Sections
@app.get("/api/movie_sections", dependencies=[Depends(verify_api_session)])
def api_movie_sections():
    try:
        return scrape_movies_sections()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Movie sections fetch failed: {e}")

# TV Sections
@app.get("/api/tv_sections", dependencies=[Depends(verify_api_session)])
def api_tv_sections():
    try:
        return scrape_series_sections()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TV sections fetch failed: {e}")

# Anime Sections
@app.get("/api/anime_sections", dependencies=[Depends(verify_api_session)])
def api_anime_sections():
    try:
        return scrape_anime_sections()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anime sections fetch failed: {e}")

# Genres
@app.get("/api/genres", dependencies=[Depends(verify_api_session)])
def api_genres(
    genre_id: str = Query(None),
    type: str = Query("all"),
    sort_by: str = Query("popularity.desc"),
    page: int = Query(1)
):
    valid_sorts = [
        "popularity.desc",
        "vote_average.desc",
        "primary_release_date.desc",
        "first_air_date.desc",
        "revenue.desc",
    ]
    if sort_by not in valid_sorts:
        sort_by = "popularity.desc"
    try:
        return get_genres_page(type, genre_id, sort_by, page=page)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Genres fetch failed: {e}")

# Provider details
@app.get("/api/provider", dependencies=[Depends(verify_api_session)])
def api_provider(
    id: str = Query(None),
    name: str = Query("Provider"),
    page: int = Query(1)
):
    if not id:
        raise HTTPException(status_code=400, detail="Missing id parameter")
    try:
        items, total_pages = fetch_provider_content(id, page=page)
        return {
            "title": f"Popular on {name}",
            "items": items,
            "page": page,
            "total_pages": total_pages,
            "has_more": page < total_pages
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Provider fetch failed: {e}")

# Provider logos
@app.get("/api/providers", dependencies=[Depends(verify_api_session)])
def api_providers():
    try:
        return fetch_provider_logos()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Provider logos fetch failed: {e}")

# Movie/TV/Anime Search
@app.get("/api/search", dependencies=[Depends(verify_api_session)])
def api_search(q: str = Query(None)):
    if not q:
        raise HTTPException(status_code=400, detail="Missing q parameter")

    clean_q = urllib.parse.quote(q.strip())
    results = []
    
    cfg = load_config()
    api_key = cfg.get("tmdb_api_key", "").strip() or "8265bd1679663a7ea12ac168da84d2e8"
        
    success = False
    try:
        search_url = f"https://api.themoviedb.org/3/search/multi?api_key={api_key}&query={clean_q}&include_adult=false"
        items_raw, _ = _fetch_multi_pages_tmdb(search_url, pages_count=10, start_page=1)
        if items_raw:
            for item in items_raw:
                media_type = item.get("media_type")
                if media_type not in ("movie", "tv"):
                    continue
                    
                is_tv = media_type == "tv"
                title = item.get("name") if is_tv else item.get("title")
                if not title:
                    title = item.get("original_name") if is_tv else item.get("original_title")
                    
                poster_path = item.get("poster_path")
                poster = f"https://image.tmdb.org/t/p/w342{poster_path}" if poster_path else ""
                
                year = (item.get("first_air_date") or "")[:4] if is_tv else (item.get("release_date") or "")[:4]
                
                tid = str(item.get("id"))
                if tid in TMDB_ID_MAP:
                    tid = TMDB_ID_MAP[tid]
                results.append({
                    "title": title or "Untitled",
                    "url": "",
                    "tmdb_id": tid,
                    "poster": poster,
                    "year": year,
                    "rating": str(item.get("vote_average", ""))[:3] if item.get("vote_average") else "",
                    "synopsis": item.get("overview", ""),
                    "type": media_type
                })
            success = True
    except Exception as e:
        print(f"[-] TMDB multi-search failed for query '{q}': {e}. Falling back to YTS & TVmaze.")

    # Fallback if TMDB is offline or returned nothing
    if not success or not results:
        # 1. YTS Movie Search
        try:
            yts_url = f"https://yts.mx/api/v2/list_movies.json?query_term={urllib.parse.quote(q.strip())}&limit=15"
            raw = _fetch(yts_url, timeout=3.0)
            d = json.loads(raw)
            if d.get("status") == "ok" and d.get("data", {}).get("movies"):
                for movie in d["data"]["movies"]:
                    imdb_id = movie.get("imdb_code")
                    if imdb_id:
                        results.append({
                            "title": movie.get("title", ""),
                            "url": "",
                            "poster": movie.get("large_cover_image") or movie.get("medium_cover_image") or "",
                            "year": str(movie.get("year", "")),
                            "rating": str(movie.get("rating", "")),
                            "synopsis": movie.get("synopsis", ""),
                            "type": "movie",
                            "imdb_id": imdb_id
                        })
        except Exception as e:
            print(f"[-] YTS fallback search error: {e}")

        # 2. TVmaze TV Show Search
        try:
            tvmaze_url = f"https://api.tvmaze.com/search/shows?q={urllib.parse.quote(q.strip())}"
            raw = _fetch(tvmaze_url, timeout=3.0)
            d = json.loads(raw)
            for item in d:
                show = item.get("show", {})
                imdb_id = show.get("externals", {}).get("imdb")
                if imdb_id:
                    summary = show.get("summary") or ""
                    summary = re.sub(r'<[^>]+>', '', summary).strip()
                    results.append({
                        "title": show.get("name", ""),
                        "url": "",
                        "poster": show.get("image", {}).get("original") or show.get("image", {}).get("medium") or "",
                        "year": (show.get("premiered") or "")[:4],
                        "rating": str(show.get("rating", {}).get("average") or ""),
                        "synopsis": summary,
                        "type": "tv",
                        "imdb_id": imdb_id
                    })
        except Exception as e:
            print(f"[-] TVmaze fallback search error: {e}")

    return {"results": results}

# IMDB Metadata
@app.get("/api/imdb", dependencies=[Depends(verify_api_session)])
def api_imdb(
    id: str = Query(None),
    url: str = Query(None),
    title: str = Query(None),
    year: str = Query(None),
    type: str = Query("movie"),
    tmdb_id: str = Query(None)
):
    if tmdb_id in TMDB_ID_MAP:
        tmdb_id = TMDB_ID_MAP[tmdb_id]

    if type in ("series", "show", "tv", "tvshows", "anime", "anime_tv"):
        content_type = "tv"
    elif type == "anime_movie":
        content_type = "movie"
    else:
        content_type = "movie"

    try:
        data = None
        if tmdb_id:
            cfg = load_config()
            api_key = cfg.get("tmdb_api_key", "").strip() or "8265bd1679663a7ea12ac168da84d2e8"
            
            try:
                credits_append = "aggregate_credits" if content_type == "tv" else "credits"
                details_url = f"https://api.themoviedb.org/3/{content_type}/{tmdb_id}?api_key={api_key}&append_to_response=external_ids,{credits_append}"
                details = _get_tmdb_json(details_url, timeout=5)
                if not details:
                    raise Exception("Failed to fetch TMDB details")
                
                imdb_id_res = details.get("external_ids", {}).get("imdb_id") or details.get("imdb_id") or ""
                genres = ", ".join([g["name"] for g in details.get("genres", [])])
                
                if content_type == "tv":
                    runtimes = details.get("episode_run_time", [])
                    runtime = f"{runtimes[0]} min" if runtimes else ""
                    year_val = (details.get("first_air_date") or "")[:4]
                    title_val = details.get("name")
                    seasons_count = details.get("number_of_seasons")
                else:
                    rt = details.get("runtime")
                    runtime = f"{rt} min" if rt else ""
                    year_val = (details.get("release_date") or "")[:4]
                    title_val = details.get("title")
                    seasons_count = None
                
                cast_list = []
                raw_cast = details.get("aggregate_credits", {}).get("cast", []) if content_type == "tv" else details.get("credits", {}).get("cast", [])
                for c in raw_cast[:12]:
                    character = ""
                    if content_type == "tv":
                        roles = c.get("roles", [])
                        if roles:
                            character = roles[0].get("character") or ""
                    else:
                        character = c.get("character") or ""

                    cast_list.append({
                        "name": c.get("name") or "",
                        "character": character,
                        "profile_path": f"https://image.tmdb.org/t/p/w185{c.get('profile_path')}" if c.get('profile_path') else ""
                    })
                
                if "Animation" in genres:
                    anilist_cast = fetch_anilist_cast(title_val)
                    if anilist_cast:
                        cast_list = anilist_cast

                data = {
                    "title": title_val or "",
                    "year": year_val or "",
                    "rating": str(details.get("vote_average", ""))[:3] if details.get("vote_average") else "",
                    "plot": details.get("overview", ""),
                    "genre": genres,
                    "runtime": runtime,
                    "poster": f"https://image.tmdb.org/t/p/w500{details.get('poster_path')}" if details.get('poster_path') else "",
                    "backdrop": f"https://image.tmdb.org/t/p/w1280{details.get('backdrop_path')}" if details.get('backdrop_path') else "",
                    "type": "series" if content_type == "tv" else "movie",
                    "seasons_count": seasons_count,
                    "votes": str(details.get("vote_count", "")),
                    "cast": cast_list
                }
                
                if imdb_id_res:
                    _tmdb_cache[imdb_id_res] = tmdb_id
                    _tmdb_details_cache[f"{imdb_id_res}|{content_type}"] = data
                _tmdb_details_cache[f"{tmdb_id}|{content_type}"] = data
                id = imdb_id_res or id
            except Exception as details_err:
                print(f"[-] TMDB lookup from tmdb_id failed: {details_err}")

        if not data and not id:
            if title:
                id = search_imdb_by_title(title, content_type, year)
            
            if not id and url:
                try:
                    headers = {"User-Agent": "Mozilla/5.0"}
                    req = urllib.request.Request(url, headers=headers)
                    with urllib.request.urlopen(req, context=ssl_ctx, timeout=6) as response:
                        page_html = response.read().decode("utf-8", errors="ignore")
                    imdb_match = re.search(r'tt\d{7,8}', page_html)
                    if imdb_match:
                        id = imdb_match.group(0)
                except Exception as scrape_err:
                    print(f"[-] Scrape IMDb ID from detail URL failed: {scrape_err}")

        if not data:
            if id:
                data = fetch_tmdb_data(id, content_type)
                if not data:
                    data = fetch_imdb_data(id)
            else:
                if title:
                    data = {
                        "title": title,
                        "year": year or "",
                        "rating": "",
                        "plot": "",
                        "genre": "",
                        "runtime": "",
                        "type": content_type
                    }

        if data:
            data["imdb_id"] = id or ""

        return data or {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"IMDB fetch/resolve failed: {e}")

# Read config
@app.get("/api/config", dependencies=[Depends(verify_admin_session)])
def api_get_config():
    return load_config()

# Write config
@app.post("/api/config", dependencies=[Depends(verify_admin_session)])
async def api_post_config(request: Request):
    try:
        body = await request.body()
        new_cfg = json.loads(body.decode("utf-8"))
        current = load_config()
        for k, v in new_cfg.items():
            current[k] = v
        save_config(current)
        global CONFIG, _homepage_cache
        CONFIG = current
        _homepage_cache = {"data": None, "ts": 0}
        print(f"[+] Config updated. Domain: {current.get('source_domain')}")
        return {"ok": True, "config": current}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Config save error: {e}")

# Cache refresh
@app.get("/api/refresh", dependencies=[Depends(verify_admin_session)])
def api_refresh():
    global _homepage_cache
    _homepage_cache = {"data": None, "ts": 0}
    return {"ok": True}

# Fetch Streams & Decrypt
@app.get("/api/fetch", dependencies=[Depends(verify_api_session)])
async def api_fetch(
    id: str = Query(None),
    url: str = Query(None),
    s: str = Query(None),
    e: str = Query(None),
    tmdb_id: str = Query(None),
    stream: str = Query("0")
):
    if not id and not url and not tmdb_id:
        raise HTTPException(status_code=400, detail="Missing id, url, or tmdb_id parameter")

    import threading
    from concurrent.futures import ThreadPoolExecutor

    content_type = "tv" if (s or e) else "movie"
    resolved_imdb_id = id
    resolved_post_id = None
    resolved_content_type = content_type
    resolved_html = None

    def task_scrape_detail():
        nonlocal resolved_imdb_id, resolved_post_id, resolved_content_type, resolved_html
        if not url:
            return
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, context=ssl_ctx, timeout=8) as response:
                html = response.read().decode("utf-8", errors="ignore")
            resolved_html = html
            
            post_match = re.search(r'postid-(\d+)', html)
            if post_match:
                resolved_post_id = post_match.group(1)
            
            if "/tvshows/" in url or "/episodes/" in url:
                resolved_content_type = "tv"
                
            if not resolved_imdb_id:
                imdb_match = re.search(r'tt\d{7,8}', html)
                if imdb_match:
                    resolved_imdb_id = imdb_match.group(0)
        except Exception as err:
            print(f"[-] Fetch Error for detail URL {url}: {err}")

    def task_resolve_tmdb():
        nonlocal resolved_imdb_id
        if resolved_imdb_id or not tmdb_id:
            return
        resolved_type = "tv" if resolved_content_type == "tv" else "movie"
        cached_data = _tmdb_details_cache.get(f"{tmdb_id}|{resolved_type}")
        if cached_data and cached_data.get("imdb_id"):
            resolved_imdb_id = cached_data["imdb_id"]
            return
        try:
            cfg = load_config()
            api_key_tmdb = cfg.get("tmdb_api_key", "").strip() or "8265bd1679663a7ea12ac168da84d2e8"
            details_url = f"https://api.themoviedb.org/3/{resolved_type}/{tmdb_id}?api_key={api_key_tmdb}&append_to_response=external_ids"
            details = _get_tmdb_json(details_url, timeout=4)
            if details:
                iid = details.get("external_ids", {}).get("imdb_id") or details.get("imdb_id") or ""
                if iid:
                    resolved_imdb_id = iid
                    _tmdb_cache[iid] = tmdb_id
        except Exception as err:
            print(f"[-] Failed to resolve imdb_id from tmdb_id {tmdb_id} in /api/fetch: {err}")

    async def sse_generator():
        nonlocal resolved_imdb_id, resolved_post_id, resolved_content_type, resolved_html
        # First resolve metadata
        loop = asyncio.get_running_loop()
        with ThreadPoolExecutor(max_workers=2) as meta_ex:
            futures_meta = []
            if url:
                futures_meta.append(meta_ex.submit(task_scrape_detail))
            if tmdb_id and not resolved_imdb_id:
                futures_meta.append(meta_ex.submit(task_resolve_tmdb))
            for f in futures_meta:
                f.result()

        if resolved_imdb_id and not (s or e):
            try:
                imdb_data = fetch_imdb_data(resolved_imdb_id)
                if imdb_data and imdb_data.get("type") in ("series", "tv", "show"):
                    resolved_content_type = "tv"
            except Exception:
                pass

        if not resolved_imdb_id and resolved_html:
            _fb_title = None
            title_m = re.search(r'<title>([^<]+)</title>', resolved_html, re.IGNORECASE)
            if title_m:
                _raw = title_m.group(1)
                _fb_title = re.split(r'\s*[\-|]\s*', _raw)[0].strip()
                _fb_title = re.sub(r':\s*\d+x\d+.*', '', _fb_title, flags=re.IGNORECASE).strip()
                _fb_title = re.sub(r':\s*season\s*\d+.*', '', _fb_title, flags=re.IGNORECASE).strip()
                _fb_title = re.sub(r':\s*episode\s*\d+.*', '', _fb_title, flags=re.IGNORECASE).strip()
                _fb_title = re.sub(r'\s+\d+x\d+.*', '', _fb_title, flags=re.IGNORECASE).strip()
                _fb_title = re.sub(r'\(\d{4}\)', '', _fb_title).strip()
            if _fb_title:
                try:
                    _found = search_imdb_by_title(_fb_title, content_type=resolved_content_type)
                    if _found:
                        resolved_imdb_id = _found
                        print(f"[+] Resolved IMDB ID by title: {resolved_imdb_id} ({_fb_title})")
                except Exception:
                    pass

        is_anime = False
        fallback_title = None
        try:
            if resolved_html:
                title_m = re.search(r'<title>([^<]+)</title>', resolved_html, re.IGNORECASE)
                if title_m:
                    raw_title = title_m.group(1)
                    fallback_title = re.split(r'\s*[\-|]\s*', raw_title)[0].strip()
                    fallback_title = re.sub(r':\s*\d+x\d+.*', '', fallback_title, flags=re.IGNORECASE).strip()
                    fallback_title = re.sub(r':\s*season\s*\d+.*', '', fallback_title, flags=re.IGNORECASE).strip()
                    fallback_title = re.sub(r':\s*episode\s*\d+.*', '', fallback_title, flags=re.IGNORECASE).strip()
                    fallback_title = re.sub(r'\s+\d+x\d+.*', '', fallback_title, flags=re.IGNORECASE).strip()
                    fallback_title = re.sub(r'\s+season\s*\d+.*', '', fallback_title, flags=re.IGNORECASE).strip()
                    fallback_title = re.sub(r'\s+episode\s*\d+.*', '', fallback_title, flags=re.IGNORECASE).strip()
                    fallback_title = re.sub(r'\s+\d+.*', '', fallback_title, flags=re.IGNORECASE).strip()
                    fallback_title = re.sub(r'\(\d{4}\)', '', fallback_title).strip()
                
                is_anime = ("/anime/" in url) or ("anime" in resolved_html.lower() and "sub" in resolved_html.lower())
                if not is_anime and ("/genre/anime" in resolved_html.lower() or "/genre/animation" in resolved_html.lower()):
                    is_anime = True
            if not is_anime and url and "anime" in url.lower():
                is_anime = True
            if not is_anime and resolved_imdb_id:
                imdb_data = fetch_imdb_data(resolved_imdb_id)
                if imdb_data:
                    genres = str(imdb_data.get("genre", "")).lower()
                    if "animation" in genres or "anime" in genres or "hentai" in genres:
                        is_anime = True
                    if not fallback_title:
                        fallback_title = imdb_data.get("title", "")
                
                if not is_anime:
                    is_an, tmdb_title = get_anime_details_from_tmdb(resolved_imdb_id)
                    if is_an:
                        is_anime = True
                        if not fallback_title:
                            fallback_title = tmdb_title
            if not is_anime and tmdb_id:
                resolved_type = "tv" if resolved_content_type == "tv" else "movie"
                # Cache is keyed by imdb_id (via fetch_tmdb_data), try resolved_imdb_id first
                tmdb_data = None
                if resolved_imdb_id:
                    tmdb_data = _tmdb_details_cache.get(f"{resolved_imdb_id}|{resolved_type}")
                    if not tmdb_data:
                        # Populate cache by running fetch_tmdb_data
                        try:
                            tmdb_data = fetch_tmdb_data(resolved_imdb_id, resolved_type)
                        except Exception:
                            pass
                # Also check by tmdb_id key (populated from /api/tv_details)
                if not tmdb_data:
                    tmdb_data = _tmdb_details_cache.get(f"{tmdb_id}|{resolved_type}")
                if tmdb_data:
                    genres = str(tmdb_data.get("genre", "")).lower()
                    if "animation" in genres or "anime" in genres or "hentai" in genres:
                        is_anime = True
                    if not fallback_title:
                        fallback_title = tmdb_data.get("title", "")

        except Exception as err:
            print(f"[-] Error extracting title/anime check from HTML: {err}")

        # Last-resort: fetch TMDB genres directly by tmdb_id if still not determined
        if not is_anime and tmdb_id:
            try:
                resolved_type = "tv" if resolved_content_type == "tv" else "movie"
                cfg2 = load_config()
                api_key2 = cfg2.get("tmdb_api_key", "").strip() or "8265bd1679663a7ea12ac168da84d2e8"
                details_url2 = f"https://api.themoviedb.org/3/{resolved_type}/{tmdb_id}?api_key={api_key2}"
                details2 = _get_tmdb_json(details_url2, timeout=5)
                if details2:
                    genre_names = [g.get("name", "").lower() for g in details2.get("genres", [])]
                    if any(g in ("animation", "anime") for g in genre_names):
                        is_anime = True
                    if not fallback_title:
                        fallback_title = details2.get("name") or details2.get("title") or ""
            except Exception as err2:
                print(f"[-] Last-resort TMDB genre check failed for tmdb_id={tmdb_id}: {err2}")

        print(f"[*] is_anime={is_anime}, fallback_title={fallback_title!r}, imdb={resolved_imdb_id}, tmdb={tmdb_id}")


        cfg = load_config()
        source_domain = cfg.get("source_domain", "https://multimovies.makeup")


        # Set up result queue
        queue = asyncio.Queue()
        active_tasks = 0
        active_tasks_lock = threading.Lock()

        def push_to_queue(srv):
            try:
                ms, pinged_srv = ping_server(srv)
                if ms == -1:
                    return
                pinged_srv["ping_ms"] = ms if ms < 9000 else None
                loop.call_soon_threadsafe(queue.put_nowait, pinged_srv)
            except Exception as err:
                print(f"[-] Error in push_to_queue: {err}")

        def multimovies_worker():
            nonlocal active_tasks
            try:
                m_embeds = []
                if resolved_post_id:
                    m_embeds = get_multimovies_embeds(resolved_post_id, s or "1", e or "1", resolved_content_type)
                elif resolved_imdb_id:
                    lookup_url = f"{source_domain}/?s={resolved_imdb_id}"
                    headers_s = {"User-Agent": "Mozilla/5.0"}
                    req_s = urllib.request.Request(lookup_url, headers=headers_s)
                    with urllib.request.urlopen(req_s, context=ssl_ctx, timeout=6) as resp_s:
                        lookup_html = resp_s.read().decode("utf-8", errors="ignore")
                    
                    m = re.search(r'postid-(\d+)', lookup_html)
                    if m:
                        pid = m.group(1)
                        m_embeds = get_multimovies_embeds(pid, s or "1", e or "1", resolved_content_type)
                for emb in m_embeds:
                    push_to_queue(emb)
            except Exception as err:
                print(f"[-] Multimovies post-id stream extract failed: {err}")
            finally:
                with active_tasks_lock:
                    active_tasks -= 1
                    if active_tasks == 0:
                        loop.call_soon_threadsafe(queue.put_nowait, None)

        def vidzee_worker(sr, api_key):
            nonlocal active_tasks
            try:
                if resolved_imdb_id:
                    v_url = f"https://player.vidzee.wtf/api/server?id={resolved_imdb_id}&sr={sr}"
                    ref_domain = source_domain.rstrip("/")
                    headers = {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        "Referer": f"{ref_domain}/"
                    }
                    req = urllib.request.Request(v_url, headers=headers)
                    with urllib.request.urlopen(req, context=ssl_ctx, timeout=3.0) as response:
                        res = json.loads(response.read().decode("utf-8"))
                    
                    if "url" in res:
                        server_info = res.get("serverInfo", {})
                        server_name = server_info.get("name", res.get("provider", f"Server {sr}"))
                        server_lang = server_info.get("language", "Unknown")
                        
                        streams = []
                        for u in res["url"]:
                            enc_link = u.get("link")
                            quality = u.get("quality", "unknown")
                            if quality is None:
                                quality = "unknown"
                            
                            raw_lang = u.get("lang")
                            if not raw_lang or str(raw_lang).lower() in ["none", "null", "unknown"]:
                                raw_lang = server_lang
                            
                            name_lower = server_name.lower()
                            raw_lang_lower = str(raw_lang).lower()
                            
                            if "hindi" in name_lower or "hindi" in raw_lang_lower:
                                lang = "Hindi"
                            elif "english" in name_lower or "english" in raw_lang_lower or "eng" in raw_lang_lower:
                                lang = "English"
                            elif "spanish" in name_lower or "spanish" in raw_lang_lower:
                                lang = "Spanish"
                            elif "french" in name_lower or "french" in raw_lang_lower:
                                lang = "French"
                            elif "german" in name_lower or "german" in raw_lang_lower:
                                lang = "German"
                            elif "tamil" in name_lower or "tamil" in raw_lang_lower:
                                lang = "Tamil"
                            elif "telugu" in name_lower or "telugu" in raw_lang_lower:
                                lang = "Telugu"
                            else:
                                lang = str(raw_lang).strip().capitalize() if raw_lang else "English"
                            
                            decrypted = decrypt_stream_link(enc_link, api_key)
                            if decrypted:
                                streams.append({
                                    "quality": quality,
                                    "language": lang,
                                    "url": decrypted
                                })
                        if streams:
                            srv_obj = {
                                "server": f"vidzee-{sr}",
                                "name": server_name,
                                "is_iframe": False,
                                "streams": streams
                            }
                            push_to_queue(srv_obj)
            except Exception:
                pass
            finally:
                with active_tasks_lock:
                    active_tasks -= 1
                    if active_tasks == 0:
                        loop.call_soon_threadsafe(queue.put_nowait, None)

        def direct_embed_worker(embed):
            nonlocal active_tasks
            try:
                embed_url = embed["url"]
                srv_obj = {
                    "server": f"iframe-direct-{embed['nume']}",
                    "name": embed["name"],
                    "is_iframe": True,
                    "embed_url": embed_url,
                    "streams": [{
                        "quality": "Embed Player",
                        "language": "Multi",
                        "url": embed_url
                    }]
                }
                push_to_queue(srv_obj)
            except Exception:
                pass
            finally:
                with active_tasks_lock:
                    active_tasks -= 1
                    if active_tasks == 0:
                        loop.call_soon_threadsafe(queue.put_nowait, None)

        def animedekho_worker():
            nonlocal active_tasks
            try:
                if is_anime and fallback_title:
                    animedekho_embeds = extract_animedekho_embeds(
                        resolved_imdb_id, 
                        s, 
                        e, 
                        fallback_title=fallback_title
                    )
                    for idx, embed in enumerate(animedekho_embeds):
                        embed_url = embed["url"]
                        source_prefix = embed.get("source", "AnimeDekho")
                        srv_obj = {
                            "server": f"iframe-animedekho-{idx+1}",
                            "name": f"{source_prefix} - {embed['name']}",
                            "is_iframe": True,
                            "embed_url": embed_url,
                            "streams": [{
                                "quality": "Embed Player",
                                "language": "Multi",
                                "url": embed_url
                            }]
                        }
                        push_to_queue(srv_obj)
            except Exception as err:
                print(f"[-] AnimeDekho scrape task failed: {err}")
            finally:
                with active_tasks_lock:
                    active_tasks -= 1
                    if active_tasks == 0:
                        loop.call_soon_threadsafe(queue.put_nowait, None)

        # Assemble list of worker functions
        workers = []
        
        # 1. AJAX scraper
        workers.append(multimovies_worker)
        
        # 2. Vidzee scraper
        if resolved_imdb_id:
            api_key = decrypt_api_key()
            if api_key:
                for sr in range(10):
                    workers.append(lambda s_num=sr, a_key=api_key: vidzee_worker(s_num, a_key))

        # 3. Direct embeds
        direct_embeds = generate_direct_embeds(
            resolved_imdb_id, 
            resolved_content_type, 
            s, 
            e, 
            tmdb_id=tmdb_id
        )
        for embed in direct_embeds:
            workers.append(lambda emb=embed: direct_embed_worker(emb))

        # 4. AnimeDekho scraper
        if is_anime:
            workers.append(animedekho_worker)

        active_tasks = len(workers)
        
        # Run workers in ThreadPoolExecutor
        worker_executor = ThreadPoolExecutor(max_workers=30)
        for w in workers:
            worker_executor.submit(w)
            
        if active_tasks == 0:
            loop.call_soon_threadsafe(queue.put_nowait, None)

        seen_embed_urls = set()
        while True:
            item = await queue.get()
            if item is None:
                break
            
            url_to_check = item.get("embed_url") or (item.get("streams")[0].get("url") if item.get("streams") else "")
            if url_to_check:
                if url_to_check in seen_embed_urls:
                    continue
                seen_embed_urls.add(url_to_check)
                
            yield f"data: {json.dumps(item)}\n\n"

        done_payload = json.dumps({"__done__": True, "imdb_id": resolved_imdb_id or ""})
        yield f"data: {done_payload}\n\n"

    # Support JSON fallback if requested without stream parameter
    if stream != "1":
        results_list = []
        async for sse_item in sse_generator():
            if "__done__" not in sse_item:
                try:
                    payload = json.loads(sse_item.replace("data: ", "").strip())
                    results_list.append(payload)
                except Exception:
                    pass
        results_list.sort(key=lambda x: x.get("ping_ms", 9999) if x.get("ping_ms") is not None else 9999)
        return {"imdb_id": resolved_imdb_id, "servers": results_list}

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*"
    }
    return StreamingResponse(sse_generator(), headers=headers)

# Async TV Details
@app.get("/api/tv_details", dependencies=[Depends(verify_api_session)])
def api_tv_details(
    url: str = Query(None),
    id: str = Query(None),
    tmdb_id: str = Query(None)
):
    if tmdb_id in TMDB_ID_MAP:
        tmdb_id = TMDB_ID_MAP[tmdb_id]
    
    if not url and not id and not tmdb_id:
        raise HTTPException(status_code=400, detail="Missing tmdb_id, id, or url parameter")

    seasons_list = []
    
    if not tmdb_id and id:
        tmdb_id = imdb_to_tmdb(id, "tv")

    if tmdb_id:
        try:
            cfg = load_config()
            api_key = cfg.get("tmdb_api_key", "").strip() or "8265bd1679663a7ea12ac168da84d2e8"
            
            tv_url = f"https://api.themoviedb.org/3/tv/{tmdb_id}?api_key={api_key}&append_to_response=external_ids"
            tv_details = _get_tmdb_json(tv_url, timeout=5)
            if not tv_details:
                raise Exception("Failed to fetch TV details from TMDB")
            
            resolved_imdb_id = tv_details.get("external_ids", {}).get("imdb_id") or id or ""
            
            if tmdb_id in TV_SEASON_SPLIT_MAP:
                split_cfg = TV_SEASON_SPLIT_MAP[tmdb_id]
                s_url = f"https://api.themoviedb.org/3/tv/{tmdb_id}/season/1?api_key={api_key}"
                s_data = _get_tmdb_json(s_url, timeout=5)
                if not s_data:
                    raise Exception("Failed to fetch consolidated season details")
                
                all_episodes = s_data.get("episodes", [])
                seasons_list = []
                
                for s_info in split_cfg["seasons"]:
                    v_num = s_info["season_number"]
                    v_name = s_info["name"]
                    start_abs = s_info["start_absolute"]
                    count = s_info["episode_count"]
                    
                    sub_eps = all_episodes[start_abs - 1 : start_abs - 1 + count]
                    v_episodes = []
                    for ep_idx, ep in enumerate(sub_eps):
                        ep_num = ep_idx + 1
                        v_episodes.append({
                            "num": f"{v_num}-{ep_num}",
                            "url": "",
                            "name": ep.get("name") or f"Episode {ep_num}",
                            "rating": str(ep.get("vote_average", ""))[:3] if ep.get("vote_average") else "",
                            "runtime": ep.get("runtime") or 0,
                            "plot": ep.get("overview") or "",
                            "air_date": ep.get("air_date") or ""
                        })
                    
                    if v_episodes:
                        seasons_list.append({
                            "season": v_name,
                            "episodes": v_episodes
                        })
                        
                if seasons_list:
                    return {"seasons": seasons_list, "imdb_id": resolved_imdb_id}

            seasons = tv_details.get("seasons", [])
            valid_seasons = [s for s in seasons if s.get("season_number", 0) > 0]
            valid_seasons.sort(key=lambda x: x.get("season_number", 1))
            
            seasons_list = [None] * len(valid_seasons)
            
            from concurrent.futures import ThreadPoolExecutor
            
            def fetch_season_details(s_idx, s_num, s_name):
                try:
                    s_url = f"https://api.themoviedb.org/3/tv/{tmdb_id}/season/{s_num}?api_key={api_key}"
                    s_data = _get_tmdb_json(s_url, timeout=5)
                    if not s_data:
                        raise Exception("Failed to fetch season details")
                    
                    episodes = []
                    for ep in s_data.get("episodes", []):
                        ep_num = ep.get("episode_number")
                        episodes.append({
                            "num": f"{s_num}-{ep_num}",
                            "url": "",
                            "name": ep.get("name") or f"Episode {ep_num}",
                            "rating": str(ep.get("vote_average", ""))[:3] if ep.get("vote_average") else "",
                            "runtime": ep.get("runtime") or 0,
                            "plot": ep.get("overview") or "",
                            "air_date": ep.get("air_date") or ""
                        })
                    
                    if episodes:
                        return s_idx, {
                            "season": s_name or f"Season {s_num}",
                            "episodes": episodes
                        }
                except Exception as e:
                    print(f"[-] Failed to fetch details for season {s_num}: {e}")
                
                ep_count = valid_seasons[s_idx].get("episode_count", 10)
                episodes = []
                for ep_num in range(1, ep_count + 1):
                    episodes.append({
                        "num": f"{s_num}-{ep_num}",
                        "url": "",
                        "name": f"Episode {ep_num}"
                    })
                return s_idx, {
                    "season": s_name or f"Season {s_num}",
                    "episodes": episodes
                }

            with ThreadPoolExecutor(max_workers=8) as executor:
                futures = [
                    executor.submit(fetch_season_details, idx, s.get("season_number"), s.get("name"))
                    for idx, s in enumerate(valid_seasons)
                ]
                for f in futures:
                    idx, res_s = f.result()
                    seasons_list[idx] = res_s
            
            seasons_list = [s for s in seasons_list if s is not None]
            return {"seasons": seasons_list, "imdb_id": resolved_imdb_id}
        except Exception as e:
            print(f"[-] TMDB TV Details failed for tmdb_id {tmdb_id}: {e}")

    if not seasons_list:
        total_seasons = 0
        cfg = load_config()
        api_key = cfg.get("omdb_api_key", "").strip()
        headers = {"User-Agent": "Mozilla/5.0"}
        if api_key and id:
            try:
                omdb_url = f"https://www.omdbapi.com/?i={id}&apikey={api_key}"
                raw = _fetch(omdb_url)
                d = json.loads(raw)
                if d.get("Response") == "True" and d.get("totalSeasons"):
                    total_seasons = int(d["totalSeasons"])
            except Exception as e:
                print(f"[-] OMDB error fetching TV details for {id}: {e}")
        
        if total_seasons == 0 and id:
            try:
                imdb_url = f"https://www.imdb.com/title/{id}/episodes/"
                req = urllib.request.Request(imdb_url, headers=headers)
                with urllib.request.urlopen(req, context=ssl_ctx, timeout=8) as response:
                    imdb_html = response.read().decode("utf-8", errors="ignore")
                
                season_links = re.findall(r'/title/' + re.escape(id) + r'/episodes/\?season=(\d+)', imdb_html)
                if season_links:
                    total_seasons = max(int(s) for s in season_links)
                else:
                    dropdown_vals = re.findall(r'<option[^>]+value="(\d+)"', imdb_html)
                    if dropdown_vals:
                        total_seasons = max(int(v) for v in dropdown_vals)
                    else:
                        total_seasons = 1
            except Exception as e:
                print(f"[-] IMDb scrape error fetching TV details for {id}: {e}")
                total_seasons = 1
        
        if total_seasons > 0:
            for s_idx in range(1, total_seasons + 1):
                episodes = []
                for e_idx in range(1, 25):
                    episodes.append({
                        "num": f"{s_idx}-{e_idx}",
                        "url": "",
                        "name": f"Episode {e_idx}"
                    })
                seasons_list.append({
                    "season": f"Season {s_idx}",
                    "episodes": episodes
                })

    return {"seasons": seasons_list, "imdb_id": id or ""}

# Async Proxy
@app.get("/api/proxy")
async def api_proxy(url: str = Query(None), referer: str = Query(None)):
    if not url:
        raise HTTPException(status_code=400, detail="Missing url parameter")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    if referer:
        headers["Referer"] = referer
        headers["Origin"] = referer.rstrip("/")

    try:
        resp = await async_client.get(url, headers=headers, timeout=15.0)
        content = resp.content
        content_type = resp.headers.get("Content-Type", "application/octet-stream")
        status_code = resp.status_code
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Proxy error: {e}")

    is_playlist = "mpegurl" in content_type.lower() or url.split("?")[0].endswith(".m3u8") or url.split("?")[0].endswith(".txt")
    
    if is_playlist:
        lines = content.decode("utf-8", errors="ignore").splitlines()
        rewritten = []
        for line in lines:
            cleaned = line.strip()
            if cleaned and not cleaned.startswith("#"):
                abs_url = urljoin(url, cleaned)
                proxied = f"/api/proxy?url={urllib.parse.quote(abs_url)}"
                if referer:
                    proxied += f"&referer={urllib.parse.quote(referer)}"
                rewritten.append(proxied)
            else:
                rewritten.append(line)
        return Response(content=chr(10).join(rewritten).encode("utf-8"), media_type=content_type, status_code=status_code)
    else:
        return Response(content=clean_segment(content), media_type=content_type, status_code=status_code)

# Async Proxy Download
@app.get("/api/proxy_download")
async def api_proxy_download(url: str = Query(None), filename: str = Query("video.mp4")):
    if not url:
        raise HTTPException(status_code=400, detail="Missing url parameter")

    from urllib.parse import urlparse as _urlparse
    parsed_remote = _urlparse(url)
    if parsed_remote.scheme not in ("https", "http"):
        raise HTTPException(status_code=400, detail="Only http/https URLs can be proxied")

    print(f"[OmniSave Proxy] Fetching: {url[:120]}")

    proxy_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Origin": "https://videodownloader.site",
        "Referer": "https://videodownloader.site/",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        "Connection": "keep-alive",
    }

    try:
        req = async_client.build_request("GET", url, headers=proxy_headers, timeout=120.0)
        resp = await async_client.send(req, stream=True)
        
        if resp.status_code >= 400:
            await resp.aclose()
            raise HTTPException(status_code=502, detail=f"CDN returned {resp.status_code}")

        content_length = resp.headers.get("Content-Length")
        content_type = resp.headers.get("Content-Type", "video/mp4")
        safe_filename = filename.replace('"', '').replace(chr(10), '').replace(chr(13), '')

        print(f"[OmniSave Proxy] OK — Content-Type={content_type}, Size={content_length}")

        async def stream_generator():
            try:
                async for chunk in resp.aiter_bytes(chunk_size=1024 * 512):
                    yield chunk
            finally:
                await resp.aclose()

        headers = {
            "Content-Disposition": f'attachment; filename="{safe_filename}"',
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*"
        }
        if content_length:
            headers["Content-Length"] = content_length

        return StreamingResponse(stream_generator(), media_type=content_type, headers=headers)

    except Exception as e:
        print(f"[OmniSave Proxy] Error: {e}")
        raise HTTPException(status_code=502, detail=f"Proxy download failed: {e}")


# Async OmniSave download list
@app.get("/api/omnisave_download")
async def api_omnisave_download(
    title: str = Query(None),
    type: str = Query("movie"),
    season: str = Query("1"),
    episode: str = Query("1"),
    subjectId: str = Query(None),
    detailPath: str = Query(None)
):
    if not title:
        raise HTTPException(status_code=400, detail="Missing title parameter")

    try:
        api_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Origin": "https://videodownloader.site",
            "Referer": "https://videodownloader.site/",
            "x-request-lang": "en",
            "X-Source": "downloader",
            "X-Client-Info": '{"timezone":"Asia/Calcutta"}',
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjcyOTE1MDQ1NzkxNzg5MTU4MDAsImF0cCI6MywiZXh0IjoiMTc4MTgwNzcwOCIsImV4cCI6MTc4OTU4MzcwOCwiaWF0IjoxNzgxODA3NDA4fQ.qQ05e8arLpTPBtGj1WNDAPOEL45sYZIyqSIlK-i4afA"
        }

        subject_id = subjectId
        detail_path = detailPath
        matched_title = title

        if not subject_id or not detail_path:
            # Step 1: Search
            search_url = "https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/search"
            payload = json.dumps({"keyword": title, "page": 1, "perPage": 15, "subjectType": 0})
            
            resp = await async_client.post(search_url, content=payload, headers=api_headers, timeout=8.0)
            search_res = resp.json()

            items = search_res.get("data", {}).get("items", [])
            if not items:
                return {"error": "No results found on OmniSave", "downloads": []}

            # Filter out trailers, but keep items if they actually have resources
            non_trailers = [
                i for i in items 
                if not (i.get("postTitle") or "").lower().startswith("trailer-") or i.get("hasResource") == True
            ]
            search_candidates = non_trailers if non_trailers else items
            
            matching_candidates = []
            for item in search_candidates:
                item_title = item.get("title", "").lower()
                if title.lower() in item_title or item_title in title.lower():
                    matching_candidates.append(item)

            if not matching_candidates:
                matching_candidates = [search_candidates[0]]

            # If multiple candidates found, return candidate list to frontend
            if len(matching_candidates) > 1:
                candidates_list = []
                for item in matching_candidates:
                    corner = item.get("corner", "")
                    t_val = item.get("title", "")
                    lang = corner.strip()
                    if not lang:
                        m = re.search(r'\[([a-zA-Z\s]+)\]', t_val)
                        if m:
                            lang = m.group(1).strip()
                        else:
                            lang = "Original / Multi"
                    candidates_list.append({
                        "subjectId": str(item.get("subjectId")),
                        "detailPath": str(item.get("detailPath")),
                        "title": t_val,
                        "language": lang
                    })
                return {"candidates": candidates_list}

            best_item = matching_candidates[0]
            subject_id = best_item.get("subjectId")
            detail_path = best_item.get("detailPath")
            matched_title = best_item.get("title")

        # Step 2: Fetch download urls
        is_tv = type in ("tv", "series", "anime")
        se_val = int(season) if is_tv else 0
        ep_val = int(episode) if is_tv else 0

        dl_params = urllib.parse.urlencode({
            "subjectId": str(subject_id),
            "se": str(se_val),
            "ep": str(ep_val),
            "detailPath": str(detail_path)
        })
        download_url = f"https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/download?{dl_params}"
        
        resp = await async_client.get(download_url, headers=api_headers, timeout=8.0)
        res_dl = resp.json()
            
        downloads = res_dl.get("data", {}).get("downloads", [])
        
        formatted_downloads = []
        for dl in downloads:
            size_bytes = dl.get("size")
            formatted_size = "Unknown"
            if size_bytes:
                try:
                    sb = int(size_bytes)
                    if sb >= 1024 * 1024 * 1024:
                        formatted_size = f"{sb / (1024 * 1024 * 1024):.2f} GB"
                    else:
                        formatted_size = f"{sb / (1024 * 1024):.1f} MB"
                except Exception:
                    formatted_size = str(size_bytes)
                    
            res_val = dl.get("resolution")
            formatted_res = f"{res_val}p" if res_val else "Unknown"
            
            formatted_downloads.append({
                "format": dl.get("format", "MP4"),
                "url": dl.get("url"),
                "resolution": formatted_res,
                "size": formatted_size,
                "codec": dl.get("codecName", "")
            })

        return {
            "matched_title": matched_title,
            "downloads": formatted_downloads
        }
        
    except Exception as e:
        print(f"[-] api_omnisave_download error: {e}")
        return {
            "error": str(e),
            "downloads": []
        }


# Async OmniSave stream
@app.get("/api/omnisave_stream")
async def api_omnisave_stream(
    title: str = Query(None),
    type: str = Query("movie"),
    season: str = Query("1"),
    episode: str = Query("1"),
    resolution: str = Query(None),
    filename: str = Query("video.mp4"),
    subjectId: str = Query(None),
    detailPath: str = Query(None)
):
    if not title:
        raise HTTPException(status_code=400, detail="Missing title parameter")

    try:
        api_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Origin": "https://videodownloader.site",
            "Referer": "https://videodownloader.site/",
            "x-request-lang": "en",
            "X-Source": "downloader",
            "X-Client-Info": '{"timezone":"Asia/Calcutta"}',
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjcyOTE1MDQ1NzkxNzg5MTU4MDAsImF0cCI6MywiZXh0IjoiMTc4MTgwNzcwOCIsImV4cCI6MTc4OTU4MzcwOCwiaWF0IjoxNzgxODA3NDA4fQ.qQ05e8arLpTPBtGj1WNDAPOEL45sYZIyqSIlK-i4afA"
        }

        subject_id = subjectId
        detail_path = detailPath

        if not subject_id or not detail_path:
            # Step 1: Search
            search_url = "https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/search"
            payload = json.dumps({"keyword": title, "page": 1, "perPage": 15, "subjectType": 0})
            
            resp = await async_client.post(search_url, content=payload, headers=api_headers, timeout=8.0)
            search_res = resp.json()

            items = search_res.get("data", {}).get("items", [])
            non_trailers = [i for i in items if not (i.get("postTitle") or "").lower().startswith("trailer-")]
            candidates = non_trailers if non_trailers else items
            if not candidates:
                raise HTTPException(status_code=404, detail="No results found on OmniSave")

            best = candidates[0]
            for item in candidates:
                t = item.get("title", "").lower()
                if title.lower() in t or t in title.lower():
                    best = item
                    break
            subject_id = best.get("subjectId")
            detail_path = best.get("detailPath")

        # Step 2: Get fresh download URLs
        is_tv = type in ("tv", "series", "anime")
        se_val = int(season) if is_tv else 0
        ep_val = int(episode) if is_tv else 0
        dl_params = urllib.parse.urlencode({
            "subjectId": str(subject_id),
            "se": se_val,
            "ep": ep_val,
            "detailPath": str(detail_path)
        })
        
        resp = await async_client.get(f"https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/download?{dl_params}", headers=api_headers, timeout=8.0)
        dl_res = resp.json()

        downloads = dl_res.get("data", {}).get("downloads", [])
        if not downloads:
            raise HTTPException(status_code=404, detail="No download links available")

        chosen = None
        if resolution:
            for dl in downloads:
                if str(dl.get("resolution", "")) == resolution:
                    chosen = dl
                    break
        if not chosen:
            sorted_dl = sorted(downloads, key=lambda x: int(x.get("resolution") or 0), reverse=True)
            chosen = sorted_dl[0]

        cdn_url = chosen.get("url")
        if not cdn_url:
            raise HTTPException(status_code=404, detail="No CDN URL for selected quality")

        print(f"[OmniSave Stream] Streaming {chosen.get('resolution')}p from: {cdn_url[:80]}...")

        cdn_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Origin": "https://videodownloader.site",
            "Referer": "https://videodownloader.site/",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "identity",
            "Connection": "keep-alive",
        }

        # Step 3: Stream from CDN
        req = async_client.build_request("GET", cdn_url, headers=cdn_headers, timeout=120.0)
        resp = await async_client.send(req, stream=True)
        
        if resp.status_code >= 400:
            await resp.aclose()
            raise HTTPException(status_code=502, detail=f"CDN returned status {resp.status_code}")

        content_length = resp.headers.get("Content-Length")
        content_type = resp.headers.get("Content-Type", "video/mp4")
        safe_fn = filename.replace('"', '').replace(chr(10), '').replace(chr(13), '')

        async def stream_generator():
            try:
                async for chunk in resp.aiter_bytes(chunk_size=1024 * 512):
                    yield chunk
            finally:
                await resp.aclose()

        headers = {
            "Content-Disposition": f'attachment; filename="{safe_fn}"',
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*"
        }
        if content_length:
            headers["Content-Length"] = content_length

        return StreamingResponse(stream_generator(), media_type=content_type, headers=headers)

    except Exception as e:
        print(f"[OmniSave Stream] Error: {e}")
        raise HTTPException(status_code=502, detail=f"Stream failed: {e}")

# Async Download
@app.get("/api/download")
async def api_download(
    background_tasks: BackgroundTasks,
    url: str = Query(None),
    referer: str = Query(""),
    title: str = Query("video")
):
    if not url:
        raise HTTPException(status_code=400, detail="Missing url parameter")

    fetch_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    if referer:
        fetch_headers["Referer"] = referer
        fetch_headers["Origin"] = referer.rstrip("/")

    try:
        resp = await async_client.get(url, headers=fetch_headers, timeout=15.0)
        playlist_content = resp.text

        lines = playlist_content.splitlines()

        is_master = any("#EXT-X-STREAM-INF" in line for line in lines)
        if is_master:
            best_url = None
            best_bandwidth = -1
            for i, line in enumerate(lines):
                if "#EXT-X-STREAM-INF" in line:
                    bw_match = re.search(r'BANDWIDTH=(\d+)', line)
                    bandwidth = int(bw_match.group(1)) if bw_match else 0
                    if bandwidth >= best_bandwidth and i + 1 < len(lines):
                        nxt = lines[i + 1].strip()
                        if nxt and not nxt.startswith("#"):
                            best_bandwidth = bandwidth
                            best_url = urljoin(url, nxt)
            if best_url:
                url = best_url
                resp = await async_client.get(url, headers=fetch_headers, timeout=15.0)
                playlist_content = resp.text
                lines = playlist_content.splitlines()

        segments = []
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith("#"):
                segments.append(urljoin(url, stripped))

        if not segments:
            raise HTTPException(status_code=500, detail="No media segments found in playlist")

        print(f"[*] Download: {len(segments)} segments for: {title}")

        import shutil, tempfile, subprocess
        ffmpeg_path = shutil.which("ffmpeg")
        safe_title = re.sub(r'[<>:"/\\|?*]', '_', title)[:60] or "video"

        if ffmpeg_path:
            tmp_dir = os.path.join(_BASE_DIR, ".tmp_download")
            os.makedirs(tmp_dir, exist_ok=True)
            tmp_out = tempfile.NamedTemporaryFile(suffix=".mp4", dir=tmp_dir, delete=False)
            tmp_out.close()
            
            try:
                extra_headers = f"User-Agent: Mozilla/5.0" + chr(13) + chr(10)
                if referer:
                    extra_headers += f"Referer: {referer}" + chr(13) + chr(10)
                
                proxied_stream_url = f"http://localhost:{PORT}/api/proxy?url={urllib.parse.quote(url)}"
                if referer:
                    proxied_stream_url += f"&referer={urllib.parse.quote(referer)}"

                cmd = [
                    ffmpeg_path, "-y",
                    "-headers", extra_headers,
                    "-allowed_extensions", "ALL",
                    "-allowed_segment_extensions", "ALL",
                    "-extension_picky", "0",
                    "-i", proxied_stream_url,
                    "-c", "copy",
                    "-movflags", "+faststart",
                    tmp_out.name
                ]
                
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                
                try:
                    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=600.0)
                except asyncio.TimeoutError:
                    proc.kill()
                    raise RuntimeError("ffmpeg process timed out")

                if proc.returncode != 0:
                    raise RuntimeError(stderr.decode(errors="ignore")[-500:])

                file_size = os.path.getsize(tmp_out.name)
                print(f"[+] Download complete (ffmpeg MP4): {safe_title}.mp4 ({file_size // 1024 // 1024} MB)")
                
                def cleanup_file():
                    try:
                        os.unlink(tmp_out.name)
                    except Exception:
                        pass
                
                background_tasks.add_task(cleanup_file)
                return FileResponse(
                    tmp_out.name,
                    media_type="video/mp4",
                    filename=f"{safe_title}.mp4"
                )
            except Exception as ffmpeg_err:
                try:
                    os.unlink(tmp_out.name)
                except Exception:
                    pass
                raise ffmpeg_err

        else:
            print("[!] ffmpeg not found — downloading as .ts (MPEG-TS)")

            async def ts_stream_generator():
                BATCH = 5
                for batch_start in range(0, len(segments), BATCH):
                    batch = segments[batch_start:batch_start + BATCH]
                    
                    async def fetch_seg(seg_url):
                        r = await async_client.get(seg_url, headers=fetch_headers, timeout=20.0)
                        return r.content
                    
                    tasks = [fetch_seg(s) for s in batch]
                    results = await asyncio.gather(*tasks, return_exceptions=True)
                    
                    for res in results:
                        if isinstance(res, Exception):
                            print(f"[-] Segment download failed: {res}")
                        else:
                            yield res

            headers = {
                "Content-Disposition": f'attachment; filename="{safe_title}.ts"'
            }
            return StreamingResponse(ts_stream_generator(), media_type="video/mp2t", headers=headers)

    except Exception as e:
        print(f"[-] Download error: {e}")
        raise HTTPException(status_code=500, detail=f"Download error: {e}")

# Serves static index
@app.get("/")
@app.get("/index.html")
def serve_index(request: Request):
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "127.0.0.1"
    save_unique_visitor(ip)

    filepath = os.path.join(_BASE_DIR, "index.html")
    if os.path.exists(filepath):
        session_cookie = generate_signed_session()
        resp = FileResponse(filepath, media_type="text/html")
        resp.set_cookie(
            key="session_token",
            value=session_cookie,
            path="/",
            httponly=True,
            samesite="strict"
        )
        return resp
    raise HTTPException(status_code=404, detail="File not found")

# Serves static admin panel
@app.get("/admin")
@app.get("/admin.html")
def serve_admin():
    filepath = os.path.join(_BASE_DIR, "admin.html")
    if os.path.exists(filepath):
        return FileResponse(filepath, media_type="text/html")
    raise HTTPException(status_code=404, detail="Admin panel file not found")

# Serve all other static assets
@app.get("/{filename:path}")
def serve_static(filename: str):
    if filename.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")
    filepath = os.path.join(_BASE_DIR, filename)
    if os.path.exists(filepath) and os.path.isfile(filepath):
        if filename.endswith(".css"):
            media_type = "text/css"
        elif filename.endswith(".js"):
            media_type = "application/javascript"
        else:
            media_type = "application/octet-stream"
        
        return FileResponse(filepath, media_type=media_type)
    raise HTTPException(status_code=404, detail="File not found")


def kill_existing_server():
    """Find and terminate any existing processes listening on the server port."""
    import subprocess
    import os
    import sys
    import signal

    port = PORT
    my_pid = os.getpid()
    
    if sys.platform.startswith("win"):
        try:
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            
            out = subprocess.check_output(
                "netstat -ano", 
                startupinfo=startupinfo, 
                shell=True
            ).decode("utf-8", errors="ignore")
            
            pids_to_kill = set()
            for line in out.splitlines():
                if f":{port}" in line and "LISTENING" in line:
                    parts = line.strip().split()
                    if parts:
                        try:
                            pid = int(parts[-1])
                            if pid != my_pid and pid > 0:
                                pids_to_kill.add(pid)
                        except ValueError:
                            pass
            
            for pid in pids_to_kill:
                print(f"[*] Terminating existing server process on port {port} (PID: {pid})...")
                try:
                    subprocess.run(
                        f"taskkill /F /PID {pid}", 
                        startupinfo=startupinfo, 
                        shell=True, 
                        check=False
                    )
                except Exception as e:
                    print(f"[-] Failed to terminate PID {pid}: {e}")
        except Exception as e:
            print(f"[-] Error checking for existing server on Windows: {e}")
    else:
        try:
            out = subprocess.check_output(f"lsof -t -i:{port}", shell=True).decode("utf-8", errors="ignore")
            for line in out.splitlines():
                try:
                    pid = int(line.strip())
                    if pid != my_pid and pid > 0:
                        print(f"[*] Terminating existing server process on port {port} (PID: {pid})...")
                        os.kill(pid, signal.SIGKILL)
                except ValueError:
                    pass
        except Exception:
            pass

def main():
    # Kill any existing server process running on the same port first
    kill_existing_server()

    # Run obfuscator to compile app.js to app.min.js on startup
    try:
        import subprocess
        base_dir = os.path.dirname(os.path.abspath(__file__))
        obf_path = os.path.join(base_dir, "obfuscator.py")
        if os.path.exists(obf_path):
            print("[*] Automatically building obfuscated app.min.js...")
            subprocess.run([sys.executable, obf_path], check=True)
    except Exception as e:
        print(f"[-] Auto-obfuscation on startup failed: {e}")

    import uvicorn
    print(f"[*] God-Level Video Player Server running at http://localhost:{PORT}/")
    try:
        uvicorn.run("server:app", host="0.0.0.0", port=PORT, reload=False)
    except KeyboardInterrupt:
        print("\n[*] Shutting down server.")

if __name__ == "__main__":
    main()
