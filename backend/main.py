import os
import json
import random
import httpx
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

anthropic_client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)


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
    if not text:
        text = extract_text_from_url(material["file_url"])
        supabase.table("materials").update(
            {"extracted_text": text}
        ).eq("id", material["id"]).execute()
    return text


# ── Models ────────────────────────────────────────────────────────────────────

class GreetingRequest(BaseModel):
    username: str

from typing import Optional

class MCQRequest(BaseModel):
    material_id: int
    num_questions: int = 5
    section: Optional[str] = None

from typing import Optional

class TheoryRequest(BaseModel):
    course_code: str
    question: Optional[str] = ""
    answer: str


@app.get("/quiz/{course_id}/{quiz_type}")
def get_quiz_from_bank(course_id: int, quiz_type: str, num_questions: int = 5):
    if quiz_type not in ["mcq", "german", "theory"]:
        raise HTTPException(status_code=400, detail="Type must be mcq, german, or theory")
    
    if quiz_type == "theory":
        num_questions = min(num_questions, 15)
    
    result = supabase.table("question_bank").select("*").eq("course_id", course_id).eq("type", quiz_type).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail=f"No {quiz_type} questions found for this course. Run generate_bank.py first.")
    
    questions = result.data
    
    if len(questions) > num_questions:
        questions = random.sample(questions, num_questions)
    
    parsed_questions = []
    for q in questions:
        qdata = q["question_data"]
        if isinstance(qdata, str):
            qdata = json.loads(qdata)
        parsed_questions.append(qdata)
    
    return {
        "course_id": course_id,
        "type": quiz_type,
        "num_questions": len(parsed_questions),
        "questions": parsed_questions
    }
class QuestionBankRequest(BaseModel):
    course_code: str
    question_type: str
    num_questions: int = 50

from typing import Optional

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
        messages=[
            {
                "role": "user",
                "content": f"Generate a short, witty, personalized greeting for a university student named {request.username}. Make it fun and motivating. Just the greeting, nothing else. Keep it to 2 sentences max — one short heading greeting and one witty line."
            }
        ]
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
    supabase.table("materials").update({"extracted_text": text}).eq("id", material_id).execute()
    return {"material_id": material_id, "title": material["title"], "text": text, "cached": False}


@app.post("/admin/generate-bank")
def generate_question_bank(request: QuestionBankRequest):
    result = supabase.table("materials").select("*").eq("course_code", request.course_code).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="No materials found for this course")

    all_text = ""
    material_ids = []

    for material in result.data:
        try:
            text = get_material_text(material)
        except Exception:
            continue
        if text:
            all_text += f"\n\n{text}"
            material_ids.append(material["id"])

    if not all_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from any materials")

    all_text = all_text[:12000]

    if request.question_type == "mcq":
        prompt = f"""You are a university exam question generator. Based on the following course material, generate exactly {request.num_questions} multiple choice questions.

Rules:
- Each question must have exactly 4 options: A, B, C, D
- Exactly one option must be correct
- Questions should test understanding, not just memorization
- Include questions on formulas, concepts, and applications
- Make wrong options plausible

Respond ONLY in this exact JSON format, no other text:
{{
  "questions": [
    {{
      "question": "Sample question?",
      "options": {{"A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D"}},
      "correct_answer": "B",
      "explanation": "Explanation here."
    }}
  ]
}}

Course material:
{all_text}"""
    else:
        prompt = f"""You are a university exam question generator. Based on the following course material, generate exactly {request.num_questions} fill-in-the-blank questions.

Rules:
- Each question should have one blank represented by _____
- The answer should be a key term or concept
- Questions should test understanding of core concepts

Respond ONLY in this exact JSON format, no other text:
{{
  "questions": [
    {{
      "question": "The process by which plants convert sunlight into energy is called _____.",
      "correct_answer": "photosynthesis",
      "acceptable_answers": ["photosynthesis"],
      "explanation": "Photosynthesis is the process plants use to convert light energy into chemical energy."
    }}
  ]
}}

Course material:
{all_text}"""

    response_text = groq_generate(prompt)
    questions_data = parse_json(response_text)

    existing = supabase.table("question_banks").select("*").eq("course_code", request.course_code).eq("question_type", request.question_type).execute()
    if existing.data:
        supabase.table("question_banks").update({
            "questions": questions_data["questions"],
            "material_ids": material_ids
        }).eq("course_code", request.course_code).eq("question_type", request.question_type).execute()
    else:
        supabase.table("question_banks").insert({
            "course_code": request.course_code,
            "question_type": request.question_type,
            "questions": questions_data["questions"],
            "material_ids": material_ids
        }).execute()

    return {
        "course_code": request.course_code,
        "question_type": request.question_type,
        "total_questions": len(questions_data["questions"]),
        "material_ids": material_ids
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
            "from_bank": True
        }

    materials = supabase.table("materials").select("*").eq("course_code", request.course_code).execute()
    if not materials.data:
        raise HTTPException(status_code=404, detail="No materials found for this course")

    all_text = ""
    for material in materials.data[:3]:
        try:
            text = get_material_text(material)
        except Exception:
            continue
        if text:
            all_text += f"\n\n{text}"

    all_text = all_text[:8000]

    if not all_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from materials")

    if request.question_type == "mcq":
        prompt = f"""Generate exactly {request.num_questions} MCQ questions from this material. Respond ONLY in JSON:
{{
  "questions": [
    {{
      "question": "Question?",
      "options": {{"A": "A", "B": "B", "C": "C", "D": "D"}},
      "correct_answer": "A",
      "explanation": "Explanation."
    }}
  ]
}}
Material: {all_text}"""
    else:
        prompt = f"""Generate exactly {request.num_questions} fill-in-the-blank questions from this material. Respond ONLY in JSON:
{{
  "questions": [
    {{
      "question": "The _____ is used to measure flow rate.",
      "correct_answer": "venturimeter",
      "acceptable_answers": ["venturimeter"],
      "explanation": "Explanation."
    }}
  ]
}}
Material: {all_text}"""

    response_text = groq_generate(prompt)
    questions_data = parse_json(response_text)

    return {
        "course_code": request.course_code,
        "question_type": request.question_type,
        "questions": questions_data["questions"][:request.num_questions],
        "from_bank": False
    }


@app.post("/generate-mcq")
def generate_mcq(request: MCQRequest):
    result = supabase.table("materials").select("*").eq("id", request.material_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Material not found")
    material = result.data[0]
    text = get_material_text(material)

    section_instruction = f"Focus ONLY on the section about: {request.section}." if request.section else ""

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

    response_text = groq_generate(prompt)
    mcq_data = parse_json(response_text)

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
    text = get_material_text(material)

    section_instruction = f"Focus ONLY on the section about: {request.section}." if request.section else ""

    prompt = f"""You are a strict university exam question generator. Based on the following course material, generate exactly {request.num_questions} fill-in-the-blank or short-answer questions.

{section_instruction}

Rules:
- Questions must have ONE specific correct answer (a word, number, formula, or short phrase)
- Ask Relevant question on slide 
- No multiple choice — the student must recall the answer from memory
- Mix question types: definitions, formulas, numerical values, names of concepts
- Answers should be unambiguous — only one correct response is possible
- Include acceptable alternative answers where relevant

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

    response_text = groq_generate(prompt)
    quiz_data = parse_json(response_text)

    return {
        "material_id": request.material_id,
        "title": material["title"],
        "section": request.section,
        "quiz": quiz_data
    }


@app.post("/generate-theory-question")
def generate_theory_question(request: MCQRequest):
    result = supabase.table("materials").select("*").eq("id", request.material_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Material not found")
    material = result.data[0]
    text = get_material_text(material)

    section_instruction = f"Focus ONLY on the section about: {request.section}." if request.section else ""

    prompt = f"""You are a university lecturer creating theory exam questions. Based on the following course material, generate exactly {request.num_questions} theory questions that require written explanations.

{section_instruction}

Rules:
- Mix question types: explain, derive, compare, describe, calculate
- Ask on Relevant questions to the course taken
- Questions should require 3-10 sentence answers, not one-word responses
- Each question should test deep understanding, not surface-level recall
- Include questions that require applying formulas to scenarios
- Order from easier to harder

Respond ONLY in this exact JSON format, no other text:
{{
  "questions": [
    {{
      "id": 1,
      "question": "Explain the working principle of a venturimeter and state the assumptions made in deriving its discharge equation.",
      "type": "explain",
      "difficulty": "medium",
      "key_points": ["Bernoulli's principle", "continuity equation", "horizontal pipe assumption", "ideal fluid assumption"],
      "max_marks": 10
    }}
  ]
}}

Course material:
{text}"""

    response_text = groq_generate(prompt)
    questions_data = parse_json(response_text)

    return {
        "material_id": request.material_id,
        "title": material["title"],
        "section": request.section,
        "theory": questions_data
    }


@app.post("/grade-theory")
def grade_theory(request: TheoryRequest):
    materials = supabase.table("materials").select("*").eq("course_code", request.course_code).execute()
    if not materials.data:
        raise HTTPException(status_code=404, detail="No materials found for this course")
    material = materials.data[0]
    text = get_material_text(material)
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
    "strengths": ["Correctly identified the three components of a venturimeter", "Good understanding of Bernoulli's principle"],
    "weaknesses": ["Did not mention the coefficient of discharge", "Formula for actual discharge was incomplete"],
    "missing_points": ["The role of C_d in accounting for energy losses"],
    "suggestion": "Review the section on actual vs theoretical discharge and understand why C_d is always less than 1."
  }}
}}

Grade fairly — a perfect answer gets 10/10, a completely wrong answer gets 0/10. Most answers should fall between 4-8.

Course material:
{text}"""

    response_text = claude_generate(prompt)
    grade_data = parse_json(response_text)

    return {
        "material_id": request.material_id,
        "title": material["title"],
        "grading": grade_data
    }