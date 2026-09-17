/**
 * 项目页数据源（纯内容）。
 * 页面展示与筛选规则由 src/config/projectsConfig.ts 控制。
 */
import type { ProjectItem } from "@/types/projectsConfig";

export const projectsData: ProjectItem[] = [
	{
		key: "mizuki-blog",
		title: "Mizuki Blog Theme",
		summary:
			"Modern blog theme developed based on the Astro framework, supporting multilingual, dark mode, and responsive design features.",
		category: "web",
		phase: "shipped",
		technologies: ["Astro", "TypeScript", "Tailwind CSS", "Svelte"],
		featured: true,
		website: "https://blog.example.com",
		repository: "https://github.com/example/mizuki",
		year: "2024",
	},
	{
		key: "portfolio-website",
		title: "Personal Portfolio",
		summary:
			"Personal portfolio website showcasing project experience and technical skills.",
		category: "web",
		phase: "shipped",
		technologies: ["React", "Next.js", "TypeScript", "Framer Motion"],
		featured: true,
		website: "https://portfolio.example.com",
		repository: "https://github.com/example/portfolio",
		year: "2023",
	},
	{
		key: "task-manager-app",
		title: "Task Manager App",
		summary:
			"Cross-platform task management application supporting team collaboration and project management.",
		category: "mobile",
		phase: "building",
		technologies: ["React Native", "TypeScript", "Redux", "Firebase"],
		year: "2024",
	},
	{
		key: "data-visualization-tool",
		title: "Data Visualization Tool",
		summary:
			"Data visualization tool supporting multiple chart types and interactive analysis.",
		category: "web",
		phase: "shipped",
		technologies: ["Vue.js", "D3.js", "TypeScript", "Node.js"],
		website: "https://dataviz.example.com",
		year: "2023",
	},
	{
		key: "e-commerce-platform",
		title: "E-commerce Platform",
		summary:
			"Full-stack e-commerce platform including user management, product management, and order processing features.",
		category: "web",
		phase: "exploring",
		technologies: ["Next.js", "Node.js", "PostgreSQL", "Stripe"],
		year: "2024",
	},
];

/** 获取所有项目数据列表 */
export function getProjectsList(): ProjectItem[] {
	return projectsData;
}
