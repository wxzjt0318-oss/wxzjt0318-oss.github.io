import type { TimelineItem } from "../timeline/types";

export interface TimelineCurrentProps {
	items: TimelineItem[];
	title?: string;
	class?: string;
}
