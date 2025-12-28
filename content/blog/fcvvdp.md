+++
title = "Introducing fcvvdp"
date = 2025-12-28
description = "A faster implementation of CVVDP, a perceptual video and image fidelity metric."
+++

{{ hero(src="/img/slate.avif", width="1536", height="864", alt="Slate")
}}

## Why?

The aphorism "all models are wrong, but some are useful" is commonly attributed to George E. P. Box, a British statistician. The concept is especially relevant in multimedia compression where we have lots of models to choose from for evaluating lossy image and video compression.

Lots of metrics exist and are easily accessible; we are intimately familiar with a wide breadth of metrics and their various pros and cons for benchmarking image compression algorithms, but there will always be blind spots regardless of how many we test. When we found ColorVideoVDP (CVVDP), we discovered it was able to catch some edge cases that other powerful perceptual metrics (like SSIMULACRA2) weren't able to; despite the fact that it has its own edge cases, it immediately became interesting to us because of this.

The only issue we faced was that the [reference Python implementation](https://github.com/gfxdisp/colorvideovdp) was not fast enough for our use case, increasing our Iris benchmark script's runtime dramatically. This wasn't an acceptable trade-off for our productivity, so we decided to build [fcvvdp](https://github.com/halidecx/fcvvdp) as an open-source C implementation of CVVDP for the benefit of everyone who may have faced the same issues we did.

## Metrics

The strongest full-reference perceptual fidelity metrics we have access to are SSIMULACRA2, Butteraugli, and (to some degree) MS-SSIM. PSNR-HVS provides some level of perceptual utility as well. SSIM and eSSIM are occasionally useful for investigating a certain class of finer artifacts; the same can be said about PSNR to some degree. VMAF isn't particularly useful for images in our experience. We don't outright shun or ignore any metrics, but our preference is to build technology that is valuable for the end-user experience (so, the human eye). We've established CVVDP is relevant to the last point, so what additional criteria must we meet to use an implementation?

The Python implementation of CVVDP is compelling research-grade software, and a [fully GPU-accelerated implementation](https://github.com/Line-fr/Vship) exists for video. While performant GPU acceleration is compelling for benchmarking videos, images have different needs:
- GPU initialization time causes slowdowns
- Threading isn't important, because each encode/metric worker gets its own thread in the benchmark script
- Batch processing on the GPU fixes the first issue, but requires re-architecting parts of our benchmark script for one metric

So, fcvvdp should be able to slot into existing workflows as easily as SSIMULACRA2 or Butteraugli might relative to a legacy image benchmarking suite.

## Implementation

fcvvdp is based on the GPU-accelerated implementation mentioned earlier, and is written in C. It is, predictably, strongest when it comes to images. The reference implementation takes (on average) 1.69 seconds and 928 MB of RAM to score one 576x576 pairwise image comparison. fcvvdp takes (on average) 85.5ms, and uses 61.5 MB of RAM. Scores are within a reasonable margin of perceptual error.

On a 360p video, fcvvdp is ~18% faster in terms of wall clock time. The benefits described above generalize in terms of user time and RAM usage, but wall clock time isn't much better on videos due to the fact that fcvvdp doesn't feature any sort of threading. This is the implementation's biggest limitation; while it is still faster than the reference implementation (which does feature threading) by a bit, threading would allow the relative improvement we see with images to generalize to video.

If you're interested in learning about how fcvvdp works, see our [implementation docs](https://github.com/halidecx/fcvvdp/blob/main/doc/cvvdp.md).

## Conclusion

Our code is public under the [Apache 2.0 license](https://github.com/halidecx/fcvvdp?tab=Apache-2.0-1-ov-file#readme). We are always proud of our capability to give back to the FOSS ecosystem when we can. While Iris is a closed source product, we hope to use Iris's impact and utility as a means of subsidizing work on open source when it helps support our mission. In this case, fcvvdp was the perfect excuse to do something great for Halide Compression while giving something valuable back to the field. We hope you enjoy fcvvdp!

{{ cta(url="mailto:mail@halide.cx", txt="Email Us") }}
