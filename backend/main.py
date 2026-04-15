import os
from fastapi import FastAPI
from pydantic import BaseModel
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


class GreetingRequest(BaseModel):
    username: str


@app.get("/")
def root():
    return {"message": "Swift backend is alive"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/generate-greeting")
def generate_greeting(request: GreetingRequest):
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=100,
        messages=[
            {
                "role": "user",
                "content": f"Generate a short, witty, personalized greeting for a university student named {request.username}. Make it fun and motivating. Just the greeting, nothing else. Keep it to 2 sentences max — one short heading greeting and one witty line."
            }
        ]
    )
    
    greeting_text = message.content[0].text
    
    return {"greeting": greeting_text, "username": request.username}