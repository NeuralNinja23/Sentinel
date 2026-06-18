import asyncio
from google.genai import types
from app.services.gemini import client
from app.config import MODEL

async def main():
    try:
        config = types.LiveConnectConfig(
            response_modalities=[types.Modality.AUDIO, types.Modality.TEXT]
        )
        async with client.aio.live.connect(model=MODEL, config=config):
            pass
    except Exception as e:
        print(f"FULL ERROR: {e}")

if __name__ == '__main__':
    asyncio.run(main())
