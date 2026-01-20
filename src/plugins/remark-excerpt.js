// biome-ignore lint/suspicious/noShadowRestrictedNames: <toString from mdast-util-to-string>
import { toString } from "mdast-util-to-string";

/* Use the post's first paragraph as the excerpt */
export function remarkExcerpt() {
  return (tree, fileOrCtx) => {
    // Astro usually passes `{ data }`, but be defensive
    const data = fileOrCtx?.data ?? fileOrCtx?.data ?? {};
    const astro = data.astro ?? (data.astro = { frontmatter: {} });
    const frontmatter =
      astro.frontmatter ?? (astro.frontmatter = {});

    // Respect author-provided excerpt in frontmatter
    if (frontmatter.excerpt) return;

    let excerpt = "";
    for (const node of tree.children ?? []) {
      if (node.type !== "paragraph") continue;
      excerpt = toString(node);
      break;
    }
    frontmatter.excerpt = excerpt;
  };
}
