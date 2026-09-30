/*
 * On a phone a staff table becomes a stack of rows, and each value needs the
 * name of its column beside it. Tables whose cells are tagged (data-cell /
 * data-label) say so themselves; for the rest, the column headings are
 * already in the table, so they are copied onto the cells rather than
 * written out a second time in every table.
 */
export function labelStackedCells(root: ParentNode) {
  for (const table of root.querySelectorAll<HTMLTableElement>("table.ops-stack-table")) {
    const headings = [...table.querySelectorAll("thead th")].map((th) => {
      const hidden = th.querySelector(".sr-only, .portal-sr-only");
      return hidden && hidden.textContent === th.textContent ? "" : (th.textContent ?? "").trim();
    });
    for (const row of table.querySelectorAll("tbody > tr")) {
      [...row.children].forEach((cell, index) => {
        // The first cell names the record; a tagged cell labels itself.
        if (index === 0 || cell.hasAttribute("data-cell") || cell.hasAttribute("data-label")) return;
        const heading = headings[index];
        if (heading) cell.setAttribute("data-label", heading);
        // An unnamed column of buttons is the row's actions: they go last, on a
        // line of their own, like a tagged table's.
        else if (cell.querySelector("a, button")) cell.setAttribute("data-stack", "action");
      });
    }
  }
}
