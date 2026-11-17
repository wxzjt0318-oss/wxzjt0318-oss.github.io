import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AUTO_DRAFT_MARKER as layoutMarker } from "../scripts/wiki/longform-layout.mjs";
import {
	AUTO_DRAFT_MARKER,
	isPublishablePost,
} from "../src/utils/publishable-post.mjs";

describe("isPublishablePost", () => {
	it("shares one auto-draft marker with the article layout", () => {
		assert.equal(AUTO_DRAFT_MARKER, "<!-- shirone:auto-draft -->");
		assert.equal(layoutMarker, AUTO_DRAFT_MARKER);
	});

	it("hides drafts and source drafts in production, and shows them in dev", () => {
		assert.equal(isPublishablePost({ draft: false, body: "长文" }, true), true);
		assert.equal(isPublishablePost({ draft: true, body: "长文" }, true), false);
		assert.equal(
			isPublishablePost(
				{ draft: false, body: `资料\n\n${AUTO_DRAFT_MARKER}` },
				true,
			),
			false,
		);
		assert.equal(
			isPublishablePost({ draft: true, body: AUTO_DRAFT_MARKER }, false),
			true,
		);
	});
});
