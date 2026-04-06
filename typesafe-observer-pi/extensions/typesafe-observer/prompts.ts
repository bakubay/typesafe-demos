import type { TypeSafePrompt } from "./typesafe-client";

export function getUserInputPrompts(): TypeSafePrompt[] {
  return [
    {
      key: "is_frustrated",
      type: "noul",
      instructions: "The user is expressing frustration or dissatisfaction",
    },
    {
      key: "is_correction",
      type: "noul",
      instructions:
        "The user is correcting or undoing something the AI did",
    },
    {
      key: "is_vague",
      type: "noul",
      instructions:
        "The input is vague or ambiguous, lacking specific details",
    },
    {
      key: "intent",
      type: "choice",
      instructions: "Classify the intent of this user message",
      options: [
        { option: "question", description: "Asking a question or seeking information" },
        { option: "command", description: "Giving a direct instruction or task" },
        { option: "complaint", description: "Expressing dissatisfaction with a result" },
        { option: "follow-up", description: "Continuing or building on a previous request" },
        { option: "clarification", description: "Clarifying or correcting a misunderstanding" },
      ],
    },
    {
      key: "frustration",
      type: "score",
      instructions: "Rate the user's level of frustration",
      levels: {
        1: "Calm and neutral, no signs of frustration",
        2: "Slightly impatient but still composed",
        3: "Noticeably frustrated, showing mild irritation",
        4: "Clearly frustrated, terse or demanding tone",
        5: "Very frustrated, angry or exasperated",
      },
    },
    {
      key: "specificity",
      type: "score",
      instructions: "Rate how specific and detailed the user's input is",
      levels: {
        1: "Extremely vague one-liner with no context",
        2: "Brief with minimal detail",
        3: "Moderate detail, somewhat clear intent",
        4: "Detailed with clear requirements",
        5: "Highly specific with exact file paths, code, or steps",
      },
    },
  ];
}

export function getAssistantResponsePrompts(): TypeSafePrompt[] {
  return [
    {
      key: "is_hedged",
      type: "noul",
      instructions:
        "The response is hedged with excessive caveats or disclaimers that reduce its usefulness",
    },
    {
      key: "is_over_explained",
      type: "noul",
      instructions:
        "The response over-explains or is unnecessarily verbose for what was asked",
    },
    {
      key: "response_type",
      type: "choice",
      instructions: "Classify the type of response the AI gave",
      options: [
        { option: "direct_answer", description: "A direct, on-topic response to the user's query" },
        { option: "hedged_answer", description: "Answers but with excessive caveats that reduce usefulness" },
        { option: "clarifying_question", description: "Asks the user for more information before proceeding" },
        { option: "refusal", description: "Declines to do what was asked" },
        { option: "off_topic", description: "Response does not address what the user asked" },
      ],
    },
    {
      key: "helpfulness",
      type: "score",
      instructions: "Rate how helpful this response is to the user",
      levels: {
        1: "Completely unhelpful, does not address the query at all",
        2: "Minimally helpful, touches on the topic but misses key points",
        3: "Somewhat helpful, addresses the query but lacks depth or accuracy",
        4: "Helpful, addresses the query well with relevant information",
        5: "Extremely helpful, thorough, accurate, and actionable",
      },
    },
  ];
}
