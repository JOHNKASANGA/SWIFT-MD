import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from anthropic import Anthropic
from dotenv import load_dotenv
from supabase import create_client
from pdf_utils import extract_text_from_url

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)

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

@app.post("/extract-text/{material_id}")
def extract_text(material_id: int):
    # Get the material from the database
    result = supabase.table("materials").select("*").eq("id", material_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Material not found")
    
    material = result.data[0]
    
    # If text is already cached, return it
    if material.get("extracted_text"):
        return {
            "material_id": material_id,
            "title": material["title"],
            "text": material["extracted_text"],
            "cached": True
        }
    
    # Extract text from the PDF
    text = extract_text_from_url(material["file_url"])
    
    # Cache it in the database
    supabase.table("materials").update(
        {"extracted_text": text}
    ).eq("id", material_id).execute()
    
    return {
        "material_id": material_id,
        "title": material["title"],
        "text": text,
        "cached": False
    }