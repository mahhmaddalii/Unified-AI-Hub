import os
import re
import base64
import binascii

from django.conf import settings
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import PGVector
from langchain_cohere import CohereEmbeddings
from dotenv import load_dotenv

from accounts.api.access import (
    authenticate_request_user,
    get_user_billing_profile,
    json_auth_required_response,
    model_requires_pro,
    sse_error_response,
    sse_token_limit_response,
)
from accounts.api.persistence import (
    attach_pending_assets_to_message,
    create_conversation,
    create_message,
    get_builtin_agent,
    get_recent_context_messages,
    get_user_conversation,
    list_user_conversations,
    rename_conversation,
    save_remote_image_asset,
    serialize_conversation,
    soft_delete_conversation,
    store_uploaded_assets,
    update_message,
)
from .documents import CONNECTION_STRING, COLLECTION_NAME
from .generate_image import image_generator
from .gemini import IMAGE_GENERATION_MODEL, generate_chat_title, get_bot_response, resolve_normal_chat_model

load_dotenv()
COHERE_API_KEY = os.getenv("COHERE_API_KEY")


def _get_embedding_client():
    return CohereEmbeddings(
        model="embed-english-v3.0",
        cohere_api_key=COHERE_API_KEY,
    )


@csrf_exempt
def conversations_view(request):
    if request.method != "GET":
        return JsonResponse({"error": "GET required"}, status=405)

    user = authenticate_request_user(request)
    if not user:
        return json_auth_required_response()

    conversations = list_user_conversations(user)
    payload = [serialize_conversation(conversation, request=request, include_messages=True) for conversation in conversations]
    return JsonResponse({"conversations": payload})


@csrf_exempt
def conversation_detail_view(request, conversation_id):
    user = authenticate_request_user(request)
    if not user:
        return json_auth_required_response()

    conversation = get_user_conversation(user, conversation_id)
    if not conversation:
        return JsonResponse({"error": "Conversation not found."}, status=404)

    if request.method == "DELETE":
        soft_delete_conversation(conversation)
        return JsonResponse({"status": "success"})

    if request.method == "PATCH":
        try:
            import json

            payload = json.loads(request.body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON payload."}, status=400)

        title = (payload.get("title") or "").strip()
        if title:
            rename_conversation(conversation, title)
        return JsonResponse({"conversation": serialize_conversation(conversation, request=request)})

    return JsonResponse({"error": "PATCH or DELETE required"}, status=405)


@csrf_exempt
def create_chat_view(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    user = authenticate_request_user(request)
    if not user:
        return json_auth_required_response()

    try:
        import json

        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        payload = {}

    builtin_agent = None
    agent_id = (payload.get("agent_id") or "").strip()
    if agent_id:
        builtin_agent = get_builtin_agent(agent_id)

    conversation = create_conversation(
        user,
        conversation_type=payload.get("conversation_type") or ("domain_agent" if builtin_agent else "normal"),
        agent=builtin_agent,
        title=payload.get("title") or "New Chat",
    )
    return JsonResponse({"chat_id": str(conversation.id)})


@csrf_exempt
def upload_document(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    user = authenticate_request_user(request)
    if not user:
        return json_auth_required_response()

    chat_id = (request.POST.get("chat_id") or "").strip()
    conversation = get_user_conversation(user, chat_id) if chat_id else None
    if not conversation:
        return JsonResponse({"error": "Valid chat_id is required."}, status=400)

    files = request.FILES.getlist("file")
    if not files:
        return JsonResponse({"error": "No PDF file uploaded"}, status=400)

    all_chunks = []
    stored_assets = store_uploaded_assets(user, conversation, files)

    for asset in stored_assets:
        full_path = asset.file.path
        loader = PyPDFLoader(full_path)
        documents = loader.load()
        splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=150)
        chunks = splitter.split_documents(documents)
        all_chunks.extend(chunks)

    if all_chunks:
        embeddings = _get_embedding_client()
        PGVector.from_documents(
            documents=all_chunks,
            embedding=embeddings,
            connection_string=CONNECTION_STRING,
            collection_name=COLLECTION_NAME,
            pre_delete_collection=False,
        )

    return JsonResponse({
        "message": "PDF processed and stored.",
        "assets": [str(asset.id) for asset in stored_assets],
    })


@csrf_exempt
def chat_view(request):
    if request.method != "GET":
        return JsonResponse({"error": "GET required for streaming"}, status=405)

    user = authenticate_request_user(request, allow_query_token=True)
    if not user:
        return sse_error_response("Authentication required. Please sign in again.")

    billing_profile = get_user_billing_profile(user, sync_remote=True)
    query = request.GET.get("text", "").strip()
    model_id = request.GET.get("model", "gpt5-nano").strip() or "gpt5-nano"
    chat_id = request.GET.get("chat_id", "").strip()
    is_first_message = request.GET.get("is_first_message", "false").lower() == "true"

    if not query:
        return JsonResponse({"error": "Empty message"}, status=400)

    conversation = get_user_conversation(user, chat_id)
    if not conversation:
        return sse_error_response("Conversation not found.")

    if model_requires_pro(model_id):
        if not billing_profile or not billing_profile.is_paid:
            return sse_error_response("Upgrade to Pro to use this model.")
        if billing_profile.token_total_used >= getattr(settings, "PAID_MONTHLY_TOKEN_QUOTA", 0):
            return sse_token_limit_response("Token limit reached. Please wait until subscription renewal.")

    previous_context = get_recent_context_messages(conversation, limit=10)
    user_message = create_message(
        conversation,
        role="user",
        user=user,
        content_text=query,
    )
    attach_pending_assets_to_message(conversation, user_message)

    chat_title = None
    if is_first_message and (conversation.title or "New Chat") == "New Chat":
        try:
            chat_title = generate_chat_title(query)
            rename_conversation(conversation, chat_title)
        except Exception as exc:
            print(f"Title generation failed: {exc}")
            chat_title = query[:30] + "..." if len(query) > 30 else query
            rename_conversation(conversation, chat_title)

    resolved_model_id = resolve_normal_chat_model(query, model_id)
    assistant_message = create_message(
        conversation,
        role="assistant",
        user=None,
        content_text="",
        status="streaming",
        model_used=resolved_model_id,
    )

    def event_stream():
        accumulated_text = ""
        try:
            if chat_title:
                yield f"data: [TITLE]{chat_title}\n\n"

            if resolved_model_id == IMAGE_GENERATION_MODEL:
                text_response, image_url = image_generator(query)
                final_text = text_response if text_response and text_response != "[No text response]" else "Here's your generated image:"
                update_message(
                    assistant_message,
                    content_text=final_text,
                    status="completed",
                    model_used=resolved_model_id,
                )

                local_image_url = None
                if image_url:
                    local_image_url = image_url
                    try:
                        asset = save_remote_image_asset(
                            user,
                            conversation,
                            assistant_message,
                            source_url=image_url,
                            prompt_text=query,
                        )
                        if asset and asset.file:
                            local_image_url = request.build_absolute_uri(asset.file.url)
                    except Exception as asset_error:
                        print(f"Image asset persistence failed: {asset_error}")
                        normalized_image = (image_url or "").strip()
                        if normalized_image and not normalized_image.startswith(("http://", "https://", "data:image/")):
                            try:
                                base64.b64decode(normalized_image, validate=True)
                                local_image_url = f"data:image/png;base64,{normalized_image}"
                            except (binascii.Error, ValueError):
                                local_image_url = None

                for token in re.findall(r"\S+\s*", final_text):
                    if token.strip():
                        yield f"data: {token.replace(chr(10), '\\n')}\n\n"
                if local_image_url:
                    yield f"data: [IMAGE]{local_image_url}\n\n"
                yield "data: [DONE]\n\n"
                return

            for chunk in get_bot_response(
                query,
                resolved_model_id,
                history_messages=previous_context,
                user=user,
                track_tokens=model_requires_pro(resolved_model_id),
            ):
                if chunk.strip():
                    accumulated_text += chunk
                    yield f"data: {chunk.replace(chr(10), '\\n')}\n\n"

            update_message(
                assistant_message,
                content_text=accumulated_text.strip(),
                status="completed",
                model_used=resolved_model_id,
            )
        except Exception as exc:
            update_message(
                assistant_message,
                content_text=accumulated_text.strip(),
                status="failed",
                model_used=resolved_model_id,
            )
            yield f"data: [ERROR]{str(exc)}\n\n"
        yield "data: [DONE]\n\n"

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Headers"] = "Cache-Control"
    return response
