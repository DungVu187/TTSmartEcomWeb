import React, { useEffect, useRef } from "react";

function SafeProductImage({ src, alt, className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src) return undefined;

    let disposed = false;
    let animationFrameId = null;
    let sourceImage = new Image();

    const draw = () => {
      if (disposed || !canvas || !sourceImage.naturalWidth || !sourceImage.naturalHeight) return;

      const width = Math.max(1, Math.round(canvas.clientWidth));
      const height = Math.max(1, Math.round(canvas.clientHeight));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      const context = canvas.getContext("2d", {
        alpha: false,
        willReadFrequently: true,
      });
      if (!context) return;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      const scale = Math.min(width / sourceImage.naturalWidth, height / sourceImage.naturalHeight);
      const drawWidth = Math.max(1, Math.round(sourceImage.naturalWidth * scale));
      const drawHeight = Math.max(1, Math.round(sourceImage.naturalHeight * scale));
      const offsetX = Math.round((width - drawWidth) / 2);
      const offsetY = Math.round((height - drawHeight) / 2);

      context.drawImage(sourceImage, offsetX, offsetY, drawWidth, drawHeight);

      // Force a CPU readback so Chrome does not keep the product thumbnail as
      // the same corrupted GPU texture that can appear on some Windows drivers.
      try {
        const pixels = context.getImageData(0, 0, width, height);
        context.putImageData(pixels, 0, 0);
      } catch (_error) {
        // The image is still drawn even if a future cross-origin URL prevents readback.
      }
    };

    const scheduleDraw = () => {
      if (disposed || animationFrameId !== null) return;

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        draw();
      });
    };

    sourceImage.decoding = "sync";
    sourceImage.onload = scheduleDraw;
    sourceImage.src = src;

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(scheduleDraw)
      : null;
    resizeObserver?.observe(canvas.parentElement || canvas);

    if (!resizeObserver) {
      window.addEventListener("resize", scheduleDraw);
    }

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleDraw);
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      sourceImage.onload = null;
      sourceImage.src = "";
      sourceImage = null;
    };
  }, [src]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label={alt || "Ảnh sản phẩm"}
    />
  );
}

export default SafeProductImage;
