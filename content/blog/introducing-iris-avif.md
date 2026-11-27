+++
title = "Introducing Iris-AVIF"
date = 2026-10-07
template = "blog-launch.html"
description = "Iris-AVIF is our new AVIF encoder, and the best image encoder we know how to build. It sets a new frontier for how small a beautiful image can be."

[extra]
cover = "/img/fall_leaves.avif"
tagline = "Our most efficient image encoder, and the best image encoder in the world."
cover_alt = "The Halide Compression mark burning, drawn in shifting ones and zeros"

stats = [
  { value = "21%", label = "Better than libaom at equal quality (CVVDP) with faster encode time" },
  { value = "20%", label = "Better than Iris-WebP at equal quality and speed" },
  { value = "29×", label = "Faster than libaom at 1% better quality (CVVDP)" },
]
stats_note = "Measured Oct 2026 on the Kodak Lossless True Color Image Suite."

hero_actions = [
  { url = "#article-text", txt = "Read More", style = "btn--primary" },
  { url = "/iris-avif/", txt = "Iris-AVIF page" },
]
+++

We’re introducing Iris-AVIF (formerly codenamed Aperture), the world's best
image encoder.

Over a year ago, our research began with Iris-WebP. Extending our methodology
and the techniques we've discovered to a vastly larger set of coding tools
brings us to Iris-AVIF, where we've achieved state of the art results and
produced a world-class image encoder that represents the frontier of image
compression efficiency.

{{ <image_switcher id="iris-avif-metrics"
images={["/img/iris-avif/iris-avif_cvvdp.svg",
"/img/iris-avif/iris-avif_ms-ssim.svg", "/img/iris-avif/iris-avif_ssimu2.svg"]}
labels={["CVVDP", "MS-SSIM", "SSIMULACRA2"]} subtitles={["CVVDP", "MS-SSIM",
"SSIMULACRA2"]} alt="Iris-AVIF compression efficiency comparison chart" /> }}

## A generational improvement

Competing with libwebp via Iris-WebP required discovering new psychovisual
research and engaging in rigorous performance engineering. The best open-source
AV1 encoders pushed our efforts even further; libwebp stopped improving a long
time ago, while the best AV1 encoders continue to improve today. The two leading
encoders (SVT-AV1 and libaom) are developed by massive companies with incredible
resources, and lots of attention is put into AVIF.

To compete at the frontier of image compression with Iris-WebP as a base, we had
to go beyond what we initially thought was possible and experiment liberally
with AV1's broad set of intra-coding tools to produce the best AVIF images.
AV1's intra-coding toolset is wildly versatile; we've seen and even
[worked on](/blog/improving-avif-in-open-source) big improvements before.

Iris-AVIF is the culmination of our best work. It represents years of
multi-disciplinary effort: perceptual fidelity work, [new](/blog/fcvvdp)
[tools](/blog/fmetrics) to measure improvements, new features WebP could never
deliver, and setting a new pace for our research and engineering. The result is
**the world's most versatile, capable, and efficient image encoder**.

## AVIF

AVIF has been considered widely supported since January 2024. Support is
guaranteed on \>95% of all Web browsers, just 1.47% behind WebP and 1.67% behind
JPEG. Decode speed is also
[fast](https://giannirosato.com/blog/post/case-against-jxl/#decode-time), not
far from WebP or JPEG.

Iris-AVIF is also a unique opportunity for us to focus beyond raw compression
efficiency on new problems AVIF lets us solve: accurate film grain via synthetic
reproduction and high-bitdepth HDR encoding stand out, and are not available in
WebP. Because of these tools, Iris-AVIF is a uniquely intelligent encoder.

### Automatic grain synthesis

Iris-AVIF intelligently detects whether an image contains a grain pattern it can
reproduce synthetically, and then determines exactly how much. It can flexibly
emulate anything from coarse film grain to fine digital chroma noise, without
manual intervention.

{{ <image_switcher id="iris-avif-grain"
images={["/img/iris-avif/sand-iris.avif", "/img/iris-avif/sand-svt.avif",
"/img/iris-avif/sand-lossless.webp"]} labels={["Iris-AVIF", "SVT-AV1",
"Source"]} subtitles={["Iris-AVIF Speed 0 | 1,012 ms | 7,995 bytes", "SVT-AV1
Tune 4 Preset 0 | 2,312 ms | 8,046 bytes", "Source | 564,008 bytes"]}
alt="Iris-AVIF grain synthesis comparison images" /> }}

### HDR

HDR allows images to display a wider range of color and light, further extending
an image's ability to saturate the infinite potential of the human eye. HDR
isn't properly supported in JPEG and WebP, requiring inefficient layering
tricks.

AVIF supports HDR natively, and we're excited to support it in Iris-AVIF.
Iris-AVIF's performance is a highlight; notice below how Iris retains the lines
on the bottom building better than SVT-AV1 while being 5 times faster.

{{ <image_switcher id="iris-avif-hdr" images={["/img/iris-avif/sf-t-iris.avif",
"/img/iris-avif/sf-t-svt.avif", "/img/iris-avif/sf-t.png"]}
labels={["Iris-AVIF", "SVT-AV1", "Source"]} subtitles={["Iris-AVIF Speed 5 |
20.4 ms | 20,028 bytes | 9.462 CVVDP", "SVT-AV1 Tune 3 P5 | 102.5 ms | 20,802
bytes | 9.402 CVVDP", "Source | 3,185,254 bytes"]} alt="Iris-AVIF HDR comparison
images" /> }}

Screen content encoding with Iris-AVIF offers up to 415% better compression than
JPEG, and other areas like progressive decoding are yet to be explored by us.
Whatever images need, Iris-AVIF aims to uniquely deliver via detection,
adaptation, and efficient reproduction. While Iris-WebP is still versatile,
Iris-AVIF is intelligent in its ability to understand and adapt to the content
it encounters.

## Perceptual alignment

Iris-AVIF is our most perceptually optimized encoder, and places the preferences
of the human eye first. We ran into some of the
[limitations of perceptual metrics](/blog/metric-limits) early in its
development, and as Iris-WebP achieved perceptual improvements that metrics
failed to reward, it became clear a strong perceptual tune should be available
upon release. We took extra time to make sure it was up to our standards before
this announcement.

Perceptual fidelity remains top of mind in our mission to produce a more
beautiful Web, but we understand that subjective methodology has limitations.
Iris-AVIF has impressed us, but we believe it can be even better. Our work
continues to focus on this aspect of the encoder, and we'll always strive to
keep improving.

## Looking Forward

Iris-AVIF has already been under evaluation since before this announcement.
Iris-WebP remains mature, available, and continually improving. Looking ahead,
we'd like to strengthen our perceptual tunes in both encoders and implement
strong progressive decoding in Iris-AVIF, among other things. For those who
value WebP, expect Iris-WebP to improve in tandem with Iris-AVIF.

We're very proud of what Iris has become, and we're excited to see even more
users take advantage of our most capable encoder. Iris-AVIF is our most
ambitious bet to bring the world a more beautiful Internet, and we can't wait to
see where it takes us all next.

Send us an email if you're interested, we'd love to hear from you.

{{ <cta url="mailto:mail@halide.cx" txt="Email Us" /> }}
