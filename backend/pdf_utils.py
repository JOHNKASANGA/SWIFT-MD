import io
import re
from typing import Optional

import httpx
from pypdf import PdfReader

try:
    from docx import Document as DocxDocument

    DOCX_SUPPORTED = True
except ImportError:
    DOCX_SUPPORTED = False


SUPPORTED_EXTENSIONS = [".pdf", ".docx"]

SKIP_EXTENSIONS = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".webp",
    ".mp4",
    ".mp3",
    ".wav",
    ".avi",
    ".mov",
    ".ppt",
    ".pptx",
    ".xlsx",
    ".xls",
    ".doc",
    ".zip",
    ".rar",
]


def is_skippable(url: str) -> bool:
    url_lower = url.lower().split("?")[0]
    return any(url_lower.endswith(extension) for extension in SKIP_EXTENSIONS)


def is_docx(url: str) -> bool:
    url_lower = url.lower().split("?")[0]
    return url_lower.endswith(".docx")


def get_direct_url(file_url: str) -> str:
    """Resolve MediaFire or other indirect URLs to a direct download URL."""
    if "mediafire.com" in file_url:
        response = httpx.get(file_url, timeout=30.0, follow_redirects=True)
        response.raise_for_status()

        match = re.search(
            r'href="(https://download\d+\.mediafire\.com/[^"]+)"',
            response.text,
        )

        if not match:
            raise ValueError(
                f"Could not find direct download link on MediaFire page: {file_url}"
            )

        return match.group(1)

    return file_url


def extract_text_from_url(
    file_url: str,
    max_pages: Optional[int] = None,
    max_chars: Optional[int] = None,
) -> str:
    """Download a supported document and extract text from it."""

    if is_skippable(file_url):
        return ""

    try:
        direct_url = get_direct_url(file_url)
    except Exception:
        return ""

    try:
        if (
            "drive.usercontent.google.com" in direct_url
            or "drive.google.com" in direct_url
        ):
            response = httpx.get(
                direct_url,
                timeout=60.0,
                follow_redirects=True,
            )
            response.raise_for_status()

            if (
                b"Google Drive - Virus scan warning" in response.content
                or b"confirm=" in str(response.url)
            ):
                confirm_match = re.search(r'confirm=([^&"]+)', str(response.url))
                file_id_match = re.search(r"id=([^&]+)", direct_url)

                if confirm_match and file_id_match:
                    confirm_token = confirm_match.group(1)
                    file_id = file_id_match.group(1)
                    direct_url = (
                        "https://drive.usercontent.google.com/download"
                        f"?id={file_id}&export=download"
                        f"&confirm={confirm_token}&authuser=0"
                    )
                    response = httpx.get(
                        direct_url,
                        timeout=60.0,
                        follow_redirects=True,
                    )
                    response.raise_for_status()

            file_bytes = response.content
        else:
            response = httpx.get(
                direct_url,
                timeout=30.0,
                follow_redirects=True,
            )
            response.raise_for_status()
            file_bytes = response.content
    except Exception:
        return ""

    try:
        if is_docx(file_url) or is_docx(direct_url):
            return extract_text_from_docx(file_bytes, max_chars=max_chars)

        return extract_text_from_pdf(
            file_bytes,
            max_pages=max_pages,
            max_chars=max_chars,
        )
    except Exception:
        return ""


def extract_text_from_pdf(
    file_bytes: bytes,
    max_pages: Optional[int] = None,
    max_chars: Optional[int] = None,
) -> str:
    """Extract text from PDF bytes, optionally limiting pages and characters."""
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        text_parts = []
        pages = reader.pages[:max_pages] if max_pages else reader.pages

        for page in pages:
            page_text = page.extract_text()

            if page_text and page_text.strip():
                text_parts.append(page_text.strip())

            combined = "\n\n".join(text_parts)

            if max_chars and len(combined) >= max_chars:
                return combined[:max_chars]

        return "\n\n".join(text_parts)[:max_chars] if max_chars else "\n\n".join(text_parts)
    except Exception:
        return ""


def extract_text_from_docx(
    file_bytes: bytes,
    max_chars: Optional[int] = None,
) -> str:
    """Extract text from DOCX bytes."""
    if not DOCX_SUPPORTED:
        return ""

    try:
        document = DocxDocument(io.BytesIO(file_bytes))
        paragraphs = [
            paragraph.text.strip()
            for paragraph in document.paragraphs
            if paragraph.text.strip()
        ]
        text = "\n\n".join(paragraphs)
        return text[:max_chars] if max_chars else text
    except Exception:
        return ""


def chunk_text(
    text: str,
    chunk_size: int = 4000,
    overlap: int = 200,
) -> list[str]:
    """Split text into overlapping chunks for better question coverage."""
    if not text or len(text) <= chunk_size:
        return [text] if text else []

    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size

        if end < len(text):
            boundary = text.rfind(".", start + chunk_size - 500, end)

            if boundary > start:
                end = boundary + 1

        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        start = end - overlap

        if start >= len(text):
            break

    return chunks
