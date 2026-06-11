import hashlib
import json
import os
import re
from pathlib import Path

from django.conf import settings
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.db.models import Q
from langchain_community.vectorstores import PGVector
from langchain_cohere import CohereEmbeddings
from langchain.tools import Tool
from langchain_core.documents import Document

from accounts.api.chat.documents import CONNECTION_STRING, collection_exists
from accounts.models import ComsatsTeacher


TEACHER_COLLECTION_NAME = "comsats_teacher_embeddings"
TEACHER_SOURCE_TYPE = "comsats_teacher"
TEACHER_COLLECTION_SCOPE = "global_comsats_teacher"
MAX_TEACHER_RESULTS = 10

EMAIL_PATTERN = re.compile(r"[\w.\-+%]+@[\w.\-]+\.[A-Za-z]{2,}")
TEACHER_QUERY_PATTERN = re.compile(
    r"\b("
    r"teacher|teachers|faculty|professor|sir|madam|ma'?am|email|contact|course|courses|"
    r"department|qualification|interest|interests|office|hours|spring 2026|teaching|"
    r"recorded|lecture|lectures|resource|resources|assignment|late submission|"
    r"quiz|quizzes|make-?up|fyp|supervise|supervisor|industry sponsored|"
    r"project title|projects"
    r")\b",
    re.IGNORECASE,
)

CSV_HEADER_MAP = {
    "Timestamp": None,
    "Full Name": "full_name",
    "Contact Email": "email",
    "Department (Kindly select under the CS umbrella like If SE courses are being taught , kindly select SE , as our broader department is CS)": "department",
    "Course(s) Currently Teaching  (Eg. CSE 482-Automated Software Testing - FA22-BSE-(A,B))": "current_courses",
    "Highest Qualification": "highest_qualification",
    "Field of Qualification (Like MS in CS / MS in SE etc)": "field_of_qualification",
    "Areas of Interest": "areas_of_interest",
    'Office Location (Block & Number - Like :  "H - 25")': "office_location",
    "Office Hours for Spring 2026 (Day , Hours Like (Tuesday - 2-3 PM))": "office_hours_spring_2026",
    "Preferred Contact Method": "preferred_contact_method",
    "Expected Response Time to Student Queries (outside class like via email)": "expected_response_time",
    "Teaching Method": "teaching_method",
    "Are Recorded Lectures available?": "recorded_lectures_available",
    "Recommended Resources (like do you suggest books/papers/youtube links/LLMs). You are kindly requested to please mention.": "recommended_resources",
    "Assignment Submission Platform": "assignment_submission_platform",
    "Are Late Submissions Allowed?": "late_submissions_allowed",
    "If Late Submissions Are Allowed, Specify the Penalty (like how many marks deduction/ or if some other kindly mention)": "late_submission_penalty",
    "Typical Quiz Format": "typical_quiz_format",
    "Are Make-up Quiz Allowed?": "makeup_quizzes_allowed",
    "FYP Domains You Supervise  ": "fyp_domains_supervised",
    "Current/Some Past FYP Projects Titles (It would be kind to provide 1,2 or more titles, if not available then please provide rough estimate of the title or keywords of the project or a little description )": "past_fyp_project_titles",
    "Do you Supervise Industry Sponsored projects?  ": "supervises_industry_projects",
    "Preferred Type of FYP Work  ": "preferred_fyp_work_type",
}

TEACHER_MODEL_FIELDS = [
    "full_name",
    "email",
    "department",
    "current_courses",
    "highest_qualification",
    "field_of_qualification",
    "areas_of_interest",
    "office_location",
    "office_hours_spring_2026",
    "preferred_contact_method",
    "expected_response_time",
    "teaching_method",
    "recorded_lectures_available",
    "recommended_resources",
    "assignment_submission_platform",
    "late_submissions_allowed",
    "late_submission_penalty",
    "typical_quiz_format",
    "makeup_quizzes_allowed",
    "fyp_domains_supervised",
    "past_fyp_project_titles",
    "supervises_industry_projects",
    "preferred_fyp_work_type",
]

SEARCH_FIELDS = [
    "full_name",
    "email",
    "department",
    "current_courses",
    "highest_qualification",
    "field_of_qualification",
    "areas_of_interest",
    "office_location",
    "office_hours_spring_2026",
    "preferred_contact_method",
    "expected_response_time",
    "teaching_method",
    "recorded_lectures_available",
    "recommended_resources",
    "assignment_submission_platform",
    "late_submissions_allowed",
    "late_submission_penalty",
    "typical_quiz_format",
    "makeup_quizzes_allowed",
    "fyp_domains_supervised",
    "past_fyp_project_titles",
    "supervises_industry_projects",
    "preferred_fyp_work_type",
]


def normalize_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_csv_header(value):
    return normalize_text(value)


def normalize_name(value):
    cleaned = re.sub(r"[^a-z0-9]+", " ", normalize_text(value).lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def validate_teacher_email(value):
    email = normalize_text(value).lower()
    if not email:
        return ""
    try:
        validate_email(email)
    except ValidationError:
        return ""
    return email


def default_teacher_csv_path():
    return Path(settings.BASE_DIR) / "Teacher Information.csv"


def resolve_teacher_csv_path(csv_path=None):
    if not csv_path:
        return default_teacher_csv_path()

    path = Path(csv_path)
    if path.is_absolute():
        return path

    cwd_path = Path.cwd() / path
    if cwd_path.exists():
        return cwd_path

    return Path(settings.BASE_DIR) / path


def map_teacher_csv_row(row):
    normalized_row = {
        normalize_csv_header(header): value
        for header, value in row.items()
    }
    mapped = {}
    for csv_header, field_name in CSV_HEADER_MAP.items():
        if not field_name:
            continue
        mapped[field_name] = normalize_text(normalized_row.get(normalize_csv_header(csv_header), ""))

    mapped["email"] = validate_teacher_email(mapped.get("email", ""))
    mapped["normalized_name"] = normalize_name(mapped.get("full_name", ""))
    return mapped


def build_teacher_row_hash(mapped):
    payload = {field: mapped.get(field, "") for field in TEACHER_MODEL_FIELDS}
    encoded = json.dumps(payload, sort_keys=True, ensure_ascii=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def import_teachers_from_csv(csv_path=None, batch="FA25SE56"):
    import csv

    path = resolve_teacher_csv_path(csv_path)
    stats = {
        "path": str(path),
        "rows_read": 0,
        "created": 0,
        "updated": 0,
        "unchanged": 0,
        "skipped": 0,
        "errors": [],
    }

    if not path.exists():
        raise FileNotFoundError(f"Teacher CSV not found: {path}")

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row_number, row in enumerate(reader, start=2):
            stats["rows_read"] += 1
            mapped = map_teacher_csv_row(row)
            if not mapped["full_name"] or not mapped["normalized_name"]:
                stats["skipped"] += 1
                stats["errors"].append(f"Row {row_number}: missing Full Name")
                continue

            row_hash = build_teacher_row_hash(mapped)
            lookup = {"normalized_name": mapped["normalized_name"]}
            if mapped["email"]:
                lookup["email"] = mapped["email"]

            teacher = ComsatsTeacher.objects.filter(**lookup).first()
            if not teacher:
                teacher = ComsatsTeacher(**lookup)
                created = True
            else:
                created = False
            old_row_hash = teacher.source_row_hash
            old_source_batch = teacher.source_batch
            old_is_active = teacher.is_active

            for field in TEACHER_MODEL_FIELDS:
                setattr(teacher, field, mapped.get(field, ""))
            teacher.normalized_name = mapped["normalized_name"]
            teacher.source_batch = batch
            teacher.source_row_hash = row_hash
            teacher.is_active = True

            if not created and old_row_hash == row_hash and old_source_batch == batch and old_is_active:
                stats["unchanged"] += 1
                continue

            teacher.save()
            stats["created" if created else "updated"] += 1

    return stats


def get_embedding_client():
    return CohereEmbeddings(
        model="embed-english-v3.0",
        cohere_api_key=os.getenv("COHERE_API_KEY"),
    )


def build_teacher_profile_text(teacher):
    parts = [
        ("Name", teacher.full_name),
        ("Email", teacher.email),
        ("Department", teacher.department),
        ("Courses", teacher.current_courses),
        ("Highest Qualification", teacher.highest_qualification),
        ("Field of Qualification", teacher.field_of_qualification),
        ("Areas of Interest", teacher.areas_of_interest),
        ("Office", teacher.office_location),
        ("Office Hours for Spring 2026", teacher.office_hours_spring_2026),
        ("Preferred Contact Method", teacher.preferred_contact_method),
        ("Expected Response Time", teacher.expected_response_time),
        ("Teaching Method", teacher.teaching_method),
        ("Recorded Lectures Available", teacher.recorded_lectures_available),
        ("Recommended Resources", teacher.recommended_resources),
        ("Assignment Submission Platform", teacher.assignment_submission_platform),
        ("Late Submissions Allowed", teacher.late_submissions_allowed),
        ("Late Submission Penalty", teacher.late_submission_penalty),
        ("Typical Quiz Format", teacher.typical_quiz_format),
        ("Make-up Quizzes Allowed", teacher.makeup_quizzes_allowed),
        ("FYP Domains", teacher.fyp_domains_supervised),
        ("Past FYP Project Titles", teacher.past_fyp_project_titles),
        ("Industry-Sponsored Projects", teacher.supervises_industry_projects),
        ("Preferred FYP Work", teacher.preferred_fyp_work_type),
    ]
    return "\n".join(f"{label}: {value}" for label, value in parts if value)


def rebuild_teacher_embeddings():
    teachers = list(ComsatsTeacher.objects.filter(is_active=True).order_by("full_name"))
    documents = []
    for teacher in teachers:
        documents.append(
            Document(
                page_content=build_teacher_profile_text(teacher),
                metadata={
                    "source_type": TEACHER_SOURCE_TYPE,
                    "collection_scope": TEACHER_COLLECTION_SCOPE,
                    "teacher_id": str(teacher.id),
                    "department": teacher.department,
                    "full_name": teacher.full_name,
                    "email": teacher.email,
                    "source_batch": teacher.source_batch,
                },
            )
        )

    if not documents:
        return {"embedded": 0, "collection": TEACHER_COLLECTION_NAME}

    PGVector.from_documents(
        documents=documents,
        embedding=get_embedding_client(),
        connection_string=CONNECTION_STRING,
        collection_name=TEACHER_COLLECTION_NAME,
        pre_delete_collection=True,
    )
    return {"embedded": len(documents), "collection": TEACHER_COLLECTION_NAME}


def load_teacher_vectorstore():
    if not collection_exists(CONNECTION_STRING, TEACHER_COLLECTION_NAME):
        return None
    return PGVector.from_existing_index(
        embedding=get_embedding_client(),
        connection_string=CONNECTION_STRING,
        collection_name=TEACHER_COLLECTION_NAME,
    )


def query_mentions_teacher_info(query):
    return bool(TEACHER_QUERY_PATTERN.search(query or ""))


def extract_query_terms(query):
    normalized = normalize_name(query)
    stopwords = {
        "what", "who", "which", "where", "when", "does", "do", "is", "are", "the",
        "a", "an", "of", "for", "to", "in", "from", "about", "tell", "me", "give",
        "teacher", "teachers", "faculty", "sir", "madam", "ma", "am", "email",
        "contact", "course", "courses", "office", "hours", "fyp",
    }
    return [term for term in normalized.split() if len(term) >= 3 and term not in stopwords]


def structured_teacher_queryset(query):
    query_text = normalize_text(query)
    normalized_query = normalize_name(query_text)
    qs = ComsatsTeacher.objects.filter(is_active=True)

    email_match = EMAIL_PATTERN.search(query_text)
    if email_match:
        email = email_match.group(0).lower()
        email_qs = qs.filter(email__iexact=email)
        if email_qs.exists():
            return email_qs

    exact_name_qs = qs.filter(normalized_name=normalized_query)
    if exact_name_qs.exists():
        return exact_name_qs

    name_q = Q()
    for term in extract_query_terms(query_text):
        name_q |= Q(normalized_name__icontains=term)
    if name_q:
        name_qs = qs.filter(name_q)
        if name_qs.exists():
            return name_qs

    content_q = Q()
    for term in extract_query_terms(query_text):
        for field in SEARCH_FIELDS:
            content_q |= Q(**{f"{field}__icontains": term})

    if content_q:
        return qs.filter(content_q).distinct()

    return qs.none()


def semantic_teacher_ids(query):
    vectorstore = load_teacher_vectorstore()
    if not vectorstore:
        return []

    results = vectorstore.similarity_search_with_score(
        query,
        k=MAX_TEACHER_RESULTS,
        filter={
            "source_type": TEACHER_SOURCE_TYPE,
            "collection_scope": TEACHER_COLLECTION_SCOPE,
        },
    )
    teacher_ids = []
    for doc, _score in results:
        teacher_id = (doc.metadata or {}).get("teacher_id")
        if teacher_id and teacher_id not in teacher_ids:
            teacher_ids.append(teacher_id)
    return teacher_ids


def format_teacher_record(teacher, index):
    fields = [
        ("Name", teacher.full_name),
        ("Email", teacher.email),
        ("Department", teacher.department),
        ("Courses", teacher.current_courses),
        ("Highest Qualification", teacher.highest_qualification),
        ("Field of Qualification", teacher.field_of_qualification),
        ("Areas of Interest", teacher.areas_of_interest),
        ("Office", teacher.office_location),
        ("Office Hours Spring 2026", teacher.office_hours_spring_2026),
        ("Preferred Contact Method", teacher.preferred_contact_method),
        ("Expected Response Time", teacher.expected_response_time),
        ("Teaching Method", teacher.teaching_method),
        ("Recorded Lectures Available", teacher.recorded_lectures_available),
        ("Recommended Resources", teacher.recommended_resources),
        ("Assignment Submission Platform", teacher.assignment_submission_platform),
        ("Late Submissions Allowed", teacher.late_submissions_allowed),
        ("Late Submission Penalty", teacher.late_submission_penalty),
        ("Typical Quiz Format", teacher.typical_quiz_format),
        ("Make-up Quizzes Allowed", teacher.makeup_quizzes_allowed),
        ("FYP Domains", teacher.fyp_domains_supervised),
        ("Past FYP Project Titles", teacher.past_fyp_project_titles),
        ("Industry-Sponsored Projects", teacher.supervises_industry_projects),
        ("Preferred FYP Work", teacher.preferred_fyp_work_type),
    ]
    lines = [f"{index}. " + f"Name: {teacher.full_name}"]
    for label, value in fields[1:]:
        if value:
            lines.append(f"   {label}: {value}")
    return "\n".join(lines)


def search_teacher_info(query):
    queryset = structured_teacher_queryset(query)
    teachers = list(queryset[:MAX_TEACHER_RESULTS])

    if not teachers:
        teacher_ids = semantic_teacher_ids(query)
        if teacher_ids:
            teacher_map = {
                str(teacher.id): teacher
                for teacher in ComsatsTeacher.objects.filter(id__in=teacher_ids, is_active=True)
            }
            teachers = [teacher_map[teacher_id] for teacher_id in teacher_ids if teacher_id in teacher_map]

    if not teachers:
        return "No verified teacher information was found for this query."

    formatted = [format_teacher_record(teacher, index) for index, teacher in enumerate(teachers, start=1)]
    return "Verified teacher records:\n" + "\n\n".join(formatted)


def is_verified_teacher_email(email):
    normalized_email = normalize_text(email).lower()
    if not normalized_email:
        return False
    return ComsatsTeacher.objects.filter(
        email__iexact=normalized_email,
        is_active=True,
    ).exists()


def build_teacher_augmented_input(query, search_query=None):
    lookup_query = search_query or query
    if not query_mentions_teacher_info(lookup_query):
        return query

    teacher_result = search_teacher_info(lookup_query)
    return (
        "Teacher information search was already performed before answering.\n"
        f"{teacher_result}\n\n"
        f"User question: {query}\n\n"
        "Use the verified teacher records above when they contain relevant information. "
        "For course, department, interest, and FYP questions, include all relevant returned records, not only the first one. "
        "Do not invent teacher emails or contact details. If no verified record was found, say so clearly."
    )


def build_teacher_info_tool():
    return Tool.from_function(
        func=search_teacher_info,
        name="teacher_info_search",
        description=(
            "Search verified COMSATS teacher records for names, emails, courses, office hours, "
            "teaching policies, resources, quizzes, assignments, interests, and FYP supervision."
        ),
    )
