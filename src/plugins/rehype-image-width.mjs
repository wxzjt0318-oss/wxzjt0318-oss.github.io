import { visit } from "unist-util-visit";

export function rehypeImageWidth() {
	// 优化正则表达式：使用更精确的模式，避免不必要的匹配
	// 仅在alt文本末尾匹配 w-XX% 格式
	const widthRegex = /\s+w-([0-9]+)%$/;
	
	// 缓存样式字符串，避免重复创建
	const imgStyle = "display: block; margin: 0 auto;";
	const figStyle = "margin: 1em 0;";
	const figcaptionStyle = "text-align: center; margin-top: 0.5em; font-size: 0.9em; color: #666;";

	return (tree) => {
		// 批量处理所有图片节点
		const imageNodes = [];
		
		// 第一步：收集所有符合条件的图片节点
		visit(tree, "element", (node, index, parent) => {
			if (
				node.tagName === "img" &&
				node.properties &&
				node.properties.alt &&
				parent
			) {
				imageNodes.push({ node, index, parent });
			}
		});
		
		// 第二步：批量处理收集到的图片节点
		imageNodes.forEach(({ node, index, parent }) => {
			const alt = node.properties.alt;
			const match = alt.match(widthRegex);

			if (match) {
				const width = match[1];
				
				// 优化属性更新
				node.properties.alt = alt.replace(widthRegex, "").trim();
				node.properties.width = `${width}%`;
				
				// 合并现有样式，而不是完全替换
				if (node.properties.style) {
					// 如果已有样式，检查是否需要添加新样式
					if (!node.properties.style.includes("display:")) {
						node.properties.style += "; display: block;";
					}
					if (!node.properties.style.includes("margin:")) {
						node.properties.style += "; margin: 0 auto;";
					}
				} else {
					node.properties.style = imgStyle;
				}

				const figureChildren = [node];

				if (node.properties.title) {
					// 优化figcaption创建
					const figcaption = {
						type: "element",
						tagName: "figcaption",
						properties: {
							style: figcaptionStyle,
						},
						children: [
							{
								type: "text",
								value: node.properties.title,
							},
						],
					};
					figureChildren.push(figcaption);
				}

				// 优化figure创建
				const figure = {
					type: "element",
					tagName: "figure",
					properties: {
						style: figStyle,
					},
					children: figureChildren,
				};

				// 替换节点
				if (parent && index !== undefined) {
					parent.children[index] = figure;
				}
			}
		});
	};
}

