/* ----

# Pio Plugin
# By: Dreamer-Paul
# Last Update: 2022.8.12

一个支持更换 Live2D 模型的 JS 插件

本代码为奇趣保罗原创，并遵守 GPL 2.0 开源协议。欢迎访问我的博客：https://paugram.com

---- */

var Paul_Pio = function (prop) {
	const current = {
		idol: 0,
		timeout: undefined,
		menu: document.querySelector(".pio-container .pio-action"),
		canvas: document.getElementById("pio"),
		body: document.querySelector(".pio-container"),
		root: document.location.origin + "/",
	};

	// 工具通用函数
	const tools = {
		// 创建内容
		create: (tag, options) => {
			const el = document.createElement(tag);
			options.class && (el.className = options.class);

			return el;
		},
		// 随机内容
		rand: (arr) => {
			return arr[Math.floor(Math.random() * arr.length + 1) - 1];
		},
		// 是否为移动设备
		isMobile: () => {
			let ua = window.navigator.userAgent.toLowerCase();
			ua =
				ua.indexOf("mobile") ||
				ua.indexOf("android") ||
				ua.indexOf("ios");

			return window.innerWidth < 500 || ua !== -1;
		},
	};

	const elements = {
		home: tools.create("span", { class: "pio-home" }),
		skin: tools.create("span", { class: "pio-skin" }),
		info: tools.create("span", { class: "pio-info" }),
		night: tools.create("span", { class: "pio-night" }),
		close: tools.create("span", { class: "pio-close" }),

		dialog: tools.create("div", { class: "pio-dialog" }),
		show: tools.create("div", { class: "pio-show" }),
	};

	current.body.appendChild(elements.dialog);
	current.body.appendChild(elements.show);

	/* - 方法 */
	const modules = {
		// 更换模型
		idol: () => {
			current.idol < prop.model.length - 1
				? current.idol++
				: (current.idol = 0);

			return current.idol;
		},
		// 创建对话框方法
		message: (text, options = {}) => {
			const { dialog } = elements;

			if (text.constructor === Array) {
				dialog.innerText = tools.rand(text);
			} else if (text.constructor === String) {
				dialog[options.html ? "innerHTML" : "innerText"] = text;
			} else {
				dialog.innerText = "输入内容出现问题了 X_X";
			}

			dialog.classList.add("active");

			current.timeout = clearTimeout(current.timeout) || undefined;
			current.timeout = setTimeout(() => {
				dialog.classList.remove("active");
			}, options.time || 3000);
		},
		// 移除方法
		destroy: () => {
			this.initHidden();
			localStorage.setItem("posterGirl", "0");
		},
	};

	this.destroy = modules.destroy;
	this.message = modules.message;

	/* - 提示操作 */
	const action = {
		// 欢迎
		welcome: () => {
			if (document.referrer && document.referrer.includes(current.root)) {
				const referrer = document.createElement("a");
				referrer.href = document.referrer;

				if (prop.content.referer) {
					modules.message(
						prop.content.referer.replace(
							/%t/,
							`“${referrer.hostname}”`,
						),
					);
				} else {
					modules.message(`欢迎来自 “${referrer.hostname}” 的朋友！`);
				}
			} else if (prop.tips) {
				let text,
					hour = new Date().getHours();

				if (hour > 22 || hour <= 5) {
					text = "你是夜猫子呀？这么晚还不睡觉，明天起的来嘛";
				} else if (hour > 5 && hour <= 8) {
					text = "早上好！";
				} else if (hour > 8 && hour <= 11) {
					text = "上午好！工作顺利嘛，不要久坐，多起来走动走动哦！";
				} else if (hour > 11 && hour <= 14) {
					text = "中午了，工作了一个上午，现在是午餐时间！";
				} else if (hour > 14 && hour <= 17) {
					text = "午后很容易犯困呢，今天的运动目标完成了吗？";
				} else if (hour > 17 && hour <= 19) {
					text = "傍晚了！窗外夕阳的景色很美丽呢，最美不过夕阳红~";
				} else if (hour > 19 && hour <= 21) {
					text = "晚上好，今天过得怎么样？";
				} else if (hour > 21 && hour <= 23) {
					text = "已经这么晚了呀，早点休息吧，晚安~";
				} else {
					text = "奇趣保罗说：这个是无法被触发的吧，哈哈";
				}

				modules.message(text);
			} else {
				modules.message(prop.content.welcome || "欢迎来到本站！");
			}
		},
		// 触摸
		touch: () => {
			current.canvas.onclick = (ev) => {
				// 随机选择一个交互动作
				const interactionMotions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // 交互动作索引
				const randomMotion =
					interactionMotions[
						Math.floor(Math.random() * interactionMotions.length)
					];

				// 随机选择一个表情
				const expressions = [0, 1, 2, 3, 4, 5]; // 表情索引
				const randomExpression =
					expressions[Math.floor(Math.random() * expressions.length)];

				// 执行交互动作和表情
				actionManager.execute(
					"motion",
					{
						motionGroup: "",
						motionIndex: randomMotion,
						duration: 2000,
					},
					actionManager.PRIORITY.INTERACTION,
				);

				actionManager.execute(
					"expression",
					{
						expressionIndex: randomExpression,
						duration: 1500,
					},
					actionManager.PRIORITY.EXPRESSION,
				);

				// 显示交互消息
				modules.message(
					prop.content.touch || [
						"你在干什么？",
						"再摸我就报警了！",
						"HENTAI!",
						"不可以这样欺负我啦！",
						"哎呀，你弄疼我了！",
						"讨厌啦~",
						"嘿嘿，好痒啊！",
						"你想和我玩吗？",
					],
				);
			};
		},
		// 右侧按钮
		buttons: () => {
			// 返回首页 - 使用 Swup 无刷新跳转
			elements.home.onclick = () => {
				// 检查 Swup 是否可用
				if (typeof window !== "undefined" && window.swup) {
					try {
						// 使用 Swup 进行无刷新跳转
						window.swup.navigate("/");
					} catch (error) {
						console.error("Swup navigation failed:", error);
						// 降级到普通跳转
						location.href = current.root;
					}
				} else {
					// Swup 不可用时使用普通跳转
					location.href = current.root;
				}
			};
			elements.home.onmouseover = () => {
				modules.message(prop.content.home || "点击这里回到首页！");
			};
			current.menu.appendChild(elements.home);

			// 更换模型
			if (prop.model && prop.model.length > 1) {
				elements.skin.onclick = () => {
					loadlive2d("pio", prop.model[modules.idol()]);

					prop.content.skin &&
						modules.message(
							prop.content.skin[1] || "新衣服真漂亮~",
						);
				};
				elements.skin.onmouseover = () => {
					prop.content.skin &&
						modules.message(
							prop.content.skin[0] || "想看看我的新衣服吗？",
						);
				};
				current.menu.appendChild(elements.skin);
			}

			// 关于我
			elements.info.onclick = () => {
				window.open(
					prop.content.link ||
						"https://paugram.com/coding/add-poster-girl-with-plugin.html",
				);
			};
			elements.info.onmouseover = () => {
				modules.message("想了解更多关于我的信息吗？");
			};
			current.menu.appendChild(elements.info);

			// 夜间模式
			if (prop.night) {
				elements.night.onclick = () => {
					typeof prop.night === "function"
						? prop.night()
						: eval(prop.night);
				};
				elements.night.onmouseover = () => {
					modules.message("夜间点击这里可以保护眼睛呢");
				};
				current.menu.appendChild(elements.night);
			}

			// 关闭看板娘
			elements.close.onclick = () => {
				modules.destroy();
			};
			elements.close.onmouseover = () => {
				modules.message(prop.content.close || "QWQ 下次再见吧~");
			};
			current.menu.appendChild(elements.close);
		},
		// 自定义选择器
		custom: () => {
			prop.content.custom.forEach((item) => {
				const el = document.querySelectorAll(item.selector);

				if (!el.length) return;

				for (let i = 0; i < el.length; i++) {
					if (item.type === "read") {
						el[i].onmouseover = (ev) => {
							const text =
								ev.currentTarget.title ||
								ev.currentTarget.innerText;
							modules.message(
								"想阅读 %t 吗？".replace(
									/%t/,
									"“" + text + "”",
								),
							);
						};
					} else if (item.type === "link") {
						el[i].onmouseover = (ev) => {
							const text =
								ev.currentTarget.title ||
								ev.currentTarget.innerText;
							modules.message(
								"想了解一下 %t 吗？".replace(
									/%t/,
									"“" + text + "”",
								),
							);
						};
					} else if (item.text) {
						el[i].onmouseover = () => {
							modules.message(t.text);
						};
					}
				}
			});
		},
	};

	/* - 场景识别系统 */
	const sceneDetector = {
		// 检测当前场景类型
		detectScene: () => {
			const path = window.location.pathname;
			const hour = new Date().getHours();

			// 根据时间判断场景
			let timeScene = "day";
			if (hour >= 22 || hour <= 6) {
				timeScene = "night";
			} else if (hour > 6 && hour <= 12) {
				timeScene = "morning";
			} else if (hour > 12 && hour <= 18) {
				timeScene = "afternoon";
			}

			// 根据页面路径判断场景
			let pageScene = "home";
			if (path.includes("/posts/") || path.includes("/article/")) {
				pageScene = "article";
			} else if (path.includes("/about/")) {
				pageScene = "about";
			} else if (path.includes("/archive/")) {
				pageScene = "archive";
			} else if (
				path.includes("/tags/") ||
				path.includes("/categories/")
			) {
				pageScene = "category";
			}

			return { timeScene, pageScene };
		},

		// 根据场景获取推荐动作
		getRecommendedAction: (scene) => {
			const { timeScene, pageScene } = scene;

			// 场景动作映射表
			const sceneActions = {
				home: {
					morning: { motion: 0, expression: 1, duration: 3000 }, // 早晨空闲动作
					afternoon: { motion: 11, expression: 2, duration: 3500 }, // 下午空闲动作
					evening: { motion: 12, expression: 3, duration: 3000 }, // 傍晚空闲动作
					night: { motion: 13, expression: 4, duration: 4000 }, // 夜晚空闲动作
				},
				article: {
					default: { motion: 0, expression: 0, duration: 5000 }, // 阅读时的安静动作
				},
				about: {
					default: { motion: 2, expression: 2, duration: 3500 }, // 关于页面的友好动作
				},
				archive: {
					default: { motion: 1, expression: 1, duration: 3000 }, // 归档页面的探索动作
				},
				category: {
					default: { motion: 0, expression: 0, duration: 3000 }, // 分类页面的安静动作
				},
			};

			// 获取场景对应的动作
			const pageConfig = sceneActions[pageScene] || sceneActions.home;
			return pageConfig[timeScene] || pageConfig.default;
		},
	};

	/* - 动作管理 */
	const actionManager = {
		// 动作优先级
		PRIORITY: {
			IDLE: 1,
			EXPRESSION: 2,
			INTERACTION: 3,
			SYSTEM: 4,
		},

		// 当前执行的动作
		currentAction: null,

		// 动作队列
		actionQueue: [],

		// 执行动作，支持优先级管理
		execute: (actionType, actionData, priority = this.PRIORITY.IDLE) => {
			// 检查优先级，如果当前有更高优先级的动作正在执行，则将当前动作加入队列
			if (this.currentAction && this.currentAction.priority > priority) {
				this.actionQueue.push({
					type: actionType,
					data: actionData,
					priority,
				});
				return;
			}

			// 执行新动作
			this.currentAction = { type: actionType, priority };

			// 根据动作类型执行不同的处理
			switch (actionType) {
				case "motion":
					// 执行动作
					if (window.loadlive2d && current.canvas) {
						// 使用Live2D SDK的动作播放功能
						try {
							// 这里需要根据具体的Live2D SDK API进行调整
							// 示例：live2d.playMotion(actionData.motionGroup, actionData.motionIndex);
						} catch (e) {
							console.error("Failed to play motion:", e);
						}
					}
					break;
				case "expression":
					// 执行表情
					if (window.loadlive2d && current.canvas) {
						try {
							// 示例：live2d.setExpression(actionData.expressionIndex);
						} catch (e) {
							console.error("Failed to set expression:", e);
						}
					}
					break;
			}

			// 动作执行完成后，处理队列中的下一个动作
			const completeAction = () => {
				this.currentAction = null;
				if (this.actionQueue.length > 0) {
					const nextAction = this.actionQueue.shift();
					this.execute(
						nextAction.type,
						nextAction.data,
						nextAction.priority,
					);
				} else {
					// 动作队列为空时，根据场景执行推荐动作
					this.executeSceneAction();
				}
			};

			// 模拟动作执行时间，实际应该监听动作完成事件
			setTimeout(completeAction, actionData.duration || 2000);
		},

		//// 根据场景执行推荐动作
		executeSceneAction: () => {
			const scene = sceneDetector.detectScene();
			const recommendedAction = sceneDetector.getRecommendedAction(scene);

			// 执行场景推荐动作
			this.execute(
				"motion",
				{
					motionGroup: "",
					motionIndex: recommendedAction.motion,
					duration: recommendedAction.duration,
				},
				this.PRIORITY.IDLE,
			);

			// 执行场景推荐表情
			this.execute(
				"expression",
				{
					expressionIndex: recommendedAction.expression,
					duration: recommendedAction.duration - 500,
				},
				this.PRIORITY.EXPRESSION,
			);
		},

		// 清除动作队列
		clearQueue: () => {
			this.actionQueue = [];
		},

		// 立即执行动作，中断当前动作
		forceExecute: (
			actionType,
			actionData,
			priority = this.PRIORITY.SYSTEM,
		) => {
			this.clearQueue();
			this.execute(actionType, actionData, priority);
		},
	};

	/* - 运行 */
	const begin = {
		static: () => {
			current.body.classList.add("static");
		},
		fixed: () => {
			action.touch();
			action.buttons();
			// 添加空闲动作
			actionManager.execute("motion", {
				motionGroup: "",
				motionIndex: 0,
				duration: 3000,
			});
		},
		draggable: () => {
			action.touch();
			action.buttons();
			// 添加空闲动作
			actionManager.execute("motion", {
				motionGroup: "",
				motionIndex: 0,
				duration: 3000,
			});

			const body = current.body;
			const canvas = current.canvas;

			const location = {
				x: 0,
				y: 0,
			};

			const mousedown = (ev) => {
				ev.preventDefault();

				const rect = body.getBoundingClientRect();
				location.x = ev.clientX - rect.left;
				location.y = ev.clientY - rect.top;

				document.addEventListener("mousemove", mousemove);
				document.addEventListener("mouseup", mouseup);
			};

			const mousemove = (ev) => {
				body.classList.add("active");
				body.classList.remove("right");

				body.style.left = ev.clientX - location.x + "px";
				body.style.top = ev.clientY - location.y + "px";
				body.style.bottom = "auto";
			};

			const mouseup = () => {
				body.classList.remove("active");
				document.removeEventListener("mousemove", mousemove);
			};

			canvas.onmousedown = mousedown;
		},
	};

	// 运行
	this.init = (noModel) => {
		// 未隐藏 + 非手机版，出现操作功能
		if (!(prop.hidden && tools.isMobile())) {
			if (!noModel) {
				action.welcome();
				loadlive2d("pio", prop.model[0]);
			}

			switch (prop.mode) {
				case "static":
					begin.static();
					break;
				case "fixed":
					begin.fixed();
					break;
				case "draggable":
					begin.draggable();
					break;
			}

			prop.content.custom && action.custom();
		}
	};

	// 隐藏状态
	this.initHidden = () => {
		// ! 清除预设好的间距
		if (prop.mode === "draggable") {
			current.body.style.top = null;
			current.body.style.left = null;
			current.body.style.bottom = null;
		}

		current.body.classList.add("hidden");
		elements.dialog.classList.remove("active");

		elements.show.onclick = () => {
			current.body.classList.remove("hidden");
			localStorage.setItem("posterGirl", "1");

			this.init();
		};
	};

	localStorage.getItem("posterGirl") === "0"
		? this.initHidden()
		: this.init();
};

// 请保留版权说明
if (window.console && window.console.log) {
	console.log(
		"%c Pio %c https://paugram.com ",
		"color: #fff; margin: 1em 0; padding: 5px 0; background: #673ab7;",
		"margin: 1em 0; padding: 5px 0; background: #efefef;",
	);
}

