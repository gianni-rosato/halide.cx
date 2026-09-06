+++
title = "Introducing Iris for WebP"
date = 2025-06-04
description = "Today we're excited to announce the Iris project, our in-house image encoder. We've begun work on Iris's first codec, Iris-WebP: A WebP encoder that brings impressive gains over the reference encoder."
+++

{{ <hero src="/img/sky.avif" width="1536" height="864" alt="Sky" /> }}

## Why WebP?

WebP was introduced in 2010 with the goal of providing better compression for
Web images. While it claimed to offer significant efficiency advantages over
JPEG, in practice this wasn't always true. Its adoption was also slow due to an
initial lack of widespread browser support and further lackluster support
outside of the Web ecosystem. This led to WebP being perceived as a confusing
addition to the Web.

Despite its reputation and unclear benefits, WebP has gained significant
traction on the Web. It is available in over 95% of Web browsers, and large
digital asset management companies serve billions of WebP images every day.

Iris-WebP is a WebP encoder tuned for the human eye. At the same encode time, it
produces smaller files than the reference encoder at equal visual quality, and
it narrows most of the gap between WebP and slower formats like AVIF.

## Our Encoder

Our primary goals building Iris-WebP are speed, compression efficiency, and
consistency. We want to consistently output high-quality results from our
encoder quickly, and in doing so provide an implementation that delivers on
WebP's initial quality promises without compromise.

In order to meet our goals, we've developed robust tooling to measure visual
fidelity with SSIMULACRA2 and Butteraugli. Visual performance is paramount, and
we work hard to ensure Iris-WebP isn't just overfit for metrics. Our featureset
includes new compression techniques that came out of our own psychovisual
research.

To learn more about Iris-WebP and how it may benefit your workflow, visit the
[Iris project page](/iris/). Metrics were not ready when this post went up; they
are now published on the Iris page, along with the cases where Iris loses.

{{ <cta url="/iris" txt="Learn More About Iris" /> }}
