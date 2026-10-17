import type { PioConfig } from "@/types/pioConfig";

export type { PioConfig };
export interface PioProps {
	config?: Partial<PioConfig>;
}
