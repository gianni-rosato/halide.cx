+++
title = "Measuring Image Encoder Consistency"
date = 2025-09-14
description = "Quality and speed define an image encoder's compression performance. Consistency is a close third, and easily overlooked in image encoder design. What value does it provide, and how can we measure it?"
+++

{{ hero(src="/img/streak.avif", width="1536", height="864", alt="Light Streak")
}}

## What Is Consistency?

Consistency could mean a number of things in the context of image compression,
but the specific definition of consistency used in this blog post measures how
closely an image encoder's user-configurable quality index matches a perceptual
quality index.

Here's an example: your encoder has a quality slider from 1 to 100. Ideally, if
you pass a quality value of 80, this should target some internal definition of
what "quality 80" means with every image it encodes. At quality 80, if some
images look incredible and some look clearly awful, there is a consistency
issue. If images all end up around the same quality visually, that is the mark
of a consistent encoder.

## Why Is Consistency Important?

It is very common for image compression workflows to include a target quality
loop of some kind, where a metric is utilized alongside an image encoder to
provide feedback about how good the image looks. If it doesn't look good enough,
re-encode; similarly, if it is too high-quality and bits could be saved by
aiming lower, re-encode. Considering image encoders and powerful metrics are
quite fast, these workflows are easy to configure and often run quickly enough.

In speed- or resource-constrained scenarios, it may not be wise to use a target
quality loop. If you do, you may be limited to faster but far less meaningful
metrics; for example, targeting [PSNR](https://wiki.x266.mov/docs/metrics/PSNR)
is not useful for delivering images at a consistent quality baseline because our
eyes don't agree with PSNR's definition of quality very often. Two separate
encodes of different sources that have the same PSNR score often look very
different in terms of visual quality, which brings us back to where we started.
In these scenarios, our definition of consistency becomes relevant; an encoder's
ability to reliably encode images close to a given quality becomes a
make-or-break consideration for this kind of workflow. Applications that process
vast quantities of user-generated content can be subject to these constraints.

A consistent encoder additionally provides a boon to user experience. Encoders
like [libjxl](https://github.com/libjxl/libjxl)'s encoder (cjxl for JPEG XL
images) and the [jpegli](https://github.com/google/jpegli) JPEG encoder have two
user-accessible quality indexes; they provide a Q scale from 0 (or 1) through
100 like most image encoders, but they also provide a "distance" scale. The
benefit of this is that quality scales measured in Q are internally defined and
often arbitrary – it isn't clear how good "quality 80" will actually be
externally, and the visual correlation for most encoder quality scales is
usually sparsely documented. On the other hand, "distance" is not arbitrary.

A "distance" parameter allows users to directly target a tangible _visual
distance_ value; roughly speaking, this indicates how far away a user needs to
be from their screen to see artifacts. A value of 1.0 is usually considered
visually lossless, and JPEG XL and jpegli are inspired by the Butteraugli metric
in how this is defined. The benefits to a user are clear; you can set-and-forget
your encoder to a distance of 1.0, and your images will always be the smallest
possible size to achieve visually lossless fidelity given your encoder is
perfectly consistent.

Our encoder is called [Iris-WebP](https://halide.cx/iris/), and features similar
functionality to libjxl and libjpegli through its own "distance" parameter for
the reasons stated above. But everything we just described is useless if the
distance value isn't consistently achievable; so, how do we measure consistency?

## Measuring Consistency

This blog post's title promises that we will measure this, so let's take a look
at some methodology.

At a high level, here is how we measure encoder consistency holistically:

- We sweep an encoder’s user-facing quality index Q across a chosen range
- For each image and each Q, we encode once, then compute one or more perceptual
  metrics against the original
- For each Q, we aggregate the metric values across all images and write a CSV
  with the mean and standard deviation

Here, the per-Q standard deviation is the important value. Lower standard
deviations per Q mean the encoder achieves more uniform visual quality across
diverse inputs at that Q.

Internally, this testing is done with a number of different metrics; for the
purposes of this blog post, we'll report all of our numbers with
[SSIMULACRA2](https://github.com/cloudinary/ssimulacra2) because it is the most
perceptually correlated open-source metric at the time of writing.

The [libaom](https://aomedia.googlesource.com/aom/) AV1 encoder is configured at
speed 7, using an improved tune iq introduced in v3.13.0 (if you'd like to learn
more about some of the ways AVIF has gotten better in the past year, read
[our blog post on open source AVIF developments](https://halide.cx/blog/improving-avif-in-open-source).)
We also tested libjpeg-turbo, libjxl, libjpegli,
[libwebp](https://chromium.googlesource.com/webm/libwebp/), and Iris-WebP. We
configured libaom to encode 10-bit 4:4:4 images and libwebp to run at its
slowest encoding preset (method 6), and everything else was left to defaults for
the other encoders. The image dataset we're testing on is
[Daala's subset1](https://github.com/WyohKnott/image-formats-comparison/tree/gh-pages/comparisonfiles/subset1/Original),
which should give us a good baseline for medium-resolution photographic content.

Our results will focus on:

- The average of standard deviations for Q levels between SSIMULACRA2 30 and 80
- The movement of std dev per Q level the range between SSIMULACRA2 30 and 80

The 30 to 80 range was chosen due to its relevance for general multimedia
delivery use cases.

## Results

![Average standard deviation across Q levels](/img/avg_stddev_ssimu2.svg)

The above graph shows us consistency numbers averaged across Q levels that
resulted in average qualities between 30 and 80 SSIMULACRA2 on the subset1
dataset we mentioned earlier. And our winner is libjpeg-turbo! On the quality
front, libjpeg-turbo is not remotely competitive with these encoders, but it
scores well for consistency – we'll think more about this in the next section.

Next, we have standard deviation over our range:

![Standard deviation graphed](/img/stddev_graphed_ssimu2.svg)

This paints an interesting picture; we see that libaom is actually the best at
SSIMULACRA2 80, but performance drops off rapidly below SSIMULACRA2 ~70. Iris is
a well-rounded strong performer, with concessions to libjpeg-turbo below
SSIMULACRA2 ~47 (low fidelity). Curiously, while libjpegli does well, libjxl is
not all that consistent overall.

## Conclusions

Iris-WebP's strong consistency performance coupled with its known speed and
efficiency make it a strong performer, but consistency wins alone are not worth
celebrating; they can only support an already fast and efficient encoder.

In a target quality loop with an inefficient encoder, bits are wasted by default
even if a particular target is readily hit; even though you are sacrificing
predictability, a less consistent encoder that is more efficient is a more
desirable choice because you can just have your target quality workflow shift
potential inconsistency into overshooting. Overshot results might be larger than
necessary, but they may still be smaller than worse looking outputs from a less
efficient encoder that is still on target.

Similarly, a consistent encoder that isn't competitively fast is not worthwhile
either. If at the same speed target, another encoder is more efficient, that
encoder is considered faster and you're leaving compression efficiency on the
table.

At Halide Compression, we believe image encoders that value efficiency, speed,
and consistency are both desirable and possible. While it is true that highly
efficient encoders may suffer consistency issues due to their spiky but still
generally incredible performance, we believe Iris has been able to successfully
mitigate potential consistency issues without sacrificing efficiency or speed.

{{ cta(url="mailto:mail@halide.cx", txt="Email Us") }}
