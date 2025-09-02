from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.contrib.auth import get_user_model


User = get_user_model()

@api_view(['POST'])
def signup_view(request):
    data = request.data
    first_name = data.get('firstName')
    last_name = data.get('lastName')
    email = data.get('email')
    password = data.get('password')
    confirm_password = data.get('confirmPassword')

    if password != confirm_password:
        return Response({'error': 'Passwords do not match'}, status=400)

    if User.objects.filter(email=email).exists():
        return Response({'error': 'Email already exists'}, status=400)

    user = User.objects.create_user(
        first_name=first_name,
        last_name=last_name,
        email=email,
        password=password
    )

    return Response({'message': 'Signup successful!'}, status=201)
