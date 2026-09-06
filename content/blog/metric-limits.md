+++
title = "Limitations of Perceptual Metrics"
date = 2026-09-05
description = "As encoders mature, metrics become less valuable."
+++

{{
<hero src="/img/fsky-hdr.avif" width="1536" height="864" alt="Sky Before Sunset" />
}}

Maturity is hard to define, but we believe Iris-WebP qualifies: it turned one
year old in May. SVT-AV1 and libaom also qualify, and certainly libwebp and
libjpeg. Over that year, our workflow has had to adapt to the encoder's growing
capabilities. As we work on our upcoming encoder codenamed Aperture, those
lessons are more relevant than ever.

## Discovery

Early in Iris-WebP's development cycle,
[SSIMULACRA2](https://codecs.wiki/docs/metrics/SSIMULACRA2) guided a lot of our
development decisions. This worked well for the majority of the encoder's
history, driving consistent perceptual gains over libwebp as we introduced new
features. However, we began to notice the limits of this approach as our
evaluation framework became more advanced and SSIMULACRA2 scores diverged from
other metrics.

Here are the properties of SSIMULACRA2 that affected us most:

- The metric was tuned on subjective human ratings and has some "weights and
  biases" that work well on its training dataset
- It leverages multi-scale distortion with weighted score averaging, so
  distortion at different scales affects its performance
- SSIMULACRA2 loses its strong perceptual correlation below medium fidelity
  (SSIMU2 ~65-70)
- It measures distortion in the color channels

We believe these factors put Iris-WebP in a unique position to overfit. There is
no subjective image distortion dataset available that we know of using a WebP
encoder that isn't libwebp, so artifacts that the reference encoder doesn't
naturally produce risk being blind spots for any trained metric.

We discovered that SSIMULACRA2 accurately rewarded good mode decision changes
for 4x4 blocks, but it encouraged blocking artifacts. These are rare in
libwebp's output; it was tuned for PSNR and SSIM, metrics that reward smoothing
more than modern perceptual metrics do. Artifacts from 8x8 blocking are common
in JPEG, but 4x4 blocking lands on SSIMULACRA2's finest distortion scale, which
its subjective training data likely gave it little reason to weight heavily.

{{ <image_switcher id="i4-blocking-src" alt="4x4 Blocking Source Images"
images={[ "/img/metric-limits/block-og.webp",
"/img/metric-limits/noblock-og.webp", "/img/metric-limits/ripples.webp", ]}
labels={[ "Blocking", "No Blocking", "Source", ]} subtitles={[ "Size: 54068
bytes | SSIMU2: 36.33", "Size: 54732 bytes | SSIMU2: 30.14", "Size: 1501760
bytes" ]} /> }}

At a normal viewing distance, the "Blocking" image likely looks better. However:

{{ <image_switcher id="i4-blocking" alt="4x4 Blocking Artifacts" images={[
"/img/metric-limits/block.webp", "/img/metric-limits/noblock.webp", ]} labels={[
"Blocking", "No Blocking", ]} subtitles={[ "Original Image Size: 54068 | SSIMU2:
36.33", "Original Image Size: 54732 | SSIMU2: 30.14", ]} /> }}

Thus, the goal becomes striking a balance between macro-scale detail and
finer-grained artifacting.

> _Note: The images above were crafted to showcase the effect of 4x4 blocking on
> SSIMULACRA2 & don't represent Iris's default behavior at any point during
> development._

While 4x4 blocking was the main culprit, we also saw strange behavior at low
fidelity, where the encoder would look just as bad as other encoders but score
much better. Low fidelity is hard because nothing looks good, but we still want
to look better in that range, and visual checks confirmed SSIMULACRA2 couldn't
drive this.

Lastly, SSIMULACRA2 over-values chroma relative to both our own eyes and other
metrics. While color quality is important and early testing showed SSIMULACRA2
helping to provide meaningful perceptual gains, this advantage went away as
gains became smaller and harder to verify visually.

## Next Steps

For a long time, our default Iris tune was designed primarily around
SSIMULACRA2. Since March, we've used a more perceptually aligned default tune
based on a combination of metrics that still include SSIMULACRA2. We've updated
our metrics on the Iris page to showcase the difference

Spotting these issues early was a motivator for developing
[fcvvdp](/blog/fcvvdp), which we currently believe is the strongest perceptual
image metric available. To be clear, the underlying
[CVVDP algorithm](https://arxiv.org/html/2401.11485) comes from the University
of Cambridge; fcvvdp is our implementation.

Re-aligning our benchmarking was easy; delivering real perceptual gains in an
efficient encoder without overfitting remains hard. Incremental gains are hard
to see by eye, so perceptual drift appears slowly — especially when the encoder
is already ahead.

Aperture has a larger set of coding tools available, which means more
opportunities for pitfalls. We don't ship encoders to clients without looking
beyond the metrics, so we are taking extra steps to ensure Aperture is
perceptually excellent before a public release. We believe in a more beautiful
Internet, and we hope to continue to be maximally scrutinizing as we pursue that
goal.

{{ <cta url="mailto:mail@halide.cx" txt="Email Us" /> }}
