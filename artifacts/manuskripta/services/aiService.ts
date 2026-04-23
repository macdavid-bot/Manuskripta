// === MODEL SELECTION LOGIC ADDED ===
const DEEPSEEK_CHAT_MODEL = "deepseek-chat-v3.2";
const DEEPSEEK_REASONER_MODEL = "deepseek-reasoner";

function isComplexBook(inputs) {
  const tocLength = inputs.tableOfContents?.split("\n").length || 0;
  const hasHeavyNotes = (inputs.additionalPrompt || "").length > 200;
  const hasMemory = (inputs.memoryBank || "").length > 200;
  const largeBook = inputs.maxPages && inputs.maxPages > 120;

  return tocLength > 12 || hasHeavyNotes || hasMemory || largeBook;
}

function selectModel(inputs) {
  return isComplexBook(inputs)
    ? DEEPSEEK_REASONER_MODEL
    : DEEPSEEK_CHAT_MODEL;
}

// === UPDATED CALL FUNCTION ===
async function callDeepSeek(messages, maxTokens = 4096, inputs) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("DeepSeek API key not configured.");
  }

  const model = inputs ? selectModel(inputs) : DEEPSEEK_CHAT_MODEL;

  console.log("Using model:", model);

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content ?? "";
}

// NOTE: All existing calls to callDeepSeek should now pass `inputs` as third argument
