/**
 * Utility functions for various common tasks.
 *
 * version 3.0 - 2025.08.29
 * Add global submit button handling for ajax-component forms
 *
 * This file contains a collection of utility functions that can be used for:
 * - String formatting
 * - DOM helpers
 * - AJAX requests
 * - Cookie handling
 * - Vue component registration
 * - File upload handling
 * - Internationalization (clientside T object)
 * - Debouncing and throttling functions
 * - Password strength calculation
 * - Tags inputs
 * - Form handling
 * - poor-mans htmx with <ajax-component>
 * - Flash message handling
 */

"use strict";

// @ts-ignore
if (!String.prototype.format) {
    /**
     * Allows "bla {a} bla {b}".format({'a': 'hello', 'b': 'world'})
     * @param {Object} args - The arguments to replace in the string.
     * @returns {String} - The formatted string.
     */
    // @ts-ignore
    String.prototype.format = function (args) {
        return this.replace(/\{([^}]+)\}/g, function (match, k) {
            return args[k];
        });
    };
}

/**
 * Global utility function object. Similar to jquery $ but lighter
 *
 * @param {string} sel
 * @param {HTMLElement} [el]
 * @returns {NodeListOf<HTMLElement>}
 */
function Q(sel, el) {
    return (el || document).querySelectorAll(sel);
}

/**
 * Clone any object
 * @param {Object} data - The object to clone.
 * @returns {Object} - The cloned object.
 */
Q.clone = function (data) {
    return JSON.parse(JSON.stringify(data));
};
/**
 *
 * @param {string} text
 * @returns
 */
Q.eval = function (text) {
    return eval("(" + text + ")");
};

/**
 * Given a URL returns an object with parsed query string
 * @param {String} source - The URL to parse.
 * @returns {Object} - The parsed query string as an object.
 */
Q.get_query = function (source) {
    source = source || window.location.search.substring(1);
    var vars = {},
        items = source.split("&");
    items.map(function (item) {
        var pair = item.split("=");
        vars[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
    });
    return vars;
};

/**
 * @param {String} method - The HTTP method.
 * @param {String} url - The URL to fetch.
 * @param {Object} [data] - The data to send.
 * @param {Object} [headers] - The headers to include.
 * @returns {Promise<{data: string, json: () => any} & Response>} - The fetch promise.
 */
Q.ajax = function (method, url, data, headers) {
    /** @type {RequestInit} */
    const options = {
        method: method,
        referrerPolicy: "no-referrer",
    };
    if (data) {
        if (!(data instanceof FormData)) {
            options.headers = { "Content-type": "application/json" };
            data = JSON.stringify(data);
        }
        options.body = data;
    }
    if (headers) {
        for (const name in headers) options.headers[name] = headers[name];
    }
    return new Promise(function (resolve, reject) {
        fetch(url, options)
            .then(function (
                /** @type {{data: string, json: () => any} & Response} */ res
            ) {
                res.text().then(function (body) {
                    res.data = body;
                    res.json = function () {
                        return JSON.parse(body);
                    };
                    resolve(res);
                }, reject);
            })
            .catch(reject);
    });
};

/** Asynchronously sends a GET request
 * @param {String} url - The URL to fetch.
 * @param {Object} [headers] - The headers to include.
 * @returns {Promise<{data: string, json: () => any} & Response>} - The fetch promise.
 */
Q.get = (url, headers) => Q.ajax("GET", url, null, headers);

/** Asynchronously sends a POST request
 * @param {String} url - The URL to fetch.
 * @param {Object} [data] - The data to send.
 * @param {Object} [headers] - The headers to include.
 * @returns {Promise<{data: string, json: () => any} & Response>} - The fetch promise.
 */
Q.post = (url, data, headers) => Q.ajax("POST", url, data, headers);

/** Asynchronously sends a PUT request
 * @param {String} url - The URL to fetch.
 * @param {Object} [data] - The data to send.
 * @param {Object} [headers] - The headers to include.
 * @returns {Promise<{data: string, json: () => any} & Response>} - The fetch promise.
 */
Q.put = (url, data, headers) => Q.ajax("PUT", url, data, headers);

/** Asynchronously sends a DELETE request
 * @param {String} url - The URL to fetch.
 * @param {Object} [headers] - The headers to include.
 * @returns {Promise<{data: string, json: () => any} & Response>} - The fetch promise.
 */
Q.delete = (url, headers) => Q.ajax("DELETE", url, null, headers);

/**
 * Gets a cookie value
 * @param {String} name - The name of the cookie.
 * @returns {String|null} - The cookie value or null if not found.
 */
Q.get_cookie = function (name) {
    var cookie = RegExp("" + name + "[^;]+").exec(document.cookie);
    if (!cookie) return null;
    return decodeURIComponent(
        !!cookie ? cookie.toString().replace(/^[^=]+./, "") : ""
    );
};

// Load components lazily: https://v3.vuejs.org/guide/component-dynamic-async.html#async-components
Q.register_vue_component = function (name, src, onload) {
    // @ts-ignore
    window.app.component(
        name,
        // @ts-ignore
        Vue.defineAsyncComponent(() => {
            return Q.ajax("GET", src).then(function (res) {
                return onload(res);
            });
        })
    );
};

// Passes binary data to callback on drop of file in elem_id
Q.upload_helper = function (elem_id, callback) {
    // function from http://jsfiddle.net/eliseosoto/JHQnk/
    var elem = document.getElementById(elem_id);
    if (elem && "files" in elem) {
        var files = elem.files;
        var reader = new FileReader();
        if (files && files[0]) {
            reader.onload = function (event) {
                const arrayBuffer = event.target.result;
                // @ts-ignore
                const uint8Array = new Uint8Array(arrayBuffer);

                let binaryString = "";
                for (let i = 0; i < uint8Array.length; i++) {
                    binaryString += String.fromCharCode(uint8Array[i]);
                }

                const b64 = btoa(binaryString);
                callback(files[0].name, b64);
            };
            reader.readAsArrayBuffer(files[0]);
        } else {
            callback();
        }
    }
};

/**
 * Internationalization helper
// Usage:
// T.translations = {'dog': {0: 'no cane', 1: 'un case', 2: '{n} cani', 10: 'tanti cani'}};
// T('dog').format({n: 5}) -> "5 cani"
 * @param {String} text - The text to translate.
 * @returns {Object} - The translation object with toString and format methods.
 */
function T(text) {
    var obj = {
        toString: function () {
            return T.format(text);
        },
        format: function (args) {
            return T.format(text, args);
        },
    };
    return obj;
}
T.translations = {};

/**
 * Adds a convenience format method to the client-side translator object
 * @param {String} text - The text to format.
 * @param {Object.<string, any>} [args] - The arguments for formatting.
 * @returns {String} - The formatted text.
 */
T.format = function (text, args) {
    args = args || {};
    const translations = (T.translations || {})[text];
    var n = "n" in args ? args.n : 1;
    if (translations) {
        var k = 0;
        for (var key in translations) {
            var i = parseInt(key);
            if (i <= n) k = i;
            else break;
        }
        text = translations[k];
    }
    // @ts-ignore
    return text.format(args);
};

// Originally inspired by  David Walsh (https://davidwalsh.name/javascript-debounce-function)
/**
 * Debounce function
 * @template {any[]} Args
 * @param {(...args: Args) => void} func - Function to debounce.
 * @param {number} wait - milliseconds between calls
 * @returns {(...args: Args) => void} debounced version of the function.
 */
Q.debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// https://skilled.dev/course/throttle
/**
 * Function throttling wrapper. Returns a new, throttled version of the function.
 *
 * @template {any[]} Args
 * @param {(...event: Args) => void} callback - event handler to throttle.
 * @param {number} delay - delay between events which will go through
 * @returns {(...event: Args) => void} debounced version of the function.
 */
Q.throttle = (callback, delay) => {
    let throttleTimeout = null;
    let storedEvent = null;
    /** @type {(...event: Args) => void} */
    const throttledEventHandler = (...event) => {
        storedEvent = event;
        const shouldHandleEvent = !throttleTimeout;
        if (shouldHandleEvent) {
            callback(...storedEvent);
            storedEvent = null;
            throttleTimeout = setTimeout(() => {
                throttleTimeout = null;
                if (storedEvent) {
                    throttledEventHandler(...storedEvent);
                }
            }, delay);
        }
    };
    return throttledEventHandler;
};

/**
 * parse a comma separated list of strings which may be quoted
 * @param {string} line
 * @returns
 */
Q.parse_list = function (line) {
    // handle empty string case
    if (line.length === 0) return [];
    let a = [],
        i = 0,
        s = "",
        q = false,
        esc = false;
    for (; i <= line.length; i++) {
        let c = line[i] || ",",
            eol = i === line.length;
        if (q) {
            if (esc) (s += c), (esc = false);
            else if (c === "\\") esc = true;
            else if (c === '"') q = false;
            else s += c;
        } else if (c === '"') q = true;
        else if (c === "," || eol) a.push(s.trim()), (s = "");
        else s += c;
    }
    return a;
};
/**
 * @typedef TagsInputOptions
 * @property {any[]} [tags]
 * @property {boolean} [freetext]
 * @property {(x: any) => any} [transform]
 * @property {{ [x: string]: any; }} [labels]
 * @property {string} [placeholder]
 * @property {string} [autocomplete_list]
 * @property {{ [Symbol.match](string: string): RegExpMatchArray | null; }} [regex]
 */

// Renders a JSON field with tags_input
/**
 *
 * @param { string | HTMLElement} elem_arg
 * @param {TagsInputOptions} [options]
 * @returns
 */
Q.tags_input = function (elem_arg, options) {
    /** @type {HTMLInputElement} */
    let elem;
    if (typeof elem_arg === "string") {
        // @ts-ignore
        elem = Q(elem_arg)[0];
        if (!elem) {
            console.log("Q.tags_input: elem " + elem_arg + " not found");
            return;
        }
    } else {
        // @ts-ignore
        elem = elem_arg;
    }
    if (!options) options = Q.eval(elem.dataset.options || "{}");
    // preferred set of tags
    options.tags ??= [];
    // set to false to only allow selecting one of the specified tags
    options.freetext ??= true;
    // how to transform typed tags to convert to actual tags
    options.transform ??= function (x) {
        return x.toLowerCase();
    };
    // how to display tags
    options.labels ??= {};
    // placeholder for the freetext field
    options.placeholder ??= "";
    // autocomplete list attribute https://www.w3schools.com/tags/tag_datalist.asp
    options.autocomplete_list ??= null;

    var tags = options.tags;

    elem.type = "hidden";
    var repl = document.createElement("ul");
    repl.classList.add("tags-list");
    elem.parentNode.insertBefore(repl, elem);
    var keys = [];
    // case elem.value is missing
    if (!("value" in elem)) keys = [];
    // case elem.value is an array
    else if (typeof elem.value === "string" && elem.value.substr(0, 1) == "[")
        keys = Q.eval(elem.value);
    // case elem.value is comma separated values
    else keys = Q.parse_list(elem.value);
    console.log("keys", keys);
    keys.map(function (x) {
        if (tags.indexOf(x) < 0) tags.push(x);
    });
    var fill = function (elem, repl) {
        repl.innerHTML = "";
        tags.forEach(function (x) {
            var item = document.createElement("li");
            item.innerHTML = options.labels[x] || x;
            item.dataset.value = x;
            item.dataset.selected = "" + (keys.indexOf(x) >= 0);
            repl.appendChild(item);
            // @ts-ignore
            item.onclick = function (evt) {
                if (item.dataset.selected == "false") keys.push(x);
                else
                    keys = keys.filter(function (y) {
                        return x != y;
                    });
                item.dataset.selected = "" + (keys.indexOf(x) >= 0);
                elem.value = JSON.stringify(keys);
                elem.dispatchEvent(new Event("input", { bubbles: true }));
            };
        });
    };
    if (options.freetext) {
        var inp = document.createElement("input");
        elem.parentNode.insertBefore(inp, elem);
        inp.type = "text";
        inp.classList.add(...elem.classList);
        inp.placeholder = options.placeholder;
        inp.setAttribute("list", options.autocomplete_list);
        // @ts-ignore
        inp.onchange = function (evt) {
            Q.parse_list(inp.value).map(function (x) {
                x = options.transform(x.trim());
                if (options.regex && !x.match(options.regex)) return;
                if (x && tags.indexOf(x) < 0) tags.push(x);
                if (x && keys.indexOf(x) < 0) keys.push(x);
            });
            inp.value = "";
            elem.value = JSON.stringify(keys);
            elem.dispatchEvent(new Event("input", { bubbles: true }));
            fill(elem, repl);
        };
    }
    fill(elem, repl);
};

/**
 * Password strength calculator
 * @param {String} text - The password text.
 * @returns {Number} - The password strength score.
 */
Q.score_password = function (text) {
    var score = -10,
        counters = {};
    text.split("").map(function (c) {
        counters[c] = (counters[c] || 0) + 1;
        score += 5 / counters[c];
    });
    [/\d/, /[a-z]/, /[A-Z]/, /\W/].map(function (re) {
        score += re.test(text) ? 10 : 0;
    });
    return Math.round(Math.max(0, score));
};

// Apply the strength calculator to some input field
Q.score_input = function (elem, reference) {
    if (typeof elem === typeof "") elem = Q(elem)[0];
    reference = reference || 100;
    elem.style.backgroundPosition = "center right";
    elem.style.backgroundRepeat = "no-repeat";
    // @ts-ignore
    elem.onkeyup = elem.onchange = function (evt) {
        var score = Q.score_password(elem.value.trim());
        var r = Math.round(
            255 * Math.max(0, Math.min(2 - (2 * score) / reference, 1))
        );
        var g = Math.round(
            255 * Math.max(0, Math.min((2 * score) / reference, 1))
        );
        elem.style.backgroundImage =
            score == 0
                ? ""
                : "url('" +
                  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="30"><circle cx="5" cy="5" r="3" stroke-width="0" fill="rgb(' +
                  r +
                  "," +
                  g +
                  ',0)"/></svg>' +
                  "')";
    };
};

// Whether the global submit handler event listener has been registered
Q._globalDelegateActive = false;

/**
 * Set up delegated event handling for all [data-component-global-submit] buttons, only once per page load.
 */
Q._maybeSetupGlobalDelegate = function () {
    if (Q._globalDelegateActive) return;
    Q._globalDelegateActive = true;

    document.body.addEventListener("click", function (event) {
        /** @type {Element|null} */
        const btn =
            event.target instanceof Element
                ? event.target.closest("button[data-component-global-submit]")
                : null;
        if (!btn || !(btn instanceof HTMLButtonElement) || btn.disabled) return;
        event.preventDefault();

        const globalSubmitId = btn.id;
        if (!globalSubmitId) return;

        /** @type {NodeListOf<HTMLFormElement>} */
        const forms = document.querySelectorAll(
            `form[data-global-submit="${globalSubmitId}"]:not(.no-form-trap)`
        );
        if (!forms.length) return;

        // Store original state and disable
        const button_html = {};
        button_html[globalSubmitId] = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML =
            button_html[globalSubmitId] + T.format(" (Submitting...)");

        Promise.all(
            Array.from(forms).map((form) => Q._ajaxSubmitForm(form))
        ).finally(() => {
            // Restore original state
            btn.disabled = false;
            if (button_html[globalSubmitId]) {
                btn.innerHTML = button_html[globalSubmitId];
            }
        });
    });
};

/**
 * Trap all forms within a component for AJAX submit; tag with data-global-submit if needed.
 * @param {string} action - fallback POST url if form.action is unused
 * @param {string} elem_id - html id of the component/container
 * @param {string} [globalSubmitId] - id of global submit button, if any
 */
Q.trap_form = function (action, elem_id, globalSubmitId) {
    /** @type {NodeListOf<HTMLFormElement>} */
    const forms =
        /** @type {NodeListOf<HTMLFormElement>} */
        (Q(`#${elem_id} form:not(.no-form-trap)`));

    forms.forEach(function (form) {
        const target = form.dataset.component_target || elem_id;
        form.dataset.component_target = target;
        let url = form.action;
        if (!url || url === "#" || url === void 0) url = action;

        /** @type {NodeListOf<HTMLButtonElement>} */
        const buttons = form.querySelectorAll(
            "input[type=submit], input[type=image], button[type=submit], button:not([type])"
        );

        if (globalSubmitId) {
            form.setAttribute("data-global-submit", globalSubmitId);
            // Hide local submits for global forms
            buttons.forEach((btn) => (btn.style.display = "none"));
        } else {
            // Local (per-form) submit:
            buttons.forEach(function (btn) {
                btn.style.display = "";
                btn.onclick = function (event) {
                    event.preventDefault();
                    btn.disabled = true;
                    Q._ajaxSubmitForm(form).finally(function () {
                        btn.disabled = false;
                    });
                };
            });
        }
    });
    // Enable delegate globally if any component uses a global submit button
    if (globalSubmitId) Q._maybeSetupGlobalDelegate();
};
/**
 * Check if any form input has been changed from its default values.
 * Used for trapped ajax forms to skip submitting if nothing changed.
 *
 * @param {HTMLFormElement} form
 * @returns {boolean}
 */
Q.is_form_changed = function (form) {
    return [...form.querySelectorAll("input, textarea, select")].some(
        /** @param {HTMLInputElement} input */
        (input) => {
            if (input.disabled) {
                return false;
            }
            if (input.type === "checkbox" || input.type === "radio") {
                return input.checked !== input.defaultChecked;
            }
            return input.value !== input.defaultValue;
        }
    );
};

/**
 * AJAX-submit a single form (using POST), disables all its submit buttons while running.
 * @param {HTMLFormElement} form
 * @returns {Promise}
 */
Q._ajaxSubmitForm = function (form) {
    const url = form.action || "";
    const target = form.dataset.component_target || "";

    if (!Q.is_form_changed(form)) {
        return Promise.reject(new Error("Form was not changed"));
    }
    /** @type {NodeListOf<HTMLButtonElement>} */
    const buttons = form.querySelectorAll(
        "input[type=submit], input[type=image], button[type=submit], button:not([type])"
    );
    buttons.forEach((btn) => (btn.disabled = true));
    const form_data = new FormData(form);
    return Q.load_and_trap("POST", url, form_data, target)
        .catch(function (err) {
            Q.flash({ message: T.format("Submission error"), class: "danger" });
            console.error("Form submission failed:", err);
        })
        .finally(function () {
            buttons.forEach((btn) => (btn.disabled = false));
        });
};

/**
 * Load a component via AJAX and trap its forms for AJAX/global submit.
 * @param {string} method
 * @param {string} url
 * @param {FormData|null} form_data
 * @param {string} target
 * @returns {Promise<void>}
 */
Q.load_and_trap = function (method, url, form_data, target) {
    method = (method || "GET").toLowerCase();
    if (!target) {
        Q.flash({
            message: T.format(
                `Target element not specified for <code>{url}</code>`,
                { url }
            ),
            class: "danger",
        });
    }
    return Q.ajax(method, url, form_data)
        .then(function (res) {
            if (res.redirected) {
                window.location.href = res.url;
                return;
            }
            /** @type {HTMLElement|undefined} */
            const elem = Q("#" + target)[0];
            if (!elem) {
                Q.flash({
                    message: T.format(
                        `Target element not found: <code>{id}</code>`,
                        { id: `#${target}` }
                    ),
                    class: "danger",
                });
                return;
            }
            elem.innerHTML = res.data;
            // trick to make JS in component execute: re-insert the scripts using dom-manipulation
            // since assigning to innerHTML doesn't run scripts
            elem.querySelectorAll("script").forEach((s_old) => {
                const s_new = document.createElement("script");

                [...s_old.attributes].forEach((attr) =>
                    s_new.setAttribute(attr.name, attr.value)
                );

                s_new.textContent = s_old.textContent;
                s_old.replaceWith(s_new);
            });
            Q.trap_form(url, target, elem.getAttribute("global-submit"));
            const flash = res.headers.get("component-flash");
            if (flash) {
                try {
                    Q.flash(JSON.parse(flash));
                } catch (e) {
                    Q.flash({ message: flash, class: "info" });
                }
            }
        })
        .catch(function (err) {
            Q.flash({
                message: T.format("Ajax component error"),
                class: "danger",
            });
            console.error("Ajax component error:", err);
        });
};

/**
 * Loads and traps all <ajax-component> blocks on page.
 * Expects: url, id, and optional global-submit attributes.
 */
Q.handle_components = function () {
    Q("ajax-component").forEach(function (elem) {
        if (!(elem instanceof HTMLElement)) return;
        const url = elem.getAttribute("url");
        const id = elem.getAttribute("id");
        const globalSubmitId = elem.getAttribute("global-submit");
        if (!url || !id) {
            console.error(
                "<ajax-component> element missing required attributes url and id:",
                elem
            );
            return;
        }
        Q.load_and_trap("GET", url, null, id).then(function () {
            Q.trap_form(url, id, globalSubmitId);
        });
    });
};

/**
 * Programmatically triggers the global submit button by id (simulates click).
 * @param {string} globalSubmitId
 */
Q.triggerGlobalSubmit = function (globalSubmitId) {
    /** @type {HTMLButtonElement|null} */
    const btn = /** @type {HTMLButtonElement|null} */ (
        document.getElementById(globalSubmitId)
    );
    if (btn && !btn.disabled) btn.click();
};

/**
 * @typedef FlashDetails
 * @property {string} message Message for the flash message
 * @property {string} [title] Title for the flash, currently only used if bootstrap is present.
 * @property {string} [class] CSS class added to the element (used for bootstrap color name)
 */

/** Flash a message. Requires a <flash-alerts> element existing somewhere.
 *
 * @param {FlashDetails} detail
 */
Q.flash = function (detail) {
    console.log("Tried to flash without <flash-alerts> element:", detail);
};

// Displays flash messages
Q.handle_flash = function () {
    const elem = Q("flash-alerts")[0];
    /** @type {(arg0: HTMLElement) => (event: CustomEvent) => void} */
    let make_handler;
    if ("bootstrap" in window) {
        make_handler = function (elem) {
            return function (event) {
                let node = document.createElement("div");
                const color = event.detail.class || "info";
                node.innerHTML = `<div
                    class="toast fade ${color} border-${color} bg-${color}-subtle"
                    role="alert"
                    aria-live="assertive"
                    aria-atomic="true"
                >
                    <div class="toast-header">
                        <strong class="me-auto">${
                            event.detail.title || "Alert"
                        }</strong>
                        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                    </div>
                    <div class="toast-body">
                        ${event.detail.message}
                    </div>
                </div>`;
                // @ts-ignore
                node = node.firstElementChild;
                elem.appendChild(node);
                bootstrap.Toast.getOrCreateInstance(node).show();
                node.addEventListener("hidden.bs.toast", () => {
                    node.parentNode.removeChild(node);
                });
            };
        };
    } else {
        const make_delete_handler = function (node) {
            return function () {
                node.parentNode.removeChild(node);
            };
        };

        make_handler = function (elem) {
            return function (event) {
                let node = document.createElement("div");
                node.innerHTML = `<div role="alert"><span class="close"></span>${event.detail.message}</div>`;
                // @ts-ignore
                node = Q('[role="alert"]', node)[0];
                node.classList.add(event.detail.class || "info");
                elem.appendChild(node);
                Q('[role="alert"] .close', node)[0].onclick =
                    make_delete_handler(node);
            };
        };
    }

    if (elem) {
        elem.addEventListener("flash", make_handler(elem), false);
        /**
         * @param {FlashDetails} detail
         */
        Q.flash = function (detail) {
            elem.dispatchEvent(new CustomEvent("flash", { detail: detail }));
        };
        if (elem.dataset.alert) Q.flash(Q.eval(elem.dataset.alert));
    }
};

// for setup which touches the DOM, ideally set it up upon DOMContentLoaded
const init = () => {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
        return;
    }
    Q.handle_components();
    Q.handle_flash();
    Q("input[type=text].type-list-string").forEach(function (elem) {
        Q.tags_input(elem);
    });
    Q("input[type=text].type-list-integer").forEach(function (elem) {
        Q.tags_input(elem, { regex: /[-+]?[\d]+/ });
    });
    Q("input[name=password],input[name=new_password]").forEach(Q.score_input);
};
init();
