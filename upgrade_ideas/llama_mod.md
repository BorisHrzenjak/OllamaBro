# llama.cpp Features Not Available in Ollama

Features that llama.cpp exposes which Ollama abstracts away or doesn't support.

## Grammar-constrained generation
- GBNF grammars force output to conform to a specific format (e.g., strict JSON schema, regex patterns)
- Ollama has basic JSON mode; llama.cpp's grammar system is far more powerful and precise

## Speculative decoding
- Use a small draft model to predict tokens, verified by the main model — can give 2-4x speed boost
- Pass `--draft-model` to llama-server; Ollama doesn't expose this

## LoRA adapter loading
- Load fine-tuned LoRA adapters at runtime without rebundling the model
- `--lora` flag at startup; you can swap adapters per model

## Advanced sampling parameters
- `mirostat` / `mirostat_tau` / `mirostat_eta` — adaptive sampling for consistent perplexity
- `tfs_z` (tail-free sampling), `typical_p` (locally typical sampling)
- `repeat_penalty`, `repeat_last_n`, `penalize_nl`, `presence_penalty`, `frequency_penalty`
- Ollama exposes some of these, but llama.cpp gives raw control

## Prompt caching (KV cache reuse)
- `cache_prompt: true` in the request body reuses the KV cache for the system prompt across turns — significant speedup for long system prompts
- Ollama does some caching internally but doesn't expose it as a tunable

## Flash attention
- `--flash-attn` flag reduces VRAM usage significantly for long contexts
- Not something you configure through Ollama

## RoPE context extension
- `--rope-scale`, `--rope-freq-base`, `--yarn-ext-factor` — extend a model's context beyond its training window
- Useful for running a 4k-context model at 16k+

## Tokenize/detokenize endpoints
- `/tokenize` and `/detokenize` endpoints for counting tokens precisely before sending
- Helpful for context management UX

---

## Priority candidates for OllamaBar implementation
1. **Grammar/JSON mode** — structured output control
2. **Prompt caching** — easy win, just pass `cache_prompt: true`
3. **Extended sampling parameters** — mirostat, repeat penalty, etc.
