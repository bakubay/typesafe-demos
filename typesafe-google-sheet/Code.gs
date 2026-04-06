// ============================================================
// TypeSafe AI — Google Sheets Add-on
// Custom functions: =NOUL(), =CHOICE(), =SCORE()
// With confidence variants: =NOUL_C(), =CHOICE_C(), =SCORE_C()
// ============================================================

// ─── Menu & Lifecycle ────────────────────────────────────────

function onInstall(e) {
  onOpen(e);
}

function onOpen(e) {
  SpreadsheetApp.getUi().createAddonMenu().addItem("⚙️ Settings", "showSidebar").addItem("🧪 Test connection", "testConnection").addSeparator().addItem("📖 Help", "showHelp").addToUi();
}

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile("Sidebar").setTitle("TypeSafe AI");
  SpreadsheetApp.getUi().showSidebar(html);
}

function showHelp() {
  var html = HtmlService.createHtmlOutputFromFile("Help").setTitle("TypeSafe AI — Help");
  SpreadsheetApp.getUi().showSidebar(html);
}

// ─── Settings helpers (called from Sidebar) ──────────────────

function saveApiKey(key) {
  PropertiesService.getUserProperties().setProperty("TYPESAFE_API_KEY", key);
  return true;
}

function getApiKey() {
  return PropertiesService.getUserProperties().getProperty("TYPESAFE_API_KEY") || "";
}

function saveModel(model) {
  PropertiesService.getUserProperties().setProperty("TYPESAFE_MODEL", model);
  return true;
}

function getModel() {
  return PropertiesService.getUserProperties().getProperty("TYPESAFE_MODEL") || "speed_v9_angry_pig";
}

function clearApiKey() {
  PropertiesService.getUserProperties().deleteProperty("TYPESAFE_API_KEY");
  return true;
}

function testConnection() {
  var apiKey = getApiKey_();
  if (!apiKey) {
    SpreadsheetApp.getUi().alert("No API key set. Go to TypeSafe AI → Settings to add one.");
    return;
  }

  try {
    var response = UrlFetchApp.fetch("https://api.typesafe.ai/preview/models", {
      method: "get",
      headers: {
        Authorization: "Bearer " + apiKey,
      },
      muteHttpExceptions: true,
    });

    var code = response.getResponseCode();
    if (code === 200) {
      var data = JSON.parse(response.getContentText());
      var modelNames = data.models
        .map(function (m) {
          return m.name;
        })
        .join(", ");
      SpreadsheetApp.getUi().alert("✅ Connected!\n\nAvailable models:\n" + modelNames);
    } else if (code === 401 || code === 403) {
      SpreadsheetApp.getUi().alert("❌ Authentication failed. Check your API key.");
    } else {
      SpreadsheetApp.getUi().alert("❌ Error " + code + ":\n" + response.getContentText());
    }
  } catch (e) {
    SpreadsheetApp.getUi().alert("❌ Connection failed:\n" + e.message);
  }
}

function fetchModels() {
  var apiKey = getApiKey_();
  if (!apiKey) return [];

  try {
    var response = UrlFetchApp.fetch("https://api.typesafe.ai/preview/models", {
      method: "get",
      headers: { Authorization: "Bearer " + apiKey },
      muteHttpExceptions: true,
    });
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText()).models;
    }
  } catch (e) {}
  return [];
}

// ─── Internal helpers ────────────────────────────────────────

function getApiKey_() {
  return PropertiesService.getUserProperties().getProperty("TYPESAFE_API_KEY") || "";
}

function getModel_() {
  return PropertiesService.getUserProperties().getProperty("TYPESAFE_MODEL") || "speed_latest";
}

/**
 * Builds a cache key from the function arguments.
 * @private
 */
function cacheKey_(prefix, args) {
  return (
    prefix +
    "_" +
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(args))
      .map(function (b) {
        return ("0" + (b & 0xff).toString(16)).slice(-2);
      })
      .join("")
  );
}

/**
 * Core API call with caching.
 * Cache TTL = 6 hours (max allowed). Avoids repeat calls for identical inputs.
 * @private
 */
function callTypeSafe_(document, prompts) {
  var apiKey = getApiKey_();
  if (!apiKey) {
    throw new Error("No API key. Go to Extensions → TypeSafe AI → Settings.");
  }

  var model = getModel_();
  var payload = { model: model, document: document, prompts: prompts };

  // Check cache
  var cache = CacheService.getUserCache();
  var key = cacheKey_("ts", [document, prompts, model]);
  var cached = cache.get(key);
  if (cached) {
    return JSON.parse(cached);
  }

  // Call API
  var response = UrlFetchApp.fetch("https://api.typesafe.ai/preview/evaluation", {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  var body = response.getContentText();

  if (code === 401 || code === 403) {
    throw new Error("Auth failed. Check your API key in TypeSafe AI → Settings.");
  }
  if (code === 422) {
    throw new Error("Invalid request: " + body);
  }
  if (code !== 200) {
    throw new Error("API error " + code + ": " + body);
  }

  var data = JSON.parse(body);

  // Cache for 6 hours
  try {
    cache.put(key, JSON.stringify(data), 21600);
  } catch (e) {
    // Cache put can fail for large payloads — that's fine, skip it
  }

  return data;
}

/**
 * Parse pipe-separated options into API format for CHOICE.
 * Supports bare labels: "a|b|c"
 * Supports label:description: "a:Desc one|b:Desc two"
 * @private
 */
function parseOptions_(optionsPiped) {
  return optionsPiped.split("|").map(function (o) {
    var parts = o.split(":");
    var option = parts[0].trim();
    var description = parts.length > 1 ? parts.slice(1).join(":").trim() : null;
    return { option: option, description: description };
  });
}

/**
 * Parse pipe-separated levels into API format for SCORE.
 * Format: "1:Terrible|2:Poor|3:OK|4:Good|5:Great"
 * Returns array: [{ level: 1, description: "Terrible" }, ...]
 * @private
 */
function parseLevels_(levelsPiped) {
  return levelsPiped.split("|").map(function (l) {
    var parts = l.split(":");
    var level = parseInt(parts[0].trim(), 10);
    var description = parts.length > 1 ? parts.slice(1).join(":").trim() : "";
    return { level: level, description: description };
  });
}

// ─── Custom Functions ────────────────────────────────────────

/**
 * Evaluate the probability of a yes/no statement being true.
 *
 * @param {string} text          The text to evaluate.
 * @param {string} instruction   A statement to assess (e.g. "The review is positive").
 * @return {number}              Probability between 0 and 1.
 * @customfunction
 */
function NOUL(text, instruction) {
  if (!text || !instruction) return "";
  var data = callTypeSafe_(String(text), [{ type: "noul", key: "r", instructions: String(instruction) }]);
  return data.responses[0].probability;
}

/**
 * Classify text into one of several options.
 *
 * Options are pipe-separated. Optionally add descriptions with colons:
 *   "positive|negative|neutral"
 *   "positive:Clearly favorable|negative:Clearly unfavorable|neutral:Neither"
 *
 * @param {string} text          The text to classify.
 * @param {string} instruction   Classification instruction.
 * @param {string} options       Pipe-separated options (e.g. "a|b|c" or "a:Desc|b:Desc").
 * @return {string}              The chosen option.
 * @customfunction
 */
function CHOICE(text, instruction, options) {
  if (!text || !instruction || !options) return "";
  var data = callTypeSafe_(String(text), [
    {
      type: "choice",
      key: "r",
      instructions: String(instruction),
      options: parseOptions_(String(options)),
    },
  ]);
  return data.responses[0].chosen;
}

/**
 * Score text on a numeric scale with defined levels.
 *
 * Levels are pipe-separated as "value:description":
 *   "1:Terrible|2:Poor|3:OK|4:Good|5:Excellent"
 *
 * You can skip intermediate levels:
 *   "1:Worst possible|5:Best possible"
 *
 * @param {string} text          The text to score.
 * @param {string} instruction   What to score (e.g. "Rate helpfulness").
 * @param {string} levels        Pipe-separated levels (e.g. "1:Bad|3:OK|5:Great").
 * @return {number}              Expected value (e.g. 3.72).
 * @customfunction
 */
function SCORE(text, instruction, levels) {
  if (!text || !instruction || !levels) return "";
  var data = callTypeSafe_(String(text), [
    {
      type: "score",
      key: "r",
      instructions: String(instruction),
      levels: parseLevels_(String(levels)),
    },
  ]);
  return data.responses[0].expectation;
}

// ─── Confidence Variants (return 2 columns) ─────────────────

/**
 * Like =NOUL() but returns [probability, confidence] across 2 columns.
 *
 * @param {string} text          The text to evaluate.
 * @param {string} instruction   A statement to assess.
 * @return {number[]}            [probability, confidence]
 * @customfunction
 */
function NOUL_C(text, instruction) {
  if (!text || !instruction) return [["", ""]];
  var data = callTypeSafe_(String(text), [{ type: "noul", key: "r", instructions: String(instruction) }]);
  var r = data.responses[0];
  return [[r.probability, r.confidence != null ? r.confidence : ""]];
}

/**
 * Like =CHOICE() but returns [chosen, confidence] across 2 columns.
 *
 * @param {string} text          The text to classify.
 * @param {string} instruction   Classification instruction.
 * @param {string} options       Pipe-separated options.
 * @return {Array}               [chosen, confidence]
 * @customfunction
 */
function CHOICE_C(text, instruction, options) {
  if (!text || !instruction || !options) return [["", ""]];
  var data = callTypeSafe_(String(text), [
    {
      type: "choice",
      key: "r",
      instructions: String(instruction),
      options: parseOptions_(String(options)),
    },
  ]);
  var r = data.responses[0];
  return [[r.chosen, r.confidence != null ? r.confidence : ""]];
}

/**
 * Like =SCORE() but returns [expectation, confidence] across 2 columns.
 *
 * @param {string} text          The text to score.
 * @param {string} instruction   What to score.
 * @param {string} levels        Pipe-separated levels.
 * @return {number[]}            [expectation, confidence]
 * @customfunction
 */
function SCORE_C(text, instruction, levels) {
  if (!text || !instruction || !levels) return [["", ""]];
  var data = callTypeSafe_(String(text), [
    {
      type: "score",
      key: "r",
      instructions: String(instruction),
      levels: parseLevels_(String(levels)),
    },
  ]);
  var r = data.responses[0];
  return [[r.expectation, r.confidence != null ? r.confidence : ""]];
}

/**
 * Returns the full probability distribution for a CHOICE as columns.
 * Each option gets its own column with the probability value.
 *
 * @param {string} text          The text to classify.
 * @param {string} instruction   Classification instruction.
 * @param {string} options       Pipe-separated options.
 * @return {number[]}            Probabilities in order of options provided.
 * @customfunction
 */
function CHOICE_DIST(text, instruction, options) {
  if (!text || !instruction || !options) return "";
  var optList = String(options)
    .split("|")
    .map(function (o) {
      return o.split(":")[0].trim();
    });
  var data = callTypeSafe_(String(text), [
    {
      type: "choice",
      key: "r",
      instructions: String(instruction),
      options: parseOptions_(String(options)),
    },
  ]);
  var probs = data.responses[0].probabilities;
  var probMap = {};
  probs.forEach(function (p) {
    probMap[p.option] = p.probability;
  });

  // Return probabilities in the same order as input options
  return [
    optList.map(function (o) {
      return probMap[o] != null ? probMap[o] : 0;
    }),
  ];
}

// ─── Batch / Multi-prompt (menu-triggered) ───────────────────

/**
 * Evaluate multiple prompts in a single API call.
 * Called from a menu or script, not as a custom function.
 *
 * @param {string|object} document   The document/data to evaluate.
 * @param {object[]} prompts         Array of prompt objects.
 * @return {object}                  Full API response.
 */
function evaluateMulti(document, prompts) {
  return callTypeSafe_(document, prompts);
}
