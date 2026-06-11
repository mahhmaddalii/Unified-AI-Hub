# backend/utils.py
import psycopg2
import os
import re
from langchain_community.vectorstores import PGVector
from langchain_cohere import CohereEmbeddings
from langchain.tools import Tool
from dotenv import load_dotenv

load_dotenv()

CONNECTION_STRING = os.getenv("PGVECTOR_CONN_STRING", "postgresql+psycopg2://postgres:1234@localhost:5432/postgres")
COLLECTION_NAME = "my_pdf_embeddings"
DOCUMENT_UPLOAD_UNSUPPORTED_MESSAGE = "File upload is not supported for this agent."
DOCUMENT_UPLOAD_BLOCKED_AGENT_IDS = {"builtin-cricket", "builtin-politics"}
DOCUMENT_QUERY_PATTERN = re.compile(
    r"\b(pdf|document|documents|uploaded file|uploaded files|file|files|attachment|attached|summary|summarize|summarise)\b",
    re.IGNORECASE,
)

def collection_exists(conn_str, name):
    """Check if a PGVector collection already exists."""
    with psycopg2.connect(conn_str.replace("+psycopg2", "")) as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    "SELECT 1 FROM langchain_pg_collection WHERE name=%s LIMIT 1",
                    (name,)
                )
                return cur.fetchone() is not None
            except psycopg2.errors.UndefinedTable:
                conn.rollback()
                return False

def load_vectorstore():
    """Load vectorstore if embeddings exist."""
    if not collection_exists(CONNECTION_STRING, COLLECTION_NAME):
        return None
    embeddings = CohereEmbeddings(
        model="embed-english-v3.0",
        cohere_api_key=os.getenv("COHERE_API_KEY")
    )
    return PGVector.from_existing_index(
        embedding=embeddings,
        connection_string=CONNECTION_STRING,
        collection_name=COLLECTION_NAME
    )


def get_conversation_agent_id(conversation):
    return str(getattr(conversation, "agent_id", "") or "")


def conversation_supports_document_upload(conversation):
    return get_conversation_agent_id(conversation) not in DOCUMENT_UPLOAD_BLOCKED_AGENT_IDS


def build_chunk_metadata(conversation, user, asset, existing_metadata=None):
    metadata = dict(existing_metadata or {})
    metadata.update({
        "conversation_id": str(conversation.id),
        "user_id": str(user.id),
        "asset_id": str(asset.id),
        "agent_id": get_conversation_agent_id(conversation),
        "conversation_type": conversation.conversation_type,
        "source_name": asset.original_name or os.path.basename(asset.file.name),
    })
    return metadata


def build_document_filter(conversation, user, agent_id=None, conversation_type=None):
    if not conversation or not user:
        return {
            "conversation_id": "__missing_conversation__",
            "user_id": "__missing_user__",
        }

    metadata_filter = {
        "conversation_id": str(conversation.id),
        "user_id": str(user.id),
        "conversation_type": conversation_type or conversation.conversation_type,
    }

    scoped_agent_id = str(agent_id) if agent_id is not None else get_conversation_agent_id(conversation)
    if scoped_agent_id:
        metadata_filter["agent_id"] = scoped_agent_id

    return metadata_filter


def search_uploaded_documents(query, metadata_filter):
    """Search uploaded PDFs using the caller's required metadata scope."""
    vectorstore = load_vectorstore()
    if not vectorstore:
        return "No documents have been uploaded in this conversation."

    results = vectorstore.similarity_search_with_score(query, k=3, filter=metadata_filter)
    if not results:
        return "No relevant documents found for your query."

    relevant = [doc.page_content.strip() for doc, _score in results if doc.page_content.strip()]

    if relevant:
        return "Relevant document content:\n" + "\n\n".join(relevant)

    return "No sufficiently relevant document content found."


def query_mentions_uploaded_documents(query):
    return bool(DOCUMENT_QUERY_PATTERN.search(query or ""))


def build_document_augmented_input(query, conversation, user, agent_id=None, conversation_type=None):
    if not query_mentions_uploaded_documents(query):
        return query

    metadata_filter = build_document_filter(
        conversation,
        user,
        agent_id=agent_id,
        conversation_type=conversation_type,
    )
    document_result = search_uploaded_documents(query, metadata_filter)
    return (
        "Document search was already performed for this chat before answering.\n"
        f"{document_result}\n\n"
        f"User question: {query}\n\n"
        "Use the document search result above when it contains relevant content. "
        "If no relevant document content was found, say that the uploaded documents in this chat did not contain matching information."
    )


def build_document_search_tool(conversation, user, agent_id=None, conversation_type=None):
    metadata_filter = build_document_filter(
        conversation,
        user,
        agent_id=agent_id,
        conversation_type=conversation_type,
    )

    def document_search(query: str) -> str:
        return search_uploaded_documents(query, metadata_filter)

    return Tool.from_function(
        func=document_search,
        name="document_search",
        description="Search uploaded PDF documents for relevant information in this chat only.",
    )
