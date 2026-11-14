/** State shared between the private-photos server actions and the console. */
export interface PhotosState {
  ok: boolean;
  error?: string;
  message?: string;
}

export const initialPhotosState: PhotosState = { ok: false };
