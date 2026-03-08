export function calculatePaginationRange(
	currentPage: number,
	lastPage: number,
	visibleCount: number = 5,
): number[] {
	const HIDDEN = -1;
	let count = 1;
	let l = currentPage;
	let r = currentPage;

	while (0 < l - 1 && r + 1 <= lastPage && count + 2 <= visibleCount) {
		count += 2;
		l--;
		r++;
	}
	while (0 < l - 1 && count < visibleCount) {
		count++;
		l--;
	}
	while (r + 1 <= lastPage && count < visibleCount) {
		count++;
		r++;
	}

	let pages: number[] = [];
	if (l > 1) pages.push(1);
	if (l === 3) pages.push(2);
	if (l > 3) pages.push(HIDDEN);
	for (let i = l; i <= r; i++) pages.push(i);
	if (r < lastPage - 2) pages.push(HIDDEN);
	if (r === lastPage - 2) pages.push(lastPage - 1);
	if (r < lastPage) pages.push(lastPage);

	return pages;
}
