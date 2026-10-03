+++
title = "Introducing wpd"
date = 2026-10-02
description = "Faster, safer WebP decoding for everyone."
+++

{{
<hero src="/img/building.avif" width="1536" height="864" alt="Building" /> }}

wpd is a faster, safer WebP decoder than libwebp, designed to help secure the
Web from vulnerabilities like
[CVE-2023-4863](https://nvd.nist.gov/vuln/detail/cve-2023-4863). At the same
time, wpd can't just maintain the status quo for speed; it offers superior
single-threaded performance, and parallelizes better across multiple threads
compared to alternatives.

## Safety

Image decoders and other image processing libraries are used everywhere, from
the OS level to sandboxed browser processes. They also process complex untrusted
input data, which makes them vulnerable to memory safety bugs. CVE-2023-4863
affected potentially billions of devices running Chrome, Firefox, Signal,
Microsoft Teams, and more – CISA confirmed it was actively exploited in the
wild, and it was added to their Known Exploited Vulnerabilities catalog
thereafter. Vulnerabilities like these have serious consequences for nearly all
consumer hardware.

While libwebp is likely safer than it was in the past, it does not "solve"
memory safety by being well-fuzzed. According to the Chromium team,
[around 70%](https://www.chromium.org/Home/chromium-security/memory-safety/) of
their high-severity security bugs come from memory safety issues.

To address this, wpd is written in Rust, with handwritten assembly routines for
performance. The handwritten SIMD present in the decoder is carefully scoped and
checked for correctness, and largely exists in less risky places. Nonetheless,
for consumers looking to harden their environments, wpd can be compiled without
handwritten assembly; this leaves the non-SIMD code we've written entirely
verifiably memory-safe, with the only unsafe code being in the vetted
[zerocopy](https://docs.rs/zerocopy/latest/zerocopy/) crate. This is a marked
improvement over libwebp, which is written entirely in unsafe C with SIMD
intrinsics.

### Performance

It isn't enough to just be safer;
[image-webp](https://crates.io/crates/image-webp) already has that covered. We
also needed to make wpd faster, so safety did not come with compromised
performance.

We benchmarked wpd on a subset of our
[developer test data](https://github.com/halidecx/wpd-test-data), and compared
to libwebp, it is:

- 1-thread, lossy: **1.19x** faster
- 1-thread, lossless: **2.74x** faster
- multi-thread, lossy: **2.68x** faster
- multi-thread, lossless: **3.19x** faster

Because our test suite mixes animated WebP content with still content, our
multi-threaded results take advantage of parallel image decoding which results
in more impressive gains there. Our single-threaded advantage is pure
algorithmic improvement.

{{ <image_switcher id="wpd-single-thread" alt="Single-threaded WPD and libwebp
decoding benchmark comparison" images={[ "/img/wpd/lossy-single.svg",
"/img/wpd/lossless-single.svg", ]} labels={[ "Lossy", "Lossless", ]}
subtitles={[ "Single-threaded lossy decoding", "Single-threaded lossless
decoding", ]} /> }}

{{ <image_switcher id="wpd-multi-thread" alt="Multi-threaded WPD and libwebp
decoding benchmark comparison" images={[ "/img/wpd/lossy-multi.svg",
"/img/wpd/lossless-multi.svg", ]} labels={[ "Lossy", "Lossless", ]} subtitles={[
"Multi-threaded lossy decoding", "Multi-threaded lossless decoding", ]} /> }}

These numbers come from our benchmarking harness in the wpd repository, using
image-webp 0.2.4 and libwebp `a1d89ff`.

### Features

Feature parity with libwebp is a target for wpd as well, as every use case that
relies on libwebp deserves an upgrade. Compared to image-webp, wpd is a proper
libwebp replacement, with some additional features included on top:

| Decoder feature                                                 | image-webp | libwebp | wpd |
| --------------------------------------------------------------- | :--------: | :-----: | :-: |
| Lossy WebP                                                      |     ☑      |    ☑    |  ☑  |
| Lossless WebP                                                   |     ☑      |    ☑    |  ☑  |
| Alpha transparency                                              |     ☑      |    ☑    |  ☑  |
| Animation with composited frames                                |     ☑      |    ☑    |  ☑  |
| Animation durations and loop count                              |     ☑      |    ☑    |  ☑  |
| Animation rewind/reset                                          |     ☑      |    ☑    |  ☑  |
| Raw animation subframe decoding                                 |     ☐      |   ⚠¹    |  ☑  |
| Per-frame geometry, blend, disposal inspection without decoding |     ☐      |    ☑    |  ☑  |
| Image dimensions and alpha inspection without decoding          |     ☑      |    ☑    |  ☑  |
| ICC, EXIF, and XMP extraction                                   |     ☑      |    ☑    |  ☑  |
| RGB/RGBA output                                                 |     ☑      |    ☑    |  ☑  |
| BGR/BGRA/ARGB output                                            |     ☐      |    ☑    |  ☑  |
| Premultiplied alpha output                                      |     ☐      |    ☑    |  ☑  |
| YUV420P output                                                  |     ⚠²     |    ☑    |  ☑  |
| YUVA420P output                                                 |     ☐      |    ☑    |  ☑  |
| RGB565 and RGBA4444 output                                      |     ☐      |    ☑    |  ☑  |
| BGR565 and BGRA4444 output                                      |     ☐      |    ☐    |  ☑  |
| Built-in cropping                                               |     ☐      |    ☑    |  ☑  |
| Built-in scaling                                                |     ☐      |    ☑    |  ☑  |
| Scaling with automatic aspect-ratio preservation                |     ☐      |    ☑    |  ☑  |
| Vertical flip                                                   |     ☐      |    ☑    |  ☑  |
| Selectable simple/fancy chroma upsampling                       |     ☑      |    ☑    |  ☑  |
| Optional bypass of lossy in-loop filtering                      |     ☐      |    ☑    |  ☑  |
| Color/alpha dithering controls                                  |     ☐      |    ☑    |  ☐  |
| Incremental decoding via appended bytes                         |     ☐      |    ☑    |  ☑  |
| Incremental decoding via cumulative borrowed buffer             |     ☐      |    ☑    |  ☑  |
| Access to completed rows before still-image decode finishes     |     ☐      |    ☑    |  ☑  |
| Caller-owned output buffer                                      |     ☑      |    ☑    |  ☑  |
| Configurable output strides, including negative strides         |     ☐      |    ☑    |  ☑  |
| Internal multithreaded decoding                                 |     ☐      |    ☑    |  ☑  |
| Explicit thread-count setting                                   |     ☐      |   ☐³    |  ☑  |
| Parallel animation frame decode-ahead                           |     ☐      |    ☐    |  ☑  |
| Configurable pixel-count limit before frame allocation/decode   |     ☐      |    ☐    |  ☑  |
| Explicit optimized SIMD implementations                         |     ☐      |    ☑    |  ☑  |
| C ABI                                                           |     ☐      |    ☑    |  ☑  |
| Rust API                                                        |     ☑      |    ☐    |  ☑  |

1. Requires demuxing the frame payload and passing it to the image decoder. Its
   animation decoder returns composited canvases.
2. Exposed by its low-level VP8 decoder; the caller must extract the VP8 payload
   from the WebP container. Its complete WebP decoder outputs RGB/RGBA.
3. Exposes a boolean to enable threading, rather than a requested thread count.

Format and processing rows describe still-image capabilities. libwebp includes
libwebpdemux; its composited animation API supports fewer formats and options.
wpd’s subframe mode excludes crop/scale/flip, and its partial-row API excludes
animations and transformed output.

### Goals

We want to give back to open source as much as possible. This project is our
third addition to our open source catalogue, joining [fcvvdp](/blog/fcvvdp) and
[fmetrics](/blog/fmetrics). Our release of wpd means we officially have more
major open source projects than closed source (Iris-WebP and the currently
unreleased Aperture). We'd like this ratio to grow even more skewed toward open
source in the future, and we'll always commit to supporting our open work as
first-class support targets, no different from our closed encoders.

To further our security goals for wpd, we are exploring partnerships with
cybersecurity firms who are interested in securing the world's most critical
software. We'd like everyone to use wpd for free today; if there's anything
stopping you, don't hesitate to let us know what it is and we'll address it (or,
push some code yourself!).

We look forward to seeing people pick up wpd. It is under the most permissive
open source license we can manage, BSD 2-Clause. If you've been following our
developments, you'll be hearing from us again soon, so stay tuned – we hope you
find wpd valuable!

{{ <cta url="mailto:mail@halide.cx" txt="Email Us" /> }}
