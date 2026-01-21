# gemini_image.py
import requests, os, json
from dotenv import load_dotenv

load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

def image_generator(prompt: str, aspect_ratio: str = "1:1"):
    """
    Generate image + text using Gemini 2.5 Flash Image via OpenRouter.
    Returns a tuple: (text_response, image_url)
    """
    try:
        print("=== Generating Gemini 2.5 Image ===")

        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "HTTP-Referer": "http://localhost:3000",  # required by OpenRouter
            "X-Title": "Unified AI Hub",
            "Content-Type": "application/json",
        }

        payload = {
            "model": "google/gemini-2.5-flash-image",
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "modalities": ["image", "text"],
            "image_config": {"aspect_ratio": aspect_ratio},
        }

        response = requests.post(url, headers=headers, json=payload, timeout=90)
        response.raise_for_status()
        data = response.json()

        # ✅ Extract both text and image
        if data.get("choices"):
            message = data["choices"][0]["message"]
            text_response = message.get("content", "[No text response]")
            image_url = None

            if message.get("images"):
                image_url = message["images"][0]["image_url"]["url"]

            return text_response, image_url

        return "[ERROR] No response returned.", None

    except requests.exceptions.RequestException as e:
        print("=== Gemini Image Generation Error ===")
        print(e.response.text if e.response else e)
        return f"[ERROR] {str(e)}", None
