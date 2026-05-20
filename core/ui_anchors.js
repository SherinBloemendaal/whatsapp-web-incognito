/*
 * Runtime structural-anchor module.
 *
 * WhatsApp Web's atomic-CSS class hashes (e.g. "x1c4vz4f xs83m0k ...") are regenerated on every
 * front-end build, so hardcoding them in `ui_class_names.js` makes the extension fragile.
 *
 * This module provides stable lookups based on structural attributes that Meta keeps for their
 * own QA/automation: data-testid, data-tab, data-navbar-item, role, aria-label, etc.
 *
 * It also exposes a clone-based icon injection (`cloneTabAsIncognitoIcon`) that copies an existing
 * navbar tab button verbatim and only swaps its SVG and label. That way we inherit all of WA's
 * current styling (and any future style updates) automatically.
 */

var UIAnchors = (function ()
{
    function findChatlistHeader()
    {
        return document.querySelector('[data-testid="chatlist-header"], header[data-tab="2"]');
    }

    function findNavbarTabs()
    {
        var header = findChatlistHeader();
        if (!header) return [];
        return Array.from(header.querySelectorAll('button[data-navbar-item="true"]'));
    }

    function findNavbarTabByLabel(label)
    {
        return findNavbarTabs().find(function (b) { return b.getAttribute("aria-label") === label; }) || null;
    }

    function findChatPanel()
    {
        return document.querySelector('#main, [data-tab="8"], [data-testid="conversation-panel-wrapper"]');
    }

    function findInnerChatPanel()
    {
        var panel = findChatPanel();
        if (!panel) return null;
        return panel.querySelector('.copyable-area, [data-tab="3"], [role="application"]');
    }

    function findChatRows()
    {
        var rows = document.querySelectorAll('[role="listitem"]');
        if (rows.length > 0) return Array.from(rows);
        if (typeof UIClassNames !== "undefined" && UIClassNames.CHAT_ENTRY_CLASS)
            return Array.from(document.getElementsByClassName(UIClassNames.CHAT_ENTRY_CLASS));
        return [];
    }

    function findUnreadCounterIn(element)
    {
        if (!element) return null;
        return element.querySelector('span[role="status"], .' + (typeof UIClassNames !== "undefined" && UIClassNames.UNREAD_COUNTER_CLASS ? UIClassNames.UNREAD_COUNTER_CLASS : "xyp3urf"));
    }

    function findOpenDropdown()
    {
        var menu = document.querySelector('[role="menu"], [role="application"][data-animate-dropdown-on="true"]');
        if (menu) return menu;
        if (typeof UIClassNames !== "undefined" && UIClassNames.OUTER_DROPDOWN_CLASS)
        {
            var legacy = document.getElementsByClassName(UIClassNames.OUTER_DROPDOWN_CLASS)[0];
            if (legacy) return legacy;
        }
        return null;
    }

    function isNewlyAddedDropdown(node)
    {
        if (!node || node.nodeType !== 1) return false;
        if (node.getAttribute && (node.getAttribute("role") === "menu" || node.getAttribute("role") === "application")) return true;
        if (node.querySelector && node.querySelector('[role="menu"], [role="menuitem"]')) return true;
        if (typeof UIClassNames !== "undefined" && UIClassNames.OUTER_DROPDOWN_CLASS &&
            node.classList && UIClassNames.OUTER_DROPDOWN_CLASS.split(" ").every(function (c) { return node.classList.contains(c); })) return true;
        return false;
    }

    /**
     * Clone an existing navbar tab button to use as a template for our Incognito tab.
     * Inherits all hover, focus, selected styling automatically.
     *
     * @param {string} svgURL  - extension URL to the SVG file to swap in
     * @param {string} label   - aria-label / title for the new tab
     * @returns {Promise<HTMLElement>} the new wrapping element ready to insert before/after a sibling
     */
    async function cloneTabAsIncognitoIcon(svgURL, label)
    {
        var template = findNavbarTabByLabel("Status") || findNavbarTabByLabel("Channels") || findNavbarTabByLabel("Communities") || findNavbarTabs()[0];
        if (!template) return null;

        // The actual node we want to clone is the navbar-button's grand-grandparent (the per-tab wrapper).
        // From the discovery output, the structure is:
        //   <div>                                <-- outer wrapper (siblings are the per-tab wrappers)
        //     <span class="...">                 <-- decorative span
        //       <div class="x1vqgdyp...">        <-- inner wrapper
        //         <button data-navbar-item="true" aria-label="Status" ...>
        //   ...
        // We want to clone the outer-most <div> so positioning/hover work correctly.
        var perTabWrapper = template.closest("div > span")?.parentElement || template.parentElement?.parentElement?.parentElement;
        if (!perTabWrapper) perTabWrapper = template;

        var clone = perTabWrapper.cloneNode(true);

        // Find the button inside the clone and rewrite its identity
        var clonedButton = clone.querySelector('button[data-navbar-item="true"]') || clone.querySelector('button');
        if (clonedButton)
        {
            clonedButton.setAttribute("aria-label", label);
            clonedButton.setAttribute("aria-pressed", "false");
            clonedButton.setAttribute("data-navbar-item-selected", "false");
            clonedButton.setAttribute("data-navbar-item-index", "incognito");
            clonedButton.setAttribute("tabindex", "0");
        }

        // Strip any unread-counter pill from the cloned tab (e.g. "99+" from the Chats tab)
        var statusPill = clone.querySelector('span[role="status"]');
        if (statusPill && statusPill.parentElement) statusPill.parentElement.remove();

        // Stop click events from bubbling into WhatsApp's React-delegated navbar handlers.
        // We cloned the DOM but not React's synthetic-event bindings, so any bubbled clicks
        // would either no-op or (worst case) trigger the original tab's navigation logic.
        clone.addEventListener("click", function (e) { e.stopPropagation(); }, true);
        clone.addEventListener("mousedown", function (e) { e.stopPropagation(); }, true);

        // Swap the SVG content
        try
        {
            var response = await fetch(svgURL);
            var text = await response.text();
            var dom = new DOMParser().parseFromString(text, "text/html");
            var newSvgEl = dom.getElementsByTagName("svg")[0];
            var oldSvgEl = clone.querySelector("svg");
            if (newSvgEl && oldSvgEl)
            {
                // Preserve sizing/classes of the original SVG, only replace inner geometry + viewBox
                var existingClass = oldSvgEl.getAttribute("class") || "";
                var existingHeight = oldSvgEl.getAttribute("height") || "24";
                var existingWidth = oldSvgEl.getAttribute("width") || "24";
                oldSvgEl.setAttribute("viewBox", newSvgEl.getAttribute("viewBox") || "0 0 24 24");
                oldSvgEl.setAttribute("class", existingClass);
                oldSvgEl.setAttribute("height", existingHeight);
                oldSvgEl.setAttribute("width", existingWidth);
                oldSvgEl.setAttribute("fill", "currentColor");
                oldSvgEl.innerHTML = newSvgEl.innerHTML;
            }

            // Update the wrapping <span data-testid="..."> if present (used for the icon container)
            var iconSpan = clone.querySelector("span[data-testid]");
            if (iconSpan) iconSpan.setAttribute("data-testid", "wai-incognito");
        }
        catch (e)
        {
            console.warn("WAIncognito: failed to swap SVG in cloned tab:", e);
        }

        clone.classList.add("menu-item-incognito");
        return clone;
    }

    /**
     * Best-effort: pull live class strings off DOM elements we found and write them into
     * the legacy `UIClassNames` global so older code paths that still use
     * `getElementsByClassName(UIClassNames.X)` keep functioning until they're refactored.
     *
     * Safe to call multiple times. Will not overwrite values that look more accurate
     * than what we discovered (e.g. if discovery returns null, the fallback stays).
     */
    function syncLegacyClassNames()
    {
        if (typeof UIClassNames === "undefined") return;

        var header = findChatlistHeader();
        if (header && !header.className.includes("undefined"))
            UIClassNames.CHAT_PANEL_CLASS = header.className;

        var inner = findInnerChatPanel();
        if (inner)
        {
            // Strip any literal "false" tokens leaking from React's clsx
            var cleaned = String(inner.className).split(/\s+/).filter(function (t) { return t && t !== "false"; }).join(" ");
            if (cleaned) UIClassNames.INNER_CHAT_PANEL_CLASS = cleaned;
        }

        var rows = findChatRows();
        if (rows.length > 0)
        {
            var rowClasses = String(rows[0].className).split(/\s+/).filter(function (t) { return t && t !== "false"; }).join(" ");
            if (rowClasses) UIClassNames.CHAT_ENTRY_CLASS = rowClasses;
        }
    }

    return {
        findChatlistHeader: findChatlistHeader,
        findNavbarTabs: findNavbarTabs,
        findNavbarTabByLabel: findNavbarTabByLabel,
        findChatPanel: findChatPanel,
        findInnerChatPanel: findInnerChatPanel,
        findChatRows: findChatRows,
        findUnreadCounterIn: findUnreadCounterIn,
        findOpenDropdown: findOpenDropdown,
        isNewlyAddedDropdown: isNewlyAddedDropdown,
        cloneTabAsIncognitoIcon: cloneTabAsIncognitoIcon,
        syncLegacyClassNames: syncLegacyClassNames,
    };
})();
