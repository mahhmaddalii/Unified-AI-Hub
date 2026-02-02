import os
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import PGVector
from langchain_cohere import CohereEmbeddings
from .documents import CONNECTION_STRING, COLLECTION_NAME, load_vectorstore
from .gemini import get_bot_response
from .gemini import generate_chat_title
from .generate_image import image_generator
from dotenv import load_dotenv
import sys, re
from django.utils.encoding import force_str

load_dotenv()
COHERE_API_KEY = os.getenv("COHERE_API_KEY")

User = get_user_model()

def stream_yield(text: str):
    sys.stdout.flush()  # force flush to client
    return f"data: {force_str(text)}\n\n"

# ---------- RAG Endpoints ----------
@csrf_exempt
def upload_document(request):
    print("📥 upload_document HIT")
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    files = request.FILES.getlist("file")
    if not files:
        return JsonResponse({"error": "No PDF file uploaded"}, status=400)

    all_chunks = []

    for pdf_file in files:
        file_path = default_storage.save(pdf_file.name, pdf_file)
        full_path = os.path.join(settings.MEDIA_ROOT, file_path)


        loader = PyPDFLoader(full_path)
        documents = loader.load()
        splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=150)
        chunks = splitter.split_documents(documents)
        print(f"📄 {pdf_file.name} → {len(chunks)} chunks")
        all_chunks.extend(chunks)

    embeddings = CohereEmbeddings(
        model="embed-english-v3.0",
        cohere_api_key=COHERE_API_KEY
    )

    PGVector.from_documents(
        documents=all_chunks,
        embedding=embeddings,
        connection_string=CONNECTION_STRING,
        collection_name=COLLECTION_NAME,
        pre_delete_collection=False
    )
    print(all_chunks)
    return JsonResponse({"message": " PDF processed and embeddings stored."})

# views.py (only chat_view part shown — replace your current chat_view)





def _sse_chunk(text: str) -> str:
    """Return properly formatted SSE chunk."""
    if text == '':
        return ""
    else:
        # Send text as-is - frontend will handle formatting
        return f"data: {text}\n\n"

@csrf_exempt
def chat_view(request):
    """Handle streaming chat messages."""
    if request.method != "GET":
        return JsonResponse({"error": "GET required for streaming"}, status=405)

    query = request.GET.get("text", "").strip()
    model_id = request.GET.get("model", "gpt5-nano")
    chat_id = request.GET.get("chat_id", None)
    is_first_message = request.GET.get("is_first_message", "false").lower() == "true"

    if not query:
        return JsonResponse({"error": "Empty message"}, status=400)
    
    chat_title = None
    if is_first_message:
        try:
            chat_title = generate_chat_title(query)
            print(f"🎯 Generated title for new chat: {chat_title}")
        except Exception as e:
            print(f"⚠️ Title generation failed: {e}")
            # Fallback title
            chat_title = query[:30] + "..." if len(query) > 30 else query

    # Load vectorstore for RAG
    vectorstore = load_vectorstore()
    doc_context = ""

    # Retrieve similar documents if vectorstore is available
    if vectorstore:
        try:
            results = vectorstore.similarity_search_with_score(query, k=2)
            if results:
                top_doc, top_score = results[0]
                if top_score > 0.66:
                    doc_context = "\n\n".join([
                        doc.page_content for doc, score in results
                    ])
        except Exception as e:
            print(f"RAG error: {e}")

    # Enrich query with document excerpts (if any)
    enriched_query = (
        f"Here are some PDF excerpts:\n{doc_context}\n\nUser: {query}"
        if doc_context else query
    )

    # Stream response - SIMPLIFIED
    def event_stream():
     try:
        if is_first_message and chat_title:
            yield f"data: [TITLE]{chat_title}\n\n"
        # Special handling for Gemini 2.5 Flash Image
        if model_id == "gemini-2.5-flash-image":
            print("=== Generating Gemini 2.5 Image ===")
            
            try:
                text_response, image_url = image_generator(query)
                print(f"DEBUG: Text response length: {len(text_response) if text_response else 0}")
            except Exception as e:
                print(f"DEBUG: Image generation error: {str(e)}")
                yield f"data: [ERROR] Image generation failed: {str(e)}\n\n"
                yield "data: [DONE]\n\n"
                return

            # Step 1: Stream the text response token by token
            if text_response and text_response != "[No text response]":
                print("DEBUG: Streaming text response")
                # Split text into tokens for streaming
                tokens = re.findall(r'\S+\s*', text_response)
                print(f"DEBUG: Number of tokens: {len(tokens)}")
                
                for token in tokens:
                    if token.strip():
                        escaped_token = token.replace('\n', '\\n')
                        
                        yield f"data: {escaped_token}\n\n"
                        import time
                        time.sleep(0.05)
            else:
                print("DEBUG: No text response, sending default message")
                yield f"data: Here's your generated image:\n\n"
            
            # Step 2: Then send the image (if available)
            if image_url:
                yield f"data: [IMAGE]{image_url}\n\n"

            yield "data: [DONE]\n\n"
            return

        # Normal text streaming for all other models
        response_text = ""
        for chunk in get_bot_response(enriched_query, model_id, chat_id):
            response_text += chunk
        
        tokens = re.findall(r'\S+\s*', response_text)
        for token in tokens:
            if token.strip():
                escaped_token = token.replace('\n', '\\n')
                yield f"data: {escaped_token}\n\n"
                import time
                time.sleep(0.05)
                    
     except Exception as e:
        print(f"DEBUG: Error: {str(e)}")
        yield f"data: [ERROR] {str(e)}\n\n"
     yield "data: [DONE]\n\n"


    # Create streaming response with proper headers
    response = StreamingHttpResponse(
        event_stream(),
        content_type='text/event-stream'
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'  # Disable buffering for nginx
    response['Access-Control-Allow-Origin'] = '*'
    response['Access-Control-Allow-Headers'] = 'Cache-Control'
    return response

