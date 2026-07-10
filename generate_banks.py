import httpx
import time

BACKEND_URL = "https://swift-md-backend.onrender.com"

COURSES = [
    # 100 Level
    "GST 111", "GST 112", "GET 101", "GET 102", "GET 103",
    "CHM 101", "CHM 102", "MTH 101", "MTH 102", "MTH 103",
    "PHY 101", "PHY 102", "PHY 103", "PHY 104", "STA 112", "TCH 101",
    # 200 Level
    "GST 212", "ENT 211", "GET 201", "GET 202", "GET 205",
    "GET 206", "GET 208", "GET 209", "GET 210", "GET 211",
    "TCH 201", "TCH 202", "TCH 206",
]

MAX_RETRIES = 3
RETRY_DELAY = 10  # seconds between retries
PAUSE_BETWEEN_COURSES = 5  # seconds between courses to let Render breathe


def generate_bank(course_code: str, question_type: str) -> bool:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"  [{attempt}/{MAX_RETRIES}] Generating {question_type.upper()} bank for {course_code}...", end=" ", flush=True)
            response = httpx.post(
                f"{BACKEND_URL}/admin/generate-bank",
                json={
                    "course_code": course_code,
                    "question_type": question_type,
                },
                timeout=300.0  # 5 minutes per request
            )
            if response.status_code == 200:
                data = response.json()
                print(f"✓ {data['total_questions']} questions from {data['materials_processed']} materials")
                return True
            elif response.status_code == 400:
                error = response.json().get("detail", "")
                if "Processed 0 materials" in error:
                    print(f"⚠ No extractable materials (images/pptx only) — skipping")
                    return True  # not a failure, just no extractable content
                print(f"✗ Failed ({response.status_code}): {error[:100]}")
                return False
            else:
                print(f"✗ Failed ({response.status_code}) — retrying in {RETRY_DELAY}s...")
                time.sleep(RETRY_DELAY)

        except httpx.TimeoutException:
            print(f"✗ Timeout — retrying in {RETRY_DELAY}s...")
            time.sleep(RETRY_DELAY)
        except Exception as e:
            print(f"✗ Error: {str(e)[:100]} — retrying in {RETRY_DELAY}s...")
            time.sleep(RETRY_DELAY)

    print(f"  ✗ All {MAX_RETRIES} attempts failed for {course_code} {question_type.upper()}")
    return False


def main():
    print(f"Generating question banks for {len(COURSES)} courses...\n")
    print(f"Settings: {MAX_RETRIES} retries, {RETRY_DELAY}s retry delay, {PAUSE_BETWEEN_COURSES}s pause between courses\n")

    success = 0
    failed = []

    for i, course_code in enumerate(COURSES):
        print(f"[{i+1}/{len(COURSES)}] {course_code}")

        mcq_ok = generate_bank(course_code, "mcq")
        time.sleep(3)

        german_ok = generate_bank(course_code, "german")
        time.sleep(3)

        if mcq_ok and german_ok:
            success += 1
        else:
            failed.append(course_code)

        print()

        # Pause between courses to let Render recover
        if i < len(COURSES) - 1:
            time.sleep(PAUSE_BETWEEN_COURSES)

    print(f"\n{'='*50}")
    print(f"Done! {success}/{len(COURSES)} courses fully banked.")
    if failed:
        print(f"\nFailed courses: {', '.join(failed)}")
        print("Re-run the script to retry failed courses only.")
        # Write failed courses to a file for easy retry
        with open("failed_courses.txt", "w") as f:
            f.write("\n".join(failed))
        print("Failed courses saved to failed_courses.txt")


if __name__ == "__main__":
    main()