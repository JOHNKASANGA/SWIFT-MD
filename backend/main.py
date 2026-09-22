import os
import json
import random
import base64
import secrets
import time
from datetime import datetime, timezone

import httpx
from typing import Optional
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from anthropic import Anthropic
from dotenv import load_dotenv
from supabase import create_client
from pdf_utils import (
    chunk_text,
    extract_material_sample_from_url,
    extract_text_from_url,
)

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
GROQ_MODEL = "openai/gpt-oss-20b"
GROQ_VISION_MODEL = "qwen/qwen3.8-27b"

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def groq_generate(
    prompt: str,
    max_tokens: int = 8000,
    temperature: float = 0.7,
) -> str:
    import time
    for attempt in range(3):
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
                "temperature": temperature
            },
            timeout=60.0
        )
        if response.status_code == 429:
            if attempt < 2:
                time.sleep(15)
                continue
            else:
                response.raise_for_status()
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


def groq_generate_vision(
    prompt: str,
    image_bytes: bytes,
    max_tokens: int = 350,
) -> str:
    image_data = base64.b64encode(image_bytes).decode("ascii")

    response = httpx.post(
        GROQ_URL,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": GROQ_VISION_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_data}"
                            },
                        },
                    ],
                }
            ],
            "max_tokens": max_tokens,
            "temperature": 0,
        },
        timeout=60.0,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


def classify_with_groq(
    prompt: str,
    image_bytes: Optional[bytes] = None,
) -> dict:
    """Get a structured document classification with cautious retry behaviour."""
    for attempt in range(5):
        if image_bytes:
            image_data = base64.b64encode(image_bytes).decode("ascii")
            model = GROQ_VISION_MODEL
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_data}"
                            },
                        },
                    ],
                }
            ]
        else:
            model = GROQ_MODEL
            messages = [{"role": "user", "content": prompt}]

        response = httpx.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": messages,
                "max_tokens": 350,
                "temperature": 0,
                "response_format": {"type": "json_object"},
            },
            timeout=90.0,
        )

        if response.status_code == 429 and attempt < 4:
            time.sleep(20)
            continue

        if not response.is_success:
            raise RuntimeError(
                f"Groq request failed ({response.status_code}): "
                f"{response.text[:500]}"
            )

        try:
            content = response.json()["choices"][0]["message"]["content"]
            return parse_json(content)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as error:
            if attempt == 4:
                raise RuntimeError(
                    f"Groq returned invalid classification JSON: {error}"
                ) from error
            time.sleep(3)

    raise RuntimeError("Groq classification retries were exhausted.")


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


MATERIAL_CATEGORIES = {
    "lecture_notes",
    "slides",
    "past_questions",
    "assignments",
    "practice",
    "textbooks",
    "references",
    "other",
}


def require_admin(x_admin_key: Optional[str]) -> None:
    expected_key = os.getenv("ADMIN_API_KEY")

    if not expected_key:
        raise HTTPException(
            status_code=503,
            detail="Admin endpoints are unavailable until ADMIN_API_KEY is configured.",
        )

    if not x_admin_key or not secrets.compare_digest(x_admin_key, expected_key):
        raise HTTPException(status_code=401, detail="Invalid admin key.")


def get_material_sample(material: dict) -> dict:
    cached_text = material.get("extracted_text")

    if cached_text and cached_text.strip():
        return {
            "text": cached_text[:2500],
            "image_bytes": b"",
            "file_type": "cached_text",
            "error": None,
        }

    return extract_material_sample_from_url(
        material["file_url"],
        max_pages=4,
        max_chars=2500,
    )


def classify_material_content(material: dict, text: str) -> dict:
    prompt = f"""You classify university study documents from their ACTUAL CONTENT.

Choose exactly one category:
- lecture_notes: teaching notes, lecture handouts, study sessions, or topic explanations
- slides: presentation slides or slide decks
- past_questions: previous tests, exams, question compilations, or worked past papers
- assignments: assignments, coursework, take-home tasks, or submitted task sheets
- practice: drills, exercises, practice problems, or revision questions not presented as past exams
- textbooks: a textbook, textbook chapter, or substantial reference book
- references: external standards, articles, reports, or supporting documents
- other: content that does not fit the categories above

Rules:
- Base the choice on the document extract, not merely the filename.
- Do not invent a category from the course code.
- Confidence must be an integer from 0 to 100.
- Evidence must be a short phrase from the extract that supports the category.
- If the extract is too weak to tell, return "other" with confidence below 50.

Material title, only for context:
{material.get("title", "")}

Document extract:
{text[:2500]}

Respond only as JSON with keys: category, confidence, evidence."""

    time.sleep(2)
    data = classify_with_groq(prompt)

    category = str(data.get("category", "other")).strip().lower()
    confidence = data.get("confidence", 0)
    evidence = str(data.get("evidence", "")).strip()

    if category not in MATERIAL_CATEGORIES:
        category = "other"

    try:
        confidence = int(confidence)
    except (TypeError, ValueError):
        confidence = 0

    return {
        "category": category,
        "confidence": max(0, min(confidence, 100)),
        "evidence": evidence[:500],
    }


def classify_material_image(material: dict, image_bytes: bytes) -> dict:
    prompt = f"""You classify a university study document from its page image.

Choose exactly one category:
- lecture_notes
- slides
- past_questions
- assignments
- practice
- textbooks
- references
- other

Use visible document content, not only the filename. Confidence must be an
integer from 0 to 100. Evidence must be a short visible phrase supporting the
category. If the page is unreadable, choose other with confidence below 50.

Material title, only for context:
{material.get("title", "")}

Respond only as JSON with keys: category, confidence, evidence."""

    time.sleep(2)
    data = classify_with_groq(prompt, image_bytes=image_bytes)

    category = str(data.get("category", "other")).strip().lower()
    confidence = data.get("confidence", 0)
    evidence = str(data.get("evidence", "")).strip()

    if category not in MATERIAL_CATEGORIES:
        category = "other"

    try:
        confidence = int(confidence)
    except (TypeError, ValueError):
        confidence = 0

    return {
        "category": category,
        "confidence": max(0, min(confidence, 100)),
        "evidence": evidence[:500],
    }


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

class TheoryQuestionRequest(BaseModel):
    course_code: str
    num_questions: int = 5
    section: Optional[str] = None

class QuestionBankRequest(BaseModel):
    course_code: str
    question_type: str

class CourseQuizRequest(BaseModel):
    course_code: str
    num_questions: int = 10
    section: Optional[str] = None
    question_type: str = "mcq"


class MaterialClassificationBatchRequest(BaseModel):
    limit: int = Field(default=3, ge=1, le=5)
    retry_failed: bool = False


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Swift backend is alive"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/generate-greeting")
def generate_greeting(request: GreetingRequest):
    prompt = (
        "Generate a short, witty, personalised greeting for a university "
        f"student named {request.username}. Make it fun and motivating. "
        "Use at most two sentences: one short heading-style greeting and "
        "one useful study line. Return only the greeting."
    )

    try:
        greeting = groq_generate(
            prompt,
            max_tokens=100,
            temperature=0.7,
        )
    except Exception:
        greeting = (
            f"Welcome back, {request.username}. "
            "Pick one useful thing and make progress on it today."
        )

    return {"greeting": greeting.strip(), "username": request.username}

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

@app.get("/admin/material-classification-status")
def material_classification_status(
    x_admin_key: Optional[str] = Header(default=None),
):
    require_admin(x_admin_key)

    result = supabase.table("materials").select(
        "classification_status"
    ).execute()

    counts = {}
    for material in result.data or []:
        status = material.get("classification_status", "pending")
        counts[status] = counts.get(status, 0) + 1

    return {
        "total_materials": len(result.data or []),
        "by_status": counts,
    }


@app.post("/admin/classify-materials")
def classify_materials(
    request: MaterialClassificationBatchRequest,
    x_admin_key: Optional[str] = Header(default=None),
):
    require_admin(x_admin_key)

    statuses = ["pending"]
    if request.retry_failed:
        statuses.append("failed")

    result = (
        supabase.table("materials")
        .select("id, title, file_url, extracted_text")
        .in_("classification_status", statuses)
        .order("id", desc=False)
        .limit(request.limit)
        .execute()
    )

    materials = result.data or []
    processed = []

    for material in materials:
        material_id = material["id"]

        supabase.table("materials").update(
            {
                "classification_status": "processing",
                "classification_error": None,
            }
        ).eq("id", material_id).execute()

        try:
            sample = get_material_sample(material)
            text = sample.get("text", "")
            image_bytes = sample.get("image_bytes", b"")

            if len(text.strip()) >= 250:
                classification = classify_material_content(material, text)
                status = (
                    "auto_classified"
                    if classification["confidence"] >= 70
                    else "needs_review"
                )

                update = {
                    "category": classification["category"],
                    "category_confidence": classification["confidence"],
                    "category_source": "content_analysis",
                    "category_evidence": classification["evidence"],
                    "classification_status": status,
                    "classification_error": None,
                    "classified_at": datetime.now(timezone.utc).isoformat(),
                }
            elif image_bytes:
                classification = classify_material_image(material, image_bytes)
                status = (
                    "auto_classified"
                    if classification["confidence"] >= 70
                    else "needs_review"
                )

                update = {
                    "category": classification["category"],
                    "category_confidence": classification["confidence"],
                    "category_source": "content_analysis",
                    "category_evidence": classification["evidence"],
                    "classification_status": status,
                    "classification_error": None,
                    "classified_at": datetime.now(timezone.utc).isoformat(),
                }
            else:
                update = {
                    "category": "uncategorized",
                    "category_confidence": 0,
                    "category_source": "unreviewed",
                    "category_evidence": None,
                    "classification_status": "needs_review",
                    "classification_error": (
                        sample.get("error")
                        or "No extractable document text or OCR image was available."
                    )[:500],
                    "classified_at": datetime.now(timezone.utc).isoformat(),
                }

            supabase.table("materials").update(update).eq(
                "id", material_id
            ).execute()

            processed.append(
                {
                    "id": material_id,
                    "title": material["title"],
                    "category": update["category"],
                    "confidence": update["category_confidence"],
                    "status": update["classification_status"],
                }
            )
        except Exception as error:
            supabase.table("materials").update(
                {
                    "classification_status": "failed",
                    "classification_error": str(error)[:500],
                    "classified_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", material_id).execute()

            processed.append(
                {
                    "id": material_id,
                    "title": material["title"],
                    "status": "failed",
                    "error": str(error)[:180],
                }
            )

    return {
        "requested": request.limit,
        "processed_count": len(processed),
        "processed": processed,
    }


@app.post("/admin/generate-bank")
def generate_question_bank(
    request: QuestionBankRequest,
    x_admin_key: Optional[str] = Header(default=None),
):
    require_admin(x_admin_key)
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

    # Live generation fallback removed — it was pulling from unfiltered
    # raw text (including textbook prefaces/front-matter) and producing
    # low-quality, irrelevant questions. /quiz now only serves from a
    # properly curated question bank. If no bank exists yet, an error
    # is returned instead of generating live.
    raise HTTPException(
        status_code=404,
        detail=f"No {request.question_type} question bank exists yet for {request.course_code}. Live generation has been disabled to avoid low-quality questions."
    )


@app.post("/generate-theory-question")
def generate_theory_question(request: TheoryQuestionRequest):
    # Try the pre-generated bank first
    bank = supabase.table("question_banks").select("*").eq("course_code", request.course_code).eq("question_type", "theory").execute()

    if bank.data:
        all_questions = bank.data[0]["questions"]
        if request.section:
            filtered = [q for q in all_questions if request.section.lower() in q.get("question", "").lower()]
            questions = filtered if filtered else all_questions
        else:
            questions = all_questions
        selected = random.sample(questions, min(request.num_questions, len(questions)))
        return {
            "course_code": request.course_code,
            "questions": selected,
            "from_bank": True
        }

    # No bank exists - generate live
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
        raise HTTPException(status_code=400, detail="Could not extract text from materials")

    questions = generate_questions_from_chunk(all_text, "theory", request.num_questions, request.course_code)
    if not questions:
        raise HTTPException(status_code=500, detail="Failed to generate theory questions. Please try again.")

    return {
        "course_code": request.course_code,
        "questions": questions,
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

    response_text = groq_generate(prompt)
    grade_data = parse_json(response_text)

    return {
        "course_code": request.course_code,
        "grading": grade_data
    }

@app.get("/practice-courses")
def get_practice_courses():
    bank_result = supabase.table("question_banks").select(
        "course_code, question_type, questions"
    ).execute()

    if not bank_result.data:
        return {"courses": []}

    course_codes = sorted(
        {bank["course_code"] for bank in bank_result.data if bank.get("course_code")}
    )

    course_result = supabase.table("courses").select(
        "id, code, title, level, description"
    ).in_("code", course_codes).execute()

    course_by_code = {
        course["code"]: course for course in (course_result.data or [])
    }

    grouped = {}
    for bank in bank_result.data:
        course_code = bank.get("course_code")
        if not course_code:
            continue

        if course_code not in grouped:
            course = course_by_code.get(course_code, {})
            grouped[course_code] = {
                "id": course.get("id"),
                "code": course_code,
                "title": course.get("title", course_code),
                "level": course.get("level"),
                "description": course.get("description"),
                "banks": [],
            }

        questions = bank.get("questions") or []
        grouped[course_code]["banks"].append(
            {
                "type": bank.get("question_type"),
                "question_count": len(questions),
            }
        )

    practice_courses = sorted(
        grouped.values(),
        key=lambda course: (
            course["level"] if course["level"] is not None else 999,
            course["code"],
        ),
    )

    return {"courses": practice_courses}
