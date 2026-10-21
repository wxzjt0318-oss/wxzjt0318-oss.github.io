/**
 * Anime News Network 条目解析：离线 XML 样例，不发网络请求。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { annEntryToText } from "../scripts/wiki/anime-databases.mjs";

const SAMPLE = `<anime id="1" type="TV" name="Yowayowa Sensei">
<info type="Picture" src="x.jpg"><img src="x.jpg"/></info>
<info type="Main title" lang="JA">Yowayowa Sensei</info>
<info type="Vintage">2026-04-11 to 2026-06-27</info>
<episode num="1"><title lang="EN">Teacher &amp; Student</title></episode>
<staff><task>Director</task><person id="2">Hiroshi Ishiodori</person></staff>
<cast lang="JA"><role>Hiyori Hiwamura</role><person id="3">Marika Kouno</person></cast>
<cast lang="EN"><role>Hiyori Hiwamura</role><person id="4">Dub Actor</person></cast>
<credit><task>Animation Production</task><company id="5">Studio</company></credit>
</anime>`;

describe("annEntryToText", () => {
	const text = annEntryToText(SAMPLE);

	it("keeps titles, dates, episodes, staff and companies", () => {
		assert.match(text, /名称：Yowayowa Sensei（TV）/);
		assert.match(text, /Main title（JA）：Yowayowa Sensei/);
		assert.match(text, /Vintage：2026-04-11 to 2026-06-27/);
		assert.match(text, /第1话：Teacher & Student/);
		assert.match(text, /Staff｜Director：Hiroshi Ishiodori/);
		assert.match(text, /公司｜Animation Production：Studio/);
	});

	it("keeps only the Japanese cast and skips pictures", () => {
		assert.match(text, /声优｜Hiyori Hiwamura：Marika Kouno/);
		assert.doesNotMatch(text, /Dub Actor/);
		assert.doesNotMatch(text, /Picture/);
	});
});
