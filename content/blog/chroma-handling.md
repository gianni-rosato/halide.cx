+++
title = "Same File, Different Score?"
date = 2026-02-03
description = "Metrics don't just measure encoder performance; decoding matters too, and even after decoding, not all post-processing is created equal."
+++

{{ hero(src="/img/rocks-hdr.avif", width="1536", height="864", alt="Rocks") }}

In developing our proprietary encoder [Iris](/iris/) for WebP, our aim with public and private testing is to properly demonstrate the value of the encoder compared to alternatives. Cheating benchmarks, overfitting for metrics, or unfairly testing other encoders does not help sell our product, which is meant to provide quality-of-experience improvements for human users above all else.

Investigating WebP's decoding performance led us to begin evaluating different means of presenting the decoded images to metrics. Even within the `dwebp` reference decoder, there are a number of different options that affect how images are decoded.

Beyond WebP, we test competing open-source encoders as well. These should be tested in such a way that they represent their best performance in real-world production scenarios, where client-side decoder options are still highly relevant.

Our findings here are not final, but this blog post aims to get the ball rolling for evaluating decoder differences and means for handling chroma in post-processing.

## Chroma Subsampling

Chroma subsampling is a useful compression technique to improve compression efficiency at low to medium-high fidelity by taking advantage of the human visual system's higher sensitivity to luma-only detail. The YCbCr color space utilizes principles of [opponent color theory](https://en.wikipedia.org/wiki/Opponent_process) and separates luma from chroma, so many encoder implementations still find value in using this colorspace to halve the resolution of the chroma planes (Cb, Cr) and concentrate bits into the luma plane (Y). This is the theoretical basis behind 4:2:0 chroma subsampling: 4 luma pixels for every 1 chroma pixel in each plane. At higher fidelity, maintaining full-resolution chroma planes is often more valuable, and thus 4:4:4 chroma subsampling (all planes at full-resolution) can be much better.

Arguably, one of WebP's most difficult limitations is mandatory 4:2:0 chroma subsampling. This limitation isn't present in JPEG or AVIF, which both support YCbCr in 4:4:4 alongside 4:2:0. There has been some [very cool work](https://skal65535.github.io/yuv/) by [Pascal Massimino](https://skal65535.github.io) on this limitation in libwebp, but properly handling chroma subsampling is a codec-agnostic issue due to Web quality ranges often favoring 4:2:0. The better utilized the lower-resolution chroma planes are, the better the output images will be – this is true for both encoding and decoding.

## Encoding

The aforementioned work by Pascal focuses on taking a full-color input and optimally downsampling the chroma planes. This doesn't involve the WebP codec whatsoever; it is true that `dwebp`'s "fancy" chroma upsampling at decode time may pair well with "Sharp YUV" encodes, but "Sharp YUV" is not a WebP encoder feature – it is a preprocessing feature that libwebp supports, and may be used by any encoder in theory. This is a matter of opinion, but we're not partial to considering gains through "Sharp YUV" preprocessing as *encoder* efficiency, as they may apply to any encoder for any format supporting 4:2:0 chroma subsampling. Measuring pure encoder efficiency should be done by controlling the color conversion process between encoders, as is done via [SVT-AV1's open-source benchmarking tools](https://gitlab.com/AOMediaCodec/SVT-AV1/-/blob/master/test/benchmarking/README.md).

There's lots to discuss with regards to encoding here, but for the sake of this post we're going to focus primarily on decoding.

## Decoding

Compression researcher [Jon Sneyers](http://sneyers.info) once said that "The video codec philosophy has always been 'we just compress matrices of numbers, how to interpret them is not our problem'," which can be interpreted as a call for image compression researchers to do better. While it is true that pre- and post-processing are not coupled to encoder or decoder efficiency, they are still relevant to overall *compression efficiency*. With YCbCr 4:2:0 inputs, we must decide how to represent our one chroma sample per four luma samples via post-processing after decoding. So, what should we do with the decoder's matrices of numbers?

For this blog post, we're going to test a couple of different implementations with some open-source codecs. We'll invariably end up investigating some level of decoder performance here as well, particularly with JPEG.

## Methodology

For encoders, we are testing Google's [jpegli](https://github.com/google/jpegli) for JPEG, [libwebp](https://libwebp.com/) and Iris-WebP for WebP, and [SVT-AV1](https://gitlab.com/AOMediaCodec/SVT-AV1/) for AVIF. For jpegli, color conversion is done internally. For libwebp, we test default color conversion with FFmpeg, internal color conversion, and internal "Sharp YUV" color conversion. Color conversion is done with FFmpeg for SVT-AV1 and Iris, as the differences demonstrated by libwebp's results should get the point across. We have our own input chroma processing algorithm for Iris, but we don't think this is the right place to discuss its impact.

To convert the encoded outputs back to pixels, we are looking at FFmpeg, jpegli's decoder, ImageMagick, `dwebp` from libwebp, and [dav1d](https://www.videolan.org/projects/dav1d.html). Note that WebP and AVIF are both decoded by libwebp and dav1d respectively with every option here; what wraps each decoder is what is different. Alongside default FFmpeg, we're testing a custom filter for chroma: `"scale=flags=lanczos+accurate_rnd+full_chroma_int:param0=5,format=rgb24"`. This string specifies we're using a sharp 5-tap Lanczos scaling algorithm with mathematically accurate rounding and high-quality chroma interpolation, which may result in higher fidelity outputs post-decode.

For metrics, we are looking at [fssimu2](https://github.com/gianni-rosato/fssimu2), [Butteraugli from libjxl](https://github.com/libjxl/libjxl/blob/main/tools/butteraugli_main.cc) at 3-pnorm and an intensity target of 203 nits, and our own [fcvvdp](https://github.com/halidecx/fcvvdp) with the default "fhd" display. These are all perceptual metrics aimed at producing results relevant to the human visual system.

Testing is done on the [gb82 image set](https://github.com/gianni-rosato/gb82-image-set), a diverse photographic image dataset of 25 images all at 576x576. The script used for testing can be found in the open source [decbench repo](https://github.com/gianni-rosato/decbench).

## Results

It is VERY important to note that *this is not an encoder efficiency test*, and that size & quality results between encoders are not controlled in any way. The only relevant results are from the decoder & post-processor implementations, which all come from the same inputs and therefore represent some kind of efficiency improvement if the scores are higher.

Please note that the harmonic mean is not super useful for Butteraugli; there isn't much utility in biasing toward lower Butteraugli scores, as they are better. `dwebp_nofancy` disables the libwebp decoder's internal "fancy" chroma upsampling.

### jpegli

`./dec.py jpegli ~/Pictures/gb82-image-set/png/*.png`

![jpegli_fssimu2](/img/chroma_handling/jpegli_fssimu2.svg)

![jpegli_butter](/img/chroma_handling/jpegli_butter.svg)

![jpegli_fcvvdp](/img/chroma_handling/jpegli_fcvvdp.svg)

### Iris-WebP (FFmpeg color conversion)

![iris_webp_fssimu2](/img/chroma_handling/iris_webp_fssimu2.svg)

![iris_webp_butter](/img/chroma_handling/iris_webp_butteraugli.svg)

![iris_webp_fcvvdp](/img/chroma_handling/iris_webp_fcvvdp.svg)

### libwebp (FFmpeg color conversion)

`./dec.py libwebp ~/Pictures/gb82-image-set/png/*.png`

![libwebp_fssimu2](/img/chroma_handling/libwebp_fssimu2.svg)

![libwebp_butter](/img/chroma_handling/libwebp_butter.svg)

![libwebp_fcvvdp](/img/chroma_handling/libwebp_fcvvdp.svg)

### libwebp (Sharp YUV color conversion)

`./dec.py libwebp_sharpyuv ~/Pictures/gb82-image-set/png/*.png`

![libwebp_sharpyuv_fssimu2](/img/chroma_handling/libwebp_sharpyuv_fssimu2.svg)

![libwebp_sharpyuv_butter](/img/chroma_handling/libwebp_sharpyuv_butter.svg)

![libwebp_sharpyuv_fcvvdp](/img/chroma_handling/libwebp_sharpyuv_fcvvdp.svg)

### libwebp (internal color conversion)

`./dec.py libwebp_default ~/Pictures/gb82-image-set/png/*.png`

![libwebp_internal_fssimu2](/img/chroma_handling/libwebp_internal_fssimu2.svg)

![libwebp_internal_butter](/img/chroma_handling/libwebp_internal_butter.svg)

![libwebp_internal_fcvvdp](/img/chroma_handling/libwebp_internal_fcvvdp.svg)

### SVT-AV1

`./dec.py svtav1 ~/Pictures/gb82-image-set/png/*.png`

![svtav1_fssimu2](/img/chroma_handling/svtav1_fssimu2.svg)

*avifdec's PNG outputs crashed the `butteraugli_main` tool*

![svtav1_butter](/img/chroma_handling/svtav1_butter.svg)

![svtav1_fcvvdp](/img/chroma_handling/svtav1_fcvvdp.svg)

## Perceptual Results

Click the buttons to switch between decoding/post-processing options on this challenging image.

{{ image_switcher(
  id="chroma-decoder",
  images=[
    "/img/chroma_handling/cmp/original.png",
    "/img/chroma_handling/cmp/jpegli.jpg",
    "/img/chroma_handling/cmp/ffmpeg_filtered.png",
    "/img/chroma_handling/cmp/djpegli.png",
    "/img/chroma_handling/cmp/magick.png",
    "/img/chroma_handling/cmp/ffmpeg.png",
  ],
  labels=[ "Source", "Your Browser", "FFmpeg (filtered)", "djpegli", "magick", "FFmpeg" ],
  subtitles=[
    "Source Image",
    "cjpegli --chroma_subsampling 420 -d 1.0 original.png jpegli.jpg",
    "ffmpeg -y -i jpegli.jpg -vf scale=flags=lanczos+accurate_rnd+full_chroma_int:param0=5,format=rgb24 -f image2 -update 1 -frames:v 1 ffmpeg_filtered.png",
    "djpegli jpegli.jpg djpegli.png",
    "magick jpegli.jpg magick.png",
    "ffmpeg -y -i jpegli.jpg -pix_fmt rgb24 -f image2 -update 1 -frames:v 1 ffmpeg.png"
  ],
  alt="Decoder comparison"
) }}

## Conclusion

The Butteraugli results are shocking, and likely merit further investigation. Aside from that, the fact that a >2% fssimu2 efficiency improvement is achievable compared to the baseline in almost every test is valuable; compression researchers fight very hard for 2%, and we get it for free here.

`ffmpeg_filtered` shows very good results across the board. There is potentially room for further investigation here through using other scaling algorithms.

The noteworthy outliers are `djpegli` winning according to fssimu2, and `dwebp` winning when "Sharp YUV" color conversion was used with libwebp.

JPEG decoding is a complex topic we are not going to explore in detail here, but it boils down to the fact that the JPEG spec has a of ambiguity regarding the way images are encoded and decoded.

For libwebp, Pascal's page says: "We utilise the upsampling used at decoding time (dubbed 'fancy upsampling' in libjpeg e.g.) to our advantage," with regards to Sharp YUV. It may be the case that with minor tweaks, Sharp YUV may be made to work better with other chroma scaling methods like we see in `ffmpeg_filtered`. It also isn't conclusive that "fancy upsampling" as it is implemented in libwebp's decoder is actually a net positive; with fancy upsampling disabled, `dwebp_nofancy` ekes out some wins over `dwebp` when Sharp YUV isn't used. Sharp YUV is also disabled by default in libwebp due to its computational complexity (Pascal: "Sharp-YUV locally optimizes the conversion loss, so is more expensive. That's why `-sharp_yuv` is not the default option in cwebp!"), so should `dwebp` be best prepared for the most popular encode use cases, or those that achieve the best performance? Sharp YUV isn't universally perceptually beneficial either, so the problem becomes harder to solve with that in mind.

For our research direction stated at the beginning of this post, we see promising results that tell us using the default tooling for other codecs might be holding them back. `ffmpeg_filtered` wins in many cases, so at least for SVT-AV1 and jpegli, it seems like a valuable option to consider. A future direction may be to explore the computational complexity of different decoders and decode options, or to do more subjective testing and go beyond metrics.

There's always more to explore with multimedia compression, and we've only scratched the surface of pre- and post-processing for 4:2:0 YCbCr here. Halide Compression is built on frontier compression expertise, so if you believe we could be valuable to you, we offer consulting services. Feel free to contact us at our email below if you have any questions about decoder optimization for your pipeline, deploying WebP at scale, or using Iris-WebP to maximize the efficiency of your image delivery solution. Thanks for reading!

{{ cta(url="mailto:mail@halide.cx", txt="Email Us") }}
