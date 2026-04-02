import type { Skill } from "../skills/types";

export interface SkillsCategoryProps {
	category: string;
	skills: Skill[];
	categoryText: string;
	class?: string;
}
