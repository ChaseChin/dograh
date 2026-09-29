# Tencent Cloud realtime ASR (实时语音识别) engine model types.
# 8k_zh is the telephony model and matches Dograh's 8 kHz telephony transport;
# 16k_zh suits browser/WebRTC audio. Custom engine types (e.g. 8k_zh_finance)
# can be entered manually, so this list only carries the common defaults.
TENCENT_STT_MODELS = ("8k_zh", "16k_zh")
