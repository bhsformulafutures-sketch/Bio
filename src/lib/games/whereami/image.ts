import { canvasToBlob, downscale, fileToImage, JPEG_QUALITY } from "@/lib/image-client";

/** A photo picked for a Where Am I round, downscaled and ready to preview. */
export interface PickedPhoto {
  canvas: HTMLCanvasElement;
  /** JPEG data URL for the on-screen preview. */
  url: string;
  width: number;
  height: number;
}

/** Read a picked file, downscale it client-side and prep a preview —
 *  the same compress-before-upload dance the other games do. */
export async function preparePhoto(file: File): Promise<PickedPhoto> {
  const img = await fileToImage(file);
  const { canvas, width, height } = downscale(img);
  return { canvas, url: canvas.toDataURL("image/jpeg", 0.8), width, height };
}

/** Encode the picked photo as the compact JPEG blob we upload. */
export function photoToBlob(photo: PickedPhoto): Promise<Blob> {
  return canvasToBlob(photo.canvas, "image/jpeg", JPEG_QUALITY);
}
