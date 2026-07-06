/*!
 * jp-qac SDK v0.1.0
 * 郵便番号→住所自動入力 / 法人名オートコンプリート
 * 依存なし・IIFE。グローバル `JpQac` を公開する。
 *
 * 使い方:
 *   JpQac.configure({ baseUrl: "https://api.example.com" });
 *   JpQac.postal("#zip", { fill: { prefecture: "#pref", city: "#city", town: "#town" } });
 *   JpQac.corporate("#company", { fill: { corporateNumber: "#houjin" } });
 */
(function (global) {
  "use strict";

  var VERSION = "0.1.0";
  var config = { baseUrl: "" };
  var idSequence = 0;

  /* ---------- ユーティリティ ---------- */

  function toElement(target) {
    var el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el || el.nodeType !== 1) {
      throw new Error("jp-qac: 対象要素が見つかりません: " + target);
    }
    return el;
  }

  // 全角数字・区切り文字を吸収して半角数字のみにする
  function normalizeDigits(value) {
    return String(value)
      .replace(/[０-９]/g, function (ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
      })
      .replace(/[^0-9]/g, "");
  }

  function debounce(fn, wait) {
    var timer = null;
    var wrapped = function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, wait);
    };
    wrapped.cancel = function () { clearTimeout(timer); };
    return wrapped;
  }

  function request(path, signal) {
    return fetch(config.baseUrl + path, {
      signal: signal,
      headers: { Accept: "application/json" }
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) {
          var err = new Error((body && body.error && body.error.message) || response.statusText);
          err.status = response.status;
          err.code = body && body.error && body.error.code;
          throw err;
        }
        return body;
      });
    });
  }

  // 値を書き込み、React 等が変更を検知できるよう input/change を発火する
  function setValue(target, value) {
    var el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return;
    el.value = value == null ? "" : value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function applyFill(fillMap, record) {
    if (!fillMap) return;
    Object.keys(fillMap).forEach(function (key) {
      if (key in record) setValue(fillMap[key], record[key]);
    });
  }

  /* ---------- 郵便番号 → 住所 ---------- */

  function postal(target, options) {
    options = options || {};
    var input = toElement(target);
    var controller = null;
    var lastCode = null;

    var lookup = debounce(function (code) {
      if (controller) controller.abort();
      controller = new AbortController();
      input.classList.add("jpqac-loading");
      request("/v1/postal-codes/" + code, controller.signal)
        .then(function (body) {
          input.classList.remove("jpqac-loading");
          var addresses = body.data || [];
          if (addresses.length > 0) applyFill(options.fill, addresses[0]);
          if (options.onResult) options.onResult(addresses, body.meta);
        })
        .catch(function (error) {
          input.classList.remove("jpqac-loading");
          if (error.name === "AbortError") return;
          if (error.status === 404 && options.onResult) return options.onResult([], null);
          if (options.onError) options.onError(error);
        });
    }, options.debounce == null ? 150 : options.debounce);

    function onInput() {
      var code = normalizeDigits(input.value);
      if (code.length !== 7 || code === lastCode) return;
      lastCode = code;
      lookup(code);
    }

    input.addEventListener("input", onInput);
    // 初期値(ブラウザ自動入力など)にも反応する
    if (input.value) onInput();

    return {
      destroy: function () {
        lookup.cancel();
        if (controller) controller.abort();
        input.removeEventListener("input", onInput);
        input.classList.remove("jpqac-loading");
      }
    };
  }

  /* ---------- 法人名オートコンプリート ---------- */

  function defaultRender(corp) {
    var name = document.createElement("span");
    name.className = "jpqac-option-name";
    name.textContent = corp.name;
    if (corp.status === "closed") {
      var badge = document.createElement("span");
      badge.className = "jpqac-option-badge";
      badge.textContent = "閉鎖";
      name.appendChild(badge);
    }
    var sub = document.createElement("span");
    sub.className = "jpqac-option-sub";
    sub.textContent = [corp.prefecture, corp.city, corp.street].filter(Boolean).join("");
    var fragment = document.createDocumentFragment();
    fragment.appendChild(name);
    fragment.appendChild(sub);
    return fragment;
  }

  function corporate(target, options) {
    options = options || {};
    var input = toElement(target);
    var minLength = options.minLength == null ? 2 : options.minLength;
    var limit = options.limit == null ? 10 : options.limit;
    var render = options.render || defaultRender;
    var listId = "jpqac-listbox-" + (++idSequence);
    var controller = null;
    var items = [];
    var activeIndex = -1;
    var cache = new Map();

    var listbox = document.createElement("ul");
    listbox.className = "jpqac-listbox";
    listbox.id = listId;
    listbox.setAttribute("role", "listbox");
    listbox.hidden = true;
    document.body.appendChild(listbox);

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", listId);
    input.setAttribute("autocomplete", "off");

    function position() {
      var rect = input.getBoundingClientRect();
      listbox.style.left = rect.left + window.scrollX + "px";
      listbox.style.top = rect.bottom + window.scrollY + "px";
      listbox.style.minWidth = rect.width + "px";
    }

    function close() {
      listbox.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      activeIndex = -1;
    }

    function open() {
      position();
      listbox.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function showStatus(text) {
      listbox.textContent = "";
      var li = document.createElement("li");
      li.className = "jpqac-status";
      li.textContent = text;
      listbox.appendChild(li);
      open();
    }

    function setActive(index) {
      var optionEls = listbox.querySelectorAll(".jpqac-option");
      if (activeIndex >= 0 && optionEls[activeIndex]) {
        optionEls[activeIndex].setAttribute("aria-selected", "false");
      }
      activeIndex = index;
      if (index >= 0 && optionEls[index]) {
        optionEls[index].setAttribute("aria-selected", "true");
        input.setAttribute("aria-activedescendant", optionEls[index].id);
        optionEls[index].scrollIntoView({ block: "nearest" });
      } else {
        input.removeAttribute("aria-activedescendant");
      }
    }

    function select(index) {
      var corp = items[index];
      if (!corp) return;
      input.value = corp.name;
      applyFill(options.fill, corp);
      close();
      if (options.onSelect) options.onSelect(corp);
    }

    function renderList() {
      listbox.textContent = "";
      items.forEach(function (corp, index) {
        var li = document.createElement("li");
        li.className = "jpqac-option";
        li.id = listId + "-option-" + index;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", "false");
        li.appendChild(render(corp));
        li.addEventListener("mousedown", function (event) {
          event.preventDefault(); // input の blur を防ぐ
          select(index);
        });
        listbox.appendChild(li);
      });
      open();
      setActive(-1);
    }

    var search = debounce(function (name) {
      if (cache.has(name)) {
        items = cache.get(name);
        return items.length ? renderList() : showStatus("該当なし");
      }
      if (controller) controller.abort();
      controller = new AbortController();
      input.classList.add("jpqac-loading");
      request("/v1/corporations?name=" + encodeURIComponent(name) + "&limit=" + limit, controller.signal)
        .then(function (body) {
          input.classList.remove("jpqac-loading");
          items = body.data || [];
          if (cache.size > 50) cache.clear();
          cache.set(name, items);
          items.length ? renderList() : showStatus("該当なし");
        })
        .catch(function (error) {
          input.classList.remove("jpqac-loading");
          if (error.name === "AbortError") return;
          showStatus("検索できませんでした");
          if (options.onError) options.onError(error);
        });
    }, options.debounce == null ? 250 : options.debounce);

    function onInput() {
      var name = input.value.trim();
      if (name.length < minLength) {
        search.cancel();
        close();
        return;
      }
      search(name);
    }

    function onKeydown(event) {
      if (listbox.hidden) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive(Math.min(activeIndex + 1, items.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive(Math.max(activeIndex - 1, 0));
      } else if (event.key === "Enter") {
        if (activeIndex >= 0) {
          event.preventDefault();
          select(activeIndex);
        }
      } else if (event.key === "Escape") {
        close();
      }
    }

    function onBlur() { close(); }
    function onWindowChange() { if (!listbox.hidden) position(); }

    input.addEventListener("input", onInput);
    input.addEventListener("keydown", onKeydown);
    input.addEventListener("blur", onBlur);
    window.addEventListener("resize", onWindowChange);
    window.addEventListener("scroll", onWindowChange, true);

    return {
      destroy: function () {
        search.cancel();
        if (controller) controller.abort();
        input.removeEventListener("input", onInput);
        input.removeEventListener("keydown", onKeydown);
        input.removeEventListener("blur", onBlur);
        window.removeEventListener("resize", onWindowChange);
        window.removeEventListener("scroll", onWindowChange, true);
        listbox.remove();
        input.classList.remove("jpqac-loading");
        ["role", "aria-autocomplete", "aria-expanded", "aria-controls", "aria-activedescendant"]
          .forEach(function (attr) { input.removeAttribute(attr); });
      }
    };
  }

  /* ---------- 公開 API ---------- */

  global.JpQac = {
    version: VERSION,
    configure: function (next) {
      if (next && typeof next.baseUrl === "string") {
        config.baseUrl = next.baseUrl.replace(/\/+$/, "");
      }
      return this;
    },
    postal: postal,
    corporate: corporate
  };
})(window);
