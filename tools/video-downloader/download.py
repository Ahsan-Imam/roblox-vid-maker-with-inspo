import argparse
import os
import sys
from urllib.parse import urlparse

import yt_dlp

HOSTS = ("youtube.com", "youtu.be", "instagram.com")


def is_supported(url):
    host = (urlparse(url).hostname or "").lower()
    return any(host == h or host.endswith("." + h) for h in HOSTS)


def download(url, audio=False):
    folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads")
    opts = {"outtmpl": os.path.join(folder, "%(title)s.%(ext)s"), "noplaylist": True}
    if audio:
        opts["format"] = "bestaudio/best"
        opts["postprocessors"] = [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3"}]
    else:
        opts["format"] = "bv*+ba/b"
        opts["merge_output_format"] = "mp4"
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([url])


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Download YouTube / Instagram videos")
    p.add_argument("url")
    p.add_argument("-a", "--audio", action="store_true", help="extract mp3 only")
    args = p.parse_args()
    if not is_supported(args.url):
        sys.exit("Only youtube.com, youtu.be and instagram.com URLs are supported.")
    try:
        download(args.url, args.audio)
    except yt_dlp.utils.DownloadError as e:
        sys.exit(f"Download failed (private/login-only post?): {e}")
