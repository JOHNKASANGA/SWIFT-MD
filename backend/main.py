import os
import json
import random
import base64
import secrets
import re
import time
import hmac
import hashlib
import requests
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import httpx
from typing import Optional
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
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

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models"

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


def gemini_generate_json(prompt: str, max_tokens: int = 2200) -> str:
    """Generate structured JSON with Gemini for student-facing study tools."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    response = httpx.post(
        f"{GEMINI_URL}/{GEMINI_MODEL}:generateContent",
        headers={
            "x-goog-api-key": GEMINI_API_KEY,
            "Content-Type": "application/json",
        },
        json={
            "contents": [
                {"role": "user", "parts": [{"text": safe_text(prompt)}]}
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": max_tokens,
                "responseMimeType": "application/json",
            },
        },
        timeout=60.0,
    )
    response.raise_for_status()

    try:
        return response.json()["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as error:
        raise RuntimeError("Gemini returned an unusable response.") from error


CLASSIFICATION_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "category": {
            "type": "string",
            "enum": [
                "lecture_notes",
                "slides",
                "past_questions",
                "assignments",
                "practice",
                "textbooks",
                "references",
                "laboratory",
                "other",
            ],
        },
        "confidence": {"type": "integer"},
        "evidence": {"type": "string"},
    },
    "required": ["category", "confidence", "evidence"],
}


class TransientClassificationError(RuntimeError):
    """A provider issue that should be retried later, not marked permanent."""


def safe_text(value: object) -> str:
    """Remove invalid Unicode surrogates before JSON, HTTP, or Supabase work."""
    return str(value or "").encode("utf-8", "replace").decode("utf-8")


def require_user(authorization: Optional[str]) -> str:
    """Verify a Swift Supabase session and return the signed-in user id."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in to use AI study checks.")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        response = supabase.auth.get_user(token)
        user = response.user
    except Exception as error:
        raise HTTPException(status_code=401, detail="Your session has expired. Sign in again.") from error

    if not user:
        raise HTTPException(status_code=401, detail="Your session has expired. Sign in again.")
    return str(user.id)


def retry_delay_seconds(response: Optional[httpx.Response], attempt: int) -> int:
    if response is not None:
        retry_after = response.headers.get("retry-after", "").strip()

        try:
            return max(5, min(int(float(retry_after)) + 1, 180))
        except ValueError:
            pass

        retry_match = re.search(
            r"retry(?:\s+in|\s+after)?\s+(\d+(?:\.\d+)?)\s*s?",
            response.text,
            re.IGNORECASE,
        )

        if retry_match:
            return max(5, min(int(float(retry_match.group(1))) + 1, 180))

    return min(15 * (2 ** attempt), 180)


def classify_with_gemini(
    prompt: str,
    image_bytes: Optional[bytes] = None,
) -> dict:
    """Classify one material with structured Gemini output and bounded retries."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    parts = [{"text": safe_text(prompt)}]

    if image_bytes:
        image_data = base64.b64encode(image_bytes).decode("ascii")
        parts.append(
            {
                "inlineData": {
                    "mimeType": "image/png",
                    "data": image_data,
                }
            }
        )

    last_error = "Gemini did not return a usable classification."

    for attempt in range(5):
        response = None

        try:
            response = httpx.post(
                f"{GEMINI_URL}/{GEMINI_MODEL}:generateContent",
                headers={
                    "x-goog-api-key": GEMINI_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "contents": [{"role": "user", "parts": parts}],
                    "generationConfig": {
                        "temperature": 0,
                        "maxOutputTokens": 220,
                        "responseMimeType": "application/json",
                        "responseJsonSchema": CLASSIFICATION_JSON_SCHEMA,
                    },
                },
                timeout=90.0,
            )
        except httpx.RequestError as error:
            last_error = f"Gemini network error: {safe_text(error)}"
        else:
            if response.status_code in {429, 500, 502, 503, 504}:
                last_error = (
                    f"Gemini temporary error ({response.status_code}): "
                    f"{safe_text(response.text)[:500]}"
                )
            elif not response.is_success:
                raise RuntimeError(
                    f"Gemini request failed ({response.status_code}): "
                    f"{safe_text(response.text)[:500]}"
                )
            else:
                try:
                    content = response.json()["candidates"][0]["content"]["parts"][0]["text"]
                    return parse_json(content)
                except (KeyError, IndexError, TypeError, json.JSONDecodeError) as error:
                    last_error = f"Gemini returned invalid classification JSON: {error}"

        if attempt < 4:
            time.sleep(retry_delay_seconds(response, attempt))

    raise TransientClassificationError(last_error)


def classify_with_provider(
    prompt: str,
    image_bytes: Optional[bytes] = None,
) -> dict:
    """Use Gemini for classification when its API key is configured."""
    if GEMINI_API_KEY:
        return classify_with_gemini(prompt, image_bytes=image_bytes)

    return classify_with_groq(prompt, image_bytes=image_bytes)


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
    "laboratory",
    "other",
}


MATERIAL_PRIORITIES = {
    "start_here",
    "core",
    "recommended",
    "supplementary",
    "reference",
    "unreviewed",
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

def make_approve_token(submission_id: int) -> str:
    secret = os.getenv("ADMIN_API_KEY")
    if not secret:
        raise RuntimeError("ADMIN_API_KEY must be configured to sign approve links.")
    return hmac.new(
        secret.encode(), f"approve:{submission_id}".encode(), hashlib.sha256
    ).hexdigest()


def send_admin_email(subject: str, html_body: str) -> None:
    resend_api_key = os.getenv("RESEND_API_KEY")
    admin_email = os.getenv("ADMIN_NOTIFY_EMAIL")

    if not resend_api_key or not admin_email:
        print("Email not sent: RESEND_API_KEY or ADMIN_NOTIFY_EMAIL not configured.")
        return

    response = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {resend_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "from": "Swift <onboarding@resend.dev>",
            "to": [admin_email],
            "subject": subject,
            "html": html_body,
        },
        timeout=10,
    )

    if response.status_code >= 400:
        print(f"Resend API error: {response.status_code} — {response.text}")
        response.raise_for_status()


def confirmation_page(message: str, success: bool = True) -> str:
    accent = "#315bea" if success else "#b3261e"
    if success:
        icon_path = '<path d="M14 24.5L20.5 31L34 17" stroke="#315bea" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
    else:
        icon_path = '<path d="M17 17L31 31M31 17L17 31" stroke="#b3261e" stroke-width="2.5" stroke-linecap="round"/>'

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Swift</title></head>
<body style="font-family: Georgia, 'Times New Roman', serif; background:#ffffff; color:#171717; display:flex; align-items:center; justify-content:center; height:100vh; margin:0;">
  <div style="text-align:center; max-width:420px; padding:24px;">
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="22" stroke="{accent}" stroke-width="2"/>
      {icon_path}
    </svg>
    <p style="margin-top:20px; font-size:1.1rem; line-height:1.5;">{message}</p>
  </div>
</body></html>"""

class MaterialSubmissionNotifyRequest(BaseModel):
    submission_id: int


@app.post("/material-submissions/notify")
def notify_material_submission(request: MaterialSubmissionNotifyRequest):
    """Called by the frontend right after a student submits a suggestion."""
    result = (
        supabase.table("material_submissions")
        .select("*")
        .eq("id", request.submission_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    submission = rows[0] if rows else None

    if not submission or submission.get("status") != "pending":
        return {"notified": False}
    if submission.get("notified_at"):
        return {"notified": False}

    backend_url = os.getenv("BACKEND_PUBLIC_URL", "").rstrip("/")
    token = make_approve_token(submission["id"])
    approve_link = f"{backend_url}/admin/material-submissions/{submission['id']}/approve/{token}"

    html_body = f"""
    <div style="font-family: Georgia, 'Times New Roman', serif; color:#171717; max-width:560px;">
      <p style="text-transform:uppercase; letter-spacing:0.08em; font-size:0.75rem; color:#777771; font-weight:700;">New material suggestion</p>
      <h2 style="font-weight:500; letter-spacing:-0.02em;">{submission['title']}</h2>
      <table style="font-family: sans-serif; font-size:0.95rem; color:#30302d; border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0; color:#777771;">Course</td><td>{submission['course_code']}</td></tr>
        <tr><td style="padding:4px 12px 4px 0; color:#777771;">Category</td><td>{submission.get('category', '')}</td></tr>
        <tr><td style="padding:4px 12px 4px 0; color:#777771;">Link</td><td><a href="{submission['url']}">{submission['url']}</a></td></tr>
        <tr><td style="padding:4px 12px 4px 0; color:#777771;">Note</td><td>{submission.get('note') or '\u2014'}</td></tr>
      </table>
      <p style="margin-top:24px;">
        <a href="{approve_link}" style="background:#315bea; color:#ffffff; text-decoration:none; padding:12px 22px; border-radius:8px; font-family: sans-serif; font-weight:600; font-size:0.9rem; display:inline-block;">
          Approve and add to Swift
        </a>
      </p>
    </div>
    """

    send_admin_email(f"New material suggestion: {submission['title']}", html_body)
    supabase.table("material_submissions").update(
        {"notified_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", submission["id"]).execute()
    return {"notified": True}


@app.get("/admin/material-submissions/{submission_id}/approve/{token}", response_class=HTMLResponse)
def approve_material_submission_via_email(submission_id: int, token: str):
    expected_token = make_approve_token(submission_id)
    if not hmac.compare_digest(expected_token, token):
        return HTMLResponse(confirmation_page("This approval link is invalid.", success=False), status_code=403)

    result = (
        supabase.table("material_submissions")
        .select("*")
        .eq("id", submission_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    submission = rows[0] if rows else None

    if not submission:
        return HTMLResponse(confirmation_page("This submission no longer exists.", success=False), status_code=404)

    if submission["status"] != "pending":
        return HTMLResponse(confirmation_page(f"This submission was already marked \u2018{submission['status']}\u2019."))

    url = safe_text(submission.get("url")).strip()
    parsed_url = urlparse(url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        return HTMLResponse(confirmation_page("This submission has no valid link and could not be added.", success=False), status_code=422)

    category = safe_text(submission.get("category")).strip().lower()
    if category not in MATERIAL_CATEGORIES:
        category = "references"

    duplicate_result = (
        supabase.table("materials")
        .select("id, title")
        .eq("file_url", url)
        .limit(1)
        .execute()
    )
    duplicate_rows = duplicate_result.data or []
    if duplicate_rows:
        return HTMLResponse(
            confirmation_page(f"This link is already published as material {duplicate_rows[0]['id']}.", success=False),
            status_code=409,
        )

    reviewed_at = datetime.now(timezone.utc).isoformat()
    material_title = safe_text(submission.get("title")).strip()
    material_summary = safe_text(submission.get("note")).strip() or None

    supabase.table("materials").insert(
        {
            "course_code": submission["course_code"],
            "title": material_title,
            "file_url": url,
            "category": category,
            "category_confidence": 100,
            "category_source": "manual_review",
            "category_evidence": "Approved student submission via email link.",
            "classification_status": "reviewed",
            "classified_at": reviewed_at,
            "source_name": parsed_url.netloc,
            "material_summary": material_summary,
            "resource_kind": "website",
        }
    ).execute()

    supabase.table("material_submissions").update(
        {
            "status": "approved",
            "review_note": "Approved via one-click email link.",
            "reviewed_at": reviewed_at,
        }
    ).eq("id", submission_id).execute()

    return HTMLResponse(confirmation_page(f"\u201c{material_title}\u201d was added to {submission['course_code']} on Swift."))

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
-- references: external standards, articles, reports, or supporting documents
-- laboratory: lab manuals, experiment sheets, apparatus guides, reports, experimental data, or practical work
-- other: content that does not fit the categories above

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

    data = classify_with_provider(prompt)

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
-- references
-- laboratory
-- other

Use visible document content, not only the filename. Confidence must be an
integer from 0 to 100. Evidence must be a short visible phrase supporting the
category. If the page is unreadable, choose other with confidence below 50.

Material title, only for context:
{material.get("title", "")}

Respond only as JSON with keys: category, confidence, evidence."""

    data = classify_with_provider(prompt, image_bytes=image_bytes)

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


def generate_study_check_questions(
    source_text: str,
    question_type: str,
    num_questions: int,
    course_code: str,
    material_title: str,
    focus: str,
) -> tuple[list, str]:
    """Generate a small source-grounded study check with a named provider."""
    if question_type not in {"mcq", "german"}:
        raise HTTPException(
            status_code=422,
            detail="question_type must be mcq or german.",
        )

    if question_type == "mcq":
        format_instructions = """
Return this JSON shape:
{
  "questions": [
    {
      "question": "Question text",
      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "correct_answer": "A",
      "explanation": "A concise explanation supported by the source"
    }
  ]
}
Each question must have exactly four options and exactly one correct answer.
"""
    else:
        format_instructions = """
Return this JSON shape:
{
  "questions": [
    {
      "question": "A statement with exactly one _____ blank",
      "correct_answer": "answer",
      "acceptable_answers": ["answer"],
      "hint": "A short hint",
      "explanation": "A concise explanation supported by the source"
    }
  ]
}
Each question must have one specific answer found in the source.
"""

    focus_instruction = (
        f"Prioritise the student's requested focus: {focus}."
        if focus
        else "Cover the most useful concepts in the supplied extract."
    )
    prompt = f"""Create exactly {num_questions} university-level study-check questions for {course_code}.

Material: {material_title}
{focus_instruction}

Grounding rules:
- Use ONLY the supplied material extract.
- Do not invent facts or rely on outside knowledge.
- Do not ask about authors, publishers, page numbers, or document metadata.
- Test understanding, application, definitions, formulas, or calculations where supported.
- If the requested focus is not supported by the extract, return {{"questions": []}}.
- Return JSON only.

{format_instructions}

Material extract:
{source_text}
"""

    providers = (
        ("Gemini", lambda: gemini_generate_json(prompt)),
        ("Groq fallback", lambda: groq_generate(prompt, max_tokens=2200, temperature=0.2)),
    )

    for provider, generate in providers:
        try:
            data = parse_json(generate())
            questions = data.get("questions", [])
            if not isinstance(questions, list):
                continue

            valid_questions = []
            for question in questions:
                if not isinstance(question, dict):
                    continue
                if not safe_text(question.get("question")).strip():
                    continue
                if not safe_text(question.get("correct_answer")).strip():
                    continue
                if not safe_text(question.get("explanation")).strip():
                    continue
                if question_type == "mcq":
                    options = question.get("options")
                    if not isinstance(options, dict) or set(options) != {"A", "B", "C", "D"}:
                        continue
                    if question.get("correct_answer") not in options:
                        continue
                valid_questions.append(question)

            if len(valid_questions) >= num_questions:
                return valid_questions[:num_questions], provider
        except Exception:
            continue

    raise HTTPException(
        status_code=503,
        detail="Swift could not build a grounded study check right now. Please try again.",
    )


def normalise_question_text(question: dict) -> str:
    return re.sub(r"\s+", " ", safe_text(question.get("question")).lower()).strip()


def validate_material_questions(questions: list, source_text: str, question_type: str) -> tuple[list, str]:
    """Independently reject questions that cannot be supported by the source."""
    if not questions:
        return [], "Not run"
    prompt = f"""You are a strict university question-bank reviewer. Review the candidate
{question_type} questions against the supplied course-material extract. Accept a question only
when its answer is supported by the extract, it tests course content rather than document
metadata, it is unambiguous, and it is not materially duplicated.

Return JSON only: {{"accepted_indices": [0, 2]}}

Candidate questions (numbered from 0):
{json.dumps(questions, ensure_ascii=False)}

Course-material extract:
{source_text[:12000]}"""
    for provider, generate in (
        ("Gemini", lambda: gemini_generate_json(prompt, max_tokens=1200)),
        ("Groq fallback", lambda: groq_generate(prompt, max_tokens=1200, temperature=0)),
    ):
        try:
            indices = parse_json(generate()).get("accepted_indices", [])
            return ([questions[i] for i in indices if isinstance(i, int) and 0 <= i < len(questions)], provider)
        except Exception:
            continue
    return [], "Validation unavailable"


def outline_topic_names(outline: dict) -> list[str]:
    """Normalise the existing outline JSON into topic names suitable for matching."""
    topics = []
    for item in outline.get("ordered_topics") or []:
        if isinstance(item, str) and item.strip():
            topics.append(item.strip())
        elif isinstance(item, dict):
            value = item.get("topic") or item.get("title") or item.get("name")
            if value and safe_text(value).strip():
                topics.append(safe_text(value).strip())
    return topics


def map_material_chunk_to_course(
    course_code: str,
    topics: list[str],
    chunk: str,
    chunk_index: int,
) -> tuple[dict, str]:
    """Decide whether one source section belongs to the supplied course outline."""
    prompt = f"""You are mapping a textbook or study material to a university course.

Course: {course_code}
Official course topics: {json.dumps(topics, ensure_ascii=False)}

Read ONLY the source section below. Return JSON with this exact shape:
{{
  "relevant": true,
  "unit_title": "short source-grounded unit title",
  "matched_topics": ["exact topic names from the official course topics"],
  "evidence": "short phrase or concise factual description from the source section",
  "importance": 1,
  "reason": "why this section is or is not needed for this course"
}}

Rules:
- relevant is true only if this section teaches one or more official course topics.
- Do not match on a vague shared word alone.
- matched_topics must use only exact names from the official course topics list.
- importance is an integer from 1 to 5 when relevant, otherwise 0.
- Never use document metadata, author names, publishers, or page numbers as a unit.
- Return JSON only.

Source section {chunk_index}:
{chunk[:12000]}"""

    for provider, generate in (
        ("Gemini", lambda: gemini_generate_json(prompt, max_tokens=900)),
        ("Groq fallback", lambda: groq_generate(prompt, max_tokens=900, temperature=0)),
    ):
        try:
            data = parse_json(generate())
            relevant = bool(data.get("relevant"))
            matched = [
                safe_text(topic).strip()
                for topic in (data.get("matched_topics") or [])
                if safe_text(topic).strip() in topics
            ]
            if relevant and not matched:
                relevant = False
            try:
                importance = int(data.get("importance", 0))
            except (TypeError, ValueError):
                importance = 0
            return {
                "chunk_index": chunk_index,
                "unit_title": safe_text(data.get("unit_title") or f"Source section {chunk_index + 1}")[:180],
                "matched_topics": matched,
                "evidence": safe_text(data.get("evidence"))[:700],
                "reason": safe_text(data.get("reason"))[:700],
                "importance": max(1, min(5, importance)) if relevant else 0,
                "relevant": relevant,
            }, provider
        except Exception:
            continue
    raise HTTPException(status_code=503, detail="Swift could not map this source section right now. Please retry later.")


def build_coverage_plan(relevant_units: list, target_count: int) -> list:
    """Allocate a finite question target across approved, source-mapped units."""
    if not relevant_units:
        return []
    weights = [max(1, int(unit.get("importance", 1))) for unit in relevant_units]
    total_weight = sum(weights)
    quotas = [max(1, round(target_count * weight / total_weight)) for weight in weights]

    while sum(quotas) > target_count:
        index = max(range(len(quotas)), key=lambda i: (quotas[i], weights[i]))
        if quotas[index] == 1:
            break
        quotas[index] -= 1
    while sum(quotas) < target_count:
        index = max(range(len(quotas)), key=lambda i: weights[i] / quotas[i])
        quotas[index] += 1

    return [
        {
            "chunk_index": unit["chunk_index"],
            "unit_title": unit["unit_title"],
            "matched_topics": unit["matched_topics"],
            "question_quota": quota,
            "importance": unit["importance"],
        }
        for unit, quota in zip(relevant_units, quotas)
    ]


def generate_material_bank_batch(
    material: dict,
    question_type: str,
    count: int,
    existing_questions: list,
    coverage_plan: list,
) -> tuple[list, str, str]:
    """Generate one small, validated batch toward one material's 100-question bank."""
    text = get_material_text(material)
    if len(text.strip()) < 300:
        raise HTTPException(status_code=422, detail="This material does not contain enough extractable text to build a question bank.")
    chunks = [chunk for chunk in chunk_text(text, chunk_size=4200, overlap=250) if len(chunk.strip()) >= 300]
    if not chunks:
        raise HTTPException(status_code=422, detail="Swift could not split this material into usable study sections.")
    generated_by_chunk = {}
    for question in existing_questions:
        chunk_index = question.get("source_chunk_index") if isinstance(question, dict) else None
        if isinstance(chunk_index, int):
            generated_by_chunk[chunk_index] = generated_by_chunk.get(chunk_index, 0) + 1

    selected_unit = next(
        (
            unit for unit in coverage_plan
            if isinstance(unit, dict)
            and isinstance(unit.get("chunk_index"), int)
            and 0 <= unit["chunk_index"] < len(chunks)
            and generated_by_chunk.get(unit["chunk_index"], 0) < int(unit.get("question_quota", 0))
        ),
        None,
    )
    if not selected_unit:
        raise HTTPException(status_code=422, detail="The approved coverage plan is complete or unusable. Rebuild the material map before generating more questions.")
    source_chunk = chunks[selected_unit["chunk_index"]]
    remaining_for_unit = int(selected_unit.get("question_quota", 0)) - generated_by_chunk.get(selected_unit["chunk_index"], 0)
    count = min(count, remaining_for_unit)
    if count < 1:
        raise HTTPException(status_code=422, detail="The selected source unit has already met its question quota.")
    candidates, generation_provider = generate_study_check_questions(
        source_text=source_chunk,
        question_type=question_type,
        num_questions=count,
        course_code=safe_text(material.get("course_code")),
        material_title=safe_text(material.get("title")),
        focus="",
    )
    accepted, validation_provider = validate_material_questions(candidates, source_chunk, question_type)
    known = {normalise_question_text(question) for question in existing_questions}
    unique = []
    for question in accepted:
        key = normalise_question_text(question)
        if key and key not in known:
            question["material_id"] = material["id"]
            question["material_title"] = safe_text(material.get("title"))
            question["source_chunk_index"] = selected_unit["chunk_index"]
            question["source_unit_title"] = safe_text(selected_unit.get("unit_title"))
            question["source_topics"] = selected_unit.get("matched_topics") or []
            unique.append(question)
            known.add(key)
    return unique, generation_provider, validation_provider


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


class MaterialStudyCheckRequest(BaseModel):
    material_id: int
    question_type: str = "mcq"
    num_questions: int = Field(default=5, ge=3, le=5)
    focus: Optional[str] = Field(default=None, max_length=120)


class MaterialQuestionBankGenerationRequest(BaseModel):
    material_id: int
    question_type: str = "mcq"
    target_count: int = Field(default=100, ge=1, le=500)
    batch_size: int = Field(default=5, ge=3, le=5)


class CourseMaterialMapRequest(BaseModel):
    course_code: str
    material_id: int
    chunks_per_run: int = Field(default=1, ge=1, le=3)
    target_question_count: int = Field(default=100, ge=1, le=500)


class CourseMaterialMapQueueRequest(BaseModel):
    course_code: str
    max_materials: int = Field(default=1, ge=1, le=3)
    chunks_per_material: int = Field(default=1, ge=1, le=3)
    target_question_count: int = Field(default=100, ge=1, le=500)


# Mapping should start with documents that teach the course.  A database order
# is not meaningful when older imported materials have no explicit sort order,
# and can otherwise select a one-page assignment before a full textbook.
MAPPING_CATEGORY_ORDER = {
    "textbooks": 0,
    "lecture_notes": 1,
    "slides": 2,
    "laboratory": 3,
    "references": 4,
    "practice": 5,
    "past_questions": 6,
    "assignments": 7,
    "other": 8,
    "uncategorized": 9,
}

MATERIAL_PRIORITY_ORDER = {
    "high": 0,
    "medium": 1,
    "low": 2,
}


def course_mapping_queue_sort_key(material: dict) -> tuple[int, int, int, int]:
    """Put substantial teaching sources ahead of exercises and small tasks."""
    category = safe_text(material.get("category")).strip().lower()
    priority = safe_text(material.get("material_priority")).strip().lower()
    sort_order = material.get("material_sort_order")

    return (
        MAPPING_CATEGORY_ORDER.get(category, 9),
        MATERIAL_PRIORITY_ORDER.get(priority, 3),
        sort_order if isinstance(sort_order, int) else 1_000_000,
        int(material.get("id", 0)),
    )


class MaterialClassificationBatchRequest(BaseModel):
    limit: int = Field(default=3, ge=1, le=5)
    retry_failed: bool = False


class MaterialReviewRequest(BaseModel):
    category: Optional[str] = None
    material_priority: Optional[str] = None
    material_sort_order: Optional[int] = Field(default=None, ge=0, le=10000)
    priority_reason: Optional[str] = Field(default=None, max_length=500)


class MaterialSubmissionReviewRequest(BaseModel):
    action: str
    category: Optional[str] = None
    title: Optional[str] = Field(default=None, max_length=300)
    source_name: Optional[str] = Field(default=None, max_length=160)
    material_summary: Optional[str] = Field(default=None, max_length=500)
    review_note: Optional[str] = Field(default=None, max_length=500)


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


@app.post("/admin/recover-stale-material-classifications")
def recover_stale_material_classifications(
    stale_after_minutes: int = 30,
    x_admin_key: Optional[str] = Header(default=None),
):
    """Return abandoned processing records to pending work."""
    require_admin(x_admin_key)

    if not 5 <= stale_after_minutes <= 1440:
        raise HTTPException(
            status_code=422,
            detail="stale_after_minutes must be between 5 and 1440.",
        )

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=stale_after_minutes)
    result = (
        supabase.table("materials")
        .select("id, title, classified_at")
        .eq("classification_status", "processing")
        .execute()
    )

    recovered = []

    for material in result.data or []:
        started_at = material.get("classified_at")
        is_stale = not started_at

        if started_at:
            try:
                parsed_started_at = datetime.fromisoformat(
                    started_at.replace("Z", "+00:00")
                )

                if parsed_started_at.tzinfo is None:
                    parsed_started_at = parsed_started_at.replace(tzinfo=timezone.utc)

                is_stale = parsed_started_at <= cutoff
            except (TypeError, ValueError):
                is_stale = True

        if is_stale:
            supabase.table("materials").update(
                {
                    "classification_status": "pending",
                    "classification_error": "Recovered after an interrupted classification attempt.",
                    "classified_at": None,
                }
            ).eq("id", material["id"]).execute()

            recovered.append(
                {
                    "id": material["id"],
                    "title": safe_text(material.get("title")),
                }
            )

    return {
        "stale_after_minutes": stale_after_minutes,
        "recovered_count": len(recovered),
        "recovered": recovered,
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
        material_title = safe_text(material.get("title"))
        started_at = datetime.now(timezone.utc).isoformat()

        supabase.table("materials").update(
            {
                "classification_status": "processing",
                "classification_error": None,
                "classified_at": started_at,
            }
        ).eq("id", material_id).execute()

        try:
            sample = get_material_sample(material)
            text = safe_text(sample.get("text", ""))
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
                    "category_evidence": safe_text(classification["evidence"])[:500],
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
                    "category_evidence": safe_text(classification["evidence"])[:500],
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
                    "classification_error": safe_text(
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
                    "title": material_title,
                    "category": update["category"],
                    "confidence": update["category_confidence"],
                    "status": update["classification_status"],
                }
            )
        except TransientClassificationError as error:
            message = safe_text(error)[:500]

            supabase.table("materials").update(
                {
                    "classification_status": "pending",
                    "classification_error": message,
                    "classified_at": None,
                }
            ).eq("id", material_id).execute()

            processed.append(
                {
                    "id": material_id,
                    "title": material_title,
                    "status": "deferred",
                    "error": message[:180],
                }
            )
        except Exception as error:
            message = safe_text(error)[:500]

            supabase.table("materials").update(
                {
                    "classification_status": "failed",
                    "classification_error": message,
                    "classified_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", material_id).execute()

            processed.append(
                {
                    "id": material_id,
                    "title": material_title,
                    "status": "failed",
                    "error": message[:180],
                }
            )

    return {
        "requested": request.limit,
        "processed_count": len(processed),
        "processed": processed,
    }


@app.patch("/admin/materials/{material_id}/review")
def review_material(
    material_id: int,
    request: MaterialReviewRequest,
    x_admin_key: Optional[str] = Header(default=None),
):
    """Record a deliberate category and/or priority correction."""
    require_admin(x_admin_key)

    if (
        request.category is None
        and request.material_priority is None
        and request.material_sort_order is None
    ):
        raise HTTPException(
            status_code=422,
            detail="Provide a category, material_priority, or both.",
        )

    material_result = (
        supabase.table("materials")
        .select("id, title, category, material_priority, material_sort_order")
        .eq("id", material_id)
        .maybe_single()
        .execute()
    )
    material = material_result.data

    if not material:
        raise HTTPException(status_code=404, detail="Material not found.")

    update = {}
    review_reason = safe_text(request.priority_reason).strip() or None

    if request.category is not None:
        category = safe_text(request.category).strip().lower()

        if category not in MATERIAL_CATEGORIES:
            raise HTTPException(
                status_code=422,
                detail="Invalid category.",
            )

        update.update(
            {
                "category": category,
                "category_confidence": 100,
                "category_source": "manual_review",
                "classification_status": "reviewed",
                "classified_at": datetime.now(timezone.utc).isoformat(),
            }
        )

        if review_reason:
            update["category_evidence"] = review_reason

    if request.material_priority is not None:
        material_priority = safe_text(request.material_priority).strip().lower()

        if material_priority not in MATERIAL_PRIORITIES:
            raise HTTPException(
                status_code=422,
                detail="Invalid material_priority.",
            )

        update.update(
            {
                "material_priority": material_priority,
                "priority_source": "manual_review",
                "priority_reason": review_reason,
                "priority_updated_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    if request.material_sort_order is not None:
        update.update(
            {
                "material_sort_order": request.material_sort_order,
                "priority_source": "manual_review",
                "priority_updated_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    updated_result = (
        supabase.table("materials")
        .update(update)
        .eq("id", material_id)
        .execute()
    )
    updated_material = (updated_result.data or [material])[0]

    supabase.table("material_review_log").insert(
        {
            "material_id": material_id,
            "previous_category": material.get("category"),
            "new_category": updated_material.get("category"),
            "previous_priority": material.get("material_priority"),
            "new_priority": updated_material.get("material_priority"),
            "previous_sort_order": material.get("material_sort_order"),
            "new_sort_order": updated_material.get("material_sort_order"),
            "review_reason": review_reason,
        }
    ).execute()

    return {
        "id": material_id,
        "title": safe_text(updated_material.get("title")),
        "category": updated_material.get("category"),
        "material_priority": updated_material.get("material_priority"),
        "material_sort_order": updated_material.get("material_sort_order"),
        "priority_reason": updated_material.get("priority_reason"),
        "status": "reviewed",
    }


@app.get("/admin/material-submissions")
def list_material_submissions(
    status: str = "pending",
    x_admin_key: Optional[str] = Header(default=None),
):
    require_admin(x_admin_key)

    if status not in {"pending", "approved", "rejected", "duplicate"}:
        raise HTTPException(status_code=422, detail="Invalid submission status.")

    result = (
        supabase.table("material_submissions")
        .select("*")
        .eq("status", status)
        .order("created_at", desc=False)
        .execute()
    )

    return {"status": status, "submissions": result.data or []}


@app.post("/admin/material-submissions/{submission_id}/review")
def review_material_submission(
    submission_id: int,
    request: MaterialSubmissionReviewRequest,
    x_admin_key: Optional[str] = Header(default=None),
):
    """Approve, reject, or mark a student material suggestion as duplicate."""
    require_admin(x_admin_key)

    action = safe_text(request.action).strip().lower()
    if action not in {"approve", "reject", "duplicate"}:
        raise HTTPException(
            status_code=422,
            detail="Action must be approve, reject, or duplicate.",
        )

    submission_result = (
        supabase.table("material_submissions")
        .select("*")
        .eq("id", submission_id)
        .maybe_single()
        .execute()
    )
    submission = submission_result.data

    if not submission:
        raise HTTPException(status_code=404, detail="Material submission not found.")

    if submission.get("status") != "pending":
        raise HTTPException(status_code=409, detail="This submission has already been reviewed.")

    review_note = safe_text(request.review_note).strip() or None
    reviewed_at = datetime.now(timezone.utc).isoformat()

    if action != "approve":
        updated = (
            supabase.table("material_submissions")
            .update(
                {
                    "status": "rejected" if action == "reject" else "duplicate",
                    "review_note": review_note,
                    "reviewed_at": reviewed_at,
                }
            )
            .eq("id", submission_id)
            .execute()
        )
        return {"submission": (updated.data or [submission])[0], "material": None}

    url = safe_text(submission.get("url")).strip()
    parsed_url = urlparse(url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise HTTPException(status_code=422, detail="Submission must contain a valid public URL.")

    category = safe_text(request.category or submission.get("category")).strip().lower()
    if category not in MATERIAL_CATEGORIES:
        raise HTTPException(status_code=422, detail="Invalid category.")

    duplicate_result = (
        supabase.table("materials")
        .select("id, title")
        .eq("file_url", url)
        .maybe_single()
        .execute()
    )
    if duplicate_result.data:
        raise HTTPException(
            status_code=409,
            detail=f"This URL is already published as material {duplicate_result.data['id']}.",
        )

    material_title = safe_text(request.title or submission.get("title")).strip()
    source_name = safe_text(request.source_name).strip() or parsed_url.netloc
    material_summary = safe_text(request.material_summary).strip() or None

    material_result = supabase.table("materials").insert(
        {
            "course_code": submission["course_code"],
            "title": material_title,
            "file_url": url,
            "category": category,
            "category_confidence": 100,
            "category_source": "manual_review",
            "category_evidence": review_note or "Approved student submission.",
            "classification_status": "reviewed",
            "classified_at": reviewed_at,
            "source_name": source_name,
            "material_summary": material_summary,
            "resource_kind": "website",
        }
    ).execute()
    material = (material_result.data or [None])[0]

    updated_submission = (
        supabase.table("material_submissions")
        .update(
            {
                "status": "approved",
                "review_note": review_note,
                "reviewed_at": reviewed_at,
            }
        )
        .eq("id", submission_id)
        .execute()
    )

    return {
        "submission": (updated_submission.data or [submission])[0],
        "material": material,
    }


@app.post("/admin/generate-bank")
def generate_question_bank(
    request: QuestionBankRequest,
    x_admin_key: Optional[str] = Header(default=None),
):
    require_admin(x_admin_key)
    # This route used to overwrite curated banks with generated output. Those
    # banks are protected now; generation happens per material instead.
    raise HTTPException(
        status_code=410,
        detail="Legacy course-bank generation is retired. Use per-material banks; curated banks are protected.",
    )

    # Historical implementation kept below temporarily; unreachable by design.
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

    # Only courses without a curated bank for this category draw from generated
    # material banks. A 50-question TCH 202 quiz can therefore sample from all
    # approved questions across its seven materials without touching an
    # existing bank.
    generated_result = (
        supabase.table("material_question_banks")
        .select("material_id, questions")
        .eq("course_code", request.course_code)
        .eq("question_type", request.question_type)
        .eq("status", "approved")
        .execute()
    )
    generated_questions = []
    for bank in generated_result.data or []:
        generated_questions.extend(bank.get("questions") or [])
    if generated_questions:
        return {
            "course_code": request.course_code,
            "question_type": request.question_type,
            "questions": random.sample(generated_questions, min(request.num_questions, len(generated_questions))),
            "from_bank": True,
            "bank_kind": "generated_material_pool",
            "bank_size": len(generated_questions),
            "materials_in_pool": len(generated_result.data or []),
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


@app.post("/admin/course-material-maps/build")
def build_course_material_map(
    request: CourseMaterialMapRequest,
    x_admin_key: Optional[str] = Header(default=None),
):
    """Map a few source sections to one course before any bank can be generated."""
    require_admin(x_admin_key)
    course_code = safe_text(request.course_code).strip().upper()
    outline_result = (
        supabase.table("course_outlines").select("course_code, ordered_topics")
        .eq("course_code", course_code).maybe_single().execute()
    )
    outline = outline_result.data
    if not outline:
        raise HTTPException(status_code=422, detail=f"{course_code} needs a verified course outline before Swift can map textbook units.")
    topics = outline_topic_names(outline)
    if not topics:
        raise HTTPException(status_code=422, detail=f"{course_code} has no usable ordered topics yet.")

    material_result = (
        supabase.table("materials")
        .select("id, title, course_code, file_url, extracted_text")
        .eq("id", request.material_id).maybe_single().execute()
    )
    material = material_result.data
    if not material:
        raise HTTPException(status_code=404, detail="Material not found.")
    if safe_text(material.get("course_code")).strip().upper() != course_code:
        raise HTTPException(status_code=422, detail="This material is not assigned to the requested course.")

    text = get_material_text(material)
    if len(text.strip()) < 300:
        raise HTTPException(status_code=422, detail="This material needs readable extracted text before Swift can map it to the course.")
    chunks = [chunk for chunk in chunk_text(text, chunk_size=4200, overlap=250) if len(chunk.strip()) >= 300]
    if not chunks:
        raise HTTPException(status_code=422, detail="Swift could not split this material into usable source sections.")

    existing_result = (
        supabase.table("course_material_maps").select("*")
        .eq("course_code", course_code).eq("material_id", material["id"])
        .maybe_single().execute()
    )
    current = existing_result.data or {}
    relevant_units = current.get("relevant_units") or []
    ignored_units = current.get("ignored_units") or []
    processed = {
        unit.get("chunk_index") for unit in (relevant_units + ignored_units)
        if isinstance(unit, dict) and isinstance(unit.get("chunk_index"), int)
    }
    pending_indices = [index for index in range(len(chunks)) if index not in processed]
    providers = []

    for index in pending_indices[:request.chunks_per_run]:
        unit, provider = map_material_chunk_to_course(course_code, topics, chunks[index], index)
        providers.append(provider)
        if unit["relevant"]:
            relevant_units.append(unit)
        else:
            ignored_units.append(unit)

    processed_count = len(relevant_units) + len(ignored_units)
    complete = processed_count >= len(chunks)
    coverage_plan = build_coverage_plan(relevant_units, request.target_question_count) if complete else []
    status = "approved" if complete and coverage_plan else ("review" if complete else "mapping")
    payload = {
        "course_code": course_code,
        "material_id": material["id"],
        "status": status,
        "source_text_length": len(text),
        "total_chunks": len(chunks),
        "processed_chunks": processed_count,
        "relevant_units": relevant_units,
        "ignored_units": ignored_units,
        "coverage_plan": coverage_plan,
        "target_question_count": request.target_question_count,
        "mapping_provider": providers[-1] if providers else current.get("mapping_provider"),
        "last_error": None,
        "mapped_at": datetime.now(timezone.utc).isoformat() if complete else None,
        "approved_at": datetime.now(timezone.utc).isoformat() if status == "approved" else None,
    }
    if current:
        supabase.table("course_material_maps").update(payload).eq("id", current["id"]).execute()
    else:
        supabase.table("course_material_maps").insert(payload).execute()

    return {
        "course_code": course_code,
        "material_id": material["id"],
        "material_title": material["title"],
        "status": status,
        "processed_chunks": processed_count,
        "total_chunks": len(chunks),
        "relevant_units": len(relevant_units),
        "remaining_chunks": max(len(chunks) - processed_count, 0),
        "coverage_plan": coverage_plan if complete else [],
        "complete": complete,
    }


@app.post("/admin/course-material-maps/run-queue")
def run_course_material_map_queue(
    request: CourseMaterialMapQueueRequest,
    x_admin_key: Optional[str] = Header(default=None),
):
    """Advance the next incomplete materials in a course without hand-picking files."""
    require_admin(x_admin_key)
    course_code = safe_text(request.course_code).strip().upper()
    materials_result = (
        supabase.table("materials")
        .select("id, title, category, material_priority, material_sort_order")
        .eq("course_code", course_code)
        .execute()
    )
    materials = sorted(
        materials_result.data or [],
        key=course_mapping_queue_sort_key,
    )
    if not materials:
        raise HTTPException(status_code=404, detail=f"No materials were found for {course_code}.")
    material_ids = [material["id"] for material in materials]
    maps_result = (
        supabase.table("course_material_maps").select("material_id, status")
        .eq("course_code", course_code).in_("material_id", material_ids).execute()
    )
    status_by_material = {
        row["material_id"]: row.get("status") for row in (maps_result.data or [])
    }
    pending = [
        material for material in materials
        if status_by_material.get(material["id"]) not in {"approved", "review"}
    ]
    if not pending:
        return {
            "course_code": course_code,
            "message": "Every material is already mapped or flagged for review.",
            "processed": [],
            "complete": True,
        }

    processed = []
    for material in pending[:request.max_materials]:
        result = build_course_material_map(
            CourseMaterialMapRequest(
                course_code=course_code,
                material_id=material["id"],
                chunks_per_run=request.chunks_per_material,
                target_question_count=request.target_question_count,
            ),
            x_admin_key=x_admin_key,
        )
        processed.append(result)
    return {
        "course_code": course_code,
        "processed": processed,
        "remaining_materials": max(len(pending) - len(processed), 0),
        "complete": len(pending) <= len(processed) and all(item["complete"] for item in processed),
    }


@app.post("/admin/material-question-banks/generate")
def generate_material_question_bank(
    request: MaterialQuestionBankGenerationRequest,
    x_admin_key: Optional[str] = Header(default=None),
):
    """Generate and validate one small batch toward a material's permanent bank."""
    require_admin(x_admin_key)
    if request.question_type not in {"mcq", "german"}:
        raise HTTPException(status_code=422, detail="Question banks currently support mcq or german.")

    material_result = (
        supabase.table("materials")
        .select("id, title, course_code, file_url, extracted_text")
        .eq("id", request.material_id)
        .maybe_single()
        .execute()
    )
    material = material_result.data
    if not material:
        raise HTTPException(status_code=404, detail="Material not found.")

    curated_result = (
        supabase.table("question_banks").select("id")
        .eq("course_code", material["course_code"])
        .eq("question_type", request.question_type)
        .limit(1).execute()
    )
    if curated_result.data:
        raise HTTPException(
            status_code=409,
            detail=f"{material['course_code']} already has a curated {request.question_type} bank. Swift will not add generated questions to that category.",
        )

    course_map_result = (
        supabase.table("course_material_maps").select("status, coverage_plan")
        .eq("course_code", material["course_code"])
        .eq("material_id", material["id"])
        .maybe_single().execute()
    )
    course_map = course_map_result.data
    if not course_map or course_map.get("status") != "approved" or not course_map.get("coverage_plan"):
        raise HTTPException(
            status_code=422,
            detail="Swift must finish the course-to-material map and coverage plan before it can generate this permanent question bank.",
        )

    existing_result = (
        supabase.table("material_question_banks").select("*")
        .eq("material_id", request.material_id)
        .eq("question_type", request.question_type)
        .maybe_single()
        .execute()
    )
    bank = existing_result.data
    existing_questions = (bank or {}).get("questions") or []
    target_count = (bank or {}).get("target_count", request.target_count)
    if len(existing_questions) >= target_count:
        return {"material_id": material["id"], "question_count": len(existing_questions), "target_count": target_count, "status": bank.get("status"), "complete": True}

    generated, generation_provider, validation_provider = generate_material_bank_batch(
        material,
        request.question_type,
        min(request.batch_size, target_count - len(existing_questions)),
        existing_questions,
        course_map["coverage_plan"],
    )
    combined = existing_questions + generated
    complete = len(combined) >= target_count
    payload = {
        "material_id": material["id"],
        "course_code": material["course_code"],
        "question_type": request.question_type,
        "questions": combined,
        "target_count": target_count,
        "status": "approved" if complete else "generating",
        "generation_provider": generation_provider,
        "validation_provider": validation_provider,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "last_error": None,
    }
    if bank:
        supabase.table("material_question_banks").update(payload).eq("id", bank["id"]).execute()
    else:
        supabase.table("material_question_banks").insert(payload).execute()

    return {
        "material_id": material["id"], "material_title": material["title"],
        "course_code": material["course_code"], "question_type": request.question_type,
        "generated_this_batch": len(generated), "question_count": len(combined),
        "target_count": target_count, "remaining": max(target_count - len(combined), 0),
        "status": "approved" if complete else "generating", "complete": complete,
    }


@app.post("/ai/material-study-check")
def create_material_study_check(
    request: MaterialStudyCheckRequest,
    authorization: Optional[str] = Header(default=None),
):
    require_user(authorization)
    material_result = (
        supabase.table("materials")
        .select("id, title, course_code, file_url, extracted_text")
        .eq("id", request.material_id)
        .maybe_single()
        .execute()
    )
    material = material_result.data
    if not material:
        raise HTTPException(status_code=404, detail="Material not found.")

    # A complete material bank serves five freshly shuffled, previously
    # validated questions. Focused checks still use the live material reader.
    permanent_bank = (
        supabase.table("material_question_banks").select("questions")
        .eq("material_id", request.material_id)
        .eq("question_type", request.question_type)
        .eq("status", "approved")
        .maybe_single()
        .execute()
    )
    permanent_questions = (permanent_bank.data or {}).get("questions") or []
    if permanent_questions and not safe_text(request.focus).strip():
        return {
            "material": {
                "id": material["id"],
                "title": safe_text(material.get("title")),
                "course_code": safe_text(material.get("course_code")),
            },
            "question_type": request.question_type,
            "focus": None,
            "questions": random.sample(permanent_questions, min(request.num_questions, len(permanent_questions))),
            "provider": "Swift vetted material bank",
            "grounding": "Shuffled from the approved question bank for this selected material.",
        }

    text = get_material_text(material)
    if len(text.strip()) < 300:
        raise HTTPException(
            status_code=422,
            detail="This material does not contain enough extractable text for an AI study check.",
        )

    chunks = [
        chunk for chunk in chunk_text(text, chunk_size=4200, overlap=250)
        if len(chunk.strip()) >= 300
    ]
    focus = safe_text(request.focus).strip()
    if focus:
        focus_terms = {
            term.lower() for term in re.findall(r"[A-Za-z0-9]+", focus)
            if len(term) > 2
        }
        ranked = sorted(
            chunks,
            key=lambda chunk: sum(
                chunk.lower().count(term) for term in focus_terms
            ),
            reverse=True,
        )
        if not ranked or not any(term in ranked[0].lower() for term in focus_terms):
            raise HTTPException(
                status_code=422,
                detail="That focus was not found in this material. Try a term used in the document.",
            )
        selected_chunks = ranked[:2]
    else:
        selected_chunks = chunks[:2]

    questions, provider = generate_study_check_questions(
        source_text="\n\n".join(selected_chunks)[:8000],
        question_type=request.question_type,
        num_questions=request.num_questions,
        course_code=safe_text(material.get("course_code")),
        material_title=safe_text(material.get("title")),
        focus=focus,
    )

    return {
        "material": {
            "id": material["id"],
            "title": safe_text(material.get("title")),
            "course_code": safe_text(material.get("course_code")),
        },
        "question_type": request.question_type,
        "focus": focus or None,
        "questions": questions,
        "provider": provider,
        "grounding": "Generated only from the selected Swift material.",
    }


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
