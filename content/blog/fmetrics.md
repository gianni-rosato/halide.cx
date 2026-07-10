+++
title = "Introducing fmetrics"
date = 2026-07-07
description = "Faster perceptual video and image fidelity metrics."
+++

{{ hero(src="/img/ceiling.avif", width="1536", height="864", alt="Museum
Ceiling") }}

## Why?

At the end of last year, we discovered the well-designed ColorVideoVDP metric,
but found the
[reference Python implementation](https://github.com/gfxdisp/colorvideovdp) was
not fast enough for our use case, increasing our [Iris](/iris/) benchmark
script's runtime dramatically. This wasn't an acceptable trade-off for our
productivity, so we decided to build
[fcvvdp](https://github.com/halidecx/fcvvdp) as an open-source C implementation
of CVVDP for the benefit of everyone.

Since its conception, fcvvdp has received many updates, including (by popular
demand) task threading for parallelized video scoring. It has also gotten much
faster overall, including on one thread. Public-facing open-source projects
demonstrate our ability to deliver high-performance solutions to complex
problems, so we're happy to see fcvvdp getting a level of attention that
encourages us to continue improving it.

How about other metrics? When we published fcvvdp, we felt other perceptual
metrics were not in need of any immediate attention; Cloudinary's
[reference SSIMULACRA2](https://github.com/cloudinary/ssimulacra2)
implementation is in C++, and so is Google's
[Butteraugli](https://github.com/google/butteraugli). Lots of other relevant
metrics were already available through
[libvmaf](https://github.com/netflix/libvmaf), and were thus easily accessible
via FFmpeg. So, why build another metrics tool?

## Introducing fmetrics

Through [fmetrics](https://github.com/halidecx/fmetrics), we offer one library
that wraps implementations of IW-SSIM, Butteraugli, SSIMULACRA2, MS-SSIM, and
CVVDP. CVVDP is provided through fcvvdp, but the rest are new
production-oriented implementations distinct from their references. The
motivations behind creating each implementation are different, but the idea to
wrap them all under a single library came from an interest in supporting other
tools more effectively and having a much simpler CLI. We like how nicely libvmaf
integrates with FFmpeg, so eventually we plan to do something similar.

Now, we can start looking at why we re-implemented each metric, followed by
benchmark results.

### IW-SSIM

This lesser-known variant of SSIM performed exceptionally well on the
[JPEG AIC-3](https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=11417802)
evaluation, and the
[reference implementation](https://github.com/Jack-guo-xy/Python-IW-SSIM) is in
Python. We wanted to be able to rapidly benchmark this like we do with other
metrics, so writing a faster version in C featuring algorithmic optimizations in
a language closer to the metal was an easy decision considering IW-SSIM's
psychovisual utility.

### Butteraugli

Butteraugli's most up-to-date implementation lives in the
[libjxl](https://github.com/libjxl/libjxl) reference implementation of the JPEG
XL image codec. Butteraugli is algorithmically slow already, so even small gains
were worth pursuing here.

### SSIMULACRA2

SSIMULACRA2 is probably the most high-profile perceptual image metric, receiving
lots of attention and thus more implementations.
[Ludicon](https://ludicon.com/)'s
[ic-metrics](https://github.com/Ludicon/ic-metrics) comes to mind, as well as
[fssimu2](https://github.com/gianni-rosato/fssimu2) and
[Vszip](https://github.com/dnjulek/vapoursynth-zip)'s implementation. Ours
(written in Zig) comes from fssimu2, and is useful due to better speed and
memory usage than the reference as well as the ability to produce visual
distortion maps like Butteraugli's. The motivation for another SSIMULACRA2
implementation was quite different from that of CVVDP or IW-SSIM; instead of a
sparsely implemented metric in desperate need of a faster tool, there are so
many fast, ergonomic implementations that building another was very easy.

### MS-SSIM

MS-SSIM and SSIMULACRA2 are very similar algorithmically, so using what we
learned from the SSIMULACRA2 implementation and bringing it to MS-SSIM was
trivial and not worth ignoring (even though libvmaf already provides MS-SSIM).

### CVVDP

Through the Zig build system, we were able to directly import fcvvdp as a Zig
module that gets compiled into the fmetrics static library; now, updates to
fcvvdp will be reflected in fmetrics by updating the Zig build system's
dependency tracker (`build.zig.zon`), but the two can be maintained separately
with ease so as not to kill fcvvdp.

## Performance

We'll be measuring three statistics:

- Speed
- Memory usage
- MOS correlation

The last effectively tells us how accurate our metric is; rather than comparing
correlation to the reference implementation, comparing directly to subjective
ratings helps us not miss out on perceptual improvements that we may have
foregone to be closer to the reference.

Speed and memory testing was done on a stock Core i7-13700K with 3840x2160
source & distorted PAM images
([Drive link](https://drive.google.com/drive/folders/1Kxzmw-jMWtbh8elPuQidY5MM1pTXkF0L?usp=sharing),
lossless JPEG-XL sources; run `djxl <*.pam.jxl> <*.pam>` to decompress).

MOS correlation was tested using `mos.py` via
[mos-correlation](https://github.com/gianni-rosato/mos-correlation) on
Cloudinary's [CID22](https://cloudinary.com/labs/cid22).

### MOS Correlation

| metric                 | SRCC (reference) | SRCC (fmetrics) | difference (%) |
| ---------------------- | ---------------- | --------------- | -------------- |
| butteraugli (p3 i203)* | 0.7929           | 0.7863          | -0.83%         |
| fcvvdp**               | 0.8274           | 0.8286          | +0.15%         |
| iw_ssim                | n/a              | 0.7925          | +0.00%         |
| ms_ssim                | 0.7845           | 0.8048          | +2.59%         |
| ssimulacra2            | 0.8916           | 0.8910          | -0.07%         |

> \*Note: Because Butteraugli is a smaller-is-better metric, the signs are
> flipped for the SRCCs reported above.

> \*\*Note: fmetrics uses the fcvvdp library (as a Zig module) with different
> I/O, so the underlying metric implementation is the same.

### Speed (ms)

| metric                | ms (reference) | ms (fmetrics) | difference (%) |
| --------------------- | -------------- | ------------- | -------------- |
| butteraugli (p3 i203) | 4110           | 3130          | 31.31% faster  |
| fcvvdp*               | 1390           | 1390          | 0.00%          |
| iw_ssim               | 3020           | 228           | 1224.6% faster |
| ms_ssim**             | 1110           | 106           | 947.2% faster  |
| ssimulacra2           | 722            | 232           | 211.2% faster  |

> \*Note: fmetrics uses the fcvvdp library (as a Zig module) with different I/O,
> so the underlying metric implementation is the same.

> \*\*Note: MS-SSIM comparison isn't fair, as libvmaf has to compute other
> metrics in the filterchain alongside MS-SSIM.

### RAM Usage (MB)

| metric                | MB (reference) | MB (fmetrics) | difference (%) |
| --------------------- | -------------- | ------------- | -------------- |
| butteraugli (p3 i203) | 2440           | 1670          | -31.56%        |
| fcvvdp*               | 1600           | 1600          | 0.00%          |
| iw_ssim               | 2660           | 551           | -79.29%        |
| ms_ssim**             | 841            | 376           | -55.29%        |
| ssimulacra2           | 1370           | 741           | -45.91%        |

> \*Note: fmetrics uses the fcvvdp library (as a Zig module) with different I/O,
> so the underlying metric implementation is the same.

> \*\*Note: MS-SSIM comparison isn't fair, as libvmaf has to compute other
> metrics in the filterchain alongside MS-SSIM.

## Conclusion

Based on the numbers:

- Butteraugli is up to 31.5% faster, uses 31.6% less RAM, and is within 1% MOS
  correlation
- fcvvdp is unchanged
- IW-SSIM is >1000% faster and uses less than half the RAM
- MS-SSIM's MOS correlation is >2.5% better than libvmaf's MS-SSIM
- SSIMULACRA2 is 72.1% faster, using 43.4% less RAM

Our future plans include making everything faster (of course), as well as
looking into FFmpeg support.

Our code is public under the
[Apache 2.0 license](https://github.com/halidecx/fmetrics?tab=Apache-2.0-1-ov-file#readme).
We are always proud of our capability to give back to the FOSS ecosystem when we
can. While Iris is a closed-source product, we hope to use Iris's impact and
utility as a means of subsidizing work on open-source when it helps support our
mission. In this case, much like with fcvvdp, fmetrics was the perfect excuse to
do something great for Halide Compression while giving something valuable back
to the field. We hope you enjoy fmetrics!

{{ cta(url="mailto:mail@halide.cx", txt="Email Us") }}
