import hashlib
import json
from pathlib import Path

import httpx


ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "app" / "catalog_sources.json"
OUTPUT_DIR = ROOT / "build" / "authority_catalogs"
MANIFEST = OUTPUT_DIR / "manifest.json"


def fetch(url: str) -> bytes:
    with httpx.Client(follow_redirects=True, timeout=120, verify=False) as client:
        response = client.get(url, headers={"User-Agent": "boatiboat-authority-fetch/1.0"})
        response.raise_for_status()
        return response.content


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sources = json.loads(SOURCES.read_text(encoding="utf-8"))
    manifest = []

    for source in sources:
      target = OUTPUT_DIR / source["local_filename"]
      content = fetch(source["source_url"])
      target.write_bytes(content)
      manifest.append({
          **source,
          "bytes": len(content),
          "sha256": hashlib.sha256(content).hexdigest(),
          "path": str(target.relative_to(ROOT)),
      })
      print(f"{source['id']}: {len(content)} bytes -> {target}")

    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"manifest: {MANIFEST}")


if __name__ == "__main__":
    main()
