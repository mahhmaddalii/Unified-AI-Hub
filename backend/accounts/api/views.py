from datetime import timedelta
import json
import os
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.core.files.storage import default_storage
from django.core.mail import send_mail
from django.http import JsonResponse, HttpResponseRedirect
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import redirect
from urllib.parse import urlencode
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import SignupSerializer
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import PGVector
from langchain_cohere import CohereEmbeddings
from ..documents import CONNECTION_STRING, COLLECTION_NAME, load_vectorstore
from ..gemini import get_bot_response
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from dotenv import load_dotenv
from django.contrib.auth.decorators import login_required

load_dotenv()
COHERE_API_KEY = os.getenv("COHERE_API_KEY")

User = get_user_model()


# ---------- Signup ----------
@api_view(['POST'])
def signup_view(request):
    serializer = SignupSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        access = refresh.access_token
        return Response({
            'message': 'Signup successful!',
            'access': str(access),
            'refresh': str(refresh)
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------- Login ----------
@api_view(['POST'])
def login_view(request):
    email = request.data.get('email')
    password = request.data.get('password')
    remember = bool(request.data.get('remember'))

    user = authenticate(request, email=email, password=password)
    if user is None:
        return Response({'error': 'Invalid email or password'}, status=status.HTTP_401_UNAUTHORIZED)

    refresh = RefreshToken.for_user(user)
    access = refresh.access_token

    if remember:
        access.set_exp(lifetime=timedelta(days=1))
        refresh.set_exp(lifetime=timedelta(days=30))

    return Response({
        'message': 'Login successful',
        'access': str(access),
        'refresh': str(refresh),
    }, status=status.HTTP_200_OK)


# ---------- Forgot Password ----------
@api_view(['POST'])
def forgot_password_view(request):
    email = request.data.get('email')
    print(f"📧 Password reset requested for: {email}")
    
    if not email:
        return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email=email)
        print(f" User found: {user.email}")
    except User.DoesNotExist:
        print(f" User not found with email: {email}")
        return Response({'message': 'If this email exists, a reset link has been sent.'})

    token_generator = PasswordResetTokenGenerator()
    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
    token = token_generator.make_token(user)
    reset_link = f"http://localhost:3000/reset-password?uid={uidb64}&token={token}"

    print(f" Generated reset link: {reset_link}")
    print(f" Attempting to send email from: {settings.DEFAULT_FROM_EMAIL}")
    print(f" Using email host: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}")

    try:
        send_mail(
            subject="Password Reset Request",
            message=f"Click this link to reset your password: {reset_link}\n\n"
                   f"This link will expire in 24 hours.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
        print(f" Email sent successfully to: {email}")
        return Response({'message': 'Password reset email sent.'}, status=200)
    except Exception as e:
        print(f" EMAIL ERROR: {str(e)}")
        print(f" Email host: {settings.EMAIL_HOST}")
        print(f" Email port: {settings.EMAIL_PORT}")
        print(f" Email user: {settings.EMAIL_HOST_USER}")
        return Response({'error': f'Failed to send email. Please try again later.'}, status=500)


# ---------- Google OAuth ----------
@login_required
def google_post_login(request):
    """Return JWT tokens after successful Google login and redirect to frontend"""
    user = request.user
    refresh = RefreshToken.for_user(user)
    
    # Create token data
    token_data = {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "email": user.email,
        "success": "true"
    }
    
    # Redirect back to frontend with tokens as URL parameters
    frontend_url = "http://localhost:3000/login"
    query_string = urlencode(token_data)
    redirect_url = f"{frontend_url}?{query_string}"
    
    return HttpResponseRedirect(redirect_url)


# ---------- RAG Endpoints ----------
@csrf_exempt
def upload_document(request):
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


@csrf_exempt
def chat_view(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    data = json.loads(request.body)
    query = data.get("text", "").strip()
    if not query:
        return JsonResponse({"error": "Empty message"}, status=400)

    vectorstore = load_vectorstore()
    doc_context = ""
    if vectorstore:
        results = vectorstore.similarity_search_with_score(query, k=2)
        if results:
            top_doc, top_score = results[0]
            if top_score > 0.66:
                doc_context = "\n\n".join([doc.page_content for doc, score in results])

    if doc_context:
        enriched_query = (
            f"You are a helpful assistant.\n\n"
            f"Here are some PDF excerpts that *might* help:\n{doc_context}\n\n"
            f"User's question: {query}\n\n"
            f"If the excerpts are relevant, use them. If not, ignore them and answer normally."
        )
        response = get_bot_response(enriched_query)
    else:
        response = get_bot_response(query)

    return JsonResponse({"response": response})