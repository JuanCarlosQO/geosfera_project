// Confirmation inside the page, next to the button that asked. Replaces the browser's
// confirm(), which some browsers block without a word (in-app browsers of chat apps,
// embedded panes): there the button seemed to do nothing.

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Hides `anchor`, shows the question with Yes / Cancel after it, resolves true or false. */
export function confirmHere(anchor, question, yes = "Yes, remove") {
  return new Promise((resolve) => {
    anchor.parentElement?.querySelector(".ask-here")?.remove();
    const box = document.createElement("span");
    box.className = "ask-here";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", question);
    box.innerHTML = `<span class="ask-q">${esc(question)}</span>
      <span class="ask-btns"><button type="button" class="ask-yes" data-ask="yes">${esc(yes)}</button><button type="button" class="textlink" data-ask="no">Cancel</button></span>`;
    const shown = anchor.style.display;
    anchor.style.display = "none";
    anchor.after(box);
    box.querySelector('[data-ask="no"]').focus({ preventScroll: true });
    box.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ask]");
      if (!b) return;
      e.stopPropagation();
      box.remove();
      anchor.style.display = shown;
      resolve(b.dataset.ask === "yes");
    });
  });
}
