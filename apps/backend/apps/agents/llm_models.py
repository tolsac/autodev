AVAILABLE_LLM_MODELS = [
    {"id": "anthropic/claude-sonnet-4-20250514", "name": "Claude Sonnet 4", "provider": "Anthropic", "context_window": 200000, "input_price_per_m": 3.0, "output_price_per_m": 15.0},
    {"id": "anthropic/claude-opus-4-20250514", "name": "Claude Opus 4", "provider": "Anthropic", "context_window": 200000, "input_price_per_m": 15.0, "output_price_per_m": 75.0},
    {"id": "openai/gpt-4o", "name": "GPT-4o", "provider": "OpenAI", "context_window": 128000, "input_price_per_m": 2.5, "output_price_per_m": 10.0},
    {"id": "openai/gpt-4o-mini", "name": "GPT-4o Mini", "provider": "OpenAI", "context_window": 128000, "input_price_per_m": 0.15, "output_price_per_m": 0.6},
    {"id": "openai/o3", "name": "o3", "provider": "OpenAI", "context_window": 200000, "input_price_per_m": 10.0, "output_price_per_m": 40.0},
    {"id": "openai/o3-mini", "name": "o3 Mini", "provider": "OpenAI", "context_window": 200000, "input_price_per_m": 1.1, "output_price_per_m": 4.4},
    {"id": "google/gemini-2.5-pro", "name": "Gemini 2.5 Pro", "provider": "Google", "context_window": 1000000, "input_price_per_m": 1.25, "output_price_per_m": 10.0},
    {"id": "google/gemini-2.5-flash", "name": "Gemini 2.5 Flash", "provider": "Google", "context_window": 1000000, "input_price_per_m": 0.15, "output_price_per_m": 0.6},
    {"id": "deepseek/deepseek-chat-v3", "name": "DeepSeek V3", "provider": "DeepSeek", "context_window": 128000, "input_price_per_m": 0.27, "output_price_per_m": 1.1},
    {"id": "deepseek/deepseek-reasoner", "name": "DeepSeek R1", "provider": "DeepSeek", "context_window": 128000, "input_price_per_m": 0.55, "output_price_per_m": 2.19},
    {"id": "mistralai/codestral-latest", "name": "Codestral", "provider": "Mistral", "context_window": 256000, "input_price_per_m": 0.3, "output_price_per_m": 0.9},
]

AVAILABLE_LLM_MODEL_IDS = [m["id"] for m in AVAILABLE_LLM_MODELS]
