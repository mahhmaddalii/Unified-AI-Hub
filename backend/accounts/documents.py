# backend/utils.py
import psycopg2
import os
from langchain_community.vectorstores import PGVector
from langchain_cohere import CohereEmbeddings
from dotenv import load_dotenv

load_dotenv()

CONNECTION_STRING = os.getenv("PGVECTOR_CONN_STRING", "postgresql+psycopg2://postgres:1234@localhost:5432/postgres")
COLLECTION_NAME = "my_pdf_embeddings"

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
