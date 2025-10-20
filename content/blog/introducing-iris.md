+++
title = "Introducing Iris for WebP"
date = 2025-06-04
description = "Today we're excited to announce the Iris project, our in-house image encoder. We've begun work on Iris's first codec, Iris-WebP: A WebP encoder that brings impressive gains over the reference encoder."
+++

{{ hero(src="/img/sky.avif", width="1536", height="864", alt="Sky") }}

## Why WebP?

WebP was introduced in 2010 with the goal of providing better compression for
Web images. While it claimed to offer significant efficiency advantages over
JPEG, in practice this wasn't always true. Its adoption was also slow due to an
initial lack of widespread browser support and further lackluster support
outside of the Web ecosystem. This led to WebP being perceived as a confusing
addition to the Web.

Desipte its reputation and unclear benefits, WebP has gained significant
traction on the Web. It is available in over 95% of Web browsers, and large
digital asset management companies serve billions of WebP images every day.

Iris-WebP provides a fast, efficient WebP encoder designed for the human eye.
Images encoded with Iris-WebP look significantly better than those encoded with
the reference WebP encoder, and Iris-WebP performance outclasses encoders for
slower, newer Web-first formats like AVIF.

## Our Encoder

Our primary goals building Iris-WebP are speed, compression efficiency, and
consistency. We want to consistenty output high-quality results from our encoder
quickly, and in doing so provide an implementation that delivers on WebP's
initial quality promises without compromise.

In order to meet our goals, we've developed robust tooling to measure visual
fidelity with SSIMULACRA2 and Butteraugli. Visual performance is paramount, and
we work hard to ensure Iris-WebP isn't just overfit for metrics. Our featureset
includes novel image compression tech designed through meticulous psychovisual
research, allowing us to provide unrivaled performance.

To learn more about Iris-WebP and how it may benefit your workflow, visit the
[Iris project page](/iris/). At the time of writing, we don't have metrics to
share, but they will be coming soon to the Iris project page. We're excited to
see how Iris can help make the web faster, lighter, and more beautiful!

{{ cta(url="/iris", txt="Learn More About Iris") }}
