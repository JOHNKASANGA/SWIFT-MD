import random

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