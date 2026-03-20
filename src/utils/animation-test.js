export function testSlideAnimation() {
	const mainElements = document.querySelectorAll(".transition-main");
	const animationElements = document.querySelectorAll(".onload-animation");

	const results = [];
	mainElements.forEach((el, index) => {
		const styles = window.getComputedStyle(el);
		results.push({
			index,
			transition: styles.transition,
			transform: styles.transform,
			opacity: styles.opacity,
		});
	});

	return {
		mainElements: mainElements.length,
		animationElements: animationElements.length,
		status: "Animation test completed",
		results,
	};
}

export function simulatePageTransition() {
	const body = document.body;
	const html = document.documentElement;

	html.classList.add("is-animating", "is-leaving");

	setTimeout(() => {
		html.classList.remove("is-leaving");

		setTimeout(() => {
			html.classList.remove("is-animating");
		}, 300);
	}, 300);
}

if (typeof window !== "undefined") {
	window.testSlideAnimation = testSlideAnimation;
	window.simulatePageTransition = simulatePageTransition;
}
