import os
import json
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

class GreetingRequest(BaseModel):
    username: str

class MCQRequest(BaseModel):
    material_id: int
    num_questions: int = 5
    section: str = None

class TheoryRequest(BaseModel):
    material_id: int
    question: str 
    answer: str

class QuestionBankRequest(BaseModel):
    course_code: str
    question_type: str  # "mcq" or "german"
    num_questions: int = 50

class CourseQuizRequest(BaseModel):
    course_code: str
    num_questions: int = 10
    section: str = None
    question_type: str = "mcq"


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

@app.post("/admin/generate-bank")
def generate_question_bank(request: QuestionBankRequest):
    # Fetch all materials for this course
    result = supabase.table("materials").select("*").eq("course_code", request.course_code).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="No materials found for this course")
    
    all_text = ""
    material_ids = []
    
    for material in result.data:
        text = material.get("extracted_text")
        if not text:
            try:
                text = extract_text_from_url(material["file_url"])
                supabase.table("materials").update(
                    {"extracted_text": text}
                ).eq("id", material["id"]).execute()
            except Exception:
                continue
        if text:
            all_text += f"\n\n{text}"
            material_ids.append(material["id"])
    
    if not all_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from any materials")
    
    # Trim text to avoid token limits
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

    else:  # german/fill-in-blank
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
      "answer": "photosynthesis",
      "explanation": "Photosynthesis is the process plants use to convert light energy into chemical energy."
    }}
  ]
}}

Course material:
{all_text}"""

    response_text = groq_generate(prompt)
    
    try:
        questions_data = json.loads(response_text)
    except json.JSONDecodeError:
        clean = response_text.replace("```json", "").replace("```", "").strip()
        questions_data = json.loads(clean)
    
    # Store in question_banks table
    existing = supabase.table("question_banks").select("*").eq("course_code", request.course_code).eq("question_type", request.question_type).execute()
    
    if existing.data:
        supabase.table("question_banks").update({
            "questions": questions_data["questions"],
            "material_ids": material_ids,
            "generated_at": "now()"
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
    # Try to serve from question bank first
    result = supabase.table("question_banks").select("*").eq("course_code", request.course_code).eq("question_type", request.question_type).execute()
    
    if result.data:
        import random
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
    
    # No bank exists — generate live with Groq
    materials = supabase.table("materials").select("*").eq("course_code", request.course_code).execute()
    
    if not materials.data:
        raise HTTPException(status_code=404, detail="No materials found for this course")
    
    all_text = ""
    for material in materials.data[:3]:  # limit to 3 materials for live generation
        text = material.get("extracted_text")
        if not text:
            try:
                text = extract_text_from_url(material["file_url"])
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
      "answer": "venturimeter",
      "explanation": "Explanation."
    }}
  ]
}}
Material: {all_text}"""
    
    response_text = groq_generate(prompt)
    
    try:
        questions_data = json.loads(response_text)
    except json.JSONDecodeError:
        clean = response_text.replace("```json", "").replace("```", "").strip()
        questions_data = json.loads(clean)
    
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

    response_text = groq_generate(prompt)
    
    
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
        max_tokens=8000,
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
@app.post("/generate-theory-question")
def generate_theory_question(request: MCQRequest):
    # Get the material
    result = supabase.table("materials").select("*").eq("id", request.material_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Material not found")
    
    material = result.data[0]
    
    # Get the extracted text
    text = material.get("extracted_text")
    if not text:
        text = extract_text_from_url(material["file_url"])
        supabase.table("materials").update(
            {"extracted_text": text}
        ).eq("id", request.material_id).execute()
    
    section_instruction = ""
    if request.section:
        section_instruction = f"Focus ONLY on the section about: {request.section}."
    
    prompt = f"""You are a university lecturer creating theory exam questions. Based on the following course material, generate exactly {request.num_questions} theory questions that require written explanations.

{section_instruction}

Rules:
- Mix question types: explain, derive, compare, describe, calculate
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

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8000,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    
    response_text = message.content[0].text
    
    try:
        questions_data = json.loads(response_text)
    except json.JSONDecodeError:
        clean = response_text.replace("```json", "").replace("```", "").strip()
        questions_data = json.loads(clean)
    
    return {
        "material_id": request.material_id,
        "title": material["title"],
        "section": request.section,
        "theory": questions_data
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
    
    prompt = f"""role:"Strict University Lecturer","task":"Grade student theory answer","constraints":"Use ONLY provided material; no external knowledge","question_logic":"Closely related to material but requires application","output":"JSON format question and grading rubric"

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
        max_tokens=8000,
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