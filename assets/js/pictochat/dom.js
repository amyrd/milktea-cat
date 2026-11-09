/**
 * A tiny helper for building DOM elements, so screens read like the HTML they
 * produce instead of a pile of createElement/appendChild calls.
 *
 *   h("button", { type: "button", onClick: save }, "Save")
 *
 * Text children are added as text nodes (never parsed as HTML), which is what
 * keeps chat messages from being able to inject markup.
 */
export function h(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);

  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;

    if (name.startsWith("on") && typeof value === "function") {
      // onClick -> "click", onSubmit -> "submit", ...
      element.addEventListener(name.slice(2).toLowerCase(), value);
    } else if (name === "className") {
      element.className = value;
    } else {
      element.setAttribute(name, value === true ? "" : value);
    }
  }

  element.append(...children.flat().filter((child) => child !== null && child !== false && child !== undefined));
  return element;
}

/**
 * Like parent.append(...), but skips anything empty (null, undefined, false).
 * Plain append() would add the *word* "null" to the page, so this lets you write
 * `isPrivate ? something : null` in a list of children.
 */
export function appendAll(parent, ...children) {
  parent.append(...children.flat().filter((child) => child !== null && child !== false && child !== undefined));
}
