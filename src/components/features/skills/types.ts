export interface Skill {
	id: string;
	name: string;
	description: string;
	icon?: string;
	category: string;
	level: "beginner" | "intermediate" | "advanced" | "expert";
	experience:
		| {
				years: number;
				months: number;
		  }
		| string;
	relatedProjects?: string[];
	certifications?: string[];
	color?: string;
}

export interface SkillCardProps {
	skill: Skill;
	size?: "small" | "medium" | "large";
	showProgress?: boolean;
	showIcon?: boolean;
}
