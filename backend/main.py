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

class TheoryRequest(BaseModel):
    material_id: int
    question: str = None
    answer: str

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
    
    result = supabase.table("materials").select("*").eq("id", material_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Material not found")
    
    material = result.data[0]
    
    
    if material.get("extracted_text"):
        return {
            "material_id": material_id,
            "title": material["title"],
            "text": material["extracted_text"],
            "cached": True
        }
    
    
    text = extract_text_from_url(material["file_url"])
    
    
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
   
    result = supabase.table("materials").select("*").eq("id", request.material_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Material not found")
    
    material = result.data[0]
    
    
    text = material.get("extracted_text")
    if not text:
        text = extract_text_from_url(material["file_url"])
        supabase.table("materials").update(
            {"extracted_text": text}
        ).eq("id", request.material_id).execute()
    
    
    section_instruction = ""
    if request.section:
        section_instruction = f"Focus ONLY on the section about: {request.section}."
    
    prompt = f"""You are a university exam question generator. Based on the following course material, generate exactly {request.num_questions} multiple choice questions, if {request.num_questions} is not enough to cover the topic extensively create 50 mcqs. if {request.num_questions} is not given automatically make 50 questions 
    

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

    
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    
    
    import json
    response_text = message.content[0].text
    
    try:
        mcq_data = json.loads(response_text)
    except json.JSONDecodeError:
        
        clean = response_text.replace("```json", "").replace("```", "").strip()
        mcq_data = json.loads(clean)
    
    return {
        "material_id": request.material_id,
        "title": material["title"],
        "section": request.section,
        "quiz": mcq_data
    }

@app.post("/generate-german-quiz")
def generate_german_quiz(request: MCQRequest):
    
    result = supabase.table("materials").select("*").eq("id", request.material_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Material not found")
    
    material = result.data[0]
    
    
    text = material.get("extracted_text")
    if not text:
        text = extract_text_from_url(material["file_url"])
        supabase.table("materials").update(
            {"extracted_text": text}
        ).eq("id", request.material_id).execute()
    
    section_instruction = ""
    if request.section:
        section_instruction = f"Focus ONLY on the section about: {request.section}."
    
    prompt = f"""You are a strict university exam question generator. Based on the following course material, generate exactly {request.num_questions} fill-in-the-blank or short-answer questions.

{section_instruction}

Rules:
- Questions must have ONE specific correct answer (a word, number, formula, or short phrase)
- No multiple choice — the student must recall the answer from memory
- Mix question types: definitions, formulas, numerical values, names of concepts
- Answers should be unambiguous — only one correct response is possible
- Include acceptable alternative answers where relevant (e.g. abbreviations, different notations)

Respond ONLY in this exact JSON format, no other text:
{{
  "questions": [
    {{
      "question": "What is the name of the coefficient that accounts for energy losses in a venturimeter?",
      "correct_answer": "coefficient of discharge",
      "acceptable_answers": ["coefficient of discharge", "Cd", "C_d", "discharge coefficient"],
      "hint": "It is represented by the symbol C_d",
      "explanation": "The coefficient of discharge (C_d) is a factor less than 1 that accounts for energy losses in real fluid flow."
    }}
  ]
}}

Course material:
{text}"""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    
    response_text = message.content[0].text
    
    try:
        quiz_data = json.loads(response_text)
    except json.JSONDecodeError:
        clean = response_text.replace("```json", "").replace("```", "").strip()
        quiz_data = json.loads(clean)
    
    return {
        "material_id": request.material_id,
        "title": material["title"],
        "section": request.section,
        "quiz": quiz_data
    }
@app.post("/grade-theory")
def grade_theory(request: TheoryRequest):
    
    result = supabase.table("materials").select("*").eq("id", request.material_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Material not found")
    
    material = result.data[0]
    
    
    text = material.get("extracted_text")
    if not text:
        text = extract_text_from_url(material["file_url"])
        supabase.table("materials").update(
            {"extracted_text": text}
        ).eq("id", request.material_id).execute()
    
    question_context = ""
    if request.question:
        question_context = f"The question asked was: {request.question}"
    
    prompt = f"""You are a strict but fair university lecturer grading a student's theory answer. Grade the answer based ONLY on the course material provided — do not use outside knowledge.

{question_context}

Student's answer:
{request.answer}

Grading criteria:
- Accuracy: Does the answer contain correct information from the course material?
- Completeness: Did the student cover all the key points?
- Understanding: Does the answer show genuine understanding, not just memorization?
- Clarity: Is the answer well-explained and logical?

Respond ONLY in this exact JSON format, no other text:
{{
  "score": 7,
  "max_score": 10,
  "grade": "B",
  "feedback": {{
    "strengths": ["Correctly identified the three components of a venturimeter", "Good understanding of Bernoulli's principle"],
    "weaknesses": ["Did not mention the coefficient of discharge", "Formula for actual discharge was incomplete"],
    "missing_points": ["The role of C_d in accounting for energy losses", "The relationship between theoretical and actual discharge"],
    "suggestion": "Review the section on actual vs theoretical discharge and understand why C_d is always less than 1."
  }}
}}

Grade fairly — a perfect answer gets 10/10, a completely wrong answer gets 0/10. Most answers should fall between 4-8.

Course material:
{text}"""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    
    response_text = message.content[0].text
    
    try:
        grade_data = json.loads(response_text)
    except json.JSONDecodeError:
        clean = response_text.replace("```json", "").replace("```", "").strip()
        grade_data = json.loads(clean)
    
    return {
        "material_id": request.material_id,
        "title": material["title"],
        "grading": grade_data
    }