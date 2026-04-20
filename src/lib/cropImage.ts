export interface CroppedArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Crop an image and always output JPEG (converts PNG automatically).
 * Returns a File object ready for FormData.
 */
export async function getCroppedImg(
  imageSrc: string,
  croppedAreaPixels: CroppedArea,
  quality = 0.85
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  canvas.width = croppedAreaPixels.width;
  canvas.height = croppedAreaPixels.height;

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    croppedAreaPixels.width,
    croppedAreaPixels.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
        resolve(file);
      },
      "image/jpeg",
      quality
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
}
