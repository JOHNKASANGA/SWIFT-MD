import os
import json
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

class MCQRequest(BaseModel):
    material_id: int
    num_questions: int = 5
    section: str = None

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

@app.post("/generate-mcq")
def generate_mcq(request: MCQRequest):
    # Get the material
    result = supabase.table("materials").select("*").eq("id", request.material_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Material not found")
    
    material = result.data[0]
    
    # Get the extracted text (extract if not cached)
    text = material.get("extracted_text")
    if not text:
        text = extract_text_from_url(material["file_url"])
        supabase.table("materials").update(
            {"extracted_text": text}
        ).eq("id", request.material_id).execute()
    
    # Build the prompt
    section_instruction = ""
    if request.section:
        section_instruction = f"Focus ONLY on the section about: {request.section}."
    
    prompt = f"""You are a university exam question generator. Based on the following course material, generate exactly {request.num_questions} multiple choice questions.

{section_instruction}

Rules:
- Each question must have exactly 4 options: A, B, C, D
- Exactly one option must be correct
- Questions should test understanding, not just memorization
- Include questions on formulas, concepts, and applications
- Make wrong options plausible, not obviously wrong

Respond ONLY in this exact JSON format, no other text:
{{
  "questions": [
    {{
      "question": "What is the purpose of a venturimeter?",
      "options": {{
        "A": "To measure temperature",
        "B": "To measure flow rate",
        "C": "To measure pressure only",
        "D": "To measure viscosity"
      }},
      "correct_answer": "B",
      "explanation": "A venturimeter measures the flow rate of fluid through a pipe using Bernoulli's principle."
    }}
  ]
}}

Course material:
{text}"""

    # Call Claude
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    
    # Parse the response
    import json
    response_text = message.content[0].text
    
    try:
        mcq_data = json.loads(response_text)
    except json.JSONDecodeError:
        # Sometimes Claude wraps JSON in markdown code blocks
        clean = response_text.replace("```json", "").replace("```", "").strip()
        mcq_data = json.loads(clean)
    
    return {
        "material_id": request.material_id,
        "title": material["title"],
        "section": request.section,
        "quiz": mcq_data
    }