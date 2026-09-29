"""阿里云百炼 (DashScope 兼容模式) LLM 选项。"""

BAILIAN_LLM_MODELS = (
    # 语音 agent 场景优先低延迟模型;qwen3 系列及其他模型可手动输入。
    "qwen-plus",
    "qwen-turbo",
    "qwen-flash",
    "qwen-max",
    "qwen-long",
)

# 兼容模式(OpenAI 协议)端点;国际站为 dashscope-intl.aliyuncs.com。
BAILIAN_DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

# 百炼 TTS(CosyVoice, DashScope 原生 websocket 协议)。
BAILIAN_TTS_MODELS = (
    "cosyvoice-v2",
    "cosyvoice-v1",
)

# 常用中文音色(cosyvoice-v2 音色带 _v2 后缀);其余音色可手动输入。
BAILIAN_TTS_VOICES = (
    "longxiaochun_v2",  # 龙小淳(女)
    "longxiaoxia_v2",  # 龙小夏(女)
    "longyu_v2",  # 龙悦(女)
    "longjing_v2",  # 龙京(男)
    "longshu_v2",  # 龙书(男)
)

# DashScope 原生 websocket 推理端点;国际站为
# wss://dashscope-intl.aliyuncs.com/api-ws/v1/inference。
BAILIAN_TTS_DEFAULT_BASE_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference"
