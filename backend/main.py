import os
import json
import random
import httpx
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from anthropic import Anthropic
from dotenv import load_dotenv
from supabase import create_client
from pdf_utils import extract_text_from_url, chunk_text

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

anthropic_client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def groq_generate(prompt: str, max_tokens: int = 8000) -> str:
    response = httpx.post(
        GROQ_URL,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": GROQ_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": 0.7
        },
        timeout=60.0
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


def claude_generate(prompt: str, max_tokens: int = 8000) -> str:
    message = anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text


def parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        clean = text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean)


def get_material_text(material: dict) -> str:
    text = material.get("extracted_text")
    if text:
        return text
    try:
        text = extract_text_from_url(material["file_url"])
        if text and text.strip():
            supabase.table("materials").update(
                {"extracted_text": text}
            ).eq("id", material["id"]).execute()
        return text or ""
    except Exception:
        return ""


def generate_questions_from_chunk(chunk: str, question_type: str, num_questions: int, course_code: str) -> list:
    if question_type == "mcq":
        prompt = f"""You are a university exam question generator for {course_code}.
Based ONLY on the following course material extract, generate exactly {num_questions} multiple choice questions.

STRICT RULES:
- Questions must be directly about concepts, facts, formulas, or principles in the text below
- Do NOT ask about authors, textbook names, publishers, page numbers, or metadata
- Do NOT ask generic questions unrelated to the actual content
- Each question must have exactly 4 options: A, B, C, D
- Exactly one option must be correct
- Make wrong options plausible but clearly incorrect to someone who studied
- Include questions on definitions, formulas, applications, and calculations where applicable

Respond ONLY in this exact JSON format, no other text:
{{
  "questions": [
    {{
      "question": "What is the purpose of a venturimeter?",
      "options": {{"A": "To measure temperature", "B": "To measure flow rate", "C": "To measure pressure only", "D": "To measure viscosity"}},
      "correct_answer": "B",
      "explanation": "A venturimeter measures the flow rate of fluid through a pipe using Bernoulli's principle."
    }}
  ]
}}

Course material extract:
{chunk}"""

    elif question_type == "german":
        prompt = f"""You are a university exam question generator for {course_code}.
Based ONLY on the following course material extract, generate exactly {num_questions} fill-in-the-blank questions.

STRICT RULES:
- Questions must be directly about concepts, facts, formulas, or principles in the text below
- Do NOT ask about authors, textbook names, publishers, or metadata
- Each question must have ONE specific correct answer
- Answers should be key terms, formulas, values, or concepts from the material
- Include acceptable alternative answers where relevant

Respond ONLY in this exact JSON format, no other text:
{{
  "questions": [
    {{
      "question": "The coefficient that accounts for energy losses in a venturimeter is called _____.",
      "correct_answer": "coefficient of discharge",
      "acceptable_answers": ["coefficient of discharge", "Cd", "C_d", "discharge coefficient"],
      "hint": "Represented by the symbol C_d",
      "explanation": "The coefficient of discharge accounts for real fluid energy losses."
    }}
  ]
}}

Course material extract:
{chunk}"""

    else:
        prompt = f"""You are a university lecturer for {course_code}.
Based ONLY on the following course material extract, generate exactly {num_questions} theory questions.

STRICT RULES:
- Questions must be directly about concepts in the text below
- Do NOT ask about authors or textbook metadata
- Questions should require 3-10 sentence written answers
- Mix question types: explain, derive, compare, describe, calculate
- Order from easier to harder

Respond ONLY in this exact JSON format, no other text:
{{
  "questions": [
    {{
      "id": 1,
      "question": "Explain the working principle of a venturimeter.",
      "type": "explain",
      "difficulty": "medium",
      "key_points": ["Bernoulli's principle", "continuity equation"],
      "max_marks": 10
    }}
  ]
}}

Course material extract:
{chunk}"""

    try:
        response_text = groq_generate(prompt)
        data = parse_json(response_text)
        return data.get("questions", [])
    except Exception:
        return []


# ── Models ────────────────────────────────────────────────────────────────────

class GreetingRequest(BaseModel):
    username: str

class MCQRequest(BaseModel):
    material_id: int
    num_questions: int = 5
    section: Optional[str] = None

class TheoryRequest(BaseModel):
    course_code: str
    question: Optional[str] = ""
    answer: str

class QuestionBankRequest(BaseModel):
    course_code: str
    question_type: str

class CourseQuizRequest(BaseModel):
    course_code: str
    num_questions: int = 10
    section: Optional[str] = None
    question_type: str = "mcq"


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Swift backend is alive"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/generate-greeting")
def generate_greeting(request: GreetingRequest):
    message = anthropic_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=100,
        messages=[{"role": "user", "content": f"Generate a short, witty, personalized greeting for a university student named {request.username}. Make it fun and motivating. Just the greeting, nothing else. Keep it to 2 sentences max — one short heading greeting and one witty line."}]
    )
    return {"greeting": message.content[0].text, "username": request.username}

@app.post("/extract-text/{material_id}")
def extract_text(material_id: int):
    result = supabase.table("materials").select("*").eq("id", material_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Material not found")
    material = result.data[0]
    if material.get("extracted_text"):
        return {"material_id": material_id, "title": material["title"], "text": material["extracted_text"], "cached": True}
    text = extract_text_from_url(material["file_url"])
    if text:
        supabase.table("materials").update({"extracted_text": text}).eq("id", material_id).execute()
    return {"material_id": material_id, "title": material["title"], "text": text, "cached": False}

@app.post("/admin/generate-bank")
def generate_question_bank(request: QuestionBankRequest):
    result = supabase.table("materials").select("*").eq("course_code", request.course_code).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="No materials found for this course")

    all_questions = []
    processed_materials = 0

    questions_per_chunk = {"mcq": 10, "german": 8, "theory": 3}.get(request.question_type, 10)

    for material in result.data:
        text = get_material_text(material)
        if not text or not text.strip():
            continue

        processed_materials += 1
        chunks = chunk_text(text, chunk_size=4000, overlap=200)

        for chunk in chunks:
            if len(chunk.strip()) < 200:
                continue
            questions = generate_questions_from_chunk(chunk, request.question_type, questions_per_chunk, request.course_code)
            all_questions.extend(questions)

    if not all_questions:
        raise HTTPException(status_code=400, detail=f"Could not generate questions. Processed {processed_materials} materials but got no questions.")

    # Deduplicate
    seen = set()
    unique_questions = []
    for q in all_questions:
        q_text = q.get("question", "")
        if q_text not in seen:
            seen.add(q_text)
            unique_questions.append(q)

    existing = supabase.table("question_banks").select("id").eq("course_code", request.course_code).eq("question_type", request.question_type).execute()
    if existing.data:
        supabase.table("question_banks").update({
            "questions": unique_questions,
        }).eq("course_code", request.course_code).eq("question_type", request.question_type).execute()
    else:
        supabase.table("question_banks").insert({
            "course_code": request.course_code,
            "question_type": request.question_type,
            "questions": unique_questions,
            "material_ids": [m["id"] for m in result.data]
        }).execute()

    return {
        "course_code": request.course_code,
        "question_type": request.question_type,
        "total_questions": len(unique_questions),
        "materials_processed": processed_materials
    }

@app.post("/quiz")
def get_quiz(request: CourseQuizRequest):
    result = supabase.table("question_banks").select("*").eq("course_code", request.course_code).eq("question_type", request.question_type).execute()

    if result.data:
        all_questions = result.data[0]["questions"]
        if request.section:
            filtered = [q for q in all_questions if request.section.lower() in q.get("question", "").lower()]
            questions = filtered if filtered else all_questions
        else:
            questions = all_questions
        selected = random.sample(questions, min(request.num_questions, len(questions)))
        return {
            "course_code": request.course_code,
            "question_type": request.question_type,
            "questions": selected,
            "from_bank": True,
            "bank_size": len(all_questions)
        }

    materials = supabase.table("materials").select("*").eq("course_code", request.course_code).execute()
    if not materials.data:
        raise HTTPException(status_code=404, detail="No materials found for this course")

    all_text = ""
    for material in materials.data[:3]:
        text = get_material_text(material)
        if text:
            all_text += f"\n\n{text}"
    all_text = all_text[:8000]

    if not all_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from materials. Generate a question bank first.")

    questions = generate_questions_from_chunk(all_text, request.question_type, request.num_questions, request.course_code)
    if not questions:
        raise HTTPException(status_code=500, detail="Failed to generate questions. Please try again.")

    return {
        "course_code": request.course_code,
        "question_type": request.question_type,
        "questions": questions[:request.num_questions],
        "from_bank": False
    }

@app.post("/grade-theory")
def grade_theory(request: TheoryRequest):
    materials = supabase.table("materials").select("*").eq("course_code", request.course_code).execute()
    if not materials.data:
        raise HTTPException(status_code=404, detail="No materials found for this course")

    context_text = ""
    for material in materials.data[:3]:
        text = get_material_text(material)
        if text:
            context_text += f"\n\n{text}"
    context_text = context_text[:8000]

    question_context = f"The question asked was: {request.question}" if request.question else ""

    prompt = f"""You are a strict university lecturer grading a student's theory answer.

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
    "strengths": ["Correctly identified the key concept", "Good understanding of the principle"],
    "weaknesses": ["Did not mention the formula", "Explanation was incomplete"],
    "missing_points": ["The mathematical derivation", "The assumptions made"],
    "suggestion": "Review the section more carefully and focus on the quantitative aspects."
  }}
}}

Grade fairly — a perfect answer gets 10/10, a completely wrong answer gets 0/10. Most answers fall between 4-8.

Course material for reference:
{context_text}"""

    response_text = claude_generate(prompt)
    grade_data = parse_json(response_text)

    return {
        "course_code": request.course_code,
        "grading": grade_data
    }