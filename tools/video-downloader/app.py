import html
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs

import yt_dlp

from download import download, is_supported

PAGE = """<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Video Downloader</title>
<style>body{{font:16px system-ui;max-width:560px;margin:10vh auto;padding:0 16px}}
input[type=text]{{width:100%;padding:10px;box-sizing:border-box}}button{{padding:10px 18px;margin-top:10px}}</style>
<h1>YouTube / Instagram downloader</h1>
<form method=post onsubmit="b.disabled=true;b.textContent='Downloading...'">
<input type=text name=url placeholder="Paste link here" required autofocus>
<label><input type=checkbox name=audio> mp3 only</label><br>
<button id=b>Download</button></form><p>{msg}</p>"""


class Handler(BaseHTTPRequestHandler):
    def reply(self, msg=""):
        body = PAGE.format(msg=msg).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.reply()

    def do_POST(self):
        size = int(self.headers.get("Content-Length", 0))
        form = parse_qs(self.rfile.read(size).decode())
        url = form.get("url", [""])[0].strip()
        if not is_supported(url):
            return self.reply("Only youtube.com, youtu.be and instagram.com links work.")
        try:
            download(url, "audio" in form)
            self.reply("Done. Saved in the <b>downloads</b> folder.")
        except yt_dlp.utils.DownloadError as e:
            self.reply("Failed (private/login-only post?): " + html.escape(str(e)))


if __name__ == "__main__":
    # shortcut: one download at a time, local only; add a queue if you ever host it
    print("Open http://127.0.0.1:8000")
    HTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
