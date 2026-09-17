/**
 * 时间线页数据源（纯内容）。
 * 页面展示与筛选规则由 src/config/timelineConfig.ts 控制。
 */
import type { TimelineItem } from "@/types/timelineConfig";

export const timelineData: TimelineItem[] = [
	{
		title: "Frontend Development Intern",
		date: "2024.07 – 2024.08",
		category: "career",
		subtitle: "TechStart Internet Company",
		location: "Beijing",
		description:
			"Summer internship at an internet company, participating in frontend development of web applications.",
		highlights: [
			"Completed user interface component development",
			"Learned team collaboration and code standards",
			"Received outstanding internship performance certificate",
		],
		tags: ["React", "JavaScript", "CSS3", "Git", "Figma"],
		icon: "material-symbols:work",
		featured: true,
	},
	{
		title: "Mizuki Personal Blog Project",
		date: "2024.06 – 2024.08",
		category: "project",
		description:
			"A personal blog website developed using the Astro framework as a practical project for learning frontend technologies.",
		highlights: [
			"Mastered modern frontend development tech stack",
			"Learned responsive design and user experience optimization",
			"Completed the full process from design to deployment",
		],
		tags: ["Astro", "TypeScript", "Tailwind CSS", "Git"],
		links: [
			{
				label: "GitHub Repository",
				url: "https://github.com/example/mizuki-blog",
			},
			{
				label: "Live Demo",
				url: "https://mizuki-demo.example.com",
			},
		],
		icon: "material-symbols:code",
		featured: true,
	},
	{
		title: "Completed Web Development Online Course",
		date: "2024.01 – 2024.05",
		category: "milestone",
		subtitle: "Mooc Website",
		description:
			"Completed a full-stack web development online course, systematically learning frontend and backend development technologies.",
		highlights: [
			"Received course completion certificate",
			"Completed 5 practical projects",
			"Mastered full-stack development fundamentals",
		],
		tags: ["HTML", "CSS", "JavaScript", "Node.js", "Express"],
		links: [
			{
				label: "Course Certificate",
				url: "https://certificates.example.com/web-dev",
			},
		],
		icon: "material-symbols:verified",
	},
	{
		title: "Student Management System Course Project",
		date: "2023.11 – 2023.12",
		category: "project",
		description:
			"Final project for the database course, developed a complete student information management system.",
		highlights: [
			"Received excellent course project grade",
			"Implemented complete CRUD functionality",
			"Learned database design and optimization",
		],
		tags: ["Java", "MySQL", "Swing", "JDBC"],
		icon: "material-symbols:database",
	},
	{
		title: "University Programming Contest",
		date: "2023.10",
		category: "milestone",
		subtitle: "School of Computer Science",
		location: "Beijing Institute of Technology",
		description:
			"Participated in a programming contest held by the university, improving algorithm and programming skills.",
		highlights: [
			"Won third prize in university contest",
			"Improved algorithmic thinking ability",
			"Strengthened programming fundamentals",
		],
		tags: ["C++", "Algorithms", "Data Structures"],
		icon: "material-symbols:emoji-events",
	},
	{
		title: "Part-time Programming Tutor",
		date: "2023.09 – 2024.01",
		category: "career",
		subtitle: "Programming Tutor",
		description:
			"Provided programming tutoring for high school students, helping them learn Python basics.",
		highlights: [
			"Helped 3 students master Python basics",
			"Improved expression and communication skills",
			"Gained teaching experience",
		],
		tags: ["Python", "Teaching", "Communication"],
		icon: "material-symbols:school",
	},
	{
		title: "Studying Computer Science and Technology",
		date: "2022.09 – Present",
		category: "education",
		subtitle: "Beijing Institute of Technology",
		location: "Beijing",
		description:
			"Currently studying Computer Science and Technology, focusing on web development and software engineering.",
		highlights: [
			"Current GPA: 3.6/4.0",
			"Completed data structures and algorithms course project",
			"Participated in multiple course project developments",
		],
		tags: ["Java", "Python", "JavaScript", "HTML/CSS", "MySQL"],
		icon: "material-symbols:school",
		featured: true,
	},
	{
		title: "First Programming Experience",
		date: "2021.03",
		category: "education",
		description:
			"First encountered programming in high school IT class, started learning Python basic syntax.",
		highlights: [
			'Completed first "Hello World" program',
			"Learned basic loops and conditional statements",
			"Developed interest in programming",
		],
		tags: ["Python", "Basic Programming Concepts"],
		icon: "material-symbols:code",
	},
	{
		title: "High School Graduation",
		date: "2019.09 – 2022.06",
		category: "education",
		subtitle: "No.1 High School of Jinan",
		location: "Jinan, Shandong",
		description:
			"Graduated from high school with excellent grades and was admitted to the Computer Science and Technology program at Beijing Institute of Technology.",
		highlights: [
			"College entrance exam score: 620",
			"Received municipal model student award",
			"Won provincial second prize in math competition",
		],
		icon: "material-symbols:school",
	},
];

/** 获取所有时间线数据列表 */
export function getTimelineList(): TimelineItem[] {
	return timelineData;
}
