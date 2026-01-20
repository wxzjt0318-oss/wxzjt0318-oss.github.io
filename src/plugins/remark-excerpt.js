// biome-ignore lint/suspicious/noShadowRestrictedNames: <toString from mdast-util-to-string>
import { toString } from "mdast-util-to-string";

/* Use the post's first paragraph as the excerpt */
export function remarkExcerpt() {
  // Return a remark plugin transformer
  return (tree, { data }) => {
    let excerpt = "";
    for (const node of tree.children) {
      if (node.type !== "paragraph") continue;
      excerpt = toString(node); // extract plain text from the paragraph node
      break;
    }
    // Attach the computed excerpt to frontmatter for later use
    data.astro.frontmatter.excerpt = excerpt;
  };
}
