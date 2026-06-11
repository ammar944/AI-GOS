(function () {
  "use strict";

  var SESSION_KEY = "sl_analytics_v1_session_id";
  var ATTRIBUTION_KEY = "sl_analytics_v1_attribution";
  var TRACKER_SRC_MARKER = "sl-analytics.v1.js";
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  var EVENT_KEY_PATTERN = /^[a-z][a-z0-9_]{1,79}$/;
  var sentScrollMilestones = {
    scroll_50: false,
    scroll_90: false
  };
  var startedForms = {};

  function warn(message, context) {
    if (window.console && typeof window.console.warn === "function") {
      window.console.warn("[SaaSLaunch Analytics] " + message, context || {});
    }
  }

  function isPiiLike(value) {
    var text = String(value || "");
    var emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
    var phonePattern = /(?:\+?\d[\s().-]*){8,}/;
    var secretPattern = /(bearer\s+[a-z0-9._-]+|sk-[a-z0-9_-]{12,}|api[_-]?key|password|secret|token)/i;
    return emailPattern.test(text) || phonePattern.test(text) || secretPattern.test(text);
  }

  function cleanScalar(value, maxLength) {
    var text = String(value || "")
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!text || isPiiLike(text)) {
      return "";
    }

    return text.slice(0, maxLength);
  }

  function cleanPropertyKey(key) {
    var cleaned = cleanScalar(key, 80);
    if (!/^[a-z][a-z0-9_]{0,79}$/.test(cleaned)) {
      return "";
    }
    return cleaned;
  }

  function cleanProperties(properties) {
    var output = {};
    var source = properties && typeof properties === "object" && !Array.isArray(properties) ? properties : {};
    var keys = Object.keys(source).slice(0, 20);

    for (var index = 0; index < keys.length; index += 1) {
      var key = cleanPropertyKey(keys[index]);
      var value = source[keys[index]];

      if (!key || value === undefined) {
        continue;
      }

      if (typeof value === "string") {
        var cleaned = cleanScalar(value, 500);
        if (cleaned) {
          output[key] = cleaned;
        }
        continue;
      }

      if (typeof value === "number" && isFinite(value)) {
        output[key] = value;
        continue;
      }

      if (typeof value === "boolean" || value === null) {
        output[key] = value;
      }
    }

    return output;
  }

  function isDoNotTrackEnabled() {
    var values = [
      window.doNotTrack,
      window.navigator && window.navigator.doNotTrack,
      window.navigator && window.navigator.msDoNotTrack
    ];

    for (var index = 0; index < values.length; index += 1) {
      var value = String(values[index] || "").toLowerCase();
      if (value === "1" || value === "yes") {
        return true;
      }
    }

    return false;
  }

  function findConfigScript() {
    if (document.currentScript && document.currentScript.getAttribute) {
      return document.currentScript;
    }

    var scripts = document.getElementsByTagName("script");
    for (var index = scripts.length - 1; index >= 0; index -= 1) {
      var script = scripts[index];
      var src = script.getAttribute("src") || "";
      var hasTrackerSrc = src.indexOf(TRACKER_SRC_MARKER) !== -1;
      var hasConfig =
        script.hasAttribute("data-client") ||
        script.hasAttribute("data-site") ||
        script.hasAttribute("data-endpoint");

      if (hasTrackerSrc || hasConfig) {
        return script;
      }
    }

    return null;
  }

  function getConfig() {
    var script = findConfigScript();

    if (!script) {
      throw new Error("SaaSLaunch analytics script tag was not found");
    }

    var client = cleanScalar(script.getAttribute("data-client") || "", 80);
    var site = cleanScalar(script.getAttribute("data-site") || "", 80);
    var endpoint = script.getAttribute("data-endpoint") || "";

    if (!client || !site || !endpoint) {
      throw new Error("SaaSLaunch analytics requires data-client, data-site, and data-endpoint");
    }

    return {
      client: client,
      site: site,
      endpoint: endpoint
    };
  }

  function storageGet(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (error) {
      warn("sessionStorage read failed", { key: key, message: error.message });
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (error) {
      warn("sessionStorage write failed", { key: key, message: error.message });
    }
  }

  function randomToken() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID().toLowerCase();
    }

    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return Array.prototype.map
        .call(bytes, function (byte) {
          return byte.toString(16).padStart(2, "0");
        })
        .join("");
    }

    return Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
  }

  function getSessionId() {
    var current = storageGet(SESSION_KEY);
    if (current) {
      return current;
    }

    var next = "sl_" + randomToken();
    storageSet(SESSION_KEY, next);
    return next;
  }

  function sanitizePageUrl(urlString) {
    var url = new URL(urlString);
    var sanitized = new URL(url.origin + url.pathname);

    for (var index = 0; index < UTM_KEYS.length; index += 1) {
      var key = UTM_KEYS[index];
      var value = cleanScalar(url.searchParams.get(key) || "", 200);
      if (value) {
        sanitized.searchParams.set(key, value);
      }
    }

    return sanitized.toString();
  }

  function sanitizeReferrer(referrer) {
    if (!referrer) {
      return "";
    }

    try {
      var url = new URL(referrer, window.location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "";
      }
      return url.origin + url.pathname;
    } catch (error) {
      warn("Referrer parse failed", { message: error.message });
      return "";
    }
  }

  function currentAttribution() {
    var params = new URL(window.location.href).searchParams;
    var attribution = {
      utm_source: "",
      utm_medium: "",
      utm_campaign: "",
      utm_content: "",
      utm_term: "",
      referrer: sanitizeReferrer(document.referrer)
    };

    for (var index = 0; index < UTM_KEYS.length; index += 1) {
      var key = UTM_KEYS[index];
      attribution[key] = cleanScalar(params.get(key) || "", 200);
    }

    return attribution;
  }

  function hasUtm(attribution) {
    for (var index = 0; index < UTM_KEYS.length; index += 1) {
      if (attribution[UTM_KEYS[index]]) {
        return true;
      }
    }
    return false;
  }

  function normalizeAttribution(value) {
    return {
      utm_source: cleanScalar(value.utm_source || "", 200),
      utm_medium: cleanScalar(value.utm_medium || "", 200),
      utm_campaign: cleanScalar(value.utm_campaign || "", 200),
      utm_content: cleanScalar(value.utm_content || "", 200),
      utm_term: cleanScalar(value.utm_term || "", 200),
      referrer: sanitizeReferrer(value.referrer || "")
    };
  }

  function storedAttribution() {
    var stored = storageGet(ATTRIBUTION_KEY);
    if (!stored) {
      return null;
    }

    try {
      var parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      return normalizeAttribution(parsed);
    } catch (error) {
      warn("Stored attribution parse failed", { message: error.message });
      return null;
    }
  }

  function getAttribution() {
    var current = currentAttribution();
    var stored = storedAttribution();

    if (hasUtm(current) || !stored) {
      storageSet(ATTRIBUTION_KEY, JSON.stringify(current));
      return current;
    }

    return stored;
  }

  function getDeviceType() {
    var userAgent = window.navigator.userAgent || "";
    if (/ipad|tablet|kindle|playbook/i.test(userAgent)) return "tablet";
    if (/mobi|android|iphone|ipod|blackberry|iemobile/i.test(userAgent)) return "mobile";
    return "desktop";
  }

  function getBrowser() {
    var userAgent = window.navigator.userAgent || "";
    if (/Edg\//.test(userAgent)) return "edge";
    if (/Chrome\//.test(userAgent) && !/Chromium\//.test(userAgent)) return "chrome";
    if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return "safari";
    if (/Firefox\//.test(userAgent)) return "firefox";
    return "unknown";
  }

  function basePayload(config, eventName, properties) {
    var attribution = getAttribution();

    return {
      event_name: eventName,
      client_slug: config.client,
      site_slug: config.site,
      page_url: sanitizePageUrl(window.location.href),
      path: window.location.pathname || "/",
      occurred_at: new Date().toISOString(),
      session_id: getSessionId(),
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      utm_content: attribution.utm_content,
      utm_term: attribution.utm_term,
      referrer: attribution.referrer,
      device_type: getDeviceType(),
      browser: getBrowser(),
      properties: cleanProperties(properties)
    };
  }

  function sendEvent(config, eventName, properties) {
    if (!EVENT_KEY_PATTERN.test(eventName)) {
      warn("Rejected invalid event key", { event_name: eventName });
      return;
    }

    var payload = basePayload(config, eventName, properties);
    var body = JSON.stringify(payload);

    if (window.navigator && typeof window.navigator.sendBeacon === "function") {
      try {
        var blob = new Blob([body], { type: "application/json" });
        if (window.navigator.sendBeacon(config.endpoint, blob)) {
          return;
        }
      } catch (error) {
        warn("sendBeacon failed", { event_name: eventName, message: error.message });
      }
    }

    if (typeof window.fetch !== "function") {
      warn("fetch is unavailable; event was not sent", { event_name: eventName });
      return;
    }

    window
      .fetch(config.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: body,
        keepalive: true,
        credentials: "omit"
      })
      .catch(function (error) {
        warn("SaaSLaunch analytics event failed", {
          event_name: eventName,
          message: error && error.message ? error.message : "unknown"
        });
      });
  }

  function closestEventElement(event) {
    if (!event.target || typeof event.target.closest !== "function") {
      return null;
    }
    return event.target.closest("[data-sl-event], [data-sl-cta]");
  }

  function closestAnchor(target) {
    if (!target || typeof target.closest !== "function") {
      return null;
    }
    return target.closest("a[href]");
  }

  function safeProperty(properties, key, value, maxLength) {
    var cleanValue = cleanScalar(value, maxLength || 200);
    if (cleanValue) {
      properties[key] = cleanValue;
    }
  }

  function hrefProperties(properties, target) {
    var anchor = closestAnchor(target);
    if (!anchor) {
      return;
    }

    try {
      var url = new URL(anchor.getAttribute("href") || "", window.location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return;
      }
      safeProperty(properties, "href_hostname", url.hostname, 200);
      safeProperty(properties, "href_path", url.pathname || "/", 200);
    } catch (error) {
      warn("CTA href parse failed", { message: error.message });
    }
  }

  function clickProperties(target) {
    var properties = {};
    var text = target.getAttribute("aria-label") || target.getAttribute("title") || target.textContent || "";
    safeProperty(properties, "cta_id", target.getAttribute("data-sl-cta") || "", 120);
    safeProperty(properties, "cta_text", text, 160);
    hrefProperties(properties, target);
    return properties;
  }

  function clickEventName(target) {
    return cleanScalar(target.getAttribute("data-sl-event") || "", 80) || "cta_clicked";
  }

  function installClickTracking(config) {
    document.addEventListener("click", function (event) {
      var target = closestEventElement(event);
      if (!target) {
        return;
      }
      sendEvent(config, clickEventName(target), clickProperties(target));
    });
  }

  function formIdentifier(form) {
    return (
      cleanScalar(form.getAttribute("data-sl-form") || "", 120) ||
      cleanScalar(form.getAttribute("id") || "", 120) ||
      cleanScalar(form.getAttribute("aria-label") || "", 120) ||
      "default_form"
    );
  }

  function installFormStartedTracking(config) {
    document.addEventListener("focusin", function (event) {
      if (!event.target || typeof event.target.closest !== "function") {
        return;
      }

      var form = event.target.closest("form");
      if (!form) {
        return;
      }

      var formId = formIdentifier(form);
      if (startedForms[formId]) {
        return;
      }

      startedForms[formId] = true;
      sendEvent(config, "form_started", { form_id: formId });
    });
  }

  function getScrollPercent() {
    var doc = document.documentElement;
    var body = document.body || {};
    var scrollTop = window.pageYOffset || doc.scrollTop || body.scrollTop || 0;
    var scrollHeight = Math.max(doc.scrollHeight || 0, body.scrollHeight || 0);
    var viewportHeight = window.innerHeight || doc.clientHeight || 0;
    var maxScroll = scrollHeight - viewportHeight;
    if (maxScroll <= 0) {
      return 0;
    }
    return (scrollTop / maxScroll) * 100;
  }

  function installScrollTracking(config) {
    window.addEventListener(
      "scroll",
      function () {
        var percent = getScrollPercent();
        if (percent >= 50 && !sentScrollMilestones.scroll_50) {
          sentScrollMilestones.scroll_50 = true;
          sendEvent(config, "scroll_50", {});
        }
        if (percent >= 90 && !sentScrollMilestones.scroll_90) {
          sentScrollMilestones.scroll_90 = true;
          sendEvent(config, "scroll_90", {});
        }
      },
      { passive: true }
    );
  }

  if (isDoNotTrackEnabled()) {
    return;
  }

  var config = getConfig();
  window.SaaSLaunchAnalytics = {
    track: function (eventName, properties) {
      sendEvent(config, cleanScalar(eventName, 80), properties || {});
    }
  };

  sendEvent(config, "page_viewed", {});
  installClickTracking(config);
  installFormStartedTracking(config);
  installScrollTracking(config);
})();
