+++
title = "An Interview With Julio Barba"
date = 2025-08-29
description = "Julio Barba works on improving state of the art multimedia compression technology at Google. In this interview, Julio talks to Gianni about the future of multimedia compression, looking at AV2 and beyond."
+++

{{ hero(src="/img/ocean.avif", width="1536", height="864", alt="Ocean") }}

## Who are you?

I'm Julio Barba, a developer who works on video and image compression technology, focusing on the AV1 format and its successor, AV2. I started in backend development but pivoted to multimedia compression in 2023 by contributing to popular open-source AV1 projects like [libaom](https://aomedia.googlesource.com/aom/) and [SVT-AV1](https://gitlab.com/AOMediaCodec/SVT-AV1/). I'm now also a contributor to AV2, the next-generation video standard from the [Alliance for Open Media (AOMedia)](https://aomedia.org).

## How did you get involved in multimedia compression?

At 10 years old, I discovered MP3s and Winamp and was amazed that you could shrink CD music by 10x with very little quality loss. That sparked my curiosity in compression.

Soon after, I learned about the royalty-free Ogg Vorbis audio format, which was even better than MP3. That led me down a rabbit hole of royalty-free video formats like Theora, VP9, and eventually AV1. In 2023, I started contributing to AV1 myself, focusing on improving its video and image quality.

In 2024, I teamed up with Gianni Rosato and two friends to create [SVT-AV1-PSY](https://svt-av1-psy.com), a version of the SVT-AV1 encoder focused on making videos look as good as possible to the human eye. We've since contributed many of our improvements back to the main SVT-AV1 project, making it more flexible, higher quality, and easier to use.

## What is your role at Google?

I work with Google's image compression team on a feature called tune IQ, a brand-new mode in the libaom encoder designed for still images. It improves quality and consistency by intelligently directing more data to the parts of an image our eyes notice most, which means you get smaller files for the same visual quality. Tune IQ also includes a new detector that dramatically improves compression for content like screenshots, simple graphics, and animations.

Today, tune IQ is already being used by customers like _[The Guardian](https://www.theguardian.com/us)_, and we've received great feedback! We're now working to make it the default setting for creating AVIF images and help it become widely adopted.

## How did you become part of the AV2 development effort?

My work with Google's image team was a natural entry point to contributing to AV2's image compression capabilities. Since Google is a founding member of AOMedia, it was easy to get involved. That said, the project is open source, so anyone can contribute, not just members!

## We have WebP (from VP8), HEIC (from HEVC), and AVIF (from AV1). Will there be an image format based on AV2?

Given AV2's compression gains over AV1, I strongly believe the industry will want an image format based on it. There's already work being done to add support for AVM (AV2's reference software) into libavif, which is a popular library for handling AVIF images.

## What AV2 features are you most excited about for still image compression?

I'm very excited about features like user-defined Quantization Matrices (QMs). This unlocks some powerful applications, most notably the ability to convert JPEG images into the AV2 format without the additional quality loss that normally happens when you transcode between formats. On top of that, you can apply deblocking filters to these converted images to smooth out artifacts and improve their perceived quality even more.

AV2 also uses higher precision math for standard 8-bit content. This helps prevent "banding" — those ugly, visible steps in what should be a smooth color gradient — which can be caused by rounding errors during compression.

## H.264 helped enable HD video on the web, while formats like AV1 drove 4K and HDR. What new experiences might AV2 unlock?

That's a great question! There's a growing demand for high-quality Virtual Reality (VR) and Augmented Reality (AR) experiences, driven by products like the Apple Vision Pro and Meta Quest. These applications require streaming video at very high resolutions (4K or higher), with a wide field of view (up to 360 degrees), and often with multiple views (e.g., one for each eye). AV2 is being designed with new compression tools specifically to handle this kind of demanding video more efficiently.

## What adoption challenges do you foresee for AV2, and how can they be solved?

The main challenges will be the same ones every new codec faces: ensuring cheap, widespread hardware support and developing fast, efficient software for encoding and decoding. For AV2 to succeed, the entire ecosystem -- from chip manufacturers to codec developers and streaming services -- needs to work together.

There will be growing pains, but if we learn from the AV1 rollout, we can speed things up. Developing a very fast software decoder early on (like dav1d was for AV1) and optimizing the software encoders will be key to driving adoption.

## Can you speculate on a timeline for widespread AV2 deployment?

It's hard to say for sure since the AV2 standard is still under development. However, seeing the close collaboration between all the AOMedia partners, I think the rollout could be even faster than AV1's. I wouldn't be surprised to see the first devices with AV2 hardware support by 2027. An optimistic guess for widespread deployment would be around 2030.

## How do you see video and image compression evolving in the next 5 to 10 years?

I'm betting we'll see a lot more machine learning (ML) and neural networks (NN) used in codec design. This could mean using AI to clean up and enhance the final decoded image, or it could mean building ML-based techniques directly into the compression process to improve quality from the start. I know of several research efforts already underway, and I hope to see them become part of real products in the future.

## What are your thoughts on machine learning in future compression standards?

As I said, I believe ML will become essential. I expect it to be adopted gradually -- first by using ML to create smarter filters that clean up compression artifacts, and then expanding to other parts of the codec as device performance allows.

The ultimate "holy grail" would be a codec that uses machine learning extensively in every step of the process. We might even see codecs that are essentially a single, large neural network. Companies like [Deep Render](https://deeprender.ai) have shown this is possible; we just need to make them fast enough to run in real-time on affordable, everyday hardware.

## If you could instantly solve one problem in compression, what would it be?

My dream is to perfect the way we handle film grain in videos. I'd want to create a fully automated system that can intelligently preserve or synthesize film grain to match the director's creative intent, without needing manual tweaking for every single movie. To do that, we'd also need to develop a new quality metric that can actually understand and measure the visual appeal of film grain.

_The world of multimedia compression is [moving more quickly than ever](https://giannirosato.com/blog/post/the-multimedia-renaissance/), and Julio is at the forefront of it all. I'm consistently impressed with his work, and If you want to learn more about him, I've linked his website below. Thanks for your time in this interview, Julio!_

_– Gianni_

{{ cta(url="https://juliobbv.com", txt="Julio's Website") }}
