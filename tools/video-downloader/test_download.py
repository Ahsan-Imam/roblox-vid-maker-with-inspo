from download import is_supported

assert is_supported("https://www.youtube.com/watch?v=abc")
assert is_supported("https://youtu.be/abc")
assert is_supported("https://www.instagram.com/reel/abc/")
assert not is_supported("https://example.com")
assert not is_supported("https://evilyoutube.com/x")
print("ok")
