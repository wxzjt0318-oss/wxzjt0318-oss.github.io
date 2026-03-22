import type { TimelineItem } from "../timeline/types";

export interface TimelineHistoryProps {
	items: TimelineItem[];
	title?: string;
	class?: string;
}
