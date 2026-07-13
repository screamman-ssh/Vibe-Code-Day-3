/** vLLM / Gemma 4: disable chain-of-thought thinking channel in chat template. */
export const LLM_DISABLE_THINKING = {
  reasoning_effort: 'none',
  chat_template_kwargs: {
    enable_thinking: false
  }
}

export function withLlmNoThinking(body = {}) {
  return {
    ...body,
    reasoning_effort: 'none',
    chat_template_kwargs: {
      enable_thinking: false,
      ...(body.chat_template_kwargs || {})
    }
  }
}
