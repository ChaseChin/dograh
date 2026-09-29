"""DeepSeek (官方 API) LLM 选项。"""

DEEPSEEK_LLM_MODELS = (
    # deepseek-chat 支持 function calling,适合语音 agent;deepseek-reasoner
    # 是推理模型,延迟高且不支持工具调用,仅建议用于非实时场景。
    "deepseek-chat",
    "deepseek-reasoner",
)

DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com/v1"
