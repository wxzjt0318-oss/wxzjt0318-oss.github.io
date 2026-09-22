/**
 * 技能页数据源（纯内容）。
 * 页面展示与筛选规则由 src/config/skillsConfig.ts 控制。
 */
import type { SkillItem } from "@/types/skillsConfig";

export const skillsData: SkillItem[] = [
	// Frontend Skills
	{
		name: "JavaScript",
		description:
			"Modern JavaScript development, including ES6+ syntax, asynchronous programming, and modular development.",
		icon: "logos:javascript",
		category: "frontend",
		level: "advanced",
	},
	{
		name: "TypeScript",
		description:
			"A type-safe superset of JavaScript that enhances code quality and development efficiency.",
		icon: "logos:typescript-icon",
		category: "frontend",
		level: "advanced",
	},
	{
		name: "React",
		description:
			"A JavaScript library for building user interfaces, including Hooks, Context, and state management.",
		icon: "logos:react",
		category: "frontend",
		level: "advanced",
	},
	{
		name: "Vue.js",
		description:
			"A progressive JavaScript framework that is easy to learn and use, suitable for rapid development.",
		icon: "logos:vue",
		category: "frontend",
		level: "intermediate",
	},
	{
		name: "Angular",
		description:
			"An enterprise-level frontend framework developed by Google, a complete single-page application solution.",
		icon: "logos:angular-icon",
		category: "frontend",
		level: "beginner",
	},
	{
		name: "Next.js",
		description:
			"A production-level React framework supporting SSR, SSG, and full-stack development.",
		icon: "logos:nextjs-icon",
		category: "frontend",
		level: "intermediate",
	},
	{
		name: "Nuxt.js",
		description:
			"An intuitive Vue.js framework supporting server-side rendering and static site generation.",
		icon: "logos:nuxt-icon",
		category: "frontend",
		level: "beginner",
	},
	{
		name: "Astro",
		description:
			"A modern static site generator supporting multi-framework integration and excellent performance.",
		icon: "logos:astro-icon",
		category: "frontend",
		level: "advanced",
	},
	{
		name: "Tailwind CSS",
		description:
			"A utility-first CSS framework for rapidly building modern user interfaces.",
		icon: "logos:tailwindcss-icon",
		category: "frontend",
		level: "advanced",
	},
	{
		name: "Sass/SCSS",
		description:
			"A CSS preprocessor providing advanced features like variables, nesting, and mixins.",
		icon: "logos:sass",
		category: "frontend",
		level: "intermediate",
	},
	{
		name: "Webpack",
		description: "A static module bundler for modern JavaScript applications.",
		icon: "logos:webpack",
		category: "frontend",
		level: "intermediate",
	},
	{
		name: "Vite",
		description:
			"Next-generation frontend build tool with fast cold starts and hot updates.",
		icon: "logos:vitejs",
		category: "frontend",
		level: "intermediate",
	},

	// Backend Skills
	{
		name: "Node.js",
		description:
			"A JavaScript runtime based on Chrome V8 engine, used for server-side development.",
		icon: "logos:nodejs-icon",
		category: "backend",
		level: "intermediate",
	},
	{
		name: "Python",
		description:
			"A general-purpose programming language suitable for web development, data analysis, machine learning, and more.",
		icon: "logos:python",
		category: "backend",
		level: "intermediate",
	},
	{
		name: "Java",
		description:
			"A mainstream programming language for enterprise application development, cross-platform and object-oriented.",
		icon: "logos:java",
		category: "backend",
		level: "intermediate",
	},
	{
		name: "C#",
		description:
			"A modern object-oriented programming language developed by Microsoft, suitable for the .NET ecosystem.",
		icon: "devicon:csharp",
		category: "backend",
		level: "intermediate",
	},
	{
		name: "Go",
		description:
			"An efficient programming language developed by Google, suitable for cloud-native and microservices development.",
		icon: "logos:go",
		category: "backend",
		level: "beginner",
	},
	{
		name: "Rust",
		description:
			"A systems programming language focusing on safety, speed, and concurrency, with no garbage collector.",
		icon: "logos:rust",
		category: "backend",
		level: "beginner",
	},
	{
		name: "C++",
		description:
			"A high-performance systems programming language widely used in game development, system software, and embedded development.",
		icon: "logos:c-plusplus",
		category: "backend",
		level: "intermediate",
	},
	{
		name: "C",
		description:
			"A low-level systems programming language, the foundation for operating systems and embedded systems development.",
		icon: "logos:c",
		category: "backend",
		level: "intermediate",
	},
	{
		name: "Kotlin",
		description:
			"A modern programming language developed by JetBrains, fully compatible with Java, the preferred choice for Android development.",
		icon: "logos:kotlin-icon",
		category: "backend",
		level: "beginner",
	},
	{
		name: "Swift",
		description:
			"A modern programming language developed by Apple for iOS, macOS, watchOS, and tvOS development.",
		icon: "logos:swift",
		category: "backend",
		level: "beginner",
	},
	{
		name: "Ruby",
		description:
			"A dynamic, open-source programming language focusing on simplicity and productivity, the foundation of the Rails framework.",
		icon: "logos:ruby",
		category: "backend",
		level: "beginner",
	},
	{
		name: "PHP",
		description:
			"A widely-used server-side scripting language, particularly suitable for web development.",
		icon: "logos:php",
		category: "backend",
		level: "intermediate",
	},
	{
		name: "Express.js",
		description: "A fast, minimalist Node.js web application framework.",
		icon: "simple-icons:express",
		category: "backend",
		level: "intermediate",
	},
	{
		name: "Spring Boot",
		description:
			"The most popular enterprise application development framework in the Java ecosystem.",
		icon: "logos:spring-icon",
		category: "backend",
		level: "intermediate",
	},
	{
		name: "Django",
		description:
			"A high-level Python web framework with rapid development and clean, pragmatic design.",
		icon: "logos:django-icon",
		category: "backend",
		level: "beginner",
	},

	// Database Skills
	{
		name: "MySQL",
		description:
			"The world's most popular open-source relational database management system, widely used in web applications.",
		icon: "logos:mysql-icon",
		category: "database",
		level: "advanced",
	},
	{
		name: "PostgreSQL",
		description:
			"A powerful open-source relational database management system.",
		icon: "logos:postgresql",
		category: "database",
		level: "intermediate",
	},
	{
		name: "Redis",
		description:
			"A high-performance in-memory data structure store, used as a database, cache, and message broker.",
		icon: "logos:redis",
		category: "database",
		level: "intermediate",
	},
	{
		name: "MongoDB",
		description:
			"A document-oriented NoSQL database with a flexible data model.",
		icon: "logos:mongodb-icon",
		category: "database",
		level: "intermediate",
	},
	{
		name: "SQLite",
		description:
			"A lightweight embedded relational database, suitable for mobile applications and small projects.",
		icon: "simple-icons:sqlite",
		category: "database",
		level: "intermediate",
	},
	{
		name: "Firebase",
		description:
			"Google's mobile and web application development platform providing real-time database and authentication services.",
		icon: "simple-icons:firebase",
		category: "database",
		level: "intermediate",
	},

	// Tools
	{
		name: "Git",
		description:
			"A distributed version control system, an essential tool for code management and team collaboration.",
		icon: "logos:git-icon",
		category: "tooling",
		level: "advanced",
	},
	{
		name: "VS Code",
		description:
			"A lightweight but powerful code editor with a rich plugin ecosystem.",
		icon: "logos:visual-studio-code",
		category: "tooling",
		level: "expert",
	},
	{
		name: "WebStorm",
		description:
			"A professional JavaScript and web development IDE developed by JetBrains with intelligent code assistance.",
		icon: "logos:webstorm",
		category: "tooling",
		level: "advanced",
	},
	{
		name: "IntelliJ IDEA",
		description:
			"JetBrains flagship IDE, the preferred tool for Java development with powerful intelligent coding assistance.",
		icon: "logos:intellij-idea",
		category: "tooling",
		level: "intermediate",
	},
	{
		name: "PyCharm",
		description:
			"A professional Python IDE by JetBrains providing intelligent code analysis and debugging features.",
		icon: "logos:pycharm",
		category: "tooling",
		level: "intermediate",
	},
	{
		name: "Rider",
		description:
			"A cross-platform .NET IDE by JetBrains supporting development in C#, VB.NET, F#, and other languages.",
		icon: "logos:rider",
		category: "tooling",
		level: "beginner",
	},
	{
		name: "GoLand",
		description:
			"A professional Go language IDE by JetBrains providing intelligent coding assistance and debugging tools.",
		icon: "logos:goland",
		category: "tooling",
		level: "beginner",
	},
	{
		name: "Docker",
		description:
			"A containerization platform that simplifies application deployment and environment management.",
		icon: "logos:docker-icon",
		category: "tooling",
		level: "intermediate",
	},
	{
		name: "Kubernetes",
		description:
			"A container orchestration platform for automating deployment, scaling, and management of containerized applications.",
		icon: "logos:kubernetes",
		category: "tooling",
		level: "beginner",
	},
	{
		name: "Nginx",
		description: "A high-performance web server and reverse proxy server.",
		icon: "logos:nginx",
		category: "tooling",
		level: "intermediate",
	},
	{
		name: "Apache HTTP Server",
		description:
			"The world's most popular web server software, a stable and reliable HTTP server.",
		icon: "logos:apache",
		category: "tooling",
		level: "intermediate",
	},
	{
		name: "OpenResty",
		description:
			"A high-performance web platform based on Nginx and LuaJIT, supporting dynamic web application development.",
		icon: "simple-icons:nginx",
		category: "tooling",
		level: "beginner",
	},
	{
		name: "Apache Tomcat",
		description:
			"A Java Servlet container and web server, the standard deployment environment for Java web applications.",
		icon: "logos:tomcat",
		category: "tooling",
		level: "intermediate",
	},
	{
		name: "AWS",
		description:
			"Amazon's cloud platform providing comprehensive cloud computing solutions.",
		icon: "logos:aws",
		category: "tooling",
		level: "intermediate",
	},
	{
		name: "Linux",
		description:
			"An open-source operating system, the preferred choice for server deployment and development environments.",
		icon: "logos:linux-tux",
		category: "tooling",
		level: "intermediate",
	},
	{
		name: "Postman",
		description:
			"An API development and testing tool that simplifies API design, testing, and documentation.",
		icon: "logos:postman-icon",
		category: "tooling",
		level: "intermediate",
	},
	{
		name: "Figma",
		description:
			"A collaborative interface design tool for UI/UX design and prototyping.",
		icon: "logos:figma",
		category: "tooling",
		level: "intermediate",
	},
	{
		name: "Photoshop",
		description: "Professional image editing and design software.",
		icon: "logos:adobe-photoshop",
		category: "tooling",
		level: "intermediate",
	},

	// Other Skills
	{
		name: "GraphQL",
		description:
			"An API query language and runtime providing a more efficient, powerful, and flexible way to fetch data.",
		icon: "logos:graphql",
		category: "other",
		level: "beginner",
	},
	{
		name: "Elasticsearch",
		description:
			"A distributed search and analytics engine used for full-text search and data analysis.",
		icon: "logos:elasticsearch",
		category: "other",
		level: "beginner",
	},
	{
		name: "Jest",
		description:
			"A JavaScript testing framework focused on simplicity and ease of use.",
		icon: "logos:jest",
		category: "other",
		level: "intermediate",
	},
	{
		name: "Cypress",
		description: "A modern end-to-end testing framework for web applications.",
		icon: "logos:cypress-icon",
		category: "other",
		level: "beginner",
	},
];

/** 获取所有技能数据列表 */
export function getSkillsList(): SkillItem[] {
	return skillsData;
}
