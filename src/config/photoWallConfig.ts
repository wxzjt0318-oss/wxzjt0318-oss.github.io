import type { PhotoWallConfig } from "../types/photoWallConfig.ts";
import { withUserConfig } from "../utils/config-overlay.ts";

export const photoWallConfig: PhotoWallConfig = withUserConfig("photoWall", {
	enable: true,
	albums: ["celia"],
});
